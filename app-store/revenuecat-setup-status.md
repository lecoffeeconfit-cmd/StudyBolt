# RevenueCat setup status

Updated 27 October 2026. This records verified configuration, not release approval.

## Installed and verified

- RevenueCat project: `StudyBolt` (`4ff86a20`).
- Entitlement: `premium`. Current offering: `default`, with `$rc_monthly` and `$rc_annual` packages.
- Apple app: `com.lecoffeeconfit.studybolt` (`appa7e4bd232a`). RevenueCat validates the existing purchase and App Store Connect credentials, and reports Apple server notifications configured correctly.
- Apple products created in the `StudyBolt Premium` subscription group: `studybolt_premium_monthly` (one month) and `studybolt_premium_annual` (one year). Both are attached to Premium and their matching offering packages.
- Android app configuration: `com.studybolt.app` (`appc576b84854`). Catalog mappings `studybolt_premium_monthly:monthly` and `studybolt_premium_annual:annual` are attached to Premium and their matching packages. Google Play service-account credentials and actual store base plans are still required.
- Test Store products match the requested pricing: `studybolt_test_monthly_299` ($2.99/month) and `studybolt_test_annual_1999_7d` ($19.99/year with a one-week free trial). They are attached to Premium and the default offering. The automatically generated products with other prices were made inactive. No Test Store SDK key is installed in release builds.
- Both public SDK keys are installed in ignored `.env.local` and the EAS `preview` and `production` environments. The local app uses the same account backend as production.
- Signed webhook: `https://studybolt-api.duckdns.org/functions/v1/revenuecat-webhook`, all events/apps, sandbox and production. RevenueCat's signed dashboard test returned HTTP 200.
- Server configuration is installed and persisted in Coolify's encrypted environment store. The existing deployment variable `REVENUECAT_SECRET_API_KEY` holds the public Apple SDK key for read-only API v1 subscriber lookups; no privileged RevenueCat API key was created. The webhook signing secret stays on the server.
- Subscription functions and the monthly PowerPoint allowance migration `20261027000000` are deployed to production.
- Existing saved Study Packs remain accessible. Free users receive one successful PowerPoint import per UTC calendar month. Active trials and paid memberships bypass this import cap; the existing AI usage budgets still apply.

## Checks passed

- TypeScript check and Expo web export.
- Database integration checks with rolled-back fixtures: free allowance, failed-upload recovery, duplicate requests, expired trials, paid renewal, monthly reset, and client permission restrictions.
- Six concurrent distinct uploads allow exactly one free import; temporary account removed.
- Live signed webhook → RevenueCat subscriber lookup → StudyBolt account metadata update; duplicate event is recorded once. Invalid and expired signatures return HTTP 401. Temporary account removed.
- Deployed subscription function hashes match the project sources.

## Required before checkout can be enabled

1. Upload [`studybolt-app-store-products.csv`](studybolt-app-store-products.csv) to the prepared RevenueCat Product editor. Review and commit the US prices ($2.99 monthly, $19.99 annually), English product descriptions, and annual 7-day free trial. The products currently show **Missing Metadata**; prices and the trial have not yet been applied. The browser file picker did not respond to supported automation attempts.
2. Complete and approve the published privacy policy and terms. They still contain operator/contact/age/jurisdiction and other placeholders. Keep both legal approval flags false until the documents are finished. The existing gate pauses checkout, cloud document processing, and subscription status sync.
3. Supply Google Play service-account credentials for `com.studybolt.app`, create/activate matching subscription base plans and the annual trial, and complete Google notifications setup.
4. The `preview` environment still needs its intended backend URL/anon key. A separate StudyBolt staging backend was not identified; preview has not been redirected to production.
5. Complete Apple subscription metadata/review requirements and perform a native sandbox purchase, restore, renewal, trial expiry, cancellation, and refund check in a fresh build. Backend lifecycle simulations do not replace a store purchase test.
6. Before deploying account-deletion cleanup, create a RevenueCat REST API v2 secret key limited to `customer_information:customers:read_write` and store it in the server's encrypted secret configuration as `REVENUECAT_CUSTOMER_DELETE_API_KEY`, with the public project ID as `REVENUECAT_PROJECT_ID`. The app does not receive this key.

Published policy links:

- [Privacy policy](https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy)
- [Terms](https://lecoffeeconfit-cmd.github.io/studybolt-legal/termsofservice)

Private backup locations remain on the VPS under `/root/studybolt-subscription-backups/`; the Coolify pre-change service definition backup is private inside its container. No credentials are included in this document or the product CSV.
