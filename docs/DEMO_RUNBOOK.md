# Presentation demo — verified October 8, 2026

Open **https://ai-wellness-twin.vercel.app/demo**. No account, password, email,
Supabase session or provider authorization is required. The home and login pages
also link to **Explore Demo**. All sample people and observations are fictional.
The demo changes only its in-memory view; refreshing or Reset demo restores it.

## Five-minute presentation

1. Start with **Employee insights → Busier week**. Explain that Alex's recent
   seven closed dates are compared with Alex's own 28 earlier observed dates.
   Meetings increase from 2 to 3 hours; breaks decrease from 5 to 3. The index
   describes recorded patterns and is not a diagnosis or productivity ranking.
2. Select **Steady week** to show the same personal baseline with no changes.
   Select **Building a baseline**: comparisons and the index stay unavailable.
   Select **Missing observations**: after-hours activity remains unknown while
   supported metric comparisons still appear. Show the evidence table.
3. Open **HR group view**. Three consenting, calibrated sample contributors
   allow fictional group averages. Select **2 consenting contributors** to
   hide every metric. Explain that real group release also depends on verified
   organization membership and metric-specific baseline evidence.
4. Open **Data & privacy** and click **Next sample step** three times. Explain
   metadata collection, deduplication, missing evidence and private comparisons.
   This is an illustrative walkthrough, not a live upload or provider connection.
5. Click **Reset demo** before the next presenter starts.

## Rehearsal checklist

The public controls below were rehearsed successfully on October 8. Repeat before
the presentation to check connectivity and the presenting device.

- Open `/demo` in a fresh browser without signing in; confirm the page renders.
- Change all four employee scenarios and confirm their values/index change.
- Check the HR threshold in both directions: 3 → 2 → 3.
- Complete and restart the sample data walkthrough.
- Reset the demo; confirm Busier week is restored.
- Check laptop/projector zoom and a narrow/mobile window for readable controls.
- Keep the demo tab open and prepare screenshots as a fallback for connectivity.
- Real `/dashboard`, `/hr` and `/settings` must still redirect anonymous visitors
  to login. Public demo access must not bypass those controls.

## Scope for questions from the audience

The public demo exercises the application's personal assessment logic with
deterministic synthetic records. The HR screen illustrates privacy suppression
using fictional averages. It does not read or create real users, measurements,
consent, organizations or provider links.

As verified on October 8, Google sign-in reaches the public employee dashboard.
Supabase's Site URL and exact callback/recovery redirects are configured for the
public website. The five outstanding database migrations were applied with the
owner's approval; private history loads and actual browser-presence observations
survive a dashboard reload. A new account still needs its own observed dates for
personal comparisons. Use `/demo` for the presentation's fictional populated views.
Recovery email delivery, live provider imports and live HR tenant/consent journeys
remain unverified. The sample data walkthrough illustrates ingestion; it does not
demonstrate any of those remaining journeys.

## Developer checks

`npm test`, `npm run lint`, `npm run build`, and `npm run test:smoke` cover sample
assessment behavior, missing evidence, HTTP access guards and existing ingestion
regressions. `npm run check:deployment -- https://ai-wellness-twin.vercel.app`
also checks the public demo page after deployment, alongside public auth health
and private access rejection. Browser interactions require a separate rehearsal.
