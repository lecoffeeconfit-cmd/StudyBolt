import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/AuthContext';
import { StudyBoltProvider } from './src/StudyBoltContext';
import { StudyBoltNavigator } from './src/navigation/StudyBoltNavigator';
import { hasApprovedLegalDocuments } from './src/config/legal';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  // Do not send diagnostics until the published privacy notice is complete and approved.
  dsn: hasApprovedLegalDocuments ? process.env.EXPO_PUBLIC_SENTRY_DSN : undefined,
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

export default Sentry.wrap(function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StudyBoltProvider>
          <StudyBoltNavigator />
        </StudyBoltProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
});
