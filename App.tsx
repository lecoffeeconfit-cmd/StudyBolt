import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/AuthContext';
import { StudyBoltProvider } from './src/StudyBoltContext';
import { StudyBoltNavigator } from './src/navigation/StudyBoltNavigator';
import { disableStudyReminders } from './src/services/notifications';
import { StudyBoltLaunch } from './src/components/StudyBoltLaunch';
import { StudyBoltLoading } from './src/components/StudyBoltLoading';
import { resolveColors, type AppColors } from './src/theme';
import { useIncreasedContrast } from './src/hooks/useIncreasedContrast';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(MaterialCommunityIcons.font);
  const increaseContrast = useIncreasedContrast();
  const systemColors = resolveColors('system', useColorScheme(), undefined, increaseContrast);
  const [workspaceColors, setWorkspaceColors] = useState<AppColors>();
  const colors = workspaceColors ?? systemColors;
  const [launchVisible, setLaunchVisible] = useState(true);
  const finishLaunch = useCallback(() => setLaunchVisible(false), []);
  const fontsReady = Boolean(fontsLoaded || fontError);

  useEffect(() => {
    if (fontError) console.error('StudyBolt icon font could not be loaded.', fontError);
  }, [fontError]);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.colorScheme = colors.mode;
    document.documentElement.style.backgroundColor = colors.background;
  }, [colors]);

  return (
    <SafeAreaProvider>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.root} aria-hidden={launchVisible} accessibilityElementsHidden={launchVisible} importantForAccessibility={launchVisible ? 'no-hide-descendants' : 'auto'}>
          {fontsReady ? <AuthProvider><AccountWorkspace onAppearanceReady={setWorkspaceColors} colors={colors} increaseContrast={increaseContrast} launching={launchVisible} /></AuthProvider> : null}
        </View>
        {launchVisible ? <StudyBoltLaunch ready={fontsReady && Boolean(workspaceColors)} colors={colors} onFinished={finishLaunch} /> : null}
      </View>
    </SafeAreaProvider>
  );
}

function AccountWorkspace({ onAppearanceReady, colors, increaseContrast, launching }: {
  onAppearanceReady: (colors: AppColors) => void;
  colors: AppColors;
  increaseContrast: boolean;
  launching: boolean;
}) {
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
  if (loading) return launching ? null : <View style={[styles.starting, { backgroundColor: colors.background }]}>
    <StudyBoltLoading colors={colors} message="Opening your study space…" />
  </View>;
  // Remount private screens, tutors, playback and generation state on a switch.
  return <StudyBoltProvider key={account ?? 'guest'} loadingColors={colors} increaseContrast={increaseContrast} onAppearanceReady={onAppearanceReady}><StudyBoltNavigator /></StudyBoltProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  starting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
});
