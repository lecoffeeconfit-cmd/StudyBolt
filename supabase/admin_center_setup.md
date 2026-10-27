# StudyBolt Admin Center

The Profile/settings page shows **Administration → Admin Center** for accounts
in `public.studybolt_admins`. Every server request verifies the session and live
membership; client flags and user-editable metadata cannot grant access.

## Activate

1. Apply `migrations/20261012000000_studybolt_admin_center.sql` once to the Supabase
   project used by `EXPO_PUBLIC_SUPABASE_URL`. This migration is independent of
   the optional Discover and cloud AI migrations.
2. Grant the intended signed-in StudyBolt account access in the SQL editor:

   ```sql
   insert into public.studybolt_admins(user_id)
   select id from auth.users where lower(email) = lower('your-admin-email@example.com')
   on conflict (user_id) do nothing;
   ```

3. Deploy the protected endpoint:

   ```sh
   npx supabase functions deploy studybolt-admin --project-ref YOUR_AUTH_PROJECT_REF
   ```

4. Reopen StudyBolt or bring it back to the foreground. Open Profile → Admin
   Center. A new native build is not required for the server configuration;
   distribute the updated app code through the normal build/update process.

Supabase supplies the server-only service-role/secret key. Never add one to
Expo environment variables. To revoke access, delete that account's row from
`studybolt_admins`; requests recheck membership instead of trusting an old JWT.

## Shared Auth and reports

This checkout currently shares Supabase Auth with WordWiz. StudyBolt has its own
admin membership and account registry. The directory includes only accounts
registered by StudyBolt or found in existing StudyBolt data. It never imports
all WordWiz Auth users. Account controls reset StudyBolt's monthly cloud quota
or grant/revoke `studybolt_complimentary_until`; paid subscriptions are preserved.

Reporting ranges are Today (UTC), trailing 7/30 days, and All time. Learning
activity begins with this app version for signed-in learners. Only event counts,
correct-answer totals, and durations are uploaded; study content, individual
answers, source files, and guest activity are excluded. Foreground time excludes
background and admin screens. Offline analytics queue for at most 7 days with
idempotent event IDs; they are estimates rather than billing records.

Cloud AI costs and quota controls become available when the existing
`20260913000000_ai_cloud_ledger.sql` migration is installed on the same backend.
Discover totals require the existing sharing and classes migrations. Missing
optional tables produce a setup state, rather than fabricated zero reports.
Deploy the updated `studybolt-ai-tutor` with `_shared/adminPolicy.ts` when enabling
cloud AI so complimentary expiry is enforced server-side on every request.
Quota reset preserves pending reservations, daily limits, and historical events.

## Feedback

Profile → Help & support allows signed-in learners to submit a problem, idea,
or question and see the admin response. Requests are limited to five per hour.
The admin Feedback tab provides status filters, priority controls, pagination, replies,
and audited updates. Learners can read only their own requests and cannot set
admin replies, status, or priority. All account/support mutations are audited.

## Validation

```sh
npm run typecheck
npx deno check --no-lock --node-modules-dir=none supabase/functions/studybolt-admin/index.ts
npx deno test --no-lock --node-modules-dir=manual supabase/functions/_shared/adminPolicy.test.ts
```

`tests/studybolt_admin_center.sql` exercises permissions, cohort isolation,
feedback RLS, idempotent ingestion, and reservation-safe quota resets. Run it in
an isolated PostgreSQL test database, not the live shared Auth project.
