const appEnvironment = process.env.EXPO_PUBLIC_APP_ENV;

// The App Store build keeps public user-to-user content disabled until the
// service has in-context reporting, blocking, and moderation. Reuse the EAS
// environment marker so preview builds can still exercise the existing flow.
export const isCommunitySharingEnabled = appEnvironment === 'development' || appEnvironment === 'staging';
