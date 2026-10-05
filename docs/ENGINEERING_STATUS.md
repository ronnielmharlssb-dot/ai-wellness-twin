# System integrity work

The continuing objective is to improve AI Wellness Twin while preserving its purpose:
private personal work-pattern insights against an individual's 28-day baseline,
with HR access limited to anonymized group trends.

## Implemented in the current worktree

- Explicit server-verified authentication for employee, HR and settings pages.
- Supabase password and registration errors no longer fall back to local login.
- Roles come from server-managed `app_metadata`, never user-editable metadata.
- Explicit signed, expiring demo sessions are available only in local development
  without configured Supabase. Production demo login is disabled.
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
- Tool cards distinguish missing data, recorded data and linked accounts.
- Synthetic calibrated sample records use the `demo` source explicitly.
- Provider callbacks validate encrypted, expiring state tied to the employee and
  request origin. GitHub uses S256 PKCE; callbacks verify identities before linking.
- Google authorization imports only Calendar; it no longer claims to link nine tools.
- Temporary atomic-replacement locks are retried briefly without deleting the previous
  snapshot. Persistent storage failures remain unacknowledged.
- Invalid, expired and permanently rejected upload packets are retained separately
  for review, so fresh observations can upload. Transient and auth failures retry.
- A tested tenant-privacy database migration replaces profile-role authority,
  restricts role updates, provisions profiles from verified auth, and isolates HR
  organizations. Fresh role revocations override stale HR claims.
- Real HR views use a database aggregate function, never browser demonstration data.
  Each metric requires three consenting contributors with 28 prior observed dates.
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

1. Finish provider ingestion: token retention and refresh, scheduled incremental
   fetches and authenticated native
   webhook subscriptions. A popup closing does not prove authorization. Linking a
   label does not establish a telemetry stream.
2. Deploy and exercise cloud ingestion across multiple server instances, and implement
   backups, derived-history retention and deletion. Raw cloud receipts and interval
   ledgers are bounded to the replay window. Local demo files still need abandoned-lock
   recovery if that optional development backend is used persistently.
3. Finish real organization membership, invitations and company verification. Current
   browser registries and verification demonstrations are not authoritative membership
   or domain ownership evidence.
4. Exercise the implemented cloud ingestion and private history path on the real
   database, including concurrent uploads, reloads and failures. Browser storage remains
   a display cache, not a privacy or tenancy boundary. Workstation and source-import
   queues recover and coordinate tabs in local tests. Their native browser reload,
   storage-quota and abrupt-close behavior still needs deployment testing.
5. Apply the prepared privacy, ingestion and source-observation-preferences migrations to the real Supabase project, provision
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

- All 141 tests passed, including PostgreSQL policy execution, upgrades from legacy
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
  privacy, cloud ingestion and source-observation-preferences migrations were tested locally and have not been applied
  to Supabase. Real cloud ingestion and provider accounts are not live verified.
