# AI Wellness Twin - Product Manual

Updated 7 October 2026. For architecture, APIs, database setup and limitations, read [System Documentation](SYSTEM_DOCUMENTATION.md). Previously generated product-manual/pitch PDFs and HTML exports contain older claims and are superseded by the current documentation.

## Purpose

AI Wellness Twin compares recorded working time, meeting load, breaks and after-hours activity with your own earlier observations. It gives descriptive feedback and suggestions. It does not diagnose burnout, rate productivity or rank employees. Survey scoring is not implemented.

## Presentation demo

Open https://ai-wellness-twin.vercel.app/demo. No account is required; all people and measurements are fictional. Controls change only the sample page's memory.

1. Switch between Busier week and Steady week.
2. Show Building a baseline and Missing observations; explain unavailable evidence.
3. Open HR group view and change three contributors to two to show suppression.
4. Advance Data & privacy's sample walkthrough, then reset.

See [Demo Runbook](DEMO_RUNBOOK.md). The sample walkthrough does not prove live provider ingestion or email delivery.

## Personal account

At `/register`, enter your name, email and matching password. Confirm email if required, then sign in at `/login`. Configured Google sign-in is available. Personal signup does not grant HR permission or organization membership.

If an email is already registered, recover/sign into that account. A failed recovery request does not mean email was sent. The latest 7 October request remained unavailable; successful owner access was not verified. There are no documented universal passwords for the public website.

## Employee workspace

| Page | Use |
| --- | --- |
| Overview | Inspect collection status, baseline coverage and comparison evidence. |
| Patterns | Read changes against your own earlier measurements. |
| Assessment | Evidence/private reflection; no survey scoring. |
| Recommendations | Suggestions grounded in supported recorded changes. |
| Reports | Personal reporting view; missing evidence cannot create a complete index. |
| Integrations | Distinguish identity links, pending imports, recorded data and missing collectors. |
| Settings | Save work schedule/capture preferences, pause collection and manage eligible sharing. |

The page tracker observes activity inside the app, not every application on your device. Keep the dashboard open while collecting and inspect pending/memory-only notices.

## Baseline and index

Each metric needs 28 valid earlier observed dates within the past 90 closed UTC dates. The recent window is seven closed dates before today, separate from the baseline. Missing measurements stay unknown.

A full descriptive index requires all four metrics on all seven recent dates and defined percentage changes. Building and Partial are expected with insufficient evidence. Stable, Watch and Attention are recording-rule labels, not clinical severity levels.

## Sources and privacy controls

Calendar describes scheduled meetings, not confirmed attendance. Public GitHub counts events, not coding hours. Slack/Discord authorization and several other tool cards do not yet supply automatic collectors.

Preferences belong to your account in this browser. Set your actual timezone/workdays. Disabled after-hours measurement stays unknown. Private reflections stay in browser storage and do not affect the index or HR output.

Device queues retain pending uploads when storage is available. Memory-only observations require the page to remain open. Retry temporary failures and review rejected/expired records. Unlinking cancels pending imports without deleting earlier cloud history. Clearing browser cache does not delete all database data.

## Organization and HR

A verified personal account submits a setup request at `/register-company`. A trusted administrator must verify the business and separately provision roles, active memberships and cohorts. A request receipt is not verification or HR permission.

Real group release needs verified organization access and at least three consenting eligible contributors per metric, each with valid prior evidence. Unsupported metrics are withheld. Private reflections and personal diagnostic views are not HR aggregate inputs.

## Before real-user testing

Verify login/email delivery, apply migrations administratively, exercise cloud upload/retry/history and check live tenant/consent suppression. The separate public demo is available while those checks remain outstanding.
