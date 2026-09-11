import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../AuthContext';
import { AuthField } from '../components/AuthField';
import { Card, Header, Icon, PrimaryButton, Screen } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';

export function ResetPasswordScreen({ onComplete }: { onComplete: () => void }) {
  const { colors } = useStudyBolt();
  const { changePassword, finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrance, { toValue: 1, damping: 17, stiffness: 150, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [entrance]);

  const submit = async () => {
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await changePassword(password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    finishRecovery();
    onComplete();
  };

  return (
    <Screen>
      <Header title="New password" subtitle="Secure your account" />
      <Animated.View style={[styles.content, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}><Icon name="lock-check-outline" size={34} color={colors.primary} /></View>
        <Text style={[styles.title, { color: colors.text }]}>Choose a new password</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Make it memorable and different from passwords you use elsewhere.</Text>
        {error ? (
          <View style={[styles.error, { backgroundColor: `${colors.danger}14` }]}>
            <Icon name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}
        <Card style={styles.form}>
          <AuthField label="New password" icon="lock-outline" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secure autoComplete="new-password" />
          <AuthField label="Confirm password" icon="lock-check-outline" value={confirmation} onChangeText={setConfirmation} placeholder="Type it again" secure autoComplete="new-password" />
          <PrimaryButton label="Update password" icon="check" loading={busy} onPress={() => void submit()} style={styles.button} />
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingTop: 32 },
  iconWrap: { width: 72, height: 72, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.7, marginTop: 18 },
  subtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 380, marginTop: 7 },
  error: { width: '100%', minHeight: 46, borderRadius: 13, paddingHorizontal: 12, marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  form: { width: '100%', gap: 14, marginTop: 22 },
  button: { marginTop: 3 },
});
