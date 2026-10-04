const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICE_NAME = 'com.studybolt.backgroundplayback.StudyCastPlaybackService';

module.exports = function withStudyCastBackgroundPlayback(config) {
  return withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) return modConfig;

    application.service = application.service ?? [];
    if (!application.service.some((service) => service.$?.['android:name'] === SERVICE_NAME)) {
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaPlayback',
        },
      });
    }

    return modConfig;
  });
};
