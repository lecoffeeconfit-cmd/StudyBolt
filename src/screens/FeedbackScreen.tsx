import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { Card, Header, Pill, PrimaryButton, Screen, SectionHeader } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import { fetchMyFeedback, submitFeedback, type FeedbackReport } from '../services/admin';

export function FeedbackScreen({ onBack, onRequireAuth }: { onBack: () => void; onRequireAuth: () => void }) {
  const { colors } = useStudyBolt();
  const { user } = useAuth();
  const [category, setCategory] = useState<FeedbackReport['category']>('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    try { setReports(await fetchMyFeedback()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Support could not be loaded.'); }
    finally { setLoading(false); }
  }, [user]);
  useEffect(() => { setReports([]); void load(); }, [load]);

  const send = async () => {
    setSending(true); setError(null); setNotice(null);
    try {
      await submitFeedback(category, subject, message);
      setSubject(''); setMessage(''); setNotice('Request sent. Replies will appear below.');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Your request could not be sent.'); }
    finally { setSending(false); }
  };

  return <Screen>
    <Header title="Help & support" onBack={onBack} />
    <Card><Text style={[styles.title, { color: colors.text }]}>Help us improve StudyBolt</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>Report a problem, suggest an idea, or ask a question. Describe what happened without including private study material or passwords.</Text></Card>
    {!user ? <Card><Text style={[styles.copy, { color: colors.textSecondary }]}>Sign in to send a request and receive replies from StudyBolt support.</Text><PrimaryButton label="Sign in for support" icon="login" onPress={onRequireAuth} style={styles.gap} /></Card> : <>
      <Card>
        <View style={styles.options}>{(['bug', 'idea', 'question'] as const).map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => setCategory(item)} style={[styles.option, { backgroundColor: category === item ? colors.primary : colors.cardStrong }]}><Text style={[styles.optionLabel, { color: category === item ? colors.primaryText : colors.textSecondary }]}>{item === 'bug' ? 'Problem' : item === 'idea' ? 'Idea' : 'Question'}</Text></Pressable>)}</View>
        <TextInput accessibilityLabel="Support request subject" value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={colors.textMuted} maxLength={120} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
        <TextInput accessibilityLabel="Support request details" value={message} onChangeText={setMessage} placeholder="Tell us more…" placeholderTextColor={colors.textMuted} multiline maxLength={3000} textAlignVertical="top" style={[styles.input, styles.message, { color: colors.text, borderColor: colors.border }]} />
        <PrimaryButton label="Send request" icon="send-outline" loading={sending} disabled={subject.trim().length < 3 || message.trim().length < 10} onPress={() => void send()} style={styles.gap} />
      </Card>
      {notice ? <Text accessibilityRole="alert" style={[styles.copy, { color: colors.mint }]}>{notice}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={[styles.copy, { color: colors.danger }]}>{error}</Text> : null}
      <SectionHeader title="Your requests" action="Refresh" onAction={() => void load()} />
      {loading ? <ActivityIndicator color={colors.primary} /> : reports.map(report => <Card key={report.id}><View style={styles.reportHeader}><Text style={[styles.title, styles.flex, { color: colors.text }]}>{report.subject}</Text><Pill label={report.status} tone={report.status === 'resolved' ? 'mint' : 'neutral'} /></View><Text style={[styles.copy, { color: colors.textMuted }]}>{new Date(report.created_at).toLocaleDateString()}</Text><Text style={[styles.copy, styles.gap, { color: colors.textSecondary }]}>{report.message}</Text>{report.admin_reply ? <View style={[styles.reply, { backgroundColor: colors.primarySoft }]}><Text style={[styles.optionLabel, { color: colors.primary }]}>StudyBolt support</Text><Text style={[styles.copy, { color: colors.text }]}>{report.admin_reply}</Text></View> : <Text style={[styles.copy, styles.gap, { color: colors.textMuted }]}>We’ll review your request and reply here.</Text>}</Card>)}
      {!loading && !reports.length && !error ? <Card><Text style={[styles.copy, { color: colors.textMuted }]}>Your support requests will appear here after you send one.</Text></Card> : null}
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', lineHeight: 23 }, copy: { fontSize: 13, lineHeight: 20, marginTop: 6 }, gap: { marginTop: 14 }, flex: { flex: 1 },
  options: { flexDirection: 'row', gap: 8 }, option: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' }, optionLabel: { fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, padding: 13, marginTop: 14, fontSize: 14 }, message: { minHeight: 120 }, reportHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, reply: { padding: 13, borderRadius: 12, marginTop: 14 },
});
