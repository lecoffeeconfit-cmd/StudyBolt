import * as Sentry from '@sentry/react-native';

import { hasApprovedLegalDocuments } from '../config/legal';

// Client DSNs are public; this fallback keeps EAS builds connected even if the
// optional EXPO_PUBLIC_SENTRY_DSN environment variable was not copied to EAS.
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN
  || 'https://ddd535a77f72186e450cf1e5b4394176@o4511657628008448.ingest.us.sentry.io/4512200025243648';

Sentry.init({
  // Keep diagnostics off until the published privacy notice is complete and approved.
  dsn: hasApprovedLegalDocuments ? sentryDsn : undefined,
  enableLogs: false,
  sendDefaultPii: false,
  beforeSend(event) {
    event.user = undefined;
    if (event.request) {
      event.request.url = safeRequestOrigin(event.request.url);
      event.request.data = undefined;
      event.request.headers = undefined;
      event.request.cookies = undefined;
    }
    event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({ ...breadcrumb, message: undefined, data: undefined }));
    return event;
  },
});

function safeRequestOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}
