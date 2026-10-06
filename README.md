# AI Wellness Twin

A private work-pattern companion that compares an employee's observations with their
own 28-day baseline. The intended HR experience exposes eligible group aggregates only.
See [engineering status](docs/ENGINEERING_STATUS.md) for implemented capabilities and
requirements still needed before production use.

Personal comparisons use seven completed UTC dates and a separate baseline of the
most recent 28 earlier observed dates per metric, within the past 90 days. Missing
measurements remain unknown; partial evidence can supply individual comparisons,
but an overall descriptive pattern index requires all four metrics across seven
recent dates and defined percentage changes. Closed dates do not imply complete
capture. The index is not a health, productivity or burnout score.

Survey scoring is not implemented; the assessment page shows that explicitly.
Optional weekly reflections remain in this browser, scoped to the employee account,
and do not modify the index or enter HR aggregates.

Workstation packets use account-scoped IndexedDB queues, so another tab in the same
browser can recover pending observations after a tab closes. Atomic leases coordinate
uploads; stable event IDs make interrupted retries safe on the server. Existing
per-tab queues are recovered for their owner and preserved as read-only backups.
Acknowledgement receipts retain hashes for 35 days without retaining the uploaded
packet. Expired or rejected packets remain available for review. Device-storage
failures are shown as memory-only; those observations require the page to stay open.

Collection preferences are stored per account in this browser. Legacy shared settings
are preserved, and collection stays paused until the account saves its own preferences.
Workstation and Calendar classification use the configured IANA timezone and workdays,
including overnight shifts and daylight saving. Disabling after-hours capture leaves
new after-hours measurements unknown. Browser pause persists across tabs and reloads;
frequent input events update presence without generating a packet per movement.
Schedule changes affect subsequent browser intervals; reimporting Calendar reclassifies
the fetched dates under the current schedule.

## Run locally

Requires Node.js 22 or newer and the installed project dependencies.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Without configured Supabase, development offers explicit
employee, HR and calibrated demo buttons on the login page. Partial or invalid Supabase
configuration disables demos as well. Demo sessions are signed,
expire after eight hours and are disabled in production. Set
`NEXT_PUBLIC_ENABLE_DEMO=false` to disable them in development too.

For a reverse-proxy deployment, set `WELLNESS_APP_ORIGIN` to the public origin,
such as `https://wellness.example.com`. It must have no path or query. Direct local
requests use the validated Host header; forwarded host headers are not trusted
automatically. Provider redirect URLs must use the same public origin.

For real accounts, configure `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY` for a legacy
project), enable the intended Supabase auth providers, and add
`http://localhost:3000/api/auth/callback` to allowed auth redirect URLs. HR roles must be
provisioned in server-managed `app_metadata`; choosing a role in the browser cannot grant
HR access. Email confirmation is required when enabled by the auth service.

Password recovery starts at `/forgot-password` and ends at `/reset-password`.
Add `http://localhost:3000/reset-password` and the equivalent production URL to
Supabase's allowed auth redirect URLs, and set its Site URL to the deployed app.
Browser requests use PKCE; externally requested recovery emails use token fragments.
Both are verified with Supabase before a password can change. The app also routes
recovery fragments arriving at the Site URL to the reset form. Expired links and
rejected password updates show an error. Passwords and recovery tokens are never
logged or persisted in the app's local UI cache.

Each workplace integration has separate provider credentials. Set
`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET`, `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, or
`SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` for the providers you enable. Register
`http://localhost:3000/api/auth/callback/github`, `/google`, `/discord` or `/slack`
under the same origin with the corresponding provider. In production, set
`WELLNESS_OAUTH_STATE_SECRET` to a random secret of at least 32 characters; local
development creates an ignored key in `.data`. Callback state expires after ten
minutes and is bound to the signed-in employee. Authorization does not establish
an automatic activity stream: Calendar is a manual import, GitHub supplies public
event counts, and the other tools still require collectors.

The former `/api/integrations/verify-owner` email/PIN endpoint is retired. It rejects
anonymous and cross-origin requests, and returns HTTP 410 to employees directing them
to provider OAuth. It does not send email, create PINs or confirm provider ownership.

## Verified organization data

For a new database, apply `src/lib/supabase/schema.sql`, then
`src/lib/supabase/migrations/20261004_tenant_privacy.sql`, followed by
`src/lib/supabase/migrations/20261005_cloud_ingestion.sql`, then
`src/lib/supabase/migrations/20261005_source_observation_preferences.sql`, then
`src/lib/supabase/migrations/20261005_hr_baseline_evidence.sql` through an
administrative database connection. For an existing installation, apply the outstanding
migrations in that order. The source-preferences migration upgrades existing Calendar
import RPCs to support unknown after-hours observations. The HR evidence migration
requires valid, recent baseline measurements even when legacy rows predate constraints.
The migrations have been tested locally with PostgreSQL via PGlite; they are not
automatically applied to your Supabase project.

Provision organizations, active memberships and group cohorts as a trusted
administrator. HR access requires both the server-managed auth role and an active
HR membership for that organization. Clients cannot promote roles, change cohorts,
or write arbitrary group aggregates. Employee group sharing starts disabled and can
be changed under Settings → Privacy & Data. The database releases each metric only
when at least three consenting contributors have 28 earlier valid observed dates for
it within the past 90 closed UTC dates. Unknown, invalid, stale and demo measurements
cannot qualify a contributor. Today and future dates are excluded.

Real HR accounts read this backend and show unavailable state if it has not been
configured. Local HR demonstrations remain separate. Once the migrations are applied,
authenticated uploads and manual Calendar/GitHub imports commit private observations
to `employee_daily_metrics`. Eligible observations can then contribute to group
aggregates under the consent and baseline rules above. Old browser estimates and
demonstration records are not uploaded or treated as trusted measurements.

The authorization design follows the documented distinctions between
[server-managed claims and user-editable metadata](https://supabase.com/docs/guides/database/postgres/row-level-security)
and the [PostgreSQL function privilege model](https://www.postgresql.org/docs/current/sql-createfunction.html).

## Verify

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run test:smoke
```

Regression tests exercise validation, precision, event-time bucketing, retries,
interval overlap, source preservation, calendar imports, provider failures and auth
boundaries. They use isolated fixtures, not live provider accounts.

Check an actual deployed site separately:

```sh
npm run check:deployment -- https://ai-wellness-twin.vercel.app
```

The checker loads Next.js production environment files and uses
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (falling back to
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) as the expected configuration. The application and
checker both prefer the publishable variable when both are set. They accept a public
publishable key or a legacy
anon key; secret/service-role keys are rejected. See the
[Supabase API key types](https://supabase.com/docs/guides/getting-started/api-keys).
It checks the login/registration pages, the configuration in served browser assets,
authentication health and email-registration settings, and anonymous access rejection
for private pages and read endpoints. It exits nonzero when any probe fails, including
an unresolved backend hostname or an outdated frontend bundle. All probes use GET;
they do not create accounts, send email, sign in, call RPCs or write observations.
Keys and response contents are excluded from the report.

Passing this check does not verify email delivery, authenticated ingestion, applied
database migrations, real provider authorization or live tenant isolation. Those
still require end-to-end deployment checks. After changing public environment values
in Vercel, rebuild/redeploy: Next.js embeds those values in browser assets at build time.

## Ingestion contract

`POST /api/telemetry/heartbeat` requires the authenticated employee's session and a
same-origin browser request. A collector sends only these metadata fields:

```json
{
  "eventId": "an-opaque-unique-event-id",
  "employeeId": "the-authenticated-user-id",
  "organizationId": "personal:the-authenticated-user-id",
  "timestamp": "2026-10-03T10:00:45.000Z",
  "activeSeconds": 45,
  "meetingMinutes": 0,
  "isBreak": false,
  "isEvening": false,
  "source": "workstation"
}
```

The timestamp is the end of the observed interval. Durations retain precision. IDs and
metadata stay identical on retries. Unknown/content-bearing fields, invalid timestamps,
observations older than 35 days, and invalid durations are rejected. Active intervals
are at most 300 seconds; calendar intervals are at most 1440 minutes. Daily buckets use
UTC; browser schedule classification uses the device timezone. Overlapping intervals
are counted once. Tool-specific durations require observations from that tool's collector.
Public GitHub timestamps establish event counts, not coding hours or breaks.
Collectors can send `afterHoursObserved: false` when that measurement is disabled;
the result stays unknown rather than becoming a measured zero. It cannot be combined
with `isEvening: true`. Omitting the field preserves the existing collector contract.

`POST /api/telemetry/calendar-webhook` currently accepts the same normalized contract
with `source: "calendar"`, `activeSeconds: 0`, and an actual meeting duration. It is an
adapter endpoint; raw Google/Microsoft push notifications require a verified subscription
and fetch adapter that is not yet implemented. No missing duration is invented.

## Storage and deployment status

Real accounts use authenticated PostgreSQL RPCs. One transaction deduplicates the
event ID, unions intervals across collectors, splits UTC dates, and materializes
the daily observations. A per-employee database lock serializes competing uploads
across server instances. Failed transactions are not acknowledged, and there is no
local-file fallback for cloud accounts. Raw receipts expire after 35 days; interval
ledgers retain the replay window, while derived daily history remains available.

`GET /api/telemetry/history` returns only the authenticated employee's cloud history.
The dashboard loads this history before assessing patterns or starting its collector.
Database failure shows an unavailable state. `POST /api/telemetry/source-snapshots`
accepts up to 36 metadata-only Calendar/GitHub daily snapshots with their capture
time. New snapshots can correct earlier values; stale responses cannot overwrite
newer observations. Only acknowledgements update the browser cache.

Manual imports are queued in IndexedDB before their first upload. The dashboard
worker retries pending batches on a timer, on connectivity recovery, or through
the imports notice. Original capture times and metadata stay identical on retries.
Transactions and expiring leases coordinate multiple tabs; closing a tab does not
remove persisted imports. Rejected, expired and cancelled batches are retained for
review/export. Unlinking an account cancels its pending uploads while preserving
already imported history. These retries upload existing observations; they do not
fetch new provider activity or refresh authorization tokens.

The imports notice distinguishes persisted batches from memory-only observations
when device storage fails. Memory-only imports require the page to stay open.
Acknowledged batches replace their observations with a minimal local receipt;
receipts older than 35 days are removed when the queue is processed again. Browser
storage can be cleared by the device user, so it is not an organization privacy
boundary or a substitute for cloud retention and backup policies.

Development demo telemetry uses `.data/telemetry-v1.json` on one host. That ignored
directory also holds development signing keys. `WELLNESS_TELEMETRY_STORE_PATH` can
override the demo file path; cloud ingestion does not require a local volume.
Integration labels, settings, organization demonstrations and invitations still
include browser-local state. Those registries are not organization authorization.
Cloud migrations, backups, derived-history retention/deletion and live provider
deployment checks remain operational requirements; none are automatically deployed.
