// Sends Web Push for a kitchen event to the housemates it concerns.
// Called by the app right after an RPC creates the event: POST { event_id }.
// The caller's device must belong to the event's kitchen; each event is pushed once.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const { data: auth } = await admin.auth.getUser(token)
  if (!auth?.user) return json({ error: 'Not signed in' }, 401)

  const { event_id } = await req.json().catch(() => ({}))
  if (typeof event_id !== 'string') return json({ error: 'event_id required' }, 400)

  const { data: device } = await admin.from('devices').select('kitchen_id').eq('user_id', auth.user.id).maybeSingle()
  if (!device) return json({ error: 'Device not in a kitchen' }, 403)

  // Claim the event atomically so retries / duplicate calls don't double-push.
  const { data: ev } = await admin
    .from('events')
    .update({ pushed: true })
    .eq('id', event_id)
    .eq('kitchen_id', device.kitchen_id)
    .eq('pushed', false)
    .gte('at', new Date(Date.now() - 2 * 60_000).toISOString())
    .select('*')
    .maybeSingle()
  if (!ev) return json({ sent: 0, skipped: true })

  let recipients: string[] = ev.targets ?? []
  if (!ev.targets) {
    const { data: members } = await admin.from('members').select('id').eq('kitchen_id', ev.kitchen_id)
    recipients = (members ?? []).map((m) => m.id).filter((id) => id !== ev.actor_id)
  }
  if (!recipients.length) return json({ sent: 0 })

  const { data: subs } = await admin.from('push_subscriptions').select('*').in('member_id', recipients)
  const tab = ev.type === 'run_started' || ev.type === 'request' ? 'grocery' : 'cupboard'
  const payload = JSON.stringify({ title: ev.title, body: ev.body, tag: ev.id, url: `/?tab=${tab}` })

  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60,
          urgency: 'high',
        })
        sent++
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode
        // Subscription expired or revoked: forget it.
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        else console.error('push failed', code, (err as Error).message)
      }
    }),
  )
  return json({ sent })
})
