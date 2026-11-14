import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Card, Icon, ProgressBar } from './ui';
import type { IconName } from './ui';
import { useStudyBolt } from '../StudyBoltContext';
import { PageEntrance as Reveal } from './PagePresentation';
import { makeStatDetail } from '../data/statExplanations';
import type { StatDetail } from '../data/statExplanations';
import type { StudyBoltState } from '../models';
import type { AnalyticsSnapshot } from '../services/analytics';
import type { LearningMasteryGroup, LearningPracticeAction } from '../services/learningMastery';
import { statsHistoryWindow, statsLearningDetails, statsPractice } from './statsLearningPresentation';
import type { StatsResult, StatsTopic } from './statsLearningPresentation';
import { spacing, typography } from '../theme';

const percent = (value: number | null) => value === null ? '—' : `${value}%`;
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Stats-only presentation. Every destination uses the app's existing study action. */
export function StatsLearningDashboard({ state, group, analytics, onDetail, onPractice }: {
  state: StudyBoltState; group: LearningMasteryGroup; analytics: AnalyticsSnapshot;
  onDetail: (detail: StatDetail) => void; onPractice: (action: LearningPracticeAction) => void;
}) {
  const { colors } = useStudyBolt();
  const data = useMemo(() => statsLearningDetails(state, group, analytics), [state, group, analytics]);
  const [allTopics, setAllTopics] = useState(false);
  const [allMaterials, setAllMaterials] = useState(false);
  const mode = state.retentionMode === 'standard' ? 'Time-based review timing' : `${state.retentionMode === 'fsrs' ? 'FSRS' : 'SM-2'} adaptive review timing`;
  const explain = (label: string, value: string, supporting: string) => onDetail(makeStatDetail(label, value, supporting));
  return <Reveal>
    <Heading title="Knowledge breakdown" detail={`${group.name} · topic practice signals`} />
    <Card style={styles.flatCard}>
      {data.topics.length ? <>
        <Text style={[styles.caption, { color: colors.textSecondary }]}>See where practice is building strength. These signals include card self-ratings and quiz results.</Text>
        {(allTopics ? data.topics : data.topics.slice(0, 5)).map(topic => <TopicRow key={topic.id} topic={topic} onDetail={onDetail} onPractice={onPractice} state={state} />)}
        {data.topics.length > 5 ? <TextButton label={allTopics ? 'Show fewer topics' : `Explore all ${data.topics.length} topics`} onPress={() => setAllTopics(value => !value)} /> : null}
      </> : <Empty icon="book-search-outline" title={group.packs.length ? 'Your topic map is taking shape' : 'Start with your course material'} text={group.packs.length ? group.explanation : 'Add notes, a PDF, or a presentation from Home. Your topics will appear here.'} />}
    </Card>

    <Heading title="Knowledge growth" detail="Evidence over time" />
    <GrowthChart results={data.results} onDetail={onDetail} />

    <Heading title="Study material breakdown" detail={`${data.materials.length} saved ${data.materials.length === 1 ? 'Study Pack' : 'Study Packs'}`} />
    {data.materials.length ? (allMaterials ? data.materials : data.materials.slice(0, 6)).map(material => <MaterialCard key={material.pack.id} material={material} state={state} analytics={analytics} onDetail={onDetail} onPractice={onPractice} />)
      : <Card><Empty icon="file-document-outline" title="Your documents belong here" text="Each saved Study Pack will open into its topics, practice results, and available study tools." /></Card>}
    {data.materials.length > 6 ? <TextButton label={allMaterials ? 'Show fewer materials' : `See all ${data.materials.length} Study Packs`} onPress={() => setAllMaterials(value => !value)} /> : null}

    <Heading title="Learning intelligence" detail="Understand what is helping" />
    <Card style={styles.flatCard}>
      <View style={[styles.timing, { backgroundColor: colors.primarySoft }]}><Icon name="calendar-sync-outline" color={colors.primary} size={20} /><View style={styles.flex}><Text style={[styles.rowTitle, { color: colors.text }]}>{mode}</Text><Text style={[styles.caption, { color: colors.textSecondary }]}>Your answers and the time between reviews guide these insights. Tap any row to see the evidence.</Text></View></View>
      <Insight icon="brain" label="Topic mastery" value={`${data.topics.filter(topic => topic.signal !== null && topic.signal >= 80).length} strong`} detail={`${data.topics.filter(topic => topic.signal !== null).length} topics with practice evidence`} onPress={() => onDetail(makeStatDetail('Topic practice signals', `${data.topics.filter(topic => topic.signal !== null).length} practiced`, 'Current saved topics', { description: 'A breakdown of topic-level practice signals, with unassessed topics kept separate.', calculation: 'The unchanged topic estimate combines card confidence, quiz accuracy, and stored assessment evidence. A percentage is shown only for topics with dated practice in the existing course projection.', whyItMatters: 'A strong practice signal is different from consistent recall across days. Use the course evidence link for the stricter knowledge-readiness rule.' }))} />
      <Insight icon="target" label="Practice accuracy" value={percent(data.practice.accuracy)} detail={`${data.practice.attempted} answers · ${data.practice.correct} correct · ${data.practice.incorrect} incorrect`} onPress={() => onDetail(makeStatDetail('Overall accuracy', percent(data.practice.accuracy), `${data.practice.attempted} source-linked answers. Repeated attempts included.`))} />
      <Insight icon="chart-line" label="Learning growth" value={analytics.advanced.learningVelocity.pointsPerWeek === null ? '—' : `${analytics.advanced.learningVelocity.pointsPerWeek > 0 ? '+' : ''}${analytics.advanced.learningVelocity.pointsPerWeek} pts/wk`} detail="Observed gains per concept; needs repeated evidence" onPress={() => explain('Learning velocity', analytics.advanced.learningVelocity.pointsPerWeek === null ? '—' : `${analytics.advanced.learningVelocity.pointsPerWeek} pts/wk`, `${analytics.advanced.learningVelocity.samples} recorded changes`)} />
      <Insight icon="layers-outline" label="Study coverage" value={`${group.assessedTopics} / ${group.topicCount}`} detail="Topics meeting the spaced-assessment requirement" onPress={() => onDetail(makeStatDetail('Spaced assessment coverage', `${group.assessedTopics} / ${group.topicCount}`, `${group.practicedPacks} of ${group.packs.length} packs have recorded practice`, { description: 'How many identified topics have enough repeated assessment evidence for course readiness.', calculation: 'Every topic needs at least two distinct mapped items. Every current item needs first responses on separate days at least 24 hours apart within the last 30 days. Complete topic mapping is also required before a course percentage is shown.', whyItMatters: 'Uploads and reading time do not establish recall. A few correct answers cannot establish knowledge of the entire class.' }))} />
      <Insight icon="calendar-refresh-outline" label="Review readiness" value={`${analytics.dueTodayCount} due`} detail="Existing review schedule; includes unseen cards" onPress={() => explain('Due today', `${analytics.dueTodayCount}`, 'Current review workload from your existing schedule')} />
      <Insight icon="memory" label="Memory retention" value={percent(analytics.retention.rate)} detail={`${analytics.retention.spacedAttempts} repeat reviews at least 18 hours apart`} onPress={() => explain('Retention rate', percent(analytics.retention.rate), `${analytics.retention.spacedAttempts} spaced attempts`)} />
      <Insight icon="scale-balance" label="Confidence calibration" value={percent(analytics.advanced.confidenceCalibration.score)} detail={`${analytics.advanced.confidenceCalibration.samples} confidence-rated answers`} onPress={() => explain('Confidence calibration', percent(analytics.advanced.confidenceCalibration.score), `${analytics.advanced.confidenceCalibration.confidentlyWrong} confidently wrong · ${analytics.advanced.confidenceCalibration.unsureRight} unsure but right`)} />
      <Insight icon="school-outline" label="Exam readiness" value="—" detail="No validated exam prediction available" onPress={() => onDetail(makeStatDetail('Exam readiness', '—', 'Use recorded practice to plan your preparation', { description: 'StudyBolt does not currently provide a validated prediction of your exam grade.', calculation: 'No new score is calculated. Course readiness uses repeated recall across the topics identified in your saved material; it does not establish coverage of your full exam syllabus.', whyItMatters: 'Use weak topics, delayed retention, and practice results alongside your course requirements when deciding what to study.' }))} last />
    </Card>
    <View style={[styles.scopeNote, { borderColor: colors.border }]}><Icon name="information-outline" size={16} color={colors.textMuted} /><Text style={[styles.caption, styles.flex, { color: colors.textMuted }]}>Mixed-class sessions and unassigned focus time appear in All classes.</Text></View>
  </Reveal>;
}

function Heading({ title, detail }: { title: string; detail: string }) {
  const { colors } = useStudyBolt();
  return <View style={styles.heading}><View style={styles.flex}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text><Text style={[styles.caption, { color: colors.textMuted }]}>{detail}</Text></View></View>;
}

function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const { colors } = useStudyBolt();
  return <View style={styles.empty}><View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon} size={22} color={colors.primary} /></View><View style={styles.flex}><Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.body, { color: colors.textSecondary }]}>{text}</Text></View></View>;
}

function ActionButton({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  const { colors } = useStudyBolt();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.cardStrong : colors.primary, opacity: pressed ? 0.8 : 1 }]}><Text style={[styles.buttonText, { color: secondary ? colors.primary : colors.primaryText }]}>{label}</Text><Icon name="arrow-right" size={17} color={secondary ? colors.primary : colors.primaryText} /></Pressable>;
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.textButton}><Text style={[styles.link, { color: colors.primary }]}>{label}</Text><Icon name="chevron-down" size={18} color={colors.primary} /></Pressable>;
}

function TopicRow({ topic, onDetail, onPractice, state }: { topic: StatsTopic; state: StudyBoltState; onDetail: (detail: StatDetail) => void; onPractice: (action: LearningPracticeAction) => void }) {
  const { colors } = useStudyBolt();
  const [expanded, setExpanded] = useState(false);
  const pack = state.decks.find(item => item.id === topic.packId)!;
  const action = statsPractice(pack, 'flashcards', topic.sectionId) ?? statsPractice(pack, 'quiz');
  const status = topic.signal === null ? 'Unassessed' : topic.signal >= 80 ? 'Strong signal' : topic.signal >= 45 ? 'Developing' : 'Worth reviewing';
  const show = () => onDetail(makeStatDetail(`${topic.title} · practice signal`, percent(topic.signal), topic.packTitle, {
    description: 'The existing topic estimate is a practice signal, with self-reported card ratings contributing alongside assessment evidence.',
    calculation: 'StudyBolt averages the existing card/concept estimates and matching quiz accuracy for this source topic. This display uses the unchanged topic calculation and requires dated topic practice before showing a percentage.',
    insight: `${topic.attempted} recorded question attempts · ${topic.correct} correct · ${topic.incorrect} incorrect · ${topic.reviews} card reviews. Accuracy: ${percent(topic.accuracy)}.`,
    whyItMatters: 'Use this to choose your next practice. Course knowledge readiness separately checks consistent recall across mapped topics on different days.',
  }));
  return <View style={[styles.topic, { borderColor: colors.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${topic.title}, ${status}, ${percent(topic.signal)}. ${topic.packTitle}. Expand topic`} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.topicButton}>
      <View style={styles.row}><Text style={[styles.rowTitle, styles.flex, { color: colors.text }]}>{topic.title}</Text>{topic.signal !== null ? <Text style={[styles.value, { color: colors.primary }]}>{percent(topic.signal)}</Text> : null}<Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.textMuted} /></View>
      {topic.signal !== null ? <ProgressBar progress={topic.signal} color={topic.signal >= 80 ? colors.mint : colors.primary} accessibilityLabel={`${topic.title}: ${topic.signal}%, ${status}`} /> : null}
      <View style={styles.row}><Text numberOfLines={1} style={[styles.caption, styles.flex, { color: colors.textMuted }]}>{topic.packTitle}</Text><Text style={[styles.caption, { color: topic.signal === null ? colors.textMuted : colors.textSecondary }]}>{status}</Text></View>
    </Pressable>
    {expanded ? <Reveal><View style={[styles.topicDetails, { backgroundColor: colors.cardStrong }]}><Text style={[styles.caption, { color: colors.textSecondary }]}>{topic.attempted} question attempts · {percent(topic.accuracy)} accuracy · {topic.reviews} card reviews</Text><TextButton label="How this signal is calculated" onPress={show} />{action ? <ActionButton label={action.label} secondary onPress={() => onPractice(action)} /> : <Text style={[styles.caption, { color: colors.textMuted }]}>Practice tools will appear when ready.</Text>}</View></Reveal> : null}
  </View>;
}

function MaterialCard({ material, state, analytics, onDetail, onPractice }: {
  material: ReturnType<typeof statsLearningDetails>['materials'][number]; state: StudyBoltState; analytics: AnalyticsSnapshot;
  onDetail: (detail: StatDetail) => void; onPractice: (action: LearningPracticeAction) => void;
}) {
  const { colors } = useStudyBolt();
  const [expanded, setExpanded] = useState(false);
  const { fontScale } = useWindowDimensions();
  const { pack } = material;
  const names = [...new Set(pack.sourceFileNames?.length ? pack.sourceFileNames : [pack.fileName])];
  const pending = pack.generation && Object.values(pack.generation.materials).some(tool => tool.status !== 'ready');
  const failed = pack.generation && Object.values(pack.generation.materials).some(tool => tool.status === 'failed');
  const completion = analytics.packs.find(item => item.id === pack.id)?.completion;
  return <Card style={styles.material}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${pack.title}. ${material.attempted} question attempts. ${percent(material.accuracy)} practice accuracy. Expand material`} onPress={() => setExpanded(value => !value)} style={[styles.materialHeading, fontScale > 1.4 && styles.materialHeadingStack]}>
      <View style={[styles.documentIcon, { backgroundColor: colors.primarySoft }]}><Icon name={pack.fileType === 'pptx' ? 'file-powerpoint-outline' : pack.fileType === 'pdf' ? 'file-pdf-box' : 'note-text-outline'} color={colors.primary} size={23} /></View>
      <View style={styles.flex}><Text style={[styles.rowTitle, { color: colors.text }]}>{pack.title}</Text><Text style={[styles.caption, { color: colors.textMuted }]}>{names.length > 1 ? `${names.length} combined sources` : pack.fileType === 'pptx' ? 'PowerPoint' : pack.fileType === 'pdf' ? 'PDF' : 'Notes'} · {material.topics.length} topics</Text>{pending ? <Text style={[styles.caption, { color: failed ? colors.warning : colors.textMuted }]}>{failed ? 'Some tools need attention in Library' : 'Some tools are being prepared'}</Text> : null}</View>
      <View style={styles.materialScore}><Text style={[styles.value, { color: colors.primary }]}>{percent(material.accuracy)}</Text><Text style={[styles.micro, { color: colors.textMuted }]}>accuracy</Text></View><Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
    </Pressable>
    {expanded ? <Reveal><View style={[styles.materialBody, { borderColor: colors.border }]}>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{names.join('\n')}</Text>
      {names.length > 1 ? <Text style={[styles.caption, { color: colors.textMuted }]}>Topics and results belong to this combined pack. Individual source attribution is not available.</Text> : null}
      <Text style={[styles.body, { color: colors.textSecondary }]}>{material.attempted} question attempts · {material.correct} correct · {material.incorrect} incorrect{completion !== undefined ? ` · ${completion}% activity coverage` : ''}</Text>
      {material.topics.map(topic => <TopicRow key={topic.id} topic={topic} state={state} onDetail={onDetail} onPractice={onPractice} />)}
      {!material.topics.length ? <Text style={[styles.caption, { color: colors.textMuted }]}>Source topics are not available yet.</Text> : null}
      <View style={styles.actions}>{(['quiz', 'flashcards', 'notes'] as const).map(tool => {
        const action = statsPractice(pack, tool);
        return action ? <ActionButton key={tool} label={action.label} secondary onPress={() => onPractice(action)} /> : null;
      })}</View>
    </View></Reveal> : null}
  </Card>;
}

function GrowthChart({ results, onDetail }: { results: StatsResult[]; onDetail: (detail: StatDetail) => void }) {
  const { colors } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  const [range, setRange] = useState<'7' | '30' | 'all'>('30');
  const [width, setWidth] = useState(0);
  const all = statsHistoryWindow(results, range);
  const shown = all.slice(-60);
  const first = shown[0];
  const last = shown[shown.length - 1];
  const h = 128, left = 29, right = Math.max(left + 1, width - 12);
  const x = (point: StatsResult) => shown.length < 2 ? (left + right) / 2 : left + (+new Date(point.at) - +new Date(first!.at)) / Math.max(1, +new Date(last!.at) - +new Date(first!.at)) * (right - left);
  const y = (score: number) => 10 + (100 - score) / 100 * (h - 20);
  const path = shown.map((point, index) => `${index ? 'L' : 'M'}${x(point)},${y(point.score)}`).join(' ');
  const showHistory = () => onDetail(makeStatDetail('Practice results over time', `${all.length} recorded results`, `${range === 'all' ? 'All time' : `Last ${range} calendar days`} · ${all.length > 60 ? 'Latest 60 plotted' : 'All points plotted'}`, {
    description: 'Actual saved quiz and test scores at their recorded completion dates. This is a history of practice performance, not historical whole-course knowledge.',
    calculation: 'Only dated, finite scores from 0–100 are plotted. Undated legacy attempts are not placed on a timeline. Completed exams already represented by a linked quiz event are not counted twice.',
    insight: all.length ? all.map(result => `${new Date(result.at).toLocaleString()} · ${result.title}: ${result.score}%`).join('\n\n') : 'No dated assessment result in this window yet.',
    whyItMatters: 'Question difficulty and material scope can differ between attempts. Uploading material changes current course coverage; it does not mean you have forgotten earlier material. Compare similar assessments when judging improvement.',
  }));
  return <Card>
    <View style={[styles.chartHeader, fontScale > 1.3 && styles.stack]}><View style={styles.flex}><Text style={[styles.rowTitle, { color: colors.text }]}>Practice results over time</Text><Text style={[styles.caption, { color: colors.textMuted }]}>{all.length} dated {all.length === 1 ? 'result' : 'results'}{last ? ` · Latest ${last.score}%` : ''}</Text></View></View>
    <View accessibilityRole="tablist" style={styles.ranges}>{(['7', '30', 'all'] as const).map(option => <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: range === option }} aria-selected={range === option} onPress={() => setRange(option)} style={[styles.range, { backgroundColor: range === option ? colors.primarySoft : colors.cardStrong }]}><Text style={[styles.link, { color: range === option ? colors.primary : colors.textSecondary }]}>{option === 'all' ? 'All time' : `${option} days`}</Text></Pressable>)}</View>
    {shown.length ? <Pressable accessibilityRole="button" accessibilityLabel={`Practice history. ${all.length} recorded results. Latest ${last!.score} percent. Tap for dates, materials, and scores.`} onPress={showHistory} onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.chart}>
      {width > 0 ? <Svg width={width} height={h} {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false })}>
        {[0, 50, 100].map(value => <Line key={value} x1={left} y1={y(value)} x2={right} y2={y(value)} stroke={colors.border} strokeWidth={1} strokeDasharray="3 5" />)}
        {shown.length > 1 ? <><Path d={`${path} L${x(last!)},${h - 10} L${x(first!)},${h - 10} Z`} fill={colors.primarySoft} opacity={0.8} /><Path d={path} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></> : null}
        {shown.map((point, index) => <Circle key={point.id} cx={x(point)} cy={y(point.score)} r={index === shown.length - 1 ? 5 : 3} fill={index === shown.length - 1 ? colors.goldBright : colors.primary} stroke={colors.card} strokeWidth={1.5} />)}
      </Svg> : null}
      <Text accessible={false} style={[styles.axisTop, { color: colors.textMuted }]}>100</Text><Text accessible={false} style={[styles.axisBottom, { color: colors.textMuted }]}>0</Text>
      <View style={styles.row}><Text style={[styles.caption, { color: colors.textMuted }]}>{dateLabel(first!.at)}</Text><View style={styles.flex} /><Text style={[styles.caption, { color: colors.textMuted }]}>{shown.length > 1 ? dateLabel(last!.at) : 'First saved result'}</Text></View>
    </Pressable> : <Empty icon="chart-line" title="Your next result starts the story" text="Complete a quiz to save a dated result. A second result adds another point to compare." />}
    <Text style={[styles.caption, { color: colors.textSecondary }]}>Practice accuracy is different from whole-course knowledge. Results may cover different topics and difficulty levels.{all.length > 60 ? ' Latest 60 results shown.' : ''}</Text>
    <TextButton label="View results and how to read this chart" onPress={showHistory} />
  </Card>;
}

function Insight({ icon, label, value, detail, onPress, last }: { icon: IconName; label: string; value: string; detail: string; onPress: () => void; last?: boolean }) {
  const { colors } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${value}. ${detail}. Tap for explanation`} onPress={onPress} style={({ pressed }) => [styles.insight, { borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
    <Icon name={icon} color={colors.primary} size={19} /><View style={styles.flex}><View style={[styles.row, fontScale > 1.3 && styles.stack]}><Text style={[styles.rowTitle, styles.flex, { color: colors.text }]}>{label}</Text><Text style={[styles.value, { color: colors.primary }]}>{value}</Text></View><Text style={[styles.caption, { color: colors.textSecondary }]}>{detail}</Text></View><Icon name="information-outline" size={16} color={colors.textMuted} />
  </Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, stack: { flexDirection: 'column', alignItems: 'flex-start' },
  heading: { marginTop: spacing.xxl, marginBottom: spacing.sm },
  title: { ...typography.sectionTitle }, rowTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  caption: { fontSize: 12, lineHeight: 18 }, body: { fontSize: 14, lineHeight: 21 }, micro: { fontSize: 10, lineHeight: 16 },
  value: { fontSize: 16, lineHeight: 23, fontWeight: '800', fontVariant: ['tabular-nums'] },
  flatCard: { padding: spacing.lg },
  button: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }, buttonText: { fontSize: 14, lineHeight: 20, fontWeight: '700', flexShrink: 1 },
  textButton: { minHeight: 44, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, link: { fontSize: 12, lineHeight: 18, fontWeight: '700', flexShrink: 1 },
  empty: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 12 }, emptyIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  topic: { borderBottomWidth: StyleSheet.hairlineWidth }, topicButton: { paddingVertical: 14, gap: 8, minHeight: 70 }, topicDetails: { padding: 12, borderRadius: 12, marginBottom: 12 },
  material: { padding: 0, marginBottom: 9, overflow: 'hidden' }, materialHeading: { padding: 15, minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 9 }, documentIcon: { width: 36, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  materialHeadingStack: { flexWrap: 'wrap' },
  materialScore: { alignItems: 'flex-end' }, materialBody: { padding: 15, paddingTop: 12, gap: 9, borderTopWidth: StyleSheet.hairlineWidth }, actions: { gap: 3 },
  timing: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 13, gap: 9 }, insight: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 75, paddingVertical: 13 },
  scopeNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 }, ranges: { flexDirection: 'row', gap: 6, marginTop: 14, marginBottom: 12 }, range: { flex: 1, borderRadius: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 7 },
  chart: { marginBottom: 12 }, axisTop: { position: 'absolute', top: 1, left: 0, fontSize: 10, lineHeight: 14 }, axisBottom: { position: 'absolute', top: 110, left: 10, fontSize: 10, lineHeight: 14 },
});
