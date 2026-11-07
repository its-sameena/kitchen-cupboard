// Runs the Supabase migration in PGlite with a stubbed `auth` schema and exercises
// the main flows as different devices/profiles with RLS enforced.
// Usage: npm run test:db
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const db = new PGlite()
const SETUP = `
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  create publication supabase_realtime;
`
await db.exec(SETUP)
const dir = new URL('../supabase/migrations/', import.meta.url)
const files = readdirSync(dir).sort()
const migrate = async (target = db, from = 0, to = files.length) => {
  for (const f of files.slice(from, to)) await target.exec(readFileSync(new URL(f, dir), 'utf8'))
}
await migrate()

// Devices = anonymous auth users. Phone 1 & 2 share the kitchen; outsider has its own.
const [P1, P2, P3, OUT] = ['a', 'b', 'c', 'd'].map((c) => `0000000${c}-0000-4000-8000-000000000000`)
await db.exec(`insert into auth.users values ('${P1}'),('${P2}'),('${P3}'),('${OUT}')`)

async function as(device, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${device}', false); set role authenticated;`)
  try { return (await db.query(sql, params)).rows } finally { await db.exec('reset role') }
}
const one = async (d, sql, p) => (await as(d, sql, p))[0]
const fails = async (d, sql, p, re) => {
  try { await as(d, sql, p) } catch (e) { if (re) assert.match(e.message, re); return e.message }
  throw new Error('expected failure: ' + sql)
}

// Kitchen setup + invite code
const { create_kitchen: k } = await one(P1, `select create_kitchen('Flat 4')`)
await fails(P1, `select create_kitchen('Again')`, [], /already/)
const { invite_code } = await one(P1, `select invite_code from kitchens`)
await one(P2, `select join_kitchen($1)`, [invite_code.toLowerCase()])
await fails(P3, `select join_kitchen('ZZZZZZ')`, [], /No kitchen/)
await fails(P3, `select create_profile('Lurker', '#000000')`, [], /not in a kitchen/)

// Profiles (Netflix-style): created on any device, visible on all
const profile = async (d, name, color) => (await one(d, `select create_profile($1, $2) r`, [name, color])).r
const A = (await profile(P1, 'Alex', '#e4572e')).member_id
const S = (await profile(P1, 'Sam', '#2e86de')).member_id
const J = (await profile(P2, 'Jordan', '#2fa84f')).member_id
await fails(P2, `select create_profile('alex', '#123456')`, [], /already a profile/)
// Colours are unique per kitchen (case-insensitive), on create and on later changes
await fails(P2, `select create_profile('Morgan', '#E4572E')`, [], /Alex already uses that colour/)
await fails(P2, `update members set color = '#2e86de' where id = $1`, [J], /members_unique_color/)
assert.equal((await as(P2, `select * from members`)).length, 3)
await one(OUT, `select create_kitchen('Other')`)
const X = (await profile(OUT, 'Xavier', '#000000')).member_id
assert.equal((await as(OUT, `select * from members`)).length, 1, 'outsider only sees own kitchen')
await fails(OUT, `select add_item($1, 'Salt', 'flask-round', 'spices')`, [A], /Profile not found/)
await fails(P1, `select add_item($1, 'Salt', 'flask-round', 'spices')`, [X], /Profile not found/)

// Cereals shelf is a valid shelf; made-up shelves are not
await as(P1, `select add_item($1, 'Granola', 'soup', 'cereals')`, [A])
assert.equal((await one(P1, `select category from items where name = 'Granola'`)).category, 'cereals')
await fails(P1, `select add_item($1, 'Thing', 'package', 'cupboard-top')`, [A], /items_category_check/)
await as(P1, `delete from items where name = 'Granola'`)

// Items, xN owners, dedupe by name
await as(P1, `select add_item($1, 'Salt', 'flask-round', 'spices')`, [A])
await as(P2, `select add_item($1, ' salt ', 'flask-round', 'spices')`, [S])
let salt = await one(P2, `select * from items where name = 'Salt'`)
assert.equal(salt.owners.length, 2)
await as(P2, `select have_it_too($1, $2)`, [J, salt.id])
await as(P2, `select have_it_too($1, $2)`, [J, salt.id])
salt = await one(P1, `select * from items where id = $1`, [salt.id])
assert.equal(salt.owners.length, 3, 'have_it_too is idempotent')

// Per-person running out
assert.equal((await one(P1, `select ran_out($1, $2) e`, [A, salt.id])).e, null)
await as(P1, `select ran_out($1, $2)`, [S, salt.id])
const ev = await one(P2, `select ran_out($1, $2) e`, [J, salt.id])
assert.ok(ev.e, 'last one out creates an event')
assert.equal((await as(P1, `select * from grocery`)).length, 1)

// Direct writes are blocked
await fails(P1, `insert into items (kitchen_id, name, category) values ($1, 'Hack', 'other')`, [k])
await fails(P1, `update items set owners = '{}'`, [], /permission/)
await fails(P1, `insert into events (kitchen_id, type, actor_id, title) values ($1, 'x', $2, 'fake')`, [k, A])
await fails(P1, `select _restock($1, 'x', 'x', 'other', null, $2)`, [k, A], /permission/)
await fails(P1, `update members set kitchen_id = gen_random_uuid()`, [], /permission/)
await fails(P1, `update feedback set status = 'done'`, [], /permission/)
await as(P1, `update members set color = '#9b59b6' where id = $1`, [A])
await as(P1, `update members set color = '#e4572e' where id = $1`, [A]) // back to own colour is fine
// Avatars: any phone in the kitchen can set/clear one; must be a small JSON object
const av = { plant: 'cactus', pot: 'bowl', pattern: null, cheeks: 'blush', eyes: 'happy', mouth: 'grin', potColor: '#fca5a5', plantColor: '#22c55e', bloomColor: '#fcd34d' }
await as(P2, `update members set avatar = $2 where id = $1`, [J, JSON.stringify(av)])
assert.deepEqual((await one(P1, `select avatar from members where id = $1`, [J])).avatar, av)
await fails(P2, `update members set avatar = '"cactus"' where id = $1`, [J], /check constraint/)
await fails(P2, `update members set avatar = $2 where id = $1`, [J, JSON.stringify({ junk: 'x'.repeat(2000) })], /check constraint/)
await as(OUT, `update members set avatar = null where id = $1`, [J]) // other kitchens can't touch it (RLS filters)
assert.ok((await one(P1, `select avatar from members where id = $1`, [J])).avatar)
await as(P2, `update members set avatar = null where id = $1`, [J])
assert.equal((await one(P1, `select avatar from members where id = $1`, [J])).avatar, null)
await as(OUT, `update members set name = 'Hacked' where id = $1`, [S]) // filtered out by RLS
assert.equal((await one(P1, `select name from members where id = $1`, [S])).name, 'Sam')

// Grocery run
assert.ok((await one(P2, `select start_run($1, 'Tesco') e`, [S])).e)
await fails(P1, `select start_run($1, 'Lidl')`, [A], /Sam is already/)
const saltEntry = await one(P1, `select id from grocery where name = 'Salt'`)
const req = await one(P1, `select request_entry($1, $2) e`, [A, saltEntry.id])
assert.deepEqual((await one(P1, `select targets from events where id = $1`, [req.e])).targets, [S])
await as(P2, `select add_grocery($1, 'Oat milk', 'milk', 'dairy', null)`, [J])
await as(P2, `select add_grocery($1, 'oat milk', 'milk', 'dairy', null)`, [J])
assert.equal((await as(P2, `select * from grocery`)).length, 2)
await fails(P1, `select toggle_got($1, $2)`, [A, saltEntry.id], /Only the shopper/)
for (const g of await as(P2, `select id from grocery`)) await as(P2, `select toggle_got($1, $2)`, [S, g.id])
await as(P2, `select add_grocery($1, 'Bin bags', 'spray-can', 'other', null)`, [S])
const end = await one(P2, `select end_run($1) e`, [S])
assert.match((await one(P1, `select body from events where id = $1`, [end.e])).body, /Picked up: .*Salt/)
assert.deepEqual((await one(P1, `select owners from items where name = 'Salt'`)).owners, [A], 'request → requester')
assert.deepEqual((await one(P1, `select owners from items where name = 'Oat milk'`)).owners, [J])
assert.deepEqual((await as(P1, `select name from grocery`)).map((r) => r.name), ['Bin bags'])

// Bought outside a run
await as(P1, `select mark_bought($1, (select id from grocery limit 1))`, [A])
assert.deepEqual((await one(P1, `select owners from items where name = 'Bin bags'`)).owners, [A])

// Event text is plain (no emoji) since it doubles as push notification text
for (const e of await as(P1, `select title, body from events`)) {
  assert.doesNotMatch(e.title + e.body, /\p{Extended_Pictographic}/u, `emoji in event: ${e.title}`)
}

// Feedback
const fid = (await one(P2, `select submit_feedback($1, 'idea', 'Barcode scanner pls', '{"tab":"cupboard"}') f`, [J])).f
const fb = await one(P1, `select * from feedback where id = $1`, [fid])
assert.equal(fb.member_name, 'Jordan')
assert.equal(fb.status, 'new')
assert.equal((await as(OUT, `select * from feedback`)).length, 0, 'feedback is private to the kitchen')
await fails(P1, `select submit_feedback($1, 'rant', 'x')`, [A])
// Developer (service role / owner) updates status + reply
await db.query(`update feedback set status = 'done', reply = 'Added in v0.3' where id = $1`, [fid])
assert.equal((await one(P2, `select status from feedback where id = $1`, [fid])).status, 'done')

// Only the author can edit / delete their feedback
await fails(P1, `select update_feedback($1, $2, 'bug', 'hijack')`, [A, fid], /only edit your own/)
await fails(P1, `select delete_feedback($1, $2)`, [A, fid], /only delete your own/)
await fails(OUT, `select update_feedback($1, $2, 'bug', 'x')`, [X, fid], /only edit your own/)
await as(P1, `select update_feedback($1, $2, 'bug', '  Scanner keeps crashing  ')`, [J, fid])
const edited = await one(P2, `select * from feedback where id = $1`, [fid])
assert.equal(edited.message, 'Scanner keeps crashing')
assert.equal(edited.kind, 'bug')
assert.ok(edited.edited_at, 'edited_at set')
assert.equal(edited.status, 'done', 'editing keeps the developer status')
const fid2 = (await one(P1, `select submit_feedback($1, 'other', 'temp') f`, [A])).f
await as(P1, `select delete_feedback($1, $2)`, [A, fid2])
assert.equal((await as(P1, `select * from feedback where id = $1`, [fid2])).length, 0)

// Push subscriptions are per device and must point at a profile in the kitchen
await as(P1, `insert into push_subscriptions (endpoint, kitchen_id, member_id, p256dh, auth) values ('https://push/a', $1, $2, 'k', 's')`, [k, A])
await fails(P1, `insert into push_subscriptions (endpoint, kitchen_id, member_id, p256dh, auth) values ('https://push/x', $1, $2, 'k', 's')`, [k, X])
assert.equal((await as(P2, `select * from push_subscriptions`)).length, 0)

// Deleting a profile, forgetting a device
await as(P2, `select delete_profile($1)`, [J])
assert.equal((await as(P1, `select * from members`)).length, 2)
assert.deepEqual((await one(P1, `select owners from items where name = 'Oat milk'`)).owners, [])
await as(P1, `select forget_device()`)
assert.equal((await as(P1, `select * from items`)).length, 0, 'forgotten device sees nothing')
assert.equal((await as(P2, `select * from items`)).length, 3, 'kitchen data remains')

// reset.sql removes everything so the migration can be re-run
await db.exec(readFileSync(new URL('../supabase/reset.sql', import.meta.url), 'utf8'))
await db.exec('drop publication supabase_realtime; create publication supabase_realtime;')
await migrate()

// Upgrading a database that has emoji data from the first migration
const old = new PGlite()
await old.exec(SETUP)
await migrate(old, 0, 1)
await old.exec(`
  insert into kitchens (id, name) values ('00000000-0000-4000-8000-0000000000aa', 'K');
  insert into items (kitchen_id, name, emoji, category) values
    ('00000000-0000-4000-8000-0000000000aa', 'Salt', '🧂', 'spices'),
    ('00000000-0000-4000-8000-0000000000aa', 'Chilli', '🌶️', 'spices'),
    ('00000000-0000-4000-8000-0000000000aa', 'Mystery', '🦄', 'other'),
    ('00000000-0000-4000-8000-0000000000aa', 'Porridge oats', '🥣', 'grains'),
    ('00000000-0000-4000-8000-0000000000aa', 'Brown rice', '🍚', 'grains');
  insert into grocery (kitchen_id, name, emoji) values ('00000000-0000-4000-8000-0000000000aa', 'Soap', '🧻');
  insert into members (kitchen_id, name, color, joined_at) values
    ('00000000-0000-4000-8000-0000000000aa', 'First', '#e4572e', now() - interval '2 days'),
    ('00000000-0000-4000-8000-0000000000aa', 'Second', '#E4572E', now() - interval '1 day'),
    ('00000000-0000-4000-8000-0000000000aa', 'Third', '#2e86de', now());
  insert into events (kitchen_id, type, actor_id, title, body)
    values ('00000000-0000-4000-8000-0000000000aa', 'run_started', gen_random_uuid(), '🛒 Sam is going grocery shopping', 'Say hi 👋');
`)
await migrate(old, 1)
const icons = Object.fromEntries((await old.query(`select name, emoji from items`)).rows.map((r) => [r.name, r.emoji]))
assert.equal(icons.Salt, 'flask-round')
assert.equal(icons.Chilli, 'flame')
assert.equal(icons.Mystery, 'package')
// Cereals shelf: obvious cereals move off "grains", everything else stays
const shelves = Object.fromEntries((await old.query(`select name, category from items`)).rows.map((r) => [r.name, r.category]))
assert.equal(shelves['Porridge oats'], 'cereals')
assert.equal(shelves['Brown rice'], 'grains')
assert.equal((await old.query(`select emoji from grocery`)).rows[0].emoji, 'spray-can')
const cols = Object.fromEntries((await old.query(`select name, color from members`)).rows.map((r) => [r.name, r.color]))
assert.equal(cols.First, '#e4572e', 'earliest profile keeps its colour')
assert.notEqual(cols.Second.toLowerCase(), '#e4572e', 'duplicate gets a new colour')
assert.equal(new Set(Object.values(cols).map((c) => c.toLowerCase())).size, 3)
assert.deepEqual((await old.query(`select title, body from events`)).rows[0], { title: 'Sam is going grocery shopping', body: 'Say hi' })

console.log('All database checks passed ✔')
