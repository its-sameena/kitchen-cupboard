import { sb } from './supabase'

export type NotifyPermission = NotificationPermission | 'unsupported'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function pushSupported() {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID
}

export function notifyPermission(): NotifyPermission {
  return pushSupported() ? Notification.permission : 'unsupported'
}

/** True on iPhone/iPad when not launched from the Home Screen (push unavailable). */
export function needsInstallForNotifications() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios && !standalone
}

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Subscribe this device to Web Push for the chosen profile and store it in Supabase. */
export async function subscribePush(kitchenId: string, memberId: string) {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID!) }))
  const json = sub.toJSON()
  const { error } = await sb.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    kitchen_id: kitchenId,
    member_id: memberId,
    updated_at: new Date().toISOString(),
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  })
  if (error) {
    // Endpoint registered by an older session on this device: start fresh next time.
    await sub.unsubscribe()
    return false
  }
  return true
}

export async function requestNotifyPermission(kitchenId: string, memberId: string): Promise<NotifyPermission> {
  if (!pushSupported()) return 'unsupported'
  let p: NotificationPermission
  try {
    p = await Notification.requestPermission()
  } catch {
    p = Notification.permission
  }
  if (p === 'granted') await subscribePush(kitchenId, memberId).catch(() => false)
  return p
}

/** When this phone leaves the kitchen: stop pushes to it. */
export async function unsubscribePush() {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
