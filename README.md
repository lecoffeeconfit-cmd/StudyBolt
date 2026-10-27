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
- Layered simplified and detailed notes with source coverage, learning-focused structure, recall prompts, and reviewed state
- Active-recall flashcards with Again / Learning / Got It mastery
- Adjustable 10/15/20-question practice quizzes plus a separate cumulative PowerPoint test
- StudyCast device text-to-speech for Original and Quick Review modes, including hybrid speed controls, a full device-voice picker with previews, current-section context, skip, pause, and resume
- Deterministic mastery estimates, progress stats, exam-review combination, modality-aware deadline plans, light/dark/system themes
- Local iOS/Android study reminders scheduled across active days in a learning plan
- Offline persistence with AsyncStorage
- PDF/PPT/PPTX picker plus notes-file uploads (`.txt`, `.md`, `.rtf`, `.doc`, and `.docx`) with honest validation/error states
- First-run onboarding plus an optional guest path
- Email/password, Google, and Apple sign-in UI with password recovery and account management

The additional Psychology and Chemistry cards are visual development content; Biology is the complete realistic sample.

## Secure processor contract

Real PDF and PowerPoint extraction/generation requires a server because model credentials must never ship in the app and robust PPTX extraction is not reliably portable on-device. The app uses this Supabase Edge Function by default when `EXPO_PUBLIC_SUPABASE_URL` is set; a custom processor can still be supplied with:

```bash
EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL=https://your-private-endpoint.example/process
```

The included `supabase/functions/studybolt-process-document/index.ts` requires a valid signed-in Supabase user for both multipart uploads and JSON material-generation requests. It receives multipart form fields `file`, `courseName`, `documentType`, `extension`, and `action=extract`, uploads/reads the source once, and returns a Study Pack shell containing the normalized source and outline. The app persists that normalized source locally, opens the pack immediately, and sends independent JSON `action=generate` requests for Simplified Notes, Detailed Notes, Key Concepts, Flashcards, Audio Summary, and Practice Quiz. A failed material can therefore be retried without uploading or extracting the document again. The server bounds uploads to 20 MB and material-generation requests to 512 KB.

```bash
supabase functions deploy studybolt-process-document
supabase secrets set OPENAI_API_KEY=your_server_key
```

The mobile build carries the self-hosted VPS processor route in `app.json` and in the client as a final built-in fallback, so an EAS build does not silently route uploads to a hosted Supabase project when the `EXPO_PUBLIC_*` values were not copied into its environment. `EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL` takes precedence, followed by the manifest route and then the same VPS route.

The function does not retain uploaded source files, deletes temporary provider files after processing, and uses `store: false` for every model response. Each extraction and generated material reserves an interaction in the same atomic per-user ledger as AI Tutor, then records actual provider token usage and cost. Per-user monthly, daily, rolling-window, concurrency, and budget checks apply. The shared ledger also has project-wide daily request, concurrency, and spend limits. Set those limits in `ai_cloud_config` for the launch plan and set an OpenAI project spend ceiling as a separate provider-side safeguard. The normalized source and per-material status live in the existing local AsyncStorage Study Pack record. A custom endpoint must keep uploads private and implement both the extraction and per-material JSON contracts. Both `notes` and `detailedNotes` must cover every source-outline section and retain a source reference for every chunk. Simplified notes are the fast layer: a condensed, one-sentence organizing summary, a short set of core ideas, one key relationship, and retrieval prompts. Detailed notes preserve meaningful source claims and wording in hierarchical subsections, connect related ideas, include grounded examples when present, and end with retrieval prompts. Content must remain source-grounded. StudyBolt uses generated notes and flashcards to build a cumulative test. Malformed or incomplete responses are rejected, and legacy/shared packs are normalized into distinct layers on load.

The OpenAI API key and Supabase service-role key must remain server-only secrets. Never add either to an Expo environment variable. No Supabase or AI credentials are currently invented or required for the local demo.

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

## StudyCast AI Tutor, Discover, and Classes

The community/StudyCast backend is defined by [`supabase/migrations/20260912000000_studycast_discover_classes.sql`](supabase/migrations/20260912000000_studycast_discover_classes.sql) and [`supabase/migrations/20260913000000_ai_cloud_ledger.sql`](supabase/migrations/20260913000000_ai_cloud_ledger.sql). They extend the existing sanitized share snapshots with Private / Anyone with link / Public visibility, optional class association, fork attribution, non-essential aggregate counts, public-only paginated discovery RPCs, class membership, and a server-enforced AI router ledger. Direct public table reads are intentionally not used for Discover or shared previews; shaped security-definer functions expose only the required public fields and always filter visibility.

Apply the sharing, classes, and AI ledger migrations (including global AI budget controls), then deploy both protected AI functions:

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy studybolt-ai-tutor
supabase functions deploy studybolt-process-document
```

The self-hosted Supabase VPS must provide `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` only to Edge Functions. The mobile app never receives either key. Document uploads require a verified Supabase session, are capped at 20 MB, and use a generic provider filename. OpenAI file uploads are deleted after processing and have a one-hour expiry as a fallback. The functions read server-managed `ai_cloud_config` and record atomic reservations/reconciliation in `ai_usage_periods`, `ai_usage_reservations`, and `ai_usage_events`. Initial quota defaults are 10 interactions/month for free users and 250 for premium users; document extraction and every generated material use the same allowance. The migration raises the default per-user cost budgets to $0.25/month for free users and $5/month for premium users so complete Study Packs can be generated, while preserving operator-customized values. Project-wide defaults are $5/day, 500 requests/day, and 20 concurrent requests. Review these limits against your OpenAI prices and launch economics before launch. The server reads paid entitlement from trusted Auth `app_metadata`; client-provided plan or user IDs are ignored.

### Premium subscriptions

Paid subscriptions use RevenueCat for App Store / Google Play purchase validation and lifecycle delivery. StudyBolt configures RevenueCat only after sign-in and uses the Supabase user UUID as the store customer ID. The client never writes Premium status: a timestamp-checked HMAC webhook triggers a server-side lookup of RevenueCat's current subscriber record, then updates only StudyBolt-specific fields in trusted Auth `app_metadata`. Duplicate and out-of-order events are idempotent; account transfers reconcile both sides; AI endpoints enforce the resulting plan from server-side metadata. Renewal, cancellation, grace period, refunds, and expiration follow the current store entitlement. Anonymous RevenueCat IDs are ignored.

Before enabling checkout in a release:

1. Create the Premium entitlement in RevenueCat, add the iOS and Android store products, and publish an offering. Build a native iOS/Android app with the matching public SDK keys in EAS environment variables `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
2. Complete every placeholder in the privacy policy and terms and review the published wording. Set `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` for each app build. The legal links are prefilled with the current GitHub Pages URLs; checkout stays disabled until `EXPO_PUBLIC_LEGAL_DOCUMENTS_APPROVED=true` is set after the documents are complete.
3. Set the matching `STUDYBOLT_PRIVACY_POLICY_URL` and `STUDYBOLT_TERMS_OF_SERVICE_URL` Supabase secrets. Cloud AI answers, document processing, and subscription status sync stay paused until `STUDYBOLT_LEGAL_DOCUMENTS_APPROVED=true` is set after the policy text is complete.
4. Apply the subscription migrations and deploy the webhook and authenticated status-sync function. In RevenueCat, configure the HTTPS endpoint `https://<supabase-project-host>/functions/v1/revenuecat-webhook`, enable HMAC signing, and use the entitlement identifier exactly as configured in RevenueCat.

```bash
supabase db push
supabase functions deploy revenuecat-webhook
supabase functions deploy studybolt-sync-subscription
supabase secrets set REVENUECAT_WEBHOOK_SECRET=<signing-secret> REVENUECAT_SECRET_API_KEY=<secret-api-key> REVENUECAT_PREMIUM_ENTITLEMENT=<entitlement-id>
supabase secrets set STUDYBOLT_PRIVACY_POLICY_URL=https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy STUDYBOLT_TERMS_OF_SERVICE_URL=https://lecoffeeconfit-cmd.github.io/studybolt-legal/termsofservice STUDYBOLT_LEGAL_DOCUMENTS_APPROVED=false
```

The HMAC signing secret, RevenueCat Secret API key, and entitlement ID are server-only Supabase secrets. Verify sandbox purchase, renewal, cancellation, grace-period, refund, restore, account transfer, and webhook retry behavior before enabling store products for production. Web checkout is not included; RevenueCat Web Billing requires its own product setup and server integration. The app displays the current allowance from the authenticated AI endpoint and does not treat the store SDK's client response as an entitlement grant.

StudyCast playback remains device TTS and makes no AI request. Only Explain, Simplify, Example, Quiz me, or an explicitly submitted question starts tutoring. The client sends the current note chunk and at most two neighboring chunks rather than the complete Study Pack. Expo Speech does not expose portable word-boundary callbacks, so the saved position is the app’s existing word/time estimate; it is preserved when the Tutor opens and used to resume the same study chunk.

### On-device AI

StudyBolt now prefers the phone’s internal AI before the cloud Tutor. The local Expo module in [`modules/studybolt-on-device-ai`](modules/studybolt-on-device-ai) uses Apple’s Foundation Models framework on eligible iPhones and ML Kit Prompt API/Gemini Nano on eligible Android devices. Context and answers stay on the phone, no StudyBolt sign-in is required, and local questions do not consume the monthly cloud quota. If phone AI is unsupported or disabled, the existing authenticated Supabase Tutor remains the fallback. A failed local generation is not silently resent to the cloud.

This native capability is not available in Expo Go or the web build. Create a development or production build after adding the module:

```bash
npx expo run:ios
npx expo run:android
```

iOS requires a current Xcode SDK plus iOS 26 or later on an Apple Intelligence-capable device with Apple Intelligence enabled. The Swift bridge remains buildable on older deployment targets and reports the feature as unavailable there. Android uses `com.google.mlkit:genai-prompt:1.0.0-beta4`, requires Android API 26 or later, and checks Gemini Nano/AICore availability at runtime. When Android reports that the model is downloadable, the first explicit Tutor request prepares it before inference. Availability varies by phone, region, language, system settings, and downloaded model state, so both platforms retain polished fallback states.

Discover is added without removing any existing destination. It provides debounced search, paginated public-set/class queries, lightweight subject relevance, Newest / Popular / Most saved sorting, joined-class pages, and a local Shared view for imported forks. When the backend or network is unavailable, saved Study Packs and normal StudyCast playback remain functional and Discover shows an intentional recovery state.

Interactive StudyCast and Drive Mode are now explicit, opt-in session surfaces with a small voice-session state machine, section pauses, quiz checkpoints, barge-in-safe Speech.stop handling, and large touch controls. The current Expo dependency set does not include a native speech-recognition permission/module, so native builds expose the safe touch/TTS fallback rather than pretending microphone input is available; a future development build can attach a recognizer to `src/services/voiceInteraction.ts` without changing the StudyCast state model.

## Admin Center

Profile/settings includes an Admin Center for authorized StudyBolt admins, with
reporting ranges, activity and cloud-cost summaries, a searchable user directory,
complimentary AI access controls, and a support inbox. Help & support lets
learners submit requests and view admin replies. See
[`supabase/admin_center_setup.md`](supabase/admin_center_setup.md) for activation,
permissions, and shared-Auth scoping. Admin analytics exclude private study content.

## Verification

```bash
npm run typecheck
npm run check
```

Local study reminders are scheduled on iOS and Android after the user grants notification permission; web displays an honest unsupported state. Account sync, server extraction/generation, production subscription sales, background/lock-screen audio, and store products require dedicated backend/native setup. Subscription checkout stays disabled until both hosted legal links are configured.

## Learning-science basis

StudyBolt applies research findings conservatively and never describes its mastery estimate as a scientific measurement of what a student knows:

- Retrieval-first cards and low-stakes quizzes follow the testing-effect findings in [Roediger & Karpicke (2006)](https://pubmed.ncbi.nlm.nih.gov/16507066/).
- Notes use overviews, headings, and explicit topic structure based on organizational-signaling findings in [Lorch & Lorch (1996)](https://doi.org/10.1037/0022-0663.88.1.38).
- Source material is presented in manageable, learner-controlled chunks, drawing on the segmentation findings in [Mayer & Chandler (2001)](https://doi.org/10.1037/0022-0663.93.2.390).
- “Retrieve it” and connection prompts combine retrieval practice with self-explanation, informed by [Karpicke & Blunt (2011)](https://pubmed.ncbi.nlm.nih.gov/21252317/) and [Chi et al. (1994)](https://doi.org/10.1207/s15516709cog1803_3).
- Deadline plans distribute study across available days based on the large spacing-effect review in [Cepeda et al. (2006)](https://pubmed.ncbi.nlm.nih.gov/16719566/).
- Practice testing and distributed practice are emphasized because they received high-utility ratings across learning conditions in [Dunlosky et al. (2013)](https://doi.org/10.1177/1529100612453266).
