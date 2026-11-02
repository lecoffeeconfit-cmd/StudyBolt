import React, { useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/AuthContext';
import { StudyBoltProvider } from './src/StudyBoltContext';
import { StudyBoltNavigator } from './src/navigation/StudyBoltNavigator';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(MaterialCommunityIcons.font);

  useEffect(() => {
    if (fontError) console.error('StudyBolt icon font could not be loaded.', fontError);
  }, [fontError]);

  if (!fontsLoaded && !fontError) return <AppStarting />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StudyBoltProvider>
          <StudyBoltNavigator />
        </StudyBoltProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function AppStarting() {
  const isDark = useColorScheme() === 'dark';
  const backgroundColor = isDark ? '#0E1217' : '#F7F9FD';
  const textColor = isDark ? '#E8EDF2' : '#111C4E';
  const mutedColor = isDark ? '#BBC4CD' : '#536080';
  const accentColor = isDark ? '#7AA8F5' : '#1678FF';

  return (
    <View style={[styles.starting, { backgroundColor }]}>
      <Text style={[styles.startingTitle, { color: textColor }]}>StudyBolt</Text>
      <ActivityIndicator color={accentColor} />
      <Text style={[styles.startingMessage, { color: mutedColor }]}>Getting your study space ready…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  starting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  startingTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  startingMessage: { fontSize: 13 },
});
