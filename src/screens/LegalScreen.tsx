import React, { useEffect, useRef } from 'react';
import { Animated, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Header, Icon, Screen } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import { LEGAL_URLS } from '../config/legal';
import { radius } from '../theme';

type LegalDocument = keyof typeof LEGAL_URLS;

const DOCUMENTS: Array<{
  id: LegalDocument;
  title: string;
  description: string;
  icon: 'shield-check-outline' | 'file-document-edit-outline';
}> = [
  {
    id: 'privacyPolicy',
    title: 'Privacy policy',
    description: 'How StudyBolt handles your account, study materials, and data.',
    icon: 'shield-check-outline',
  },
  {
    id: 'termsOfService',
    title: 'Terms of service',
    description: 'The simple ground rules for using StudyBolt and its study tools.',
    icon: 'file-document-edit-outline',
  },
];

export function LegalScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useStudyBolt();
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      damping: 18,
      stiffness: 150,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [entrance]);

  const openDocument = (id: LegalDocument) => {
    const url = LEGAL_URLS[id];
    if (url) void Linking.openURL(url);
  };

  return (
    <Screen>
      <Header title="Legal" subtitle="Privacy & terms" onBack={onBack} />
      <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.mintSoft }]}><Icon name="shield-lock-outline" size={29} color={colors.mint} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Your trust, in plain language.</Text>
            <Text style={[styles.heroCopy, { color: colors.textSecondary }]}>Review how your account and study materials are handled. We keep these links easy to find.</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DOCUMENTS</Text>
        <View style={styles.documents}>
          {DOCUMENTS.map((document) => {
            const url = LEGAL_URLS[document.id];
            const ready = Boolean(url);
            return (
              <Pressable
                key={document.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ready }}
                disabled={!ready}
                onPress={() => openDocument(document.id)}
                style={({ pressed }) => [
                  styles.documentCard,
                  { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, opacity: pressed ? 0.74 : 1 },
                ]}
              >
                <View style={[styles.documentIcon, { backgroundColor: document.id === 'privacyPolicy' ? colors.mintSoft : colors.primarySoft }]}>
                  <Icon name={document.icon} size={23} color={document.id === 'privacyPolicy' ? colors.mint : colors.primary} />
                </View>
                <View style={styles.documentCopy}>
                  <Text style={[styles.documentTitle, { color: colors.text }]}>{document.title}</Text>
                  <Text style={[styles.documentDescription, { color: colors.textSecondary }]}>{document.description}</Text>
                  <View style={[styles.documentStatus, { backgroundColor: ready ? colors.primarySoft : colors.cardStrong }]}>
                    <Text style={[styles.documentStatusText, { color: ready ? colors.primary : colors.textMuted }]}>{ready ? 'Read online' : 'URL coming soon'}</Text>
                  </View>
                </View>
                <Icon name={ready ? 'open-in-new' : 'link-variant-off'} size={18} color={ready ? colors.primary : colors.textMuted} />
              </Pressable>
            );
          })}
        </View>

        <Card style={[styles.noteCard, { backgroundColor: colors.primarySoft }]}>
          <View style={[styles.noteIcon, { backgroundColor: colors.card }]}><Icon name="link-variant" size={19} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.noteTitle, { color: colors.text }]}>Add your URLs when ready</Text>
            <Text style={[styles.noteCopy, { color: colors.textSecondary }]}>Update <Text style={styles.code}>src/config/legal.ts</Text> with your hosted policy links. The buttons will activate automatically.</Text>
          </View>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 17 },
  heroIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  heroCopy: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 20, marginBottom: 10 },
  documents: { gap: 11 },
  documentCard: { minHeight: 123, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 11, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2 },
  documentIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  documentCopy: { flex: 1, minWidth: 0 },
  documentTitle: { fontSize: 14, fontWeight: '900' },
  documentDescription: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  documentStatus: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 5, marginTop: 9 },
  documentStatusText: { fontSize: 9, fontWeight: '900' },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 22 },
  noteIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  noteTitle: { fontSize: 12, fontWeight: '900' },
  noteCopy: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  code: { fontWeight: '900' },
});
