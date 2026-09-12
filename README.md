# StudyBolt

StudyBolt is an Expo + React Native study utility for iOS, Android, and web. One source upload is designed to produce one offline-ready Study Pack containing notes, flashcards, a quiz, and two listening modes.

## Run locally

```bash
npm install
npm start
```

Then press `i` for the iOS Simulator, `a` for Android, or `w` for web. You can also run `npm run ios`, `npm run android`, or `npm run web` directly.

## Project structure

The app is organized by responsibility so screens stay focused on presentation and user interactions:

```text
App.tsx                 Root providers and lightweight route composition
src/
  components/           Reusable visual primitives and navigation controls
  config/                Environment-independent product configuration (legal links)
  data/                  Seed content and learning-science references
  navigation/            Route and navigation types
  screens/               User-facing screen components
  services/              Persistence, authentication, document processing, and study logic
  models.ts              Shared domain types
  theme.ts               Design tokens and color-mode resolution
supabase/functions/      Server-only functions (never bundled into the client)
```

When adding a feature, keep domain transformations in `src/services`, shared data contracts in `src/models.ts`, and UI-specific code in a screen or reusable component. `App.tsx` should remain limited to providers, route state, and screen composition.

## What works without a backend

- Full interactive Biology sample Study Pack
- Notes with source slide references and reviewed state
- Active-recall flashcards with Again / Learning / Got It mastery
- Adjustable 10/15/20-question practice quizzes plus a separate cumulative PowerPoint test
- Device text-to-speech for Original and Quick Review modes, including rate, device voice, skip, pause, and resume
- Deterministic mastery estimates, progress stats, exam-review combination, modality-aware deadline plans, light/dark/system themes
- Local iOS/Android study reminders scheduled across active days in a learning plan
- Offline persistence with AsyncStorage
- PDF/PPT/PPTX picker and honest validation/error states
- First-run onboarding plus an optional guest path
- Email/password, Google, and Apple sign-in UI with password recovery and account management

The additional Psychology and Chemistry cards are visual development content; Biology is the complete realistic sample.

## Secure processor contract

Real PDF and PowerPoint extraction/generation requires a server because model credentials must never ship in the app and robust PPTX extraction is not reliably portable on-device. Set:

```bash
EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL=https://your-private-endpoint.example/process
```

The endpoint receives multipart form fields `file` and `courseName`. It must keep uploads private, extract source content, generate a grounded Study Pack once, validate the response, and return the `StudyPack` JSON shape from `src/models.ts`. Notes and flashcards should cover every source section; StudyBolt uses them to build a cumulative test whose prompts are separate from the practice-quiz pool. Malformed responses are rejected by the client.

Recommended production implementation: private Supabase Storage, user-scoped RLS tables, and a Supabase Edge Function that calls a document-extraction worker and AI provider with server-only secrets. No Supabase or AI credentials are currently invented or required for the local demo.

## Authentication setup

The account experience stays in honest demo mode until these public Supabase project values are set:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
# Public URL prefix for shared packs, including /share.
EXPO_PUBLIC_STUDYBOLT_SHARE_BASE_URL=https://your-domain.example/share
```

Enable Email, Google, and Apple in Supabase Auth, and add the app callback URLs (`studybolt://auth/callback` for native and the deployed web origin) to the Auth redirect allow list. Password-reset links return to the app and open the new-password screen automatically.

Account deletion is intentionally server-authorized. Deploy [`supabase/functions/delete-account/index.ts`](supabase/functions/delete-account/index.ts) as the `delete-account` Edge Function; Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Any user-owned database rows should reference `auth.users` with `ON DELETE CASCADE` so deletion also removes synced study data.

## Study Pack sharing

Study Pack sharing uses the sanitized generated-content snapshot in [`src/services/sharing.ts`](src/services/sharing.ts). It excludes original source text/uploads, quiz history, mastery, listening position, and account data. A recipient sees a read-only preview and gets fresh progress when they choose “Save copy”.

Run [`supabase/migrations/20260911000000_shared_study_packs.sql`](supabase/migrations/20260911000000_shared_study_packs.sql) against the project that provides Auth (`supabase link --project-ref <project-ref>` followed by `supabase db push`, or paste the migration into the Supabase SQL editor), then set `EXPO_PUBLIC_STUDYBOLT_SHARE_BASE_URL` to the public web route, for example `https://your-domain.example/share`. Without that value, native builds use the app-only fallback `studybolt://share/<token>`; it is useful for local installed-app testing but does not provide a web fallback.

The app accepts these deep-link shapes:

```text
studybolt://share/<share-token>
https://<your-domain>/share/<share-token>
```

For production Universal Links/App Links, add the domain to the native build configuration and host Apple’s `apple-app-site-association` plus Android’s `/.well-known/assetlinks.json` for `com.studybolt.app`. The repository does not invent or claim ownership of a production domain, so those association files and hosting remain deployment steps.

## Verification

```bash
npm run typecheck
npm run check
```

Local study reminders are scheduled on iOS and Android after the user grants notification permission; web displays an honest unsupported state. Account sync, server extraction/generation, production subscriptions, background/lock-screen audio, and store configuration require dedicated backend/native setup.

## Learning-science basis

StudyBolt applies research findings conservatively and never describes its mastery estimate as a scientific measurement of what a student knows:

- Retrieval-first cards and low-stakes quizzes follow the testing-effect findings in [Roediger & Karpicke (2006)](https://pubmed.ncbi.nlm.nih.gov/16507066/).
- Deadline plans distribute study across available days based on the large spacing-effect review in [Cepeda et al. (2006)](https://pubmed.ncbi.nlm.nih.gov/16719566/).
- Practice testing and distributed practice are emphasized because they received high-utility ratings across learning conditions in [Dunlosky et al. (2013)](https://doi.org/10.1177/1529100612453266).
