/**
 * Kitchen store backed by Supabase.
 *
 * Access: each phone signs in with Supabase anonymous auth (no email/password),
 * joins a kitchen once, then picks a housemate profile (remembered per device).
 *
 * - Reads: a snapshot of the device's kitchen (RLS limits every query to it),
 *   refreshed whenever Supabase Realtime reports a change.
 * - Writes: Postgres RPCs taking `p_me` (the chosen profile), so multi-step
 *   changes are atomic. RPCs that create a kitchen event return its id, which
 *   is handed to the `notify` edge function to send Web Push.
 */
import { useSyncExternalStore } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { isConfigured, sb } from './supabase'
import type { CategoryId, FeedbackKind, GroceryEntry, Item, KitchenEvent, KitchenState, User } from './types'

export type Status = 'unconfigured' | 'loading' | 'offline' | 'no_kitchen' | 'pick_profile' | 'ready'

interface AppState {
  status: Status
  /** Anonymous auth user = this device. */
  deviceId: string | null
  /** The housemate profile chosen on this device. */
  profileId: string | null
  kitchen: KitchenState | null
  error: string | null
}

const PROFILE_KEY = 'kitchen-cupboard:profile'

function rememberedProfile(kitchenId: string): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}')
    return saved[kitchenId] ?? null
  } catch {
    return null
  }
}

function rememberProfile(kitchenId: string, memberId: string | null) {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}')
    if (memberId) saved[kitchenId] = memberId
    else delete saved[kitchenId]
    localStorage.setItem(PROFILE_KEY, JSON.stringify(saved))
  } catch {
    /* private mode: profile is asked again next launch */
  }
}

let app: AppState = {
  status: isConfigured ? 'loading' : 'unconfigured',
  deviceId: null,
  profileId: null,
  kitchen: null,
  error: null,
}

const listeners = new Set<() => void>()
const eventListeners = new Set<(events: KitchenEvent[]) => void>()

function set(patch: Partial<AppState>) {
  app = { ...app, ...patch }
  listeners.forEach((l) => l())
}

export function subscribe(l: () => void) {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/** New events by other housemates, as they arrive (for in-app toasts). */
export function onNewEvents(l: (events: KitchenEvent[]) => void) {
  eventListeners.add(l)
  return () => void eventListeners.delete(l)
}

export const getApp = () => app
export const getMe = () => app.profileId

export function useApp() {
  return useSyncExternalStore(subscribe, getApp)
}

/** Only call inside screens rendered once a kitchen is loaded. */
export function useKitchen(): KitchenState {
  return useApp().kitchen!
}

export function useMe(): User | null {
  const a = useApp()
  return a.kitchen?.users.find((u) => u.id === a.profileId) ?? null
}

export function clearError() {
  set({ error: null })
}

// ───────────────────────── loading ─────────────────────────

const ms = (t: string | null | undefined) => (t ? Date.parse(t) : 0)

async function fetchKitchen(): Promise<KitchenState | null> {
  const kitchen = await sb.from('kitchens').select('*').maybeSingle()
  if (kitchen.error) throw kitchen.error
  if (!kitchen.data) return null
  const [members, items, grocery, runs, events, feedback] = await Promise.all([
    sb.from('members').select('*').order('joined_at'),
    sb.from('items').select('*'),
    sb.from('grocery').select('*').order('added_at'),
    sb.from('runs').select('*').order('started_at', { ascending: false }).limit(10),
    sb.from('events').select('*').order('at', { ascending: false }).limit(150),
    sb.from('feedback').select('*').order('created_at', { ascending: false }).limit(100),
  ])
  for (const r of [members, items, grocery, runs, events, feedback]) if (r.error) throw r.error
  const k = kitchen.data
  return {
    kitchenId: k.id,
    kitchenName: k.name,
    inviteCode: k.invite_code,
    users: members.data!.map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      seenAt: ms(m.seen_at),
      createdAt: ms(m.joined_at),
    })),
    items: items.data!.map((i) => ({
      id: i.id,
      name: i.name,
      icon: i.emoji,
      category: i.category,
      owners: i.owners ?? [],
      createdBy: i.created_by,
      updatedAt: ms(i.updated_at),
    })),
    grocery: grocery.data!.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.emoji,
      category: g.category,
      itemId: g.item_id ?? undefined,
      addedBy: g.added_by,
      forUser: g.for_user ?? undefined,
      runId: g.run_id ?? undefined,
      gotBy: g.got_by ?? undefined,
      addedAt: ms(g.added_at),
    })),
    runs: runs.data!.reverse().map((r) => ({
      id: r.id,
      shopperId: r.shopper_id,
      store: r.store,
      startedAt: ms(r.started_at),
      endedAt: r.ended_at ? ms(r.ended_at) : undefined,
    })),
    events: events.data!.reverse().map((e) => ({
      id: e.id,
      type: e.type,
      actorId: e.actor_id,
      targets: e.targets ?? undefined,
      title: e.title,
      body: e.body,
      at: ms(e.at),
    })),
    feedback: feedback.data!.map((f) => ({
      id: f.id,
      memberId: f.member_id ?? undefined,
      memberName: f.member_name,
      kind: f.kind,
      message: f.message,
      status: f.status,
      reply: f.reply ?? undefined,
      editedAt: f.edited_at ? ms(f.edited_at) : undefined,
      createdAt: ms(f.created_at),
      updatedAt: ms(f.updated_at),
    })),
  }
}

let refreshing: Promise<void> | null = null
let dirty = false
let refreshTimer: ReturnType<typeof setTimeout> | undefined

export async function refresh(): Promise<void> {
  if (!app.deviceId) return
  if (refreshing) {
    dirty = true
    return refreshing
  }
  refreshing = (async () => {
    do {
      dirty = false
      try {
        const prev = app.kitchen
        const next = await fetchKitchen()
        if (!next) {
          setChannel(null)
          set({ status: 'no_kitchen', kitchen: null, profileId: null })
          continue
        }
        // Keep the chosen profile if it still exists; otherwise ask again.
        const wanted = app.profileId ?? rememberedProfile(next.kitchenId)
        const profileId = next.users.some((u) => u.id === wanted) ? wanted : null
        if (wanted && !profileId) rememberProfile(next.kitchenId, null)

        if (profileId && prev && prev.kitchenId === next.kitchenId) {
          const seen = new Set(prev.events.map((e) => e.id))
          const fresh = eventsFor(next, profileId).filter((e) => !seen.has(e.id))
          if (fresh.length) eventListeners.forEach((l) => l(fresh))
        }
        set({ status: profileId ? 'ready' : 'pick_profile', kitchen: next, profileId })
        setChannel(next.kitchenId)
      } catch (e) {
        const fatal = !app.kitchen && app.status === 'loading'
        set({ error: messageOf(e), status: fatal ? 'offline' : app.status })
      }
    } while (dirty)
  })()
  try {
    await refreshing
  } finally {
    refreshing = null
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => void refresh(), 120)
}

// ───────────────────────── realtime ─────────────────────────

let channel: RealtimeChannel | null = null
let channelKitchen: string | null = null

function setChannel(kitchenId: string | null) {
  if (kitchenId === channelKitchen) return
  if (channel) void sb.removeChannel(channel)
  channel = null
  channelKitchen = kitchenId
  if (!kitchenId) return
  // RLS limits inserts/updates to our kitchen; deletes only carry ids, so any delete triggers a refresh.
  channel = sb.channel(`kitchen:${kitchenId}`)
  for (const table of ['kitchens', 'members', 'items', 'grocery', 'runs', 'events', 'feedback']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh)
  }
  channel.subscribe((status) => {
    // Catch up on anything missed while the socket was down.
    if (status === 'SUBSCRIBED') scheduleRefresh()
  })
}

/** Sign this device in anonymously (once; Supabase keeps the session), then load. */
export async function boot() {
  if (!isConfigured) return
  set({ status: 'loading', error: null })
  try {
    let { data } = await sb.auth.getSession()
    if (!data.session) {
      const res = await sb.auth.signInAnonymously()
      if (res.error) {
        throw new Error(
          /anonymous/i.test(res.error.message)
            ? 'Anonymous sign-ins are turned off. Enable them in Supabase → Authentication → Sign In / Providers.'
            : res.error.message,
        )
      }
      data = { session: res.data.session! }
    }
    set({ deviceId: data.session!.user.id })
    await refresh()
  } catch (e) {
    set({ status: 'offline', error: messageOf(e) })
  }
}

if (isConfigured && typeof window !== 'undefined') {
  void boot()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleRefresh()
  })
  window.addEventListener('online', () => (app.status === 'offline' ? void boot() : scheduleRefresh()))
}

// ───────────────────────── helpers ─────────────────────────

function messageOf(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

export function activeRun(s: KitchenState) {
  return s.runs.find((r) => !r.endedAt) ?? null
}

/** Events meant for `profileId` (everything they didn't do themselves, or targeted at them). */
export function eventsFor(s: KitchenState, profileId: string) {
  return s.events.filter((e) => (e.targets ? e.targets.includes(profileId) : e.actorId !== profileId))
}

async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw error
  return data as T
}

/** RPC acting as the chosen profile. */
function rpcMe<T = unknown>(fn: string, args: Record<string, unknown> = {}) {
  return rpc<T>(fn, { p_me: app.profileId, ...args })
}

/** Ask the edge function to push this event to the other housemates. Best-effort. */
function pushEvent(eventId: unknown) {
  if (typeof eventId !== 'string') return
  sb.functions.invoke('notify', { body: { event_id: eventId } }).catch(() => {})
}

const check = ({ error }: { error: unknown }) => {
  if (error) throw error
}

/** Fire-and-forget action: shows errors as a toast, pushes any event, then refreshes. */
function act(p: PromiseLike<unknown>) {
  Promise.resolve(p)
    .then(pushEvent)
    .catch((e) => set({ error: messageOf(e) }))
    .finally(() => void refresh())
}

// ───────────────────────── kitchen & profiles ─────────────────────────

export async function createKitchen(kitchenName: string) {
  await rpc('create_kitchen', { p_kitchen: kitchenName })
  await refresh()
}

export async function joinKitchen(code: string) {
  await rpc('join_kitchen', { p_code: code })
  await refresh()
}

/** Disconnect this phone from the kitchen (data and profiles stay). */
export async function forgetDevice() {
  const { unsubscribePush } = await import('./notify')
  await unsubscribePush().catch(() => {})
  if (app.kitchen) rememberProfile(app.kitchen.kitchenId, null)
  await rpc('forget_device')
  set({ profileId: null })
  await refresh()
}

export function selectProfile(memberId: string | null) {
  if (app.kitchen) rememberProfile(app.kitchen.kitchenId, memberId)
  set({ profileId: memberId, status: memberId ? 'ready' : 'pick_profile' })
}

export async function createProfile(name: string, color: string) {
  const res = await rpc<{ member_id: string; event_id: string }>('create_profile', { p_name: name, p_color: color })
  await refresh()
  selectProfile(res.member_id)
  pushEvent(res.event_id)
}

export function updateProfile(patch: { name?: string; color?: string }) {
  const row: Record<string, string> = {}
  if (patch.name?.trim()) row.name = patch.name.trim()
  if (patch.color) row.color = patch.color
  act(sb.from('members').update(row).eq('id', app.profileId!).then(check))
}

export async function deleteProfile() {
  await rpcMe('delete_profile')
  selectProfile(null)
  await refresh()
}

export function markSeen() {
  const k = app.kitchen
  const latest = k?.events.at(-1)?.at ?? 0
  const me = k?.users.find((u) => u.id === app.profileId)
  if (!me || me.seenAt >= latest) return
  act(sb.from('members').update({ seen_at: new Date(latest).toISOString() }).eq('id', me.id).then(check))
}

export function setKitchenName(name: string) {
  if (!name.trim() || !app.kitchen) return
  act(sb.from('kitchens').update({ name: name.trim() }).eq('id', app.kitchen.kitchenId).then(check))
}

// ───────────────────────── cupboard ─────────────────────────

export function addItem(input: { name: string; icon: string; category: CategoryId }) {
  act(rpcMe('add_item', { p_name: input.name, p_emoji: input.icon, p_category: input.category }))
}

export function haveItToo(itemId: string) {
  act(rpcMe('have_it_too', { p_item: itemId }))
}

/** Remove my copy. If nobody has it any more, it goes onto the grocery list. */
export function ranOut(itemId: string) {
  act(rpcMe('ran_out', { p_item: itemId }))
}

export function updateItem(itemId: string, patch: Pick<Item, 'name' | 'icon' | 'category'>) {
  act(rpcMe('update_item', { p_item: itemId, p_name: patch.name, p_emoji: patch.icon, p_category: patch.category }))
}

export function deleteItem(itemId: string) {
  act(sb.from('items').delete().eq('id', itemId).then(check))
}

// ───────────────────────── grocery list ─────────────────────────

export function addGrocery(input: Pick<GroceryEntry, 'name' | 'icon' | 'category' | 'itemId'>) {
  act(
    rpcMe('add_grocery', {
      p_name: input.name,
      p_emoji: input.icon,
      p_category: input.category,
      p_item: input.itemId ?? null,
    }),
  )
}

/** Ask the current shopper to pick up an entry that's already on the list. */
export function requestEntry(entryId: string) {
  act(rpcMe('request_entry', { p_entry: entryId }))
}

export function unrequestEntry(entryId: string) {
  act(rpcMe('unrequest_entry', { p_entry: entryId }))
}

export function removeGrocery(entryId: string) {
  act(sb.from('grocery').delete().eq('id', entryId).then(check))
}

/** Bought outside of a run: goes straight back into the cupboard. */
export function markBought(entryId: string) {
  act(rpcMe('mark_bought', { p_entry: entryId }))
}

// ───────────────────────── grocery runs ─────────────────────────

export function startRun(store: string) {
  act(rpcMe('start_run', { p_store: store }))
}

/** Shopper ticks an item into the basket (or back out). */
export function toggleGot(entryId: string) {
  // Optimistic tick so the checkbox feels instant while shopping.
  if (app.kitchen) {
    set({
      kitchen: {
        ...app.kitchen,
        grocery: app.kitchen.grocery.map((g) =>
          g.id === entryId ? { ...g, gotBy: g.gotBy ? undefined : app.profileId! } : g,
        ),
      },
    })
  }
  act(rpcMe('toggle_got', { p_entry: entryId }))
}

export function endRun() {
  act(rpcMe('end_run'))
}

// ───────────────────────── feedback ─────────────────────────

export async function submitFeedback(kind: FeedbackKind, message: string, context: Record<string, unknown>) {
  await rpcMe('submit_feedback', { p_kind: kind, p_message: message, p_context: context })
  await refresh()
}

/** Only the author can edit their feedback (enforced in the database). */
export async function updateFeedback(id: string, kind: FeedbackKind, message: string) {
  await rpcMe('update_feedback', { p_id: id, p_kind: kind, p_message: message })
  await refresh()
}

export async function deleteFeedback(id: string) {
  await rpcMe('delete_feedback', { p_id: id })
  await refresh()
}
