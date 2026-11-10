import { LoadingArtwork } from '../components/StudyBoltLoading';
import { typography } from '../theme';
import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Card, Header, Icon, Pill, ProgressBar, Screen } from '../components/ui';
import { SubjectIcon } from '../components/SubjectIcon';
import { LearningMasteryHero } from '../components/LearningMasteryHero';
import type { IconName } from '../components/ui';
import { learningEvidence } from '../data/learningScience';
import { makeStatDetail } from '../data/statExplanations';
import type { StatDetail } from '../data/statExplanations';
import { useStudyBolt } from '../StudyBoltContext';
import { buildAnalytics } from '../services/analytics';
import { personalStatisticsState } from '../services/personalStatistics';
import { buildLearningMastery } from '../services/learningMastery';
import type { LearningMasteryGroup, LearningPracticeAction } from '../services/learningMastery';
import type { StudyPack, StudyTool } from '../models';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { AnalyticsSnapshot, BreakdownValue, ConceptInsight, DistributionValue } from '../services/analytics';

type StatsTab = 'overview' | 'insights' | 'mastery' | 'quizzes' | 'activity' | 'methods';

const TABS: Array<{ id: StatsTab; label: string; icon: IconName }> = [
  { id: 'overview', label: 'Overview', icon: 'view-dashboard-outline' },
  { id: 'insights', label: 'Insights', icon: 'chart-box-plus-outline' },
  { id: 'mastery', label: 'Mastery', icon: 'brain' },
  { id: 'quizzes', label: 'Quizzes', icon: 'clipboard-check-outline' },
  { id: 'activity', label: 'Activity', icon: 'chart-timeline-variant' },
  { id: 'methods', label: 'Methods', icon: 'shape-outline' },
];

type StatsDetail = StatDetail & { action?: { label: string; onPress: () => void } };
const StatDetailContext = React.createContext<(detail: StatsDetail) => void>(() => undefined);

function useStatDetail() {
  return React.useContext(StatDetailContext);
}

export function StatsScreen({ onOpenDeck, onAddMaterial }: {
  onOpenDeck: (deck: StudyPack, tool?: StudyTool, cardIds?: string[]) => void;
  onAddMaterial: () => void;
}) {
  const { colors, state, hydrated } = useStudyBolt();
  const [tab, setTab] = useState<StatsTab>('overview');
  const [selectedDetail, setSelectedDetail] = useState<StatsDetail | null>(null);
  const [includeSamples, setIncludeSamples] = useState(false);
  const [activityEpoch, setActivityEpoch] = useState(0);
  const personalState = useMemo(() => personalStatisticsState(state), [state]);
  const hasSamples = state.decks.some((deck) => deck.fileType === 'demo');
  const analytics = useMemo(() => buildAnalytics(includeSamples ? state : personalState), [activityEpoch, includeSamples, personalState, state]);
  const courseGroups = useMemo(() => buildLearningMastery(state), [activityEpoch, state]);
  const topicEvidence = useMemo(() => new Set(courseGroups.flatMap(group => group.practicedTopicIds)), [courseGroups]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') setActivityEpoch(value => value + 1); });
    return () => subscription.remove();
  }, []);

  const openPractice = (action: LearningPracticeAction) => {
    const deck = state.decks.find(item => item.id === action.deckId && item.fileType !== 'demo');
    if (!deck) return;
    const cardIds = action.cardIds?.filter(id => deck.flashcards.some(card => card.id === id));
    if (action.cardIds && !cardIds?.length) return;
    onOpenDeck(deck, action.tool, cardIds);
  };

  const showAbout = () => setSelectedDetail({
    ...makeStatDetail('About your statistics', capitalize(analytics.evidenceLevel) + ' evidence', analytics.historyMessage, {
      description: includeSamples ? 'Detailed tabs currently include bundled examples and older totals. Course readiness and study actions always use your own saved material.' : 'Your personal view excludes bundled examples, seeded history, and mixed sample sessions. Statistics come from this account’s saved material and activity.',
      calculation: 'Counts describe recorded activity. A dash means a result is not yet assessed. Course readiness uses repeated recall across identified topics; study progress and coverage describe completed activities. Evidence level describes the amount of history, not your ability.',
      whyItMatters: 'Use a result to choose your next practice, then open its explanation if you want the calculation. Learning estimates are not predictions of an exam grade.',
    }),
    action: { label: includeSamples ? 'Return to personal progress' : hasSamples ? 'Explore sample statistics' : 'Show all recorded statistics', onPress: () => { setIncludeSamples(value => !value); setSelectedDetail(null); } },
  });

  return (
    <StatDetailContext.Provider value={setSelectedDetail}>
      <View style={[styles.screenShell, { backgroundColor: colors.background }]}>
        <Screen>
          <View aria-hidden={Boolean(selectedDetail)} accessibilityElementsHidden={Boolean(selectedDetail)} importantForAccessibility={selectedDetail ? 'no-hide-descendants' : 'auto'} style={styles.contentWidth}>
          <Header
            title="Stats"
            right={(
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="About your statistics and data scope"
                onPress={showAbout}
                style={[styles.aboutButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Icon name="information-outline" color={colors.textSecondary} size={22} />
              </Pressable>
            )}
          />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Your progress</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your practice, progress, and next steps.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={includeSamples ? 'Sample and personal data. Change statistics scope' : 'Personal progress. About your statistics'} onPress={showAbout} style={styles.scopeRow}>
            <Icon name={includeSamples ? 'layers-outline' : 'account-check-outline'} size={16} color={includeSamples ? colors.warning : colors.primary} />
            <Text style={[styles.scopeLabel, { color: includeSamples ? colors.warning : colors.textSecondary }]}>{includeSamples ? 'Includes sample and older totals' : 'Your saved material only'}</Text>
            <Icon name="chevron-down" size={16} color={colors.textMuted} />
          </Pressable>
          <StatsTabs tab={tab} onChange={setTab} />
          <Text style={[styles.inlineHint, { color: colors.textMuted }]}>Tap a stat to explore its meaning and evidence.</Text>
          {!hydrated ? <View accessibilityState={{ busy: true }} style={styles.loadingState}><LoadingArtwork colors={colors} /><Text style={[styles.subtitle, { color: colors.textSecondary }]}>Loading your progress…</Text></View> : <>
          {tab === 'overview' ? <LearningMasteryHero groups={courseGroups} onExplore={setSelectedDetail} onPractice={openPractice} onAddMaterial={onAddMaterial} /> : null}
          {tab === 'overview' ? <Overview analytics={analytics} groups={courseGroups} onPractice={openPractice} onAddMaterial={onAddMaterial} /> : null}
          {tab === 'insights' ? <AdvancedInsights analytics={analytics} topicEvidence={includeSamples ? undefined : topicEvidence} /> : null}
          {tab === 'mastery' ? <MasteryAnalytics analytics={analytics} topicEvidence={includeSamples ? undefined : topicEvidence} /> : null}
          {tab === 'quizzes' ? <QuizAnalytics analytics={analytics} /> : null}
          {tab === 'activity' ? <ActivityAnalytics analytics={analytics} goalMinutes={state.dailyStudyGoalMinutes} /> : null}
          {tab === 'methods' ? <MethodAnalytics analytics={analytics} classCount={includeSamples ? state.classes.length : courseGroups.filter(group => group.kind === 'class').length} presentationCount={courseGroups.reduce((sum, group) => sum + group.powerpoints, 0)} /> : null}
          </>}
          </View>
        </Screen>
        <StatDetailSheet detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
      </View>
    </StatDetailContext.Provider>
  );
}

function StatsTabs({ tab, onChange }: { tab: StatsTab; onChange: (value: StatsTab) => void }) {
  const { colors } = useStudyBolt();
  const { width, fontScale } = useWindowDimensions();
  return <View role="tablist" accessibilityLabel="Statistics sections" style={styles.tabGrid}>{TABS.map(item => {
    const active = tab === item.id;
    return <Pressable key={item.id} accessibilityRole="tab" aria-selected={active} accessibilityState={{ selected: active }} onPress={() => onChange(item.id)} style={({ pressed }) => [styles.sectionTab, fontScale > 1.35 && styles.tabHalf, fontScale > 1.9 && styles.tabFull, width > 740 && fontScale <= 1.35 && styles.tabSixth, { backgroundColor: active ? colors.primarySoft : colors.card, borderColor: active ? colors.primary : colors.border, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={item.icon} size={16} color={active ? colors.primary : colors.textSecondary} /><Text style={[styles.sectionTabText, { color: active ? colors.primary : colors.textSecondary }]}>{item.label}</Text>
    </Pressable>;
  })}</View>;
}

function StatDetailSheet({ detail, onClose }: { detail: StatsDetail | null; onClose: () => void }) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  return (
    <Modal visible={Boolean(detail)} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close stat details" style={styles.modalBackdrop} onPress={onClose} />
        {detail ? (
          <View accessibilityViewIsModal aria-modal role="dialog" accessibilityLabel="Statistic details" style={[styles.detailSheet, { backgroundColor: colors.backgroundRaised, borderColor: colors.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.detailEyebrow, { color: colors.primary }]}>STAT EXPLAINER</Text>
                <Text style={[styles.detailTitle, { color: colors.text }]}>{detail.label}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={[styles.detailClose, { backgroundColor: colors.cardStrong }]}>
                <Icon name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailScroll}>
              <View style={[styles.detailValueCard, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.detailValueLabel, { color: colors.primary }]}>YOUR CURRENT VALUE</Text>
                <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.detailValue, { color: colors.text }]}>{detail.value}</Text>
                <Text style={[styles.detailSupporting, { color: colors.textSecondary }]}>{detail.supporting}</Text>
              </View>

              <DetailSection icon="book-open-variant" title="What it means" body={detail.description} />
              <DetailSection icon="calculator-variant-outline" title="How it’s calculated" body={detail.calculation} />
              <DetailSection icon="chart-timeline-variant-shimmer" title="What your data suggests" body={detail.insight} emphasized />
              <DetailSection icon="compass-outline" title="How to use it" body={detail.whyItMatters} />

              <View style={[styles.estimateNote, { borderColor: colors.border }]}>
                <Icon name="shield-check-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.estimateNoteText, { color: colors.textMuted }]}>Learning estimates guide priorities; they are not guarantees or predicted exam grades.</Text>
              </View>
            </ScrollView>
            {detail.action ? <Pressable accessibilityRole="button" onPress={detail.action.onPress} style={[styles.detailAction, { backgroundColor: colors.primary }]}><Text style={[styles.detailActionText, { color: colors.primaryText }]}>{detail.action.label}</Text><Icon name="arrow-right" color={colors.primaryText} size={18} /></Pressable> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function DetailSection({ icon, title, body, emphasized = false }: { icon: IconName; title: string; body: string; emphasized?: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <View style={[styles.detailSection, emphasized && { backgroundColor: colors.mintSoft }]}>
      <View style={[styles.detailSectionIcon, { backgroundColor: emphasized ? colors.card : colors.cardStrong }]}>
        <Icon name={icon} size={18} color={emphasized ? colors.mint : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailSectionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.detailSectionBody, { color: colors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

function Overview({ analytics, groups, onPractice, onAddMaterial }: {
  analytics: AnalyticsSnapshot; groups: LearningMasteryGroup[];
  onPractice: (action: LearningPracticeAction) => void; onAddMaterial: () => void;
}) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  const hasPacks = analytics.packs.length > 0;
  const nextGroups = groups.filter(group => group.nextPractice).sort((a, b) => b.focusTopics.length - a.focusTopics.length).slice(0, 2);
  return (
    <>
      <SectionHeader title="This week" action="Last 7 days" />
      <View style={styles.metricGrid}>
        <MetricCard icon="timer-outline" label="Study time this week" value={formatMinutes(analytics.studyTimeThisWeek)} detail="Notes, practice, and listening" tone="blue" />
        <MetricCard icon="calendar-check-outline" label="Active study days" value={analytics.activity.daysThisWeek + ' / 7'} detail="Every session counts" tone="mint" />
        <MetricCard icon="clipboard-check-outline" label="Recent quiz average" value={percent(analytics.recentQuizAverage)} detail="Your most recent 5 runs" tone="purple" />
        <MetricCard icon="help-circle-outline" label="Questions answered" value={String(analytics.quizzes.answered)} detail="Recorded answer history" tone="blue" />
      </View>

      <SectionHeader title="Your study rhythm" action="A little at a time" />
      <Card>
        <BarChart values={analytics.activity.sevenDays.map(day => day.minutes)} labels={analytics.activity.sevenDays.map(day => shortWeekday(day.key))} minutes compact />
        <Text style={[styles.chartCaption, { color: colors.textSecondary }]}>Time shows your activity. Practice results show what is sticking.</Text>
      </Card>

      <SectionHeader title={nextGroups.some(group => group.focusTopics.length) ? 'Worth revisiting' : 'Continue learning'} action="From your material" />
      <View style={styles.stack}>
        {nextGroups.map(group => <Card key={group.id} onPress={() => onPractice(group.nextPractice!)} accessibilityLabel={group.nextPractice!.label + ' · ' + group.name + '. ' + group.nextPractice!.reason} style={styles.nextStepCard}>
          <View style={[styles.nextStepIcon, { backgroundColor: colors.mintSoft }]}><Icon name={group.nextPractice!.tool === 'quiz' ? 'clipboard-check-outline' : group.nextPractice!.tool === 'notes' ? 'note-text-outline' : 'cards-outline'} color={colors.mint} size={22} /></View>
          <View style={styles.flexCopy}><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{group.name}</Text><Text style={[styles.rowTitle, { color: colors.text }]}>{group.nextPractice!.label}</Text><Text style={[styles.rowMeta, { color: colors.textSecondary }]}>{group.nextPractice!.reason}</Text></View>
          <Icon name="arrow-right" color={colors.primary} size={20} />
        </Card>)}
        {!nextGroups.length ? <Card onPress={!groups.some(group => group.packs.length) ? onAddMaterial : undefined} accessibilityLabel="Add study material from Home">
          <EmptyInsight icon="sprout-outline" title={groups.some(group => group.packs.length) ? 'Your material is saved' : 'Your progress starts with your material'} detail={groups.some(group => group.packs.length) ? 'Open its Study Pack from Library to check the available tools or retry a tool that needs attention.' : 'Add a Study Pack from Home. Reading time, practice, and listening will build your stats.'} />
        </Card> : null}
      </View>

      <StatsDisclosure title="More study details" subtitle="Coverage, review status, and study patterns">
        <View style={styles.metricGrid}>
          <MetricCard icon="book-open-page-variant-outline" label="Study progress" value={hasPacks ? analytics.overallMastery + '%' : '—'} detail="Activity and practice composite" tone="purple" />
          <MetricCard icon="calendar-range" label="Consecutive study days" value={analytics.streakDays + (analytics.streakDays === 1 ? ' day' : ' days')} detail="A pattern, never an obligation" tone="blue" />
          <MetricCard icon="chart-timeline-variant" label="Daily average" value={formatMinutes(analytics.activity.averageDaily)} detail="On study days · last 30 days" tone="mint" />
          <MetricCard icon="timer-sand" label="Average session" value={formatMinutes(analytics.activity.averageSession)} detail={analytics.activity.sessions + ' recorded sessions'} tone="blue" />
          <MetricCard icon="check-decagram-outline" label="Concepts showing strength" value={String(analytics.masteredCount)} detail="Estimated signal ≥ 80%" tone="mint" />
          <MetricCard icon="progress-clock" label="Concepts to practice" value={String(analytics.learningCount)} detail="Includes unseen concepts" tone="purple" />
          <MetricCard icon="calendar-refresh-outline" label="Due today" value={String(analytics.dueTodayCount)} detail="Suggested review timing" tone="blue" />
          <MetricCard icon="book-open-page-variant-outline" label="Pack completion" value={hasPacks ? analytics.packCompletion + '%' : '—'} detail="Coverage across study modes" tone="blue" />
          <MetricCard icon="layers-triple-outline" label="Material remaining" value={hasPacks ? analytics.materialRemaining + '%' : '—'} detail="Weighted activity remaining" tone="purple" />
        </View>
      </StatsDisclosure>

      <StatsDisclosure title="Study progress by class" subtitle="Activity coverage and practice results">
        <View style={styles.stack}>
          {analytics.classes.map(course => <Card key={course.id} onPress={() => showStatDetail(makeStatDetail(course.name + ' study progress', course.mastery + '%', course.studyMinutes ? formatMinutes(course.studyMinutes) + ' tracked study' : 'No tracked study time yet', {
            description: 'A study-progress composite across this class’s saved packs. It includes reviewed notes, flashcard confidence, and recent assessment scores.',
            calculation: 'Each pack combines notes, card confidence, and its latest quiz score, plus a cumulative-test score when present. Pack composites are averaged equally across the class.',
            whyItMatters: 'Use this to understand activity progress. The course card above separately assesses repeated recall; neither percentage predicts an exam grade.',
          }))} style={styles.progressCard}>
            <SubjectIcon subject={course.name} emoji={course.emoji} size={40} />
            <View style={styles.flexCopy}><View style={styles.progressHeading}><Text style={[styles.progressTitle, styles.flexCopy, { color: colors.text }]}>{course.name}</Text><Text style={[styles.progressValue, { color: colors.primary }]}>{course.mastery}%</Text></View><ProgressBar accessibilityLabel={course.name + ' study progress'} progress={course.mastery} color={colors.primary} /><Text style={[styles.progressMeta, { color: colors.textMuted }]}>{course.studyMinutes ? formatMinutes(course.studyMinutes) + ' tracked study' : 'No tracked study time yet'}</Text></View>
          </Card>)}
          {!analytics.classes.length ? <EmptyInsight icon="school-outline" title="No class data yet" detail="Your class progress will appear after you add material." /> : null}
        </View>
      </StatsDisclosure>

      <SectionHeader title="Study Pack coverage" action={hasPacks ? analytics.materialRemaining + '% remaining' : '—'} />
      <View style={styles.stack}>{analytics.packs.map(pack => <PackRow key={pack.id} pack={pack} />)}{!analytics.packs.length ? <Card><EmptyInsight icon="book-open-outline" title="Your packs will appear here" detail="Add your study material to see its coverage here." /></Card> : null}</View>
    </>
  );
}

function StatsDisclosure({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { colors } = useStudyBolt();
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.disclosure}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={({ pressed }) => [styles.disclosureHeading, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.flexCopy}><Text style={[styles.disclosureTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.rowMeta, { color: colors.textSecondary }]}>{subtitle}</Text></View><Icon name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.primary} size={22} />
    </Pressable>
    {expanded ? <View style={styles.disclosureBody}>{children}</View> : null}
  </View>;
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  const { colors } = useStudyBolt();
  return <View style={styles.sectionHeading}><Text accessibilityRole="header" style={[styles.sectionHeadingTitle, { color: colors.text }]}>{title}</Text>{action ? <Text style={[styles.sectionHeadingMeta, { color: colors.textSecondary }]}>{action}</Text> : null}</View>;
}

function AdvancedInsights({ analytics, topicEvidence }: { analytics: AnalyticsSnapshot; topicEvidence?: Set<string> }) {
  const { colors, state } = useStudyBolt();
  const showStatDetail = useStatDetail();
  const insight = analytics.advanced;
  const advancedRetention = state.retentionMode !== 'standard';
  const retentionLabel = state.retentionMode === 'standard' ? 'Standard' : state.retentionMode === 'fsrs' ? 'FSRS' : 'SM-2';
  const gap = insight.recognitionRecallGap;
  const calibration = insight.confidenceCalibration;
  const fatigue = insight.sessionFatigue;
  const efficiency = insight.efficiencyTrend;
  const nextAdjustment = getNextStudyAdjustment(analytics);
  const habitDays = analytics.activity.thirtyDays.slice(-28);
  const activeHabitDays = habitDays.filter(day => day.minutes > 0).length;
  const activeHabitWeeks = new Set(habitDays.flatMap((day, index) => day.minutes > 0 ? [Math.floor(index / 7)] : [])).size;
  return (
    <>
      <Card
        style={[styles.advancedHero, { backgroundColor: colors.mode === 'dark' ? colors.primarySoft : '#EEF5FF' }]}
      >
        <View style={[styles.advancedHeroIcon, { backgroundColor: colors.primary }]}><Icon name="chart-box-plus-outline" color={colors.primaryText} size={24} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.advancedHeroTitle, { color: colors.text }]}>Your learning signals</Text>
          <Text style={[styles.advancedHeroText, { color: colors.textSecondary }]}>Measured from your answers, retrieval ratings, timing, spacing, study sessions, and completed plan blocks. Estimates stay hidden until enough evidence exists.</Text>
          <Text style={[styles.advancedHeroMode, { color: advancedRetention ? colors.primary : colors.textMuted }]}>{advancedRetention ? `${retentionLabel} is on · review timing adapts per card.` : 'Standard is on · fixed time-based review intervals.'}</Text>
        </View>
      </Card>

      <SectionHeader title="Your next adjustment" action="Based on your study history" />
      <Card
        accessibilityLabel={`${nextAdjustment.value}. Tap for the evidence and suggested next step`}
        onPress={() => showStatDetail(nextAdjustment)}
      >
        <MethodologyRow icon="compass-outline" title={nextAdjustment.value} detail={nextAdjustment.supporting} />
      </Card>

      <SectionHeader title="Memory & recall" action="What is likely to stick" />
      <View style={styles.metricGrid}>
        <MetricCard icon="head-check-outline" label="Estimated recall" value={percent(insight.recallProbability.value)} detail={`${insight.recallProbability.concepts} concepts with dated evidence`} tone="mint" muted={insight.recallProbability.value === null} />
        <MetricCard icon="eye-outline" label="Recognition vs. recall" value={gap.value === null ? '—' : formatPointGap(gap.value)} detail={`${percent(gap.recognition)} recognition · ${percent(gap.recall)} recall`} tone="purple" muted={gap.value === null} />
        <MetricCard icon="scale-balance" label="Confidence calibration" value={percent(calibration.score)} detail={`${calibration.samples} answers with confidence`} tone="blue" muted={calibration.score === null} />
        <MetricCard icon="target-account" label="First-try accuracy" value={percent(analytics.quizzes.firstTryAccuracy)} detail="First recorded attempt per question" tone="orange" muted={analytics.quizzes.firstTryAccuracy === null} />
        <MetricCard icon="calendar-sync-outline" label="Delayed retention" value={percent(analytics.retention.longTermSuccess)} detail="Repeat reviews ≥ 6.5 days apart" tone="mint" muted={analytics.retention.longTermSuccess === null} />
        <MetricCard icon="trending-up" label="Learning velocity" value={insight.learningVelocity.pointsPerWeek === null ? '—' : `${formatSigned(insight.learningVelocity.pointsPerWeek)} pts/wk`} detail={`${insight.learningVelocity.samples} changes · normalized per concept`} tone="purple" muted={insight.learningVelocity.pointsPerWeek === null} />
      </View>

      <SectionHeader title="Forgetting risk" action={`${insight.forgettingRisk.length} concepts to protect`} />
      <Card style={styles.insightCard}>
        {insight.forgettingRisk.length ? insight.forgettingRisk.map((concept, index) => (
          <RiskConceptRow key={concept.id} concept={concept} last={index === insight.forgettingRisk.length - 1} />
        )) : <EmptyInsight icon="shield-check-outline" title="Review priorities are still building" detail="Dated recall history helps identify topics worth another check." />}
      </Card>

      <SectionHeader title="Confidence outcomes" action={`${calibration.samples} rated answers`} />
      <Card>
        {calibration.samples ? (
          <View style={styles.calibrationGrid}>
            <CalibrationCell label="Confidently right" value={calibration.confidentlyRight} color={colors.mint} background={colors.mintSoft} />
            <CalibrationCell label="Confidently wrong" value={calibration.confidentlyWrong} color={colors.danger} background={`${colors.danger}14`} />
            <CalibrationCell label="Unsure but right" value={calibration.unsureRight} color={colors.primary} background={colors.primarySoft} />
            <CalibrationCell label="Unsure and wrong" value={calibration.unsureWrong} color={colors.warning} background={`${colors.warning}18`} />
          </View>
        ) : <EmptyInsight icon="scale-balance" title="Confidence calibration is ready to collect" detail="Use the optional confidence chips before answering quiz questions." />}
      </Card>

      <SectionHeader title={analytics.weakConcepts.some(concept => concept.lastEvidenceAt) ? 'Practice priorities' : 'Build your baseline'} action="Based on recorded evidence" />
      <Card style={styles.insightCard}>
        {analytics.weakConcepts.length ? analytics.weakConcepts.slice(0, 5).map((concept, index) => <ConceptRow key={concept.id} concept={concept} rank={index + 1} last={index === Math.min(4, analytics.weakConcepts.length - 1)} />)
          : <EmptyInsight icon="check-all" title="No weak concepts detected" detail="Keep using spaced retrieval to confirm your knowledge holds." />}
      </Card>

      <SectionHeader title="Strongest concepts" action="Likely lower priority" />
      <Card style={styles.insightCard}>
        {analytics.strongestConcepts.length ? analytics.strongestConcepts.slice(0, 5).map((concept, index) => <ConceptRow key={concept.id} concept={concept} last={index === Math.min(4, analytics.strongestConcepts.length - 1)} />)
          : <EmptyInsight icon="shield-outline" title="Strong concepts are still being established" detail="Repeated correct recall will move concepts into this list." />}
      </Card>

      <SectionHeader title="Confusion pairs" action="Repeated mix-ups" />
      <Card>
        {insight.confusionPairs.length ? insight.confusionPairs.map((pair, index) => (
          <View
            key={pair.id}
            style={[styles.confusionRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <View style={[styles.confusionCount, { backgroundColor: `${colors.danger}14` }]}><Text style={[styles.confusionCountText, { color: colors.danger }]}>{pair.count}×</Text></View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.text }]}>{pair.selected}</Text>
              <View style={styles.confusionCorrection}><Icon name="arrow-right" size={14} color={colors.mint} /><Text numberOfLines={2} style={[styles.rowMeta, { color: colors.textSecondary }]}>{pair.correct}</Text></View>
            </View>
          </View>
        )) : <EmptyInsight icon="swap-horizontal" title="No repeated confusion pair yet" detail="A pair appears after the same wrong choice is selected for the same correct idea twice." />}
      </Card>

      <StatsDisclosure title="More learning patterns" subtitle="Timing, habits, and topic estimates">
      <SectionHeader title="Retrieval performance" action="Accuracy plus speed" />
      <View style={styles.metricGrid}>
        <MetricCard icon="timer-outline" label="Response time" value={insight.responseTime.averageSeconds === null ? '—' : `${insight.responseTime.averageSeconds}s`} detail={`Median ${insight.responseTime.medianSeconds ?? '—'}s · ${insight.responseTime.samples} timed`} tone="blue" muted={insight.responseTime.averageSeconds === null} />
        <MetricCard icon="speedometer" label="Fluency" value={insight.fluency.correctPerMinute === null ? '—' : `${insight.fluency.correctPerMinute}/min`} detail="Correct retrievals per timed minute" tone="mint" muted={insight.fluency.correctPerMinute === null} />
        <MetricCard icon="weather-sunset-up" label="Best study time" value={insight.bestStudyTime?.label ?? '—'} detail={insight.bestStudyTime ? `${insight.bestStudyTime.accuracy}% across ${insight.bestStudyTime.samples} answers` : 'Needs timed answers in multiple periods'} tone="purple" muted={!insight.bestStudyTime} />
        <MetricCard icon="battery-low" label="Session fatigue" value={!fatigue ? '—' : fatigue.drop > 0 ? `${fatigue.drop} pt drop` : 'No decline'} detail={fatigue ? `${fatigue.earlyAccuracy}% early · ${fatigue.lateAccuracy}% late` : 'Needs at least two 8+ question runs'} tone="orange" muted={!fatigue} />
        <MetricCard icon="timer-sand-complete" label="Ideal session length" value={insight.idealSessionLength?.label ?? '—'} detail={insight.idealSessionLength ? `${insight.idealSessionLength.accuracy}% recall across ${insight.idealSessionLength.sessions} sessions` : 'Needs repeated scored sessions'} tone="blue" muted={!insight.idealSessionLength} />
        <MetricCard icon="chart-line-variant" label="Efficiency trend" value={!efficiency ? '—' : `${formatSigned(efficiency.changePercent)}%`} detail={efficiency ? `${efficiency.recent} vs ${efficiency.previous} gain pts/hour` : 'Needs measured gains in both weeks'} tone="mint" muted={!efficiency} />
      </View>

      <SectionHeader title="Question-type performance" action="Observed attempts only" />
      <Card>
        <BreakdownRows values={insight.questionTypePerformance} />
      </Card>

      <SectionHeader title="Mastery gain per hour" action="Measured improvement" />
      <View style={styles.metricGrid}>
        <MetricCard icon="shape-plus-outline" label="Best study method" value={insight.masteryGainPerHour.topMethod ?? '—'} detail={insight.masteryGainPerHour.topMethodValue === null ? 'Needs repeated before/after evidence' : `${insight.masteryGainPerHour.topMethodValue} pts/concept/hour`} tone="purple" muted={!insight.masteryGainPerHour.topMethod} />
        <MetricCard icon="school-outline" label="Most efficient course" value={insight.masteryGainPerHour.topCourse ?? '—'} detail={insight.masteryGainPerHour.topCourseValue === null ? 'Needs repeated before/after evidence' : `${insight.masteryGainPerHour.topCourseValue} pts/concept/hour`} tone="blue" muted={!insight.masteryGainPerHour.topCourse} />
      </View>

      <SectionHeader title="Study habits" action="Last 28 days" />
      <View style={styles.metricGrid}>
        <MetricCard icon="calendar-check-outline" label="Active weeks" value={`${activeHabitWeeks} / 4`} detail={`${activeHabitDays} active days in the last 28 days`} tone="mint" />
        <MetricCard icon="calendar-range" label="Spacing quality" value={percent(insight.spacingQuality.score)} detail={`${insight.spacingQuality.spaced}/${insight.spacingQuality.total} repeat intervals well spaced`} tone="purple" muted={insight.spacingQuality.score === null} />
        <MetricCard icon="flash-alert-outline" label="Cramming index" value={insight.crammingIndex ? `${insight.crammingIndex.value}%` : '—'} detail={insight.crammingIndex ? `${formatMinutes(insight.crammingIndex.finalWindowMinutes)} of ${formatMinutes(insight.crammingIndex.totalMinutes)} in final 24h` : 'Calculated during the final 24h of a plan'} tone="orange" muted={!insight.crammingIndex} />
        <MetricCard icon="clipboard-check-outline" label="Plan adherence" value={percent(insight.planAdherence.value)} detail={`${formatMinutes(insight.planAdherence.completedMinutes)} of ${formatMinutes(insight.planAdherence.plannedMinutes)} marked complete`} tone="blue" muted={insight.planAdherence.value === null} />
        <MetricCard icon="calendar-arrow-right" label="Reviews by tomorrow" value={`${insight.reviewLoad.tomorrow}`} detail="Includes overdue cards" tone="red" />
        <MetricCard icon="calendar-week" label="Reviews in 7 days" value={`${insight.reviewLoad.nextSevenDays}`} detail={state.retentionMode === 'fsrs' ? 'Forecast from FSRS card schedules' : state.retentionMode === 'sm2' ? 'Forecast from SM-2 card schedules' : 'Forecast from last recall and confidence'} tone="mint" />
      </View>

      <SectionHeader title="Mastery distribution" action="Current evidence" />
      <DistributionCard values={insight.masteryDistribution} />

      <SectionHeader title="Personal difficulty" action="Based on your performance" />
      <DistributionCard values={insight.difficultyDistribution} />

      <SectionHeader title="Topic practice signals" action="Estimated from your history" />
      <Card>
        {analytics.topicMastery.length ? analytics.topicMastery.slice(0, 12).map((topic, index) => (
          <ProgressRow key={topic.id} label={topic.title} detail={topic.courseName} value={!topicEvidence || topicEvidence.has(topic.id) ? topic.value : null} last={index === Math.min(11, analytics.topicMastery.length - 1)} />
        )) : <EmptyInsight icon="book-search-outline" title="No topic evidence yet" detail="Study cards or complete quizzes to build topic-level readiness." />}
      </Card>


      <SectionHeader title="How these stats are made" action="Transparent methodology" />
      <Card>
        <MethodologyRow icon="database-check-outline" title="Direct observations" detail="Correctness, chosen and correct answers, answer confidence, response time, timestamps, session duration, card ratings, and completed plan blocks are stored on this device." />
        <MethodologyRow icon="brain" title="Recall estimate" detail={state.retentionMode === 'fsrs' ? 'FSRS replays each card\'s dated review history and estimates retrievability from per-card difficulty and stability, with intervals capped at 365 days.' : state.retentionMode === 'sm2' ? 'SM-2 replays each card\'s dated review history using repetitions, an ease factor, and quality ratings to set the next interval. Its recall estimate uses the scheduled interval.' : 'Standard mode decays current observed mastery from the latest dated evidence using StudyBolt\'s time-based forgetting curve. More successful reviews increase estimated stability.'} bordered />
        <MethodologyRow icon="calendar-sync-outline" title="Spacing and retention" detail="This detailed retention view groups repeat reviews at least 18 hours apart, with a longer-delay group at 6.5 days. Course readiness separately requires practice at least 24 hours apart within its 30-day window." bordered />
        <MethodologyRow icon="flask-outline" title="Evidence context" detail="Spaced and retrieval practice have strong learning-science support. FSRS and SM-2 are timing models—not guarantees of remembering or exam performance." bordered />
        <MethodologyRow icon="trending-up" title="Improvement rates" detail="Mastery changes are normalized per distinct concept or assessment, then divided by elapsed weeks or tracked study hours so studying more items does not inflate the rate." bordered />
        <MethodologyRow icon="shield-check-outline" title="Evidence thresholds" detail="Timing, calibration, fatigue, ideal-session, and forecast metrics remain unavailable until their minimum sample sizes are met." bordered />
        <MethodologyRow icon="alert-circle-outline" title="Interpret estimates carefully" detail="Readiness and recall probability guide study priorities; they are not validated predictions of an exam grade or a guarantee of remembering." bordered />
      </Card>
      </StatsDisclosure>
    </>
  );
}

function MasteryAnalytics({ analytics, topicEvidence }: { analytics: AnalyticsSnapshot; topicEvidence?: Set<string> }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  return (
    <>
      <SectionHeader title="Mastery & retention" action="Recall over time" />
      <Card style={[styles.sectionHero, { backgroundColor: colors.purpleSoft }]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.card }]}><Icon name="brain" color={colors.purple} size={25} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionHeroTitle, { color: colors.text }]}>Recall that holds over time</Text>
          <Text style={[styles.sectionHeroText, { color: colors.textSecondary }]}>Repeated reviews help you see which ideas you can retrieve after a break.</Text>
        </View>
      </Card>
      <View style={styles.metricGrid}>
        <MetricCard icon="memory" label="Retention rate" value={percent(analytics.retention.rate)} detail={`${analytics.retention.spacedAttempts} spaced attempts`} tone="mint" />
        <MetricCard icon="shield-star-outline" label="Evidence history" value={capitalize(analytics.evidenceLevel)} detail="Amount of recorded history" tone="purple" />
        <MetricCard icon="target-account" label="First-try accuracy" value={percent(analytics.quizzes.firstTryAccuracy)} detail="First attempt per question" tone="blue" />
        <MetricCard icon="backup-restore" label="Repeat accuracy" value={percent(analytics.quizzes.repeatAccuracy)} detail="After prior exposure" tone="orange" />
        <MetricCard icon="calendar-sync-outline" label="Long-term retention" value={percent(analytics.retention.longTermSuccess)} detail="Repeat reviews ≥ 6.5 days apart" tone="mint" muted={analytics.retention.longTermSuccess === null} />
        <MetricCard icon="eye-off-outline" label="Unseen concepts" value={`${analytics.unseenConcepts.length}`} detail="No recall evidence yet" tone="red" />
      </View>

      <SectionHeader title="Topic mastery" action="Strongest to weakest" />
      <Card>
        {analytics.topicMastery.length ? analytics.topicMastery.slice(0, 12).map((topic, index) => (
          <ProgressRow key={topic.id} label={topic.title} detail={topic.courseName} value={!topicEvidence || topicEvidence.has(topic.id) ? topic.value : null} last={index === Math.min(11, analytics.topicMastery.length - 1)} />
        )) : <EmptyInsight icon="brain" title="Topic estimates will appear here" detail="Study Pack topics and recorded practice build this view." />}
      </Card>

      <StatusSection title="Strongest concepts" action="Most secure" concepts={analytics.strongestConcepts} icon="shield-check-outline" />
      <StatusSection title="Unseen concepts" action="Not studied yet" concepts={analytics.unseenConcepts} icon="eye-off-outline" />
      <StatsDisclosure title="Changes in your recall" subtitle="Improvement and review opportunities">
      <StatusSection title="At-risk concepts" action="Previously stronger" concepts={analytics.atRiskConcepts} icon="trending-down" />
      <StatusSection title="Improving concepts" action="Most improved" concepts={analytics.improvingConcepts} icon="trending-up" />
      <StatusSection title="Needs a fresh review" action="Recall rating decreased" concepts={analytics.forgottenConcepts} icon="head-question-outline" />
      </StatsDisclosure>

      <SectionHeader title="Understanding your progress" action="Three different signals" />
      <Card>
        <MethodologyRow icon="clipboard-check-outline" title="Practice results" detail="Quiz accuracy and dated card ratings describe your recorded responses." />
        <MethodologyRow icon="calendar-sync-outline" title="Course readiness" detail="The course cards use repeated recall across mapped topics. A dash means the material has not been assessed thoroughly enough yet." bordered />
        <MethodologyRow icon="book-open-page-variant-outline" title="Study progress" detail="Coverage combines reviewed notes, card confidence, and assessment activity. It helps you track your work; the course evidence breakdown explains what supports a knowledge estimate." bordered />
      </Card>

      <StatsDisclosure title="Learning science" subtitle="Research behind the study approach">
      <View style={styles.stack}>
        {learningEvidence.map((evidence) => (
          <Card key={evidence.principle} onPress={() => void Linking.openURL(evidence.url)} style={styles.evidenceCard}>
            <View style={[styles.evidenceIcon, { backgroundColor: colors.mintSoft }]}><Icon name="flask-outline" color={colors.mint} size={20} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.evidenceTitle, { color: colors.text }]}>{evidence.principle}</Text>
              <Text style={[styles.evidenceText, { color: colors.textSecondary }]}>{evidence.application}</Text>
              <Text style={[styles.evidenceSource, { color: colors.primary }]}>{evidence.source}</Text>
            </View>
            <Icon name="open-in-new" size={17} color={colors.textMuted} />
          </Card>
        ))}
      </View>
      </StatsDisclosure>
    </>
  );
}

function QuizAnalytics({ analytics }: { analytics: AnalyticsSnapshot }) {
  const { colors } = useStudyBolt();
  const quiz = analytics.quizzes;
  return (
    <>
      <SectionHeader title="Quiz analytics" action={`${quiz.completed} completed`} />
      <View style={styles.metricGrid}>
        <MetricCard icon="target" label="Overall accuracy" value={percent(quiz.overallAccuracy)} detail="Recorded answers" tone="mint" />
        <MetricCard icon="chart-box-outline" label="Average quiz score" value={percent(quiz.averageScore)} detail="All quiz runs" tone="blue" />
        <MetricCard icon="trophy-outline" label="Best score" value={percent(quiz.bestScore)} detail="Personal best" tone="orange" />
        <MetricCard icon="help-circle-outline" label="Questions answered" value={`${quiz.answered}`} detail="With answer detail" tone="purple" />
        <MetricCard icon="check-circle-outline" label="Correct answers" value={`${quiz.correct}`} detail="Observed recall" tone="mint" />
        <MetricCard icon="close-circle-outline" label="Needs review" value={`${quiz.incorrect}`} detail="Incorrect answers" tone="red" />
      </View>

      <SectionHeader title="Accuracy trend" action="Recent runs" />
      <Card>
        <BarChart values={quiz.trend} labels={quiz.trend.map((_, index) => `${index + 1}`)} />
        <Text style={[styles.chartCaption, { color: colors.textMuted }]}>Each bar is one completed quiz or cumulative test.</Text>
      </Card>

      <SectionHeader title="Recent quiz results" />
      <Card>
        {quiz.recentResults.length ? quiz.recentResults.map((result, index) => (
          <View key={result.id} style={[styles.resultRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.scoreBadge, { backgroundColor: result.score >= 80 ? colors.mintSoft : colors.primarySoft }]}>
              <Text style={[styles.scoreBadgeText, { color: result.score >= 80 ? colors.mint : colors.primary }]}>{result.score}%</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{result.deckTitle}</Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{formatDate(result.date)}</Text>
            </View>
            <Icon name={result.score >= 80 ? 'trending-up' : 'refresh'} color={result.score >= 80 ? colors.mint : colors.warning} />
          </View>
        )) : <EmptyInsight icon="clipboard-outline" title="No detailed quiz history yet" detail="Your next completed quiz will appear here." />}
      </Card>

      <SectionHeader title="Accuracy breakdown" />
      <View style={styles.breakdownGrid}>
        <BreakdownCard title="By difficulty" values={quiz.byDifficulty} />
        <BreakdownCard title="By question type" values={quiz.byType} />
      </View>

      <SectionHeader title="Repeatedly missed" action="Persistent gaps" />
      <Card>
        {quiz.repeatedMisses.length ? quiz.repeatedMisses.map((item, index) => (
          <View key={item.id} style={[styles.missRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.missBadge, { backgroundColor: `${colors.danger}16` }]}><Text style={[styles.missBadgeText, { color: colors.danger }]}>{item.misses}×</Text></View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.text }]}>{item.prompt}</Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{item.deckTitle}</Text>
            </View>
          </View>
        )) : <EmptyInsight icon="check-all" title="No question missed repeatedly" detail="StudyBolt flags a question after two recorded misses." />}
      </Card>

      <SectionHeader title="More quiz stats" />
      <View style={styles.compactStats}>
        <CompactStat label="First-try accuracy" value={percent(quiz.firstTryAccuracy)} />
        <CompactStat label="Repeat accuracy" value={percent(quiz.repeatAccuracy)} />
        <CompactStat label="Perfect quizzes" value={`${quiz.perfectQuizzes}`} />
        <CompactStat label="Quizzes completed" value={`${quiz.completed}`} />
      </View>
    </>
  );
}

function ActivityAnalytics({ analytics, goalMinutes }: { analytics: AnalyticsSnapshot; goalMinutes: number }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  const activity = analytics.activity;
  return (
    <>
      <SectionHeader title="Study activity" action={`${activity.activeDays} active days this month`} />
      <Card
        accessibilityLabel={`Today's study goal, ${formatMinutes(activity.today)} of ${formatMinutes(goalMinutes)}. Tap for details`}
        onPress={() => showStatDetail(makeStatDetail('Today’s study goal', `${formatMinutes(activity.today)} / ${formatMinutes(goalMinutes)}`, `${Math.round((activity.today / Math.max(1, goalMinutes)) * 100)}% complete today`, {
          description: 'Your progress toward the daily study-time goal set in StudyBolt.',
          calculation: 'Today’s positive-duration study events are added and compared with your saved daily goal.',
          whyItMatters: 'Use the goal to create a realistic study cue. The quality and spacing of those minutes still matter more than simply filling the bar.',
        }))}
        style={[styles.goalCard, { backgroundColor: colors.primarySoft }]}
      >
        <View style={[styles.goalIcon, { backgroundColor: colors.primary }]}><Icon name="flag-checkered" color={colors.primaryText} /></View>
        <View style={{ flex: 1 }}>
          <View style={styles.progressHeading}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>Today’s study goal</Text>
            <Text style={[styles.progressValue, { color: colors.primary }]}>{formatMinutes(activity.today)} / {formatMinutes(goalMinutes)}</Text>
          </View>
          <ProgressBar progress={(activity.today / Math.max(1, goalMinutes)) * 100} color={colors.primary} />
        </View>
        <Icon name="information-outline" size={18} color={colors.primary} />
      </Card>
      <View style={styles.metricGrid}>
        <MetricCard icon="calendar-today" label="Study time today" value={formatMinutes(activity.today)} detail="Tracked activity" tone="blue" />
        <MetricCard icon="calendar-week" label="This week" value={formatMinutes(activity.week)} detail={`${activity.daysThisWeek} days studied`} tone="mint" />
        <MetricCard icon="calendar-month-outline" label="This month" value={formatMinutes(activity.month)} detail={`${activity.activeDays} active days`} tone="purple" />
        <MetricCard icon="clock-outline" label="Total study time" value={formatMinutes(activity.total)} detail="Includes legacy totals" tone="orange" />
      </View>

      <SectionHeader title="Your study rhythm" action="Time, routine & comparison" />
      <View style={styles.metricGrid}>
        <MetricCard icon="chart-timeline-variant" label="Daily average" value={formatMinutes(activity.averageDaily)} detail="On study days · last 30 days" tone="mint" />
        <MetricCard icon="timer-sand" label="Average session" value={formatMinutes(activity.averageSession)} detail={`${activity.sessions} recorded sessions`} tone="blue" />
        <MetricCard icon="chart-line-variant" label="Study time change" value={activity.weekChangePercent === null ? '—' : `${formatSigned(activity.weekChangePercent)}%`} detail={activity.weekChangePercent === null ? 'Needs study time in the previous 7 days' : `${formatMinutes(activity.week)} vs ${formatMinutes(activity.previousWeek)} · previous 7 days`} tone="blue" muted={activity.weekChangePercent === null} />
        <MetricCard icon="calendar-check-outline" label="Days meeting your goal" value={`${activity.goalDaysThisWeek} / 7`} detail={`At your current ${formatMinutes(goalMinutes)} daily goal`} tone="purple" />
      </View>

      <SectionHeader title="7-day activity" action={`${formatMinutes(activity.week)} total`} />
      <Card>
        <BarChart values={activity.sevenDays.map((day) => day.minutes)} labels={activity.sevenDays.map((day) => shortWeekday(day.key))} minutes />
      </Card>

      <SectionHeader title="30-day history" action="Consistency over intensity" />
      <Card>
        <View style={styles.heatmap}>
          {activity.thirtyDays.map((day) => {
            const opacity = day.minutes === 0 ? 0.08 : Math.min(1, 0.25 + day.minutes / 60);
            return <View key={day.key} accessible accessibilityLabel={`${day.key}: ${formatMinutes(day.minutes)}`} style={[styles.heatCell, { backgroundColor: colors.primary, opacity }]} />;
          })}
        </View>
        <View style={styles.heatLegend}>
          <Text style={[styles.chartCaption, { color: colors.textMuted }]}>Less</Text>
          {[0.08, 0.3, 0.55, 0.8, 1].map((opacity) => <View key={opacity} style={[styles.legendCell, { backgroundColor: colors.primary, opacity }]} />)}
          <Text style={[styles.chartCaption, { color: colors.textMuted }]}>More</Text>
        </View>
      </Card>

      <StatsDisclosure title="Where your study time goes" subtitle="Time by class, Study Pack, and topic">
      <SectionHeader title="Time by class" />
      <Card>
        {analytics.classes.length ? analytics.classes.map((course, index) => (
          <HorizontalValue key={course.id} label={course.name} value={course.studyMinutes} max={Math.max(1, ...analytics.classes.map((item) => item.studyMinutes))} formatted={formatMinutes(course.studyMinutes)} color={course.color} last={index === analytics.classes.length - 1} />
        )) : <EmptyInsight icon="school-outline" title="No class activity yet" detail="Add material to a class to start tracking its study time." />}
      </Card>

      <SectionHeader title="Time by Study Pack" />
      <Card>
        {analytics.packs.length ? analytics.packs.map((pack, index) => {
          return <HorizontalValue key={pack.id} label={pack.title} value={pack.studyMinutes} max={Math.max(1, ...analytics.packs.map((item) => item.studyMinutes))} formatted={formatMinutes(pack.studyMinutes)} color={pack.color} last={index === analytics.packs.length - 1} />;
        }) : <EmptyInsight icon="book-open-outline" title="No Study Pack activity yet" detail="Reading, practice, and listening add to each pack’s study time." />}
      </Card>

      <SectionHeader title="Time by topic" action="Source-linked activity" />
      <Card>
        {analytics.topicStudyTime.length ? analytics.topicStudyTime.slice(0, 12).map((topic, index) => (
          <HorizontalValue key={topic.id} label={topic.title} value={topic.minutes} max={Math.max(1, ...analytics.topicStudyTime.map((item) => item.minutes))} formatted={formatMinutes(topic.minutes)} color={topic.color} last={index === Math.min(11, analytics.topicStudyTime.length - 1)} />
        )) : <EmptyInsight icon="clock-outline" title="No topic time yet" detail="Review a note, card, or quiz question to build source-linked topic time." />}
      </Card>
      </StatsDisclosure>

      <SectionHeader title="More activity stats" action="Secondary insights" />
      <View style={styles.compactStats}>
        <CompactStat label="Longest session" value={activity.longestSession === null ? '—' : formatMinutes(activity.longestSession)} />
        <CompactStat label="Most active day" value={activity.productiveDay ?? '—'} />
        <CompactStat label="Most active time" value={activity.productiveTime ?? '—'} />
        <CompactStat label="Study sessions" value={`${activity.sessions}`} />
      </View>
    </>
  );
}

function MethodAnalytics({ analytics, classCount, presentationCount }: { analytics: AnalyticsSnapshot; classCount: number; presentationCount: number }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  const methods = analytics.methods;
  return (
    <>
      <SectionHeader title="Study method breakdown" action="How you’re learning" />
      <View style={styles.methodStack}>
        <MethodCard icon="note-text-outline" color={colors.primary} background={colors.primarySoft} title="Notes" value={formatMinutes(methods.notesMinutes)} detail={`${methods.notesSectionsReviewed} sections reviewed · ${methods.fullNotesReviewsCompleted} full reviews`} />
        <MethodCard icon="cards-outline" color={colors.purple} background={colors.purpleSoft} title="Flashcards" value={`${methods.flashcardsReviewed} reviews`} detail={`${methods.flashcardsMastered} mastered · ${methods.flashcardsLearning} still learning`} />
        <MethodCard icon="clipboard-check-outline" color={colors.mint} background={colors.mintSoft} title="Quizzes" value={`${methods.quizzesCompleted} completed`} detail={`${methods.questionsAnswered} detailed answers recorded`} />
        <MethodCard icon="headphones" color={colors.warning} background={`${colors.warning}18`} title="Listening" value={formatMinutes(methods.listeningMinutes)} detail={`${percent(methods.listeningCompletion)} average completion · ${methods.quickReviewsCompleted} quick reviews`} />
      </View>

      <SectionHeader title="Study Pack status" />
      <Card style={styles.splitCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${methods.packsCompleted} completed Study Packs. Tap for details`}
          onPress={() => showStatDetail(makeStatDetail('Completed Study Packs', `${methods.packsCompleted}`, 'Packs at or above 90% completion', {
            description: 'Study Packs whose weighted activity coverage has reached the completion threshold.',
            calculation: 'A pack is complete at 90% or higher across notes, flashcards, quizzes, and listening progress.',
            whyItMatters: 'Completion shows broad coverage. Check mastery and recall to confirm that the covered material is secure.',
          }))}
          style={({ pressed }) => [styles.splitMetric, pressed && styles.statPressed]}
        >
          <View style={[styles.bigStatusIcon, { backgroundColor: colors.mintSoft }]}><Icon name="check-bold" color={colors.mint} size={25} /></View>
          <Text style={[styles.splitValue, { color: colors.text }]}>{methods.packsCompleted}</Text>
          <Text style={[styles.splitLabel, { color: colors.textMuted }]}>Completed</Text>
        </Pressable>
        <View style={[styles.splitDivider, { backgroundColor: colors.border }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${methods.packsIncomplete} Study Packs in progress. Tap for details`}
          onPress={() => showStatDetail(makeStatDetail('Study Packs in progress', `${methods.packsIncomplete}`, 'Packs below 90% completion', {
            description: 'Study Packs that still have meaningful coverage left across one or more learning modes.',
            calculation: 'Every pack below 90% weighted completion is counted as in progress.',
            whyItMatters: 'Open pack coverage to see where notes, cards, a quiz, or listening can close the remaining gap.',
          }))}
          style={({ pressed }) => [styles.splitMetric, pressed && styles.statPressed]}
        >
          <View style={[styles.bigStatusIcon, { backgroundColor: colors.primarySoft }]}><Icon name="progress-clock" color={colors.primary} size={25} /></View>
          <Text style={[styles.splitValue, { color: colors.text }]}>{methods.packsIncomplete}</Text>
          <Text style={[styles.splitLabel, { color: colors.textMuted }]}>In progress</Text>
        </Pressable>
      </Card>
      <View style={[styles.stack, { marginTop: 10 }]}>
        {analytics.packs.map((pack) => <PackRow key={pack.id} pack={pack} />)}
      </View>

      <SectionHeader title="More stats" action="Collected, not emphasized" />
      <View style={styles.compactStats}>
        <CompactStat label="Classes saved" value={String(classCount)} />
        <CompactStat label="Your presentations" value={String(presentationCount)} />
        <CompactStat label="Study Packs saved" value={String(analytics.more.packsCreated)} />
        <CompactStat label="Pages / slides" value={`${analytics.more.totalPages}`} />
        <CompactStat label="Page coverage estimate" value={`≈ ${analytics.more.slidesReviewed}`} />
        <CompactStat label="Perfect quizzes" value={`${analytics.quizzes.perfectQuizzes}`} />
      </View>

      <SectionHeader title="Study milestones" />
      <Card>
        {analytics.more.milestones.length ? analytics.more.milestones.map((milestone, index) => (
          <View key={milestone} style={[styles.milestone, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.milestoneIcon, { backgroundColor: colors.purpleSoft }]}><Icon name="star-four-points" color={colors.purple} size={17} /></View>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{milestone}</Text>
          </View>
        )) : <EmptyInsight icon="flag-outline" title="Your first milestone is close" detail="Complete a quiz or master five concepts." />}
      </Card>
    </>
  );
}

function MetricCard({ icon, label, value, detail, tone, muted = false }: { icon: IconName; label: string; value: string; detail: string; tone: 'blue' | 'mint' | 'purple' | 'orange' | 'red'; muted?: boolean }) {
  const { colors } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  const showStatDetail = useStatDetail();
  const color = tone === 'mint' ? colors.mint : tone === 'purple' ? colors.purple : tone === 'orange' ? colors.warning : tone === 'red' ? colors.danger : colors.primary;
  const background = tone === 'mint' ? colors.mintSoft : tone === 'purple' ? colors.purpleSoft : tone === 'orange' ? `${colors.warning}18` : tone === 'red' ? `${colors.danger}14` : colors.primarySoft;
  const isMuted = muted || value === '—';
  const displayedValue = isMuted ? '—' : value;
  return (
    <Card
      accessibilityLabel={`${label}, ${displayedValue}. Tap for details`}
      onPress={() => showStatDetail(makeStatDetail(label, displayedValue, detail))}
      style={[styles.metricCard, fontScale > 1.3 && styles.fullWidth]}
    >
      <View style={styles.metricTopRow}>
        <View style={[styles.metricIcon, { backgroundColor: background }]}><Icon name={icon} size={19} color={color} /></View>
        <View style={[styles.metricInfo, { backgroundColor: colors.cardStrong }]}><Icon name="information-outline" size={14} color={colors.textMuted} /></View>
      </View>
      <Text style={[styles.metricValue, { color: isMuted ? colors.textMuted : colors.text }]}>{displayedValue}</Text>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricDetail, { color: colors.textMuted }]}>{detail}</Text>
    </Card>
  );
}

function RiskConceptRow({ concept, last }: { concept: ConceptInsight; last: boolean }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  const probability = concept.recallProbability ?? 0;
  const color = probability >= 70 ? colors.mint : probability >= 50 ? colors.warning : colors.danger;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${concept.title}, ${probability}% recall probability. Tap for details`}
      onPress={() => showStatDetail(makeStatDetail(`${concept.title} recall probability`, `${probability}%`, `${concept.courseName} · ${concept.lastEvidenceAt ? `last evidence ${formatDate(concept.lastEvidenceAt)}` : 'no dated evidence'}`, {
        description: 'The estimated chance that you could retrieve this concept right now without seeing the answer.',
        calculation: 'The active retention model combines this concept’s dated review history, current mastery, and elapsed time.',
        whyItMatters: 'A low value or overdue status means a retrieval attempt now is likely to be useful.',
      }))}
      style={({ pressed }) => [styles.conceptRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && styles.statPressed]}
    >
      <View style={[styles.riskIcon, { backgroundColor: `${color}16` }]}><Icon name="memory" color={color} size={19} /></View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.text }]}>{concept.title}</Text>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{concept.courseName} · {concept.lastEvidenceAt ? `last evidence ${formatDate(concept.lastEvidenceAt)}` : 'no dated evidence'}</Text>
      </View>
      <View style={styles.conceptScore}><Text style={[styles.conceptPercent, { color }]}>{probability}%</Text><Text style={[styles.riskLabel, { color: colors.textMuted }]}>RECALL</Text></View>
      <Icon name="chevron-right" size={17} color={colors.textMuted} />
    </Pressable>
  );
}

function CalibrationCell({ label, value, color, background }: { label: string; value: number; color: string; background: string }) {
  const { fontScale } = useWindowDimensions();
  const showStatDetail = useStatDetail();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value} answers. Tap for details`}
      onPress={() => showStatDetail(makeStatDetail(label, `${value}`, 'Confidence-rated quiz answers', {
        description: `${label} counts answers grouped by whether your confidence matched the outcome.`,
        calculation: 'Your answer confidence at submission is paired with whether the answer was correct, then matching outcomes are counted.',
        whyItMatters: label === 'Confidently wrong' ? 'These are high-value review targets because the misconception may feel reliable.' : 'Use this group to understand whether your self-judgment matches tested performance.',
      }))}
      style={({ pressed }) => [styles.calibrationCell, fontScale > 1.3 && styles.fullWidth, { backgroundColor: background }, pressed && styles.statPressed]}
    >
      <Text style={[styles.calibrationValue, { color }]}>{value}</Text>
      <Text style={[styles.calibrationLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

function BreakdownRows({ values }: { values: BreakdownValue[] }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  return (
    <>
      {values.map((item, index) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${friendlyLabel(item.label)} performance, ${item.value === null ? 'not enough data' : `${item.value}%`}. Tap for details`}
          key={item.label}
          onPress={() => showStatDetail(makeStatDetail(`${friendlyLabel(item.label)} performance`, item.value === null ? '—' : `${item.value}%`, item.count ? `${item.count} recorded attempts` : 'Not collected by the current study tools', {
            description: `Your observed accuracy when practicing with ${friendlyLabel(item.label).toLowerCase()} prompts.`,
            calculation: 'Correct answers and partial-credit points for this question type are divided by its recorded attempts.',
            whyItMatters: 'Compare question types with enough attempts to find formats that may need a different practice strategy.',
          }))}
          style={({ pressed }) => [styles.performanceRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }, pressed && styles.statPressed]}
        >
          <View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.text }]}>{friendlyLabel(item.label)}</Text><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{item.count ? `${item.count} recorded attempts` : 'Not collected by the current study tools'}</Text></View>
          <Text style={[styles.performanceValue, { color: item.value === null ? colors.textMuted : colors.primary }]}>{item.value === null ? '—' : `${item.value}%`}</Text>
          <Icon name="chevron-right" size={17} color={colors.textMuted} />
        </Pressable>
      ))}
    </>
  );
}

function DistributionCard({ values }: { values: DistributionValue[] }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  const total = values.reduce((sum, item) => sum + item.count, 0);
  return (
    <Card>
      {values.map((item, index) => {
        const color = index === values.length - 1 ? colors.mint : index === 0 ? colors.textMuted : colors.primary;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.label}, ${item.count} concepts, ${total ? item.percent + '%' : 'not assessed yet'}. Tap for details`}
            key={item.label}
            onPress={() => showStatDetail(makeStatDetail(`${item.label} concepts`, total ? `${item.percent}%` : '—', `${item.count} concepts in this band`, {
              description: `The share of your tracked concepts currently classified as ${item.label.toLowerCase()}.`,
              calculation: 'Concepts are placed into this band from their current mastery estimate, then divided by all tracked concepts.',
              whyItMatters: 'The full distribution shows whether progress is broad or concentrated in only a few concepts.',
            }))}
            style={({ pressed }) => [styles.distributionRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }, pressed && styles.statPressed]}
          >
            <View style={styles.distributionHeading}><Text style={[styles.rowTitle, { color: colors.text }]}>{item.label}</Text><Text style={[styles.distributionValue, { color }]}>{item.count} · {total ? item.percent + '%' : '—'}</Text></View>
            {total ? <ProgressBar accessibilityLabel={item.label + ' share of concepts'} progress={item.percent} color={color} /> : <View style={[styles.unassessedTrack, { backgroundColor: colors.border }]} />}
          </Pressable>
        );
      })}
    </Card>
  );
}

function MethodologyRow({ icon, title, detail, bordered = false }: { icon: IconName; title: string; detail: string; bordered?: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <View style={[styles.methodologyRow, bordered && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.methodologyIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon} color={colors.primary} size={18} /></View>
      <View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.methodologyText, { color: colors.textSecondary }]}>{detail}</Text></View>
    </View>
  );
}

function ConceptRow({ concept, rank, last }: { concept: ConceptInsight; rank?: number; last: boolean }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  const hasEvidence = Boolean(concept.lastEvidenceAt);
  const value = hasEvidence ? concept.mastery + '%' : '—';
  const color = !hasEvidence ? colors.textMuted : concept.mastery >= 80 ? colors.mint : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${concept.title}, ${hasEvidence ? value + ' estimated practice signal' : 'not assessed yet'}. Tap for details`}
      onPress={() => showStatDetail(makeStatDetail(`${concept.title} practice signal`, value, `${concept.courseName} · ${concept.reviewCount} recorded reviews${concept.due ? ' · review suggested' : ''}`, {
        description: 'An estimate based on self-rated confidence and matching assessment evidence for this concept.',
        calculation: 'The estimate blends the card’s current confidence rating with accuracy from quiz questions in the same source section.',
        whyItMatters: concept.due ? 'This concept is due. A retrieval attempt now will both strengthen it and add better evidence.' : 'Use the estimate with due status and last evidence date to choose when to review.',
      }))}
      style={({ pressed }) => [styles.conceptRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && styles.statPressed]}
    >
      {rank ? <View style={[styles.rank, { backgroundColor: `${color}18` }]}><Text style={[styles.rankText, { color }]}>{rank}</Text></View> : null}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.text }]}>{concept.title}</Text>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{concept.courseName} · {concept.deckTitle}</Text>
      </View>
      <View style={styles.conceptScore}>
        <Text style={[styles.conceptPercent, { color }]}>{value}</Text>
        {!hasEvidence || concept.due ? <Text style={[styles.dueText, { color: colors.textMuted }]}>{hasEvidence ? 'Review' : 'Unseen'}</Text> : null}
      </View>
      <Icon name="chevron-right" size={17} color={colors.textMuted} />
    </Pressable>
  );
}

function StatusSection({ title, action, concepts, icon }: { title: string; action: string; concepts: ConceptInsight[] | null; icon: IconName }) {
  return (
    <>
      <SectionHeader title={title} action={action} />
      <Card>
        {concepts === null ? <EmptyInsight icon="clock-outline" title="Not enough study history yet" detail="This insight needs repeated activity across multiple days." />
          : concepts.length ? concepts.slice(0, 5).map((concept, index) => <ConceptRow key={concept.id} concept={concept} last={index === Math.min(4, concepts.length - 1)} />)
            : <EmptyInsight icon={icon} title={`No ${title.toLowerCase()} detected`} detail="This will update as your recall history develops." />}
      </Card>
    </>
  );
}

function ProgressRow({ label, detail, value, last }: { label: string; detail: string; value: number | null; last: boolean }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  const color = value === null ? colors.textMuted : value >= 80 ? colors.mint : colors.primary;
  const displayedValue = percent(value);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value === null ? 'not assessed yet' : displayedValue + ' estimated practice signal'}. Tap for details`}
      onPress={() => showStatDetail(makeStatDetail(`${label} practice signal`, displayedValue, detail, {
        description: 'Your current mastery estimate for this topic, based on its concepts and matching quiz evidence.',
        calculation: 'StudyBolt averages concept mastery in this source section and includes question accuracy when matching answers are available.',
        whyItMatters: 'Topic-level results narrow a broad class score into a specific area you can act on next.',
      }))}
      style={({ pressed }) => [styles.topicRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && styles.statPressed]}
    >
      <View style={styles.progressHeading}>
        <View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.text }]}>{label}</Text><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{detail}</Text></View>
        <Text style={[styles.progressValue, { color }]}>{displayedValue}</Text>
      </View>
      {value !== null ? <ProgressBar accessibilityLabel={label + ' estimated practice signal'} progress={value} color={color} /> : <View style={[styles.unassessedTrack, { backgroundColor: colors.border }]} />}
    </Pressable>
  );
}

function PackRow({ pack }: { pack: AnalyticsSnapshot['packs'][number] }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  return (
    <Card
      accessibilityLabel={`${pack.title}, ${pack.completion}% complete. Tap for details`}
      onPress={() => showStatDetail(makeStatDetail(`${pack.title} completion`, `${pack.completion}%`, `${pack.remaining}% remaining · ${pack.courseName}`, {
        description: 'Weighted activity coverage for this Study Pack across its learning modes.',
        calculation: 'Reviewed notes contribute 30%, attempted flashcards 35%, quiz completion 25%, and listening progress 10%.',
        whyItMatters: 'Use the remaining percentage to find untouched activities, then use mastery and recall to judge understanding.',
      }))}
      style={styles.packCard}
    >
      <View style={styles.progressHeading}>
        <View style={{ flex: 1 }}><Text style={[styles.progressTitle, { color: colors.text }]}>{pack.title}</Text><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{pack.courseName}</Text></View>
        <Text style={[styles.progressValue, { color: pack.color }]}>{pack.completion}%</Text>
      </View>
      <ProgressBar progress={pack.completion} color={pack.color} />
      <View style={styles.packMetaRow}><Text style={[styles.progressMeta, { color: colors.textMuted }]}>{pack.remaining}% of this pack remains</Text><Icon name="information-outline" size={15} color={colors.textMuted} /></View>
    </Card>
  );
}

function BreakdownCard({ title, values }: { title: string; values: BreakdownValue[] }) {
  const { colors } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  const showStatDetail = useStatDetail();
  return (
    <Card style={[styles.breakdownCard, fontScale > 1.3 && styles.fullWidth]}>
      <Text style={[styles.breakdownTitle, { color: colors.text }]}>{title}</Text>
      {values.map((item) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${friendlyLabel(item.label)}, ${item.value === null ? 'not enough data' : `${item.value}%`}. Tap for details`}
          key={item.label}
          onPress={() => showStatDetail(makeStatDetail(`${friendlyLabel(item.label)} accuracy`, item.value === null ? '—' : `${item.value}%`, `${item.count} recorded questions · ${title.toLowerCase()}`, {
            description: `Your quiz accuracy for the ${friendlyLabel(item.label).toLowerCase()} group.`,
            calculation: 'Correct answers and partial-credit points in this group are divided by its recorded answers.',
            whyItMatters: 'Compare groups only when they have enough attempts; a small sample can move sharply after one answer.',
          }))}
          style={({ pressed }) => [styles.breakdownRow, pressed && styles.statPressed]}
        >
          <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>{friendlyLabel(item.label)}</Text>
          <Text style={[styles.breakdownValue, { color: item.value === null ? colors.textMuted : colors.text }]}>{item.value === null ? '—' : `${item.value}%`}</Text>
          <Text style={[styles.breakdownCount, { color: colors.textMuted }]}>{item.count} Q</Text>
        </Pressable>
      ))}
    </Card>
  );
}

function BarChart({ values, labels, minutes = false, compact = false }: { values: number[]; labels: string[]; minutes?: boolean; compact?: boolean }) {
  const { colors } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  const showStatDetail = useStatDetail();
  const max = Math.max(Number.EPSILON, ...values);
  const formatted = (value: number) => minutes ? formatMinutes(value) : value + '%';
  if (!values.length) return <EmptyInsight icon="chart-bar" title="Your trend starts here" detail="A completed quiz adds the first result to this chart." />;
  const breakdown = values.map((value, index) => labels[index] + ': ' + formatted(value)).join('\n');
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={(minutes ? 'Study activity. ' : 'Quiz results. ') + breakdown.replace(/\n/g, '. ') + '. Tap for the full breakdown.'}
    onPress={() => showStatDetail(makeStatDetail(minutes ? 'Study activity' : 'Recent quiz results', minutes ? formatMinutes(values.reduce((sum, value) => sum + value, 0)) : values.length + ' recorded runs', breakdown, {
      description: minutes ? 'Your recorded study duration for each day shown in the chart.' : 'The score of each completed quiz or cumulative-test run, from earlier to later.',
      calculation: minutes ? 'Durations of tracked study activities are added for each calendar day. Bar height is proportional to the largest day shown.' : 'Each bar shows the saved score of one completed run. Bar height is proportional to the largest score shown.',
      whyItMatters: minutes ? 'Use the pattern to understand your routine. Time alone does not establish recall.' : 'Compare direction alongside question difficulty and source material; different runs may test different topics.',
    }))}
    style={({ pressed }) => [fontScale > 1.3 ? styles.chartList : styles.chart, compact && fontScale <= 1.3 && styles.chartCompact, { opacity: pressed ? 0.8 : 1 }]}
  >
    {values.map((value, index) => fontScale > 1.3 ? <View key={labels[index] + '-' + index} style={styles.chartListRow}>
      <View style={styles.progressHeading}><Text style={[styles.rowTitle, { color: colors.text }]}>{labels[index]}</Text><Text style={[styles.rowMeta, { color: colors.textSecondary }]}>{formatted(value)}</Text></View><ProgressBar accessibilityLabel={labels[index] + ' ' + formatted(value)} progress={(value / max) * 100} />
    </View> : <View key={labels[index] + '-' + index} style={styles.chartColumn}>
      <Text style={[styles.chartValue, { color: colors.textSecondary }]}>{formatted(value)}</Text>
      <View style={[styles.barTrack, compact && styles.barTrackCompact, { backgroundColor: colors.cardStrong }]}><View style={[styles.bar, { height: `${(value / max) * 100}%`, backgroundColor: index === values.length - 1 ? colors.purple : colors.primary }]} /></View>
      <Text style={[styles.dayLabel, { color: colors.textMuted }]}>{labels[index]}</Text>
    </View>)}
  </Pressable>;
}

function HorizontalValue({ label, value, max, formatted, color, last }: { label: string; value: number; max: number; formatted: string; color: string; last: boolean }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${formatted} study time. Tap for details`}
      onPress={() => showStatDetail(makeStatDetail(`${label} study time`, formatted, `${Math.round((value / Math.max(1, max)) * 100)}% of the largest value in this list`, {
        description: `Tracked study activity associated with ${label}.`,
        calculation: 'Durations from study events assigned to this class or Study Pack are added together.',
        whyItMatters: 'The bar is relative to the largest item in this list. Time shows allocation, while mastery shows the result.',
      }))}
      style={({ pressed }) => [styles.horizontalRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }, pressed && styles.statPressed]}
    >
      <View style={styles.progressHeading}><Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>{label}</Text><Text style={[styles.horizontalValue, { color }]}>{formatted}</Text></View>
      <ProgressBar progress={(value / max) * 100} color={color} />
    </Pressable>
  );
}

function MethodCard({ icon, color, background, title, value, detail }: { icon: IconName; color: string; background: string; title: string; value: string; detail: string }) {
  const { colors } = useStudyBolt();
  const showStatDetail = useStatDetail();
  return (
    <Card accessibilityLabel={`${title}, ${value}. Tap for details`} onPress={() => showStatDetail(makeStatDetail(title, value, detail))} style={styles.methodCard}>
      <View style={[styles.methodIcon, { backgroundColor: background }]}><Icon name={icon} color={color} size={24} /></View>
      <View style={{ flex: 1 }}><View style={styles.methodHeading}><Text style={[styles.methodTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.methodValue, { color }]}>{value}</Text></View><Text style={[styles.methodDetail, { color: colors.textMuted }]}>{detail}</Text></View>
      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </Card>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  const { colors } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  const showStatDetail = useStatDetail();
  return (
    <Card accessibilityLabel={`${label}, ${value}. Tap for details`} onPress={() => showStatDetail(makeStatDetail(label, value, 'Based on your recorded StudyBolt activity'))} style={[styles.compactStat, fontScale > 1.3 && styles.fullWidth]}>
      <View style={styles.compactTopRow}><Icon name="information-outline" size={14} color={colors.textMuted} /></View>
      <Text style={[styles.compactValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.compactLabel, { color: colors.textMuted }]}>{label}</Text>
    </Card>
  );
}

function EmptyInsight({ icon, title, detail }: { icon: IconName; title: string; detail: string }) {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.emptyInsight}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.cardStrong }]}><Icon name={icon} color={colors.textMuted} size={20} /></View>
      <View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{detail}</Text></View>
    </View>
  );
}

const percent = (value: number | null) => value === null ? '—' : `${value}%`;
const capitalize = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
const friendlyLabel = (value: string) => value.split('-').map(capitalize).join(' ');
const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const shortWeekday = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
const formatSigned = (value: number) => `${value > 0 ? '+' : ''}${value}`;
const formatPointGap = (value: number) => `${formatSigned(value)} pts`;
function formatMinutes(minutes: number): string {
  if (minutes > 0 && minutes < 1) return `${Math.max(1, Math.round(minutes * 60))}s`;
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
}
function getNextStudyAdjustment(analytics: AnalyticsSnapshot): StatDetail {
  const { advanced, activity } = analytics;
  const fatigue = advanced.sessionFatigue;
  let value = 'Keep strong concepts in rotation';
  let supporting = 'Use a short recall check to confirm that familiar ideas still come back easily.';
  let calculation = 'Your recorded study activity is reviewed for late-session accuracy drops, confident errors, clustered reviews, forgetting risk, and weak concepts, in that order.';
  let nextStep = 'Mix a few previously strong concepts into your next review and check your answers before moving on.';

  if (!activity.sessions) {
    value = 'Build your study pattern';
    supporting = 'Complete a few study activities to reveal a personal suggestion.';
    calculation = 'A personal suggestion needs recorded study activity. No timing or learning pattern is assumed before you start.';
    nextStep = 'Review a few cards or complete a quiz, then return to Insights as your history grows.';
  } else if (fatigue && fatigue.drop >= 10) {
    value = 'Try shorter study blocks';
    supporting = `Accuracy was ${fatigue.earlyAccuracy}% early and ${fatigue.lateAccuracy}% later in longer quizzes. Try a shorter block and a break.`;
    calculation = 'At least two quizzes with eight or more questions are available. Accuracy in their first and final thirds is compared; the observed decline is at least 10 percentage points.';
    nextStep = 'Split your next longer session into smaller blocks. Compare accuracy again before deciding whether shorter sessions work better for you; question difficulty can also affect this pattern.';
  } else if (advanced.confidenceCalibration.samples >= 5 && advanced.confidenceCalibration.confidentlyWrong >= 2) {
    value = 'Revisit confident misses';
    supporting = `${advanced.confidenceCalibration.confidentlyWrong} of ${advanced.confidenceCalibration.samples} confidence-rated answers were confidently wrong. Revisit their explanations before your next long quiz.`;
    calculation = 'At least five confidence-rated answers are available, including two or more answers marked very sure that were incorrect.';
    nextStep = 'Open your missed questions, explain the corrected idea in your own words, then answer again before revealing the solution.';
  } else if (advanced.spacingQuality.score !== null && advanced.spacingQuality.score < 50) {
    value = 'Check your review spacing';
    supporting = `${advanced.spacingQuality.spaced} of ${advanced.spacingQuality.total} repeat reviews were spaced 20 hours to 14 days apart. Check whether repeats are too close together or too far apart.`;
    calculation = 'At least three repeat-review intervals are available. Fewer than half fall in the app’s 20-hour to 14-day spacing window.';
    nextStep = 'Use your due-review schedule to spread the next round of familiar cards across days. The best timing depends on the card and how well you recalled it.';
  } else if (advanced.forgettingRisk.length) {
    const concept = advanced.forgettingRisk[0]!;
    value = 'Protect recent progress';
    supporting = `Estimated recall is ${concept.recallProbability}% for “${concept.title}”. Start your next review there.`;
    calculation = 'Concepts with dated recall evidence are ranked by estimated forgetting risk. This suggestion uses the highest-priority concept in that list.';
    nextStep = `Answer “${concept.title}” before opening the explanation. This is a timing estimate, so use your actual answer to decide what needs more work.`;
  } else if (activity.daysThisWeek <= 2 && activity.week > 0) {
    value = 'Spread out your next study block';
    supporting = `Your last seven days include ${activity.daysThisWeek} active study ${activity.daysThisWeek === 1 ? 'day' : 'days'}. Plan another short session on a different day.`;
    calculation = 'Positive-duration study events in the last seven calendar days are grouped by local day. No more than two days contain recorded study time.';
    nextStep = 'Choose one manageable review task for a different day instead of adding it all to your next longer session.';
  } else if (analytics.weakConcepts.length) {
    const concept = analytics.weakConcepts[0]!;
    value = 'Give a weak concept a focused review';
    supporting = `Observed mastery is ${concept.mastery}% for “${concept.title}”. Check your recall before adding more new material.`;
    calculation = 'Your current weak-concept ranking provides the next topic after no higher-priority timing, confidence, spacing, or forgetting-risk adjustment is detected.';
    nextStep = `Answer “${concept.title}” without the explanation, then check which part still needs work.`;
  }

  return makeStatDetail('Your next adjustment', value, supporting, {
    description: 'A practical next step based on patterns in your recorded study activity.',
    calculation,
    insight: supporting,
    whyItMatters: nextStep,
  });
}

const styles = StyleSheet.create({
  contentWidth: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 10, rowGap: 3, marginTop: 26, marginBottom: 12 },
  sectionHeadingTitle: { ...typography.sectionTitle, maxWidth: '100%' },
  sectionHeadingMeta: { ...typography.caption, maxWidth: '100%' },
  methodHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 },
  flexCopy: { flex: 1, minWidth: 0 },
  aboutButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  scopeRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 8 },
  scopeLabel: { fontSize: 12, lineHeight: 18, flexShrink: 1 },
  tabGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  sectionTab: { width: '31%', flexGrow: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  sectionTabText: { fontSize: 13, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  tabHalf: { width: '47%' },
  tabFull: { width: '100%' },
  tabSixth: { width: '15%' },
  inlineHint: { fontSize: 12, lineHeight: 18, marginTop: 10 },
  loadingState: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 12 },
  detailAction: { minHeight: 50, borderRadius: 15, paddingHorizontal: 16, paddingVertical: 13, marginHorizontal: 20, marginBottom: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  detailActionText: { fontSize: 15, lineHeight: 22, fontWeight: '600', flexShrink: 1 },
  nextStepCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  nextStepIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  disclosure: { marginTop: 22 },
  disclosureHeading: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  disclosureTitle: { ...typography.sectionTitle },
  disclosureBody: { paddingTop: 14 },
  fullWidth: { width: '100%', flexBasis: '100%' },
  unassessedTrack: { height: 5, borderRadius: 3 },
  chartCompact: { height: 145 },
  chartList: { gap: 14 },
  chartListRow: { width: '100%' },
  barTrackCompact: { height: 88 },
  screenShell: { flex: 1 },
  title: { ...typography.pageTitle },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 5, marginBottom: 2, maxWidth: 510 },
  modalRoot: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  modalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4, 9, 20, 0.56)' },
  detailSheet: { width: '100%', maxWidth: 620, maxHeight: '88%', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, paddingTop: 9, shadowColor: '#000000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 18 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
  detailEyebrow: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 1.1 },
  detailTitle: { fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.65, marginTop: 2 },
  detailClose: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  detailScroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 34, gap: 10 },
  detailValueCard: { minHeight: 116, borderRadius: 20, padding: 17, justifyContent: 'center' },
  detailValueLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 1 },
  detailValue: { fontSize: 32, lineHeight: 39, fontWeight: '900', letterSpacing: -0.8, marginTop: 3 },
  detailSupporting: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  detailSection: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderRadius: 17, padding: 13 },
  detailSectionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  detailSectionTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  detailSectionBody: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  estimateNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, marginTop: 2 },
  estimateNoteText: { flex: 1, fontSize: 14, lineHeight: 21 },
  statPressed: { opacity: 0.66 },
  advancedHero: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  advancedHeroIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  advancedHeroTitle: { fontSize: 14, fontWeight: '900' },
  advancedHeroText: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  advancedHeroMode: { fontSize: 14, lineHeight: 21, fontWeight: '700', marginTop: 5 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 148, padding: 15 },
  metricTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  metricInfo: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 26, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5, marginTop: 10, fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 14, lineHeight: 21, fontWeight: '600', marginTop: 1 },
  metricDetail: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  stack: { gap: 9 },
  insightCard: { paddingVertical: 3 },
  conceptRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
  rank: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  rowTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  rowMeta: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  conceptScore: { alignItems: 'flex-end', gap: 2 },
  conceptPercent: { fontSize: 14, fontWeight: '900' },
  dueText: { fontSize: 14, lineHeight: 21, fontWeight: '700', letterSpacing: 0.8 },
  riskIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  riskLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 0.7 },
  calibrationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  calibrationCell: { width: '48.5%', minHeight: 74, borderRadius: 13, padding: 12, justifyContent: 'center' },
  calibrationValue: { fontSize: 21, fontWeight: '900' },
  calibrationLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 2 },
  confusionRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  confusionCount: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confusionCountText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  confusionCorrection: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  performanceRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  performanceValue: { fontSize: 15, fontWeight: '900' },
  distributionRow: { paddingVertical: 12 },
  distributionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  distributionValue: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  methodologyRow: { minHeight: 75, flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 12 },
  methodologyIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  methodologyText: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  progressTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  progressValue: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  progressMeta: { fontSize: 12, lineHeight: 18, marginTop: 7 },
  packCard: { padding: 14 },
  packMetaRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  sectionHero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  heroIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionHeroTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  sectionHeroText: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  topicRow: { paddingVertical: 12 },
  evidenceCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  evidenceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  evidenceTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  evidenceText: { fontSize: 14, lineHeight: 21, marginTop: 2 },
  evidenceSource: { fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 4 },
  chart: { height: 190, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5 },
  chartColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  chartValue: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  barTrack: { width: '68%', maxWidth: 27, height: 125, borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 7 },
  dayLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  chartCaption: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  resultRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  scoreBadge: { width: 48, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  scoreBadgeText: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  breakdownCard: { width: '48%', flexGrow: 1, padding: 15 },
  breakdownTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700', marginBottom: 10 },
  breakdownRow: { marginTop: 8 },
  breakdownLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  breakdownValue: { fontSize: 15, fontWeight: '900', marginTop: 1 },
  breakdownCount: { fontSize: 14, lineHeight: 21, marginTop: 1 },
  missRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  missBadge: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  missBadgeText: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  compactStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  compactStat: { width: '48%', minHeight: 89, justifyContent: 'center', padding: 14 },
  compactTopRow: { position: 'absolute', right: 10, top: 10 },
  compactValue: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  compactLabel: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  goalCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  goalIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heatCell: { width: '8.3%', aspectRatio: 1, borderRadius: 5 },
  heatLegend: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 5, marginTop: 10 },
  legendCell: { width: 11, height: 11, borderRadius: 3 },
  horizontalRow: { paddingVertical: 12 },
  horizontalValue: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  methodStack: { gap: 9 },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  methodDetail: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  methodValue: { fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'right' },
  splitCard: { flexDirection: 'row', alignItems: 'center' },
  splitMetric: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  splitDivider: { width: StyleSheet.hairlineWidth, height: 78 },
  bigStatusIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  splitValue: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  splitLabel: { fontSize: 12, lineHeight: 18, marginTop: 1 },
  milestone: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  milestoneIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  emptyInsight: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  emptyIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
