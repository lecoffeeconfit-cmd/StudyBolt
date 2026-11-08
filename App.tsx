import React, { useCallback, useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/AuthContext';
import { StudyBoltProvider } from './src/StudyBoltContext';
import { StudyBoltNavigator } from './src/navigation/StudyBoltNavigator';
import { disableStudyReminders } from './src/services/notifications';
import { StudyBoltLaunch } from './src/components/StudyBoltLaunch';
import { StudyBoltLoading } from './src/components/StudyBoltLoading';
import { resolveColors } from './src/theme';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(MaterialCommunityIcons.font);
  const colors = resolveColors('system', useColorScheme());
  const [launchVisible, setLaunchVisible] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const onWorkspaceReady = useCallback(() => setWorkspaceReady(true), []);
  const finishLaunch = useCallback(() => setLaunchVisible(false), []);
  const fontsReady = Boolean(fontsLoaded || fontError);

  useEffect(() => {
    if (fontError) console.error('StudyBolt icon font could not be loaded.', fontError);
  }, [fontError]);

  return (
    <SafeAreaProvider>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.root} aria-hidden={launchVisible} accessibilityElementsHidden={launchVisible} importantForAccessibility={launchVisible ? 'no-hide-descendants' : 'auto'}>
          {fontsReady ? <AuthProvider><AccountWorkspace onInitialContentReady={onWorkspaceReady} launching={launchVisible} /></AuthProvider> : null}
        </View>
        {launchVisible ? <StudyBoltLaunch ready={fontsReady && workspaceReady} onFinished={finishLaunch} /> : null}
      </View>
    </SafeAreaProvider>
  );
}

function AccountWorkspace({ onInitialContentReady, launching }: { onInitialContentReady: () => void; launching: boolean }) {
  const { user, loading } = useAuth();
  const previousAccount = React.useRef<string | null | undefined>(undefined);
  const account = user?.id ?? null;
  useEffect(() => {
    if (loading) return;
    if (previousAccount.current !== undefined && previousAccount.current !== account) {
      void disableStudyReminders();
    }
    previousAccount.current = account;
  }, [account, loading]);
  if (loading) return launching ? null : <AppStarting />;
  // Remount private screens, tutors, playback and generation state on a switch.
  return <StudyBoltProvider key={account ?? 'guest'} onInitialContentReady={onInitialContentReady}><StudyBoltNavigator /></StudyBoltProvider>;
}

function AppStarting() {
  const colors = resolveColors('system', useColorScheme());

  return (
    <View style={[styles.starting, { backgroundColor: colors.background }]}>
      <StudyBoltLoading colors={colors} message="Opening your study space…" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  starting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
