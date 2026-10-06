# System integrity work

The continuing objective is to improve AI Wellness Twin while preserving its purpose:
private personal work-pattern insights against an individual's 28-day baseline,
with HR access limited to anonymized group trends.

## Implemented in the current worktree

- A public `/demo` route requires no account and presents deterministic fictional
  employee scenarios through the existing assessment logic. HR averages and the
  data walkthrough are explicitly illustrative. Controls change only the page's
  memory; the demo neither starts collectors nor reads/writes real account data.
- Organization setup now uses authenticated, database-backed pending requests,
  private applicant history and idempotent receipts. Confirmed contact identity is
  derived by the database. Requests grant no roles, membership or verification.
  Browser company registration/domain PIN authority and format-based KYB have been
  removed; administrative business review is a separate operational requirement.

- Explicit server-verified authentication for employee, HR and settings pages.
- Supabase password and registration errors no longer fall back to local login.
- Roles come from server-managed `app_metadata`, never user-editable metadata.
- Explicit signed, expiring demo sessions are available only in local development
  without configured Supabase. Production demo login is disabled.
- Partial or invalid Supabase configuration also disables demos. Browser and server
  clients select the same publishable-key variable, with legacy anon-key support;
  malformed or elevated keys do not enter public SDK clients. The public checker
  uses the same variable preference. These checks do not replace provider validation.
- Employee telemetry endpoints enforce authenticated personal ownership.
- Strict metadata allowlist, identifiers, event times, duration bounds and JSON body limit.
- Observed intervals retain precision, use event-time UTC dates and split midnight.
- Durable local telemetry snapshots replace temporary-file storage. Writers lock and
  replace snapshots atomically; unavailable storage fails the request.
- Retry event IDs deduplicate deliveries; overlapping collectors cannot multiply time.
- Per-source daily snapshots preserve imports and permit source corrections.
- Browser collection measures elapsed presence, respects pause/idle/visibility settings,
  keeps pending uploads and stops on an identity change or dashboard unmount.
- Calendar imports union overlapping blocks and report scheduled load only.
- Complete calendar imports include empty days, so a cancelled meeting can be
  cleared on resync while other sources remain intact.
- GitHub imports report public event counts without fabricated focus or break durations.
- Missing measurements do not establish a baseline or generate metric comparisons.
- Personal comparisons average seven closed UTC dates, with a separate recent
  28-observation baseline for each metric within the past 90 days. Duplicate dates,
  current/future dates and invalid values cannot calibrate a metric.
- Partial coverage supplies only supported comparisons. The overall descriptive
  pattern index remains unavailable unless all four metrics have seven recent dates
  and defined percentage changes; increases from zero are qualitative, not invented
  percentages. Recorded-day coverage does not prove complete collection.
- Fabricated exhaustion, detachment and efficacy scores have been removed. Survey
  scoring is explicitly unavailable. Recommendations describe the observed direction
  and recording limitations, without inferring clinical outcomes.
- Optional weekly reflections use employee-scoped keys and recheck ownership before
  saving. Legacy shared keys are not adopted. Storage failure cannot report a save;
  reflections do not change the pattern index or enter HR aggregates.
- Disabled after-hours measurement is explicitly unknown; pure break events remain
  observed counts without requiring an active interval.
- Collection settings are scoped to the signed-in account and strictly validated.
  Legacy shared settings are preserved rather than adopted; collection stays paused
  until account-specific preferences are saved. Failed reads or invalid preferences
  pause collection, and failed writes cannot report a successful save.
- Browser and Calendar schedule classification use the same IANA timezone, selected
  workdays and overnight-shift rules. UTC observation buckets remain unchanged.
  Calendar imports can withhold after-hours measurements through the prepared
  source-observation-preferences RPC upgrade, without inventing zero evidence.
- Browser input events update presence rather than enqueueing one packet per pointer
  movement. Preference events close preceding intervals under their original settings.
  If a cross-tab change was missed, the uncertain open interval is excluded.
- Settings keep verified identity separate from editable browser preferences.
  Pause controls persist; cache export and clearing are explicitly browser-only.
  Persona customization and scheduled alert delivery are shown as inactive.
- The login page exposes direct employee account creation separately from organization
  membership. A read-only `check:deployment` command verifies actual served public
  configuration, authentication availability, email self-registration and anonymous
  access rejection. Unresolved backends, stale assets and failed probes exit nonzero
  without reporting keys or creating test accounts.
- Tool cards distinguish missing data, recorded data and linked accounts.
- Synthetic calibrated sample records use the `demo` source explicitly.
- Provider callbacks validate encrypted, expiring state tied to the employee and
  request origin. GitHub uses S256 PKCE; callbacks verify identities before linking.
- The unused email/PIN verification endpoint is retired behind origin and identity
  checks. It no longer sends email, stores PINs in temporary files, logs credentials
  or claims delivery/ownership. Employees are directed to the existing OAuth flow.
- Google authorization imports only Calendar; it no longer claims to link nine tools.
- Temporary atomic-replacement locks are retried briefly without deleting the previous
  snapshot. Persistent storage failures remain unacknowledged.
- Invalid, expired and permanently rejected upload packets are retained separately
  for review, so fresh observations can upload. Transient and auth failures retry.
- A tested tenant-privacy database migration replaces profile-role authority,
  restricts role updates, provisions profiles from verified auth, and isolates HR
  organizations. Fresh role revocations override stale HR claims.
- Real HR views use a database aggregate function, never browser demonstration data.
  Each metric requires three consenting contributors with 28 earlier valid observed
  dates within the past 90 closed UTC dates. Unknown, invalid and stale legacy rows
  cannot qualify a contributor; a separate upgrade hardens existing installations.
  Missing metrics remain withheld and individual identifiers are excluded.
- Employees can opt into or withdraw group sharing for verified memberships.
- Request origin checks and provider callbacks use the actual public origin rather
  than Next.js's internal hostname. Reverse proxies can configure WELLNESS_APP_ORIGIN.
- Next.js and its ESLint config are updated to 16.3.8, with compatible transitive
  dependency patches applied.
- An authenticated cloud ingestion migration provides transactional receipts,
  interval unions, source corrections, daily materialization and per-employee locking.
  Real accounts never fall back to local files when cloud storage fails.
- The dashboard reads private cloud history before assessment and collection starts.
  Complete daily snapshots and revisions prevent stale replies from restoring old
  totals or overwriting later acknowledgements. Legacy estimates are not uploaded.
- Calendar and public GitHub imports persist via validated employee-only RPCs.
  Their observations reach HR only through consented, calibrated tenant aggregates.
- Failed manual imports retain metadata-only batches in IndexedDB and retry with
  their original capture time. Transactions and expiring leases coordinate tabs.
  Account changes stop uploads; incomplete acknowledgements cannot update assessment.
  Rejected, expired and cancelled imports remain available for review/export.
- Import status distinguishes cloud acknowledgement, durable device queues and
  memory-only fallback after a device-storage failure. Unlinking cancels pending
  uploads without deleting earlier cloud observations. Minimal receipts prove
  acknowledgements; missing storage never counts as successful ingestion.
- Workstation packets now use account-wide IndexedDB storage. New tabs recover
  closed-tab queues for the same employee; atomic leases coordinate workers and
  expire after 60 seconds. Capture, replay identity and permanent review records
  survive worker reloads without affecting other employees.
- Legacy per-tab queues are read and migrated without deleting their original bytes,
  because older app tabs do not participate in transactions. Hash receipts prevent
  acknowledged backups from being uploaded repeatedly and expire after 35 days.
  Pending and rejected metadata is not automatically deleted.
- Heartbeat replies require validated employee-owned snapshots for every touched UTC
  date. Wrong-owner, malformed and incomplete acknowledgements cannot update the
  display cache or remove a queued packet. An aborted receipt transaction retains
  the packet for retry. Pause and account/role changes stop uploads.
- Connectivity recovery and explicit retries reset transient backoff. Storage and
  fingerprint failures retain the current capture in memory with an explicit notice;
  this fallback cannot survive closing the page. Receipt and pending-row indexes keep
  claims from scanning all acknowledged heartbeat records.

## Required work before claiming a production system

This is a local application under development, not a verified production deployment.

### Deployed authentication check on 2026-10-06

The owner restored the paused Supabase project. The most recent live public check
passed authentication health, enabled email registration and anonymous access guards.
The requested email is already registered; the earlier password attempt was rejected.
The authorized recovery request failed with HTTP 500, so no recovery email was
confirmed sent. Google OAuth reached Google's sign-in page, but an authenticated
dashboard and live ingestion remain unverified. The separate public sample demo
does not depend on this account recovery.

1. Finish provider ingestion: token retention and refresh, scheduled incremental
   fetches and authenticated native
   webhook subscriptions. A popup closing does not prove authorization. Linking a
   label does not establish a telemetry stream.
2. Deploy and exercise cloud ingestion across multiple server instances, and implement
   backups, derived-history retention and deletion. Raw cloud receipts and interval
   ledgers are bounded to the replay window. Local demo files still need abandoned-lock
   recovery if that optional development backend is used persistently.
3. Apply the organization setup request migration and implement the operational
   administrator review, invitations and verified membership process. Pending requests
   are implemented; they are not membership or domain ownership evidence.
4. Exercise the implemented cloud ingestion and private history path on the real
   database, including concurrent uploads, reloads and failures. Browser storage remains
   a display cache, not a privacy or tenancy boundary. Workstation and source-import
   queues recover and coordinate tabs in local tests. Their native browser reload,
   storage-quota and abrupt-close behavior still needs deployment testing.
5. Apply the prepared privacy, ingestion, source-observation-preferences and HR-baseline-evidence migrations to the real Supabase project, provision
   verified memberships/cohorts, and test the live deployment. No live database
   migration has been performed in this worktree.
6. Expand timezone/calendar coverage, incremental subscription reconciliation and
   evidence of daily completeness. Metric-specific observation counts and assessment
   explanations are implemented; observed dates alone cannot prove complete capture.
   A real survey requires a separate implementation and validated scoring.
7. Add browser integration checks and configured-provider smoke tests. Unit tests with
   isolated provider responses cannot prove external services are connected.

The old temporary telemetry JSON and legacy browser data are not silently rewritten
as trusted observations. Existing estimates cannot be reconstructed into measured time.

## Verification on 2026-10-04

- All 39 regression tests passed; lint, TypeScript and the production build passed.
- Production HTTP checks confirmed login redirects for protected pages, authentication
  requirements for both ingestion endpoints and live status, cross-origin rejection,
  authenticated provider initiation/callbacks and disabled production demo login.
- Build tracing included no files from the private `.data` runtime directory.
- The temporary HTTP smoke server was stopped after verification.

These checks do not verify a live external provider account, a browser authorization
journey, native webhook delivery or a production HR privacy boundary.

## Verification on 2026-10-05

- All 142 tests passed, including PostgreSQL policy execution, upgrades from legacy
   policies, role escalation, tenant isolation, stale role revocation, consent,
  contributor thresholds, failed queue writes and public-origin handling. Cloud
  ingestion checks cover interval unions, replay conflicts, source corrections,
  atomic batch rollback, unknown measurements, private history and consented HR
  release from ingested observations. Manual source sync checks confirm that failed
  uploads cannot become successful local syncs.
- Assessment regressions cover separate baseline/recent windows, weekly averages,
  partial coverage, unknown measurements, duplicates, unfinished dates, increases
  from zero and invalid values. Private reflection checks cover account changes,
  legacy shared keys, malformed stored entries and explicit device write failures.
- Collection preference regressions cover account isolation, preserved legacy keys,
  invalid settings, failed device writes, verified identity, configured timezones,
  overnight workdays and daylight saving. Pointer-event tests prove repeated presence
  events accumulate elapsed time without producing one packet per movement.
  The final storage-read guard also passed all 25 focused settings, tracker and source
  sync checks: unreadable preferences cannot enable after-hours imports or be
  overwritten by a partial save.
- HR baseline regressions reproduce premature releases under the prior PostgreSQL
  function, then test the corrected fresh-installation and idempotent upgrade paths.
  Stale, non-finite, negative, fractional-break, unknown and demo evidence cannot
  establish calibration. Today/future rows are excluded; the 90-day boundary is
  tested. Valid zero observations count, and repairing one metric does not release
  other metrics whose contributor evidence remains insufficient.
- Calendar preference tests exercise client validation, queued imports and actual
  PostgreSQL RPC upgrades from the prior two-metric contract. Meeting-only imports
  preserve unknown after-hours values, reject fabricated durations, and retain
  existing employee/tenant authorization. The upgrade is idempotent locally.
- IndexedDB tests use the development-only fake-indexeddb implementation. They
  exercise committed transactions, rollback, competing leases, module reloads,
  interrupted uploads, failed device writes, acknowledgement receipts and cleanup.
  Presentation checks hide other accounts and distinguish persisted queues from
  memory-only fallback. Native browser reloads and live provider journeys remain
  unverified deployment checks.
- Workstation queue tests exercise closed-worker recovery, competing claims, expired
  leases, original legacy-byte preservation, conflicting event IDs, metadata validation,
  account/role changes, malformed acknowledgements, transactional rollback, receipt
  retention, connectivity retries, paused capture and transient fingerprint failures.
  These verify the application logic with emulated IndexedDB; they do not prove a
  browser will finish a final asynchronous capture while its tab is abruptly closed.
- Lint, TypeScript, the patched production build and `npm run test:smoke` passed.
  The smoke harness starts and stops its own local server and verifies unauthenticated
  access rejection, cross-origin rejection and disabled production demo login.
- Build traces contain no `.data`, `.env` or `.aws` runtime files.
- `npm audit --omit=dev` reports zero production vulnerabilities. Five high-severity
  advisory entries remain in the development-only ESLint/fast-glob/micromatch/braces
  chain. The suggested forced fix would downgrade eslint-config-next across major
  versions and has not been applied.
- The local configuration contains no administrative database connection. The
  privacy, cloud ingestion, source-observation-preferences and HR-baseline-evidence migrations were tested locally and have not been applied
  to Supabase. Real cloud ingestion and provider accounts are not live verified.

## Verification on 2026-10-06

- All 152 regression tests passed. The ten deployment-check tests use local HTTP
  fixtures and actual CLI subprocesses to verify healthy and failed exit codes,
  absent authentication DNS, stale browser configuration, rejected or elevated keys,
  disabled signup, malformed responses, private access failures, response size limits
  and credential-safe redirect handling. The probes issue GET requests only.
- The live checker confirmed that the Vercel login and registration pages respond,
  their assets contain the expected public configuration, and the tested private
  pages/endpoints reject anonymous access. The authentication probe failed because
  the configured Supabase hostname does not resolve; the command exited nonzero.
  No account, email, session, RPC or observation was created by these checks.
- Lint and the production build including TypeScript passed. The first sandboxed
  build could not download its configured Google Fonts; the subsequent build with
  network access succeeded. Private `.data` runtime files are excluded from lint.
- The production HTTP smoke harness passed and stopped its temporary server. It
  checked protected-page redirects, ingestion authentication and origin requirements,
  disabled production demos and exclusion of private runtime data from build tracing.
- Restoring or replacing the Supabase project, applying migrations and verifying an
  actual employee account remain external deployment requirements. Neither the
  passing local tests nor the new public probes establish live authenticated ingestion.

### Authentication recovery follow-up

- The project owner reported that Supabase had been paused. After restoration,
  the live public deployment checker passed, including authentication health and
  enabled email registration. A signup attempt reported that the requested account
  already exists. The password retained from the earlier registration attempt was
  rejected; a successful employee login remains unverified.
- The login page's previously inactive password-recovery button now opens a real
  email-request form. A new password form verifies implicit recovery credentials or
  a PKCE code with Supabase and checks the provider user again before updating a
  password. Ordinary cached browser identities cannot authorize an update. Recovery
  fragments arriving at the configured Site URL are directed to the same form.
- Focused regressions cover failed email requests, missing configuration, incomplete
  and expired links, rejected code exchanges, verified provider identity, password
  validation and failed updates. Deployment and actual email delivery still require
  separate confirmation; no local test demonstrates access to the owner's inbox.
- All 160 regression tests passed, followed by lint, the production build including
  TypeScript, and the production HTTP smoke test. The smoke test now checks both
  password-recovery pages. Recovery changes were pushed as `4d8e55b`; the deployed
  reset page was observed rejecting access without a valid recovery session.
- The authorized live reset request failed with HTTP 500 and Supabase's
  `unexpected_failure` / `Error sending recovery email` response. An email was not
  confirmed sent; determining the underlying cause requires Supabase Auth logs and
  email-service configuration. Google sign-in is enabled and the deployed OAuth flow
  reached Google's sign-in page. Completing that login requires the account owner;
  an authenticated dashboard or live ingestion is still unverified.

### Integration endpoint and configuration follow-up

- All 168 tests passed, as did lint, the production build including TypeScript and
  the production HTTP smoke harness. The harness verifies that the retired endpoint
  rejects anonymous requests and cross-origin requests through the real Next.js server.
  Five new configuration tests exercise both client factories, public key formats,
  variable preference, partial configuration and demo denial. Existing auth tests
  now verify that partial configuration prevents demo session creation/acceptance.
  The actual deployment CLI is tested with the publishable alias and rejects an
  invalid preferred key instead of silently using an older key.
- Three endpoint regressions exercise origin rejection before authentication,
  anonymous/HR denial and retirement of employee send/verify calls. Forbidden mail,
  filesystem, random-number and logging operations are instrumented. Submitted
  addresses/codes are never parsed or reflected, including malformed/large payloads.
- Live application of database migrations and authenticated ingestion remain
  unverified. The email-delivery failure and account-owner Google sign-in handoff
  remain unresolved external checks; this work does not claim a successful login.

### Presentation readiness follow-up

- All 184 regression tests passed, including actual PostgreSQL request permissions,
  private applicant history, unconfirmed-account denial, request replay conflicts,
  direct approval denial and administrative review without membership/role grants.
  API/client tests reject missing or mismatched acknowledgements and sanitize failures.
- Public demo regressions exercise the real personal assessment function with
  deterministic fictional records. Separate baseline/recent windows, unfinished
  calibration and missing metrics retain their evidence requirements. The HR sample
  illustration suppresses all averages below three contributors.
- Lint, TypeScript, the production build and HTTP smoke checks passed. The smoke
  harness checks public demo access while real dashboards and private endpoints
  continue to reject anonymous users. Cross-origin setup/KYB calls are rejected.
- A browser rehearsal of the local production build verified all four sample
  scenarios, HR suppression and recovery, and all three data-walkthrough steps.
  This verifies sample UI behavior, not live provider ingestion.
- The public demo requires no database migration. Real organization requests still
  require the new migration to be applied through an administrator connection.
  Existing deployment requirements for real users remain in force.
