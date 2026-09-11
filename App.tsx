import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/AuthContext';
import { StudyBoltProvider } from './src/StudyBoltContext';
import { StudyBoltNavigator } from './src/navigation/StudyBoltNavigator';

export default function App() {
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
