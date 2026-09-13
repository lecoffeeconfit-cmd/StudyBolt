import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, Header, Icon, Pill, ProgressBar, Screen, SectionHeader } from '../components/ui';
import type { IconName } from '../components/ui';
import { learningEvidence } from '../data/learningScience';
import { useStudyBolt } from '../StudyBoltContext';
import { buildAnalytics } from '../services/analytics';
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

export function StatsScreen() {
  const { colors, state } = useStudyBolt();
  const [tab, setTab] = useState<StatsTab>('overview');
  const analytics = useMemo(() => buildAnalytics(state), [state]);

  return (
    <Screen>
      <Header title="Stats" right={<Pill label={`${capitalize(analytics.evidenceLevel)} evidence`} tone={analytics.evidenceLevel === 'strong' ? 'mint' : 'purple'} />} />
      <Text style={[styles.title, { color: colors.text }]}>Know what to study next.</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Progress signals grounded in your coverage, retrieval, quizzes, and study spacing—not XP.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(item.id)}
              style={[styles.tab, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
            >
              <Icon name={item.icon} size={16} color={active ? colors.primaryText : colors.textSecondary} />
              <Text style={[styles.tabText, { color: active ? colors.primaryText : colors.textSecondary }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === 'overview' ? <Overview analytics={analytics} /> : null}
      {tab === 'insights' ? <AdvancedInsights analytics={analytics} /> : null}
      {tab === 'mastery' ? <MasteryAnalytics analytics={analytics} /> : null}
      {tab === 'quizzes' ? <QuizAnalytics analytics={analytics} /> : null}
      {tab === 'activity' ? <ActivityAnalytics analytics={analytics} goalMinutes={state.dailyStudyGoalMinutes} /> : null}
      {tab === 'methods' ? <MethodAnalytics analytics={analytics} /> : null}
    </Screen>
  );
}

function Overview({ analytics }: { analytics: AnalyticsSnapshot }) {
  const { colors } = useStudyBolt();
  const readiness = analytics.readiness.score;
  const readinessColor = readiness === null ? colors.textMuted : readiness >= 75 ? colors.mint : readiness >= 55 ? colors.warning : colors.danger;
  return (
    <>
      <Card style={[styles.readinessCard, { backgroundColor: colors.mode === 'dark' ? '#121A24' : '#111936' }]}>
        <View style={styles.readinessTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>ESTIMATED EXAM READINESS</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.heroValue}>{readiness === null ? 'Building' : `${readiness}%`}</Text>
            <Text style={styles.heroDetail}>{readiness === null ? 'Complete two quizzes and review concepts on more than one day.' : readinessLabel(readiness)}</Text>
          </View>
          <View style={[styles.readinessRing, { borderColor: readinessColor }]}>
            <Icon name={readiness === null ? 'progress-clock' : 'school-outline'} size={28} color={readinessColor} />
          </View>
        </View>
        <ProgressBar progress={readiness ?? 0} color={readinessColor} />
        <View style={styles.confidenceRow}>
          <Icon name="shield-check-outline" size={16} color="#AEB8DE" />
          <Text style={styles.confidenceText}>{analytics.historyMessage}</Text>
        </View>
      </Card>

      <SectionHeader title="At a glance" action="Live" />
      <View style={styles.metricGrid}>
        <MetricCard icon="brain" label="Overall mastery" value={`${analytics.overallMastery}%`} detail="Across every class" tone="purple" />
        <MetricCard icon="clipboard-check-outline" label="Recent quiz average" value={percent(analytics.recentQuizAverage)} detail="Most recent 5" tone="mint" />
        <MetricCard icon="timer-outline" label="Study time this week" value={formatMinutes(analytics.studyTimeThisWeek)} detail={`${analytics.activity.daysThisWeek} active days`} tone="blue" />
        <MetricCard icon="fire" label="Study streak" value={`${analytics.streakDays} days`} detail="Consecutive active days" tone="orange" />
        <MetricCard icon="check-decagram-outline" label="Concepts mastered" value={`${analytics.masteredCount}`} detail="Observed mastery ≥ 80%" tone="mint" />
        <MetricCard icon="progress-clock" label="Still learning" value={`${analytics.learningCount}`} detail="Needs more retrieval" tone="orange" />
        <MetricCard icon="calendar-alert" label="Due today" value={`${analytics.dueTodayCount}`} detail="Based on last recall" tone="red" />
        <MetricCard icon="book-open-page-variant-outline" label="Pack completion" value={`${analytics.packCompletion}%`} detail="Notes, cards, quiz, audio" tone="blue" />
        <MetricCard icon="layers-triple-outline" label="Material remaining" value={`${analytics.materialRemaining}%`} detail="Across all Study Packs" tone="purple" />
      </View>

      <SectionHeader title="What to study next" action={`${analytics.weakConcepts.length} priority concepts`} />
      <Card style={styles.insightCard}>
        {analytics.weakConcepts.length ? analytics.weakConcepts.slice(0, 4).map((concept, index) => (
          <ConceptRow key={concept.id} concept={concept} rank={index + 1} last={index === Math.min(3, analytics.weakConcepts.length - 1)} />
        )) : <EmptyInsight icon="check-circle-outline" title="No weak concepts detected" detail="Keep using spaced retrieval to confirm they stay strong." />}
      </Card>

      <SectionHeader title="Class mastery" action={`${analytics.classes.length} classes`} />
      <View style={styles.stack}>
        {analytics.classes.map((course) => (
          <Card key={course.id} style={styles.progressCard}>
            <View style={[styles.courseIcon, { backgroundColor: `${course.color}20` }]}><Text style={styles.emoji}>{course.emoji}</Text></View>
            <View style={{ flex: 1 }}>
              <View style={styles.progressHeading}>
                <Text style={[styles.progressTitle, { color: colors.text }]}>{course.name}</Text>
                <Text style={[styles.progressValue, { color: course.color }]}>{course.mastery}%</Text>
              </View>
              <ProgressBar progress={course.mastery} color={course.color} />
              <Text style={[styles.progressMeta, { color: colors.textMuted }]}>{course.studyMinutes ? `${formatMinutes(course.studyMinutes)} tracked study` : 'No tracked study time yet'}</Text>
            </View>
          </Card>
        ))}
      </View>

      <SectionHeader title="Study Pack coverage" action={`${analytics.materialRemaining}% remaining`} />
      <View style={styles.stack}>
        {analytics.packs.map((pack) => <PackRow key={pack.id} pack={pack} />)}
      </View>
    </>
  );
}

function AdvancedInsights({ analytics }: { analytics: AnalyticsSnapshot }) {
  const { colors, state } = useStudyBolt();
  const insight = analytics.advanced;
  const advancedRetention = state.retentionMode !== 'standard';
  const retentionLabel = state.retentionMode === 'standard' ? 'Standard' : state.retentionMode === 'fsrs' ? 'FSRS' : 'SM-2';
  const gap = insight.recognitionRecallGap;
  const calibration = insight.confidenceCalibration;
  const fatigue = insight.sessionFatigue;
  const forecast = insight.readinessForecast;
  const efficiency = insight.efficiencyTrend;
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

      <SectionHeader title="Memory & recall" action="What is likely to stick" />
      <View style={styles.metricGrid}>
        <MetricCard icon="head-check-outline" label="Recall probability" value={percent(insight.recallProbability.value)} detail={`${insight.recallProbability.concepts} concepts with dated evidence`} tone="mint" muted={insight.recallProbability.value === null} />
        <MetricCard icon="eye-outline" label="Recognition vs. recall" value={gap.value === null ? '—' : formatPointGap(gap.value)} detail={`${percent(gap.recognition)} recognition · ${percent(gap.recall)} recall`} tone="purple" muted={gap.value === null} />
        <MetricCard icon="scale-balance" label="Confidence calibration" value={percent(calibration.score)} detail={`${calibration.samples} answers with confidence`} tone="blue" muted={calibration.score === null} />
        <MetricCard icon="target-account" label="First-try accuracy" value={percent(analytics.quizzes.firstTryAccuracy)} detail="First recorded attempt per question" tone="orange" muted={analytics.quizzes.firstTryAccuracy === null} />
        <MetricCard icon="calendar-sync-outline" label="Delayed retention" value={percent(analytics.retention.longTermSuccess)} detail="Recall repeated at least 7 days later" tone="mint" muted={analytics.retention.longTermSuccess === null} />
        <MetricCard icon="trending-up" label="Learning velocity" value={insight.learningVelocity.pointsPerWeek === null ? '—' : `${formatSigned(insight.learningVelocity.pointsPerWeek)} pts/wk`} detail={`${insight.learningVelocity.samples} changes · normalized per concept`} tone="purple" muted={insight.learningVelocity.pointsPerWeek === null} />
      </View>

      <SectionHeader title="Forgetting risk" action={`${insight.forgettingRisk.length} concepts to protect`} />
      <Card style={styles.insightCard}>
        {insight.forgettingRisk.length ? insight.forgettingRisk.map((concept, index) => (
          <RiskConceptRow key={concept.id} concept={concept} last={index === insight.forgettingRisk.length - 1} />
        )) : <EmptyInsight icon="shield-check-outline" title="No near-term forgetting risk detected" detail="This list uses dated recall evidence and grows more reliable after spaced reviews." />}
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

      <SectionHeader title="Weakest concepts" action="Study these next" />
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
        <MetricCard icon="calendar-check-outline" label="Consistency score" value={`${insight.consistency.score}%`} detail={`${insight.consistency.activeDays} active days · ${insight.consistency.activeWeeks}/4 weeks`} tone="mint" />
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

      <SectionHeader title="Exam readiness by topic" action="Strongest to weakest" />
      <Card>
        {analytics.topicMastery.length ? analytics.topicMastery.slice(0, 12).map((topic, index) => (
          <ProgressRow key={topic.id} label={topic.title} detail={topic.courseName} value={topic.value} last={index === Math.min(11, analytics.topicMastery.length - 1)} />
        )) : <EmptyInsight icon="book-search-outline" title="No topic evidence yet" detail="Study cards or complete quizzes to build topic-level readiness." />}
      </Card>

      <SectionHeader title="Readiness forecast" action="At your current measured pace" />
      <Card style={[styles.forecastCard, { backgroundColor: forecast ? colors.mintSoft : colors.card }]}>
        {forecast ? (
          <>
            <View style={styles.forecastTop}>
              <View style={[styles.forecastIcon, { backgroundColor: colors.card }]}><Icon name="chart-timeline-variant-shimmer" color={colors.mint} size={24} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.forecastValue, { color: colors.text }]}>{forecast.value}% projected</Text><Text style={[styles.forecastText, { color: colors.textSecondary }]}>by {formatDate(forecast.targetDate)} · {forecast.daysRemaining} days remaining</Text></View>
            </View>
            <ProgressBar progress={forecast.value} color={colors.mint} />
          </>
        ) : <EmptyInsight icon="chart-timeline-variant-shimmer" title="Forecast is still building" detail="It needs a plan deadline, current readiness, and at least three measured mastery changes." />}
      </Card>

      <SectionHeader title="How these stats are made" action="Transparent methodology" />
      <Card>
        <MethodologyRow icon="database-check-outline" title="Direct observations" detail="Correctness, chosen and correct answers, answer confidence, response time, timestamps, session duration, card ratings, and completed plan blocks are stored on this device." />
        <MethodologyRow icon="brain" title="Recall estimate" detail={state.retentionMode === 'fsrs' ? 'FSRS replays each card\'s dated review history and estimates retrievability from per-card difficulty and stability, with intervals capped at 365 days.' : state.retentionMode === 'sm2' ? 'SM-2 replays each card\'s dated review history using repetitions, an ease factor, and quality ratings to set the next interval. Its recall estimate uses the scheduled interval.' : 'Standard mode decays current observed mastery from the latest dated evidence using StudyBolt\'s time-based forgetting curve. More successful reviews increase estimated stability.'} bordered />
        <MethodologyRow icon="calendar-sync-outline" title="Spacing and retention" detail="A repeat review counts as spaced after 20 hours; delayed retention requires successful recall at least 7 days after prior retrieval." bordered />
        <MethodologyRow icon="flask-outline" title="Evidence context" detail="Spaced and retrieval practice have strong learning-science support. FSRS and SM-2 are timing models—not guarantees of remembering or exam performance." bordered />
        <MethodologyRow icon="trending-up" title="Improvement rates" detail="Mastery changes are normalized per distinct concept or assessment, then divided by elapsed weeks or tracked study hours so studying more items does not inflate the rate." bordered />
        <MethodologyRow icon="shield-check-outline" title="Evidence thresholds" detail="Timing, calibration, fatigue, ideal-session, and forecast metrics remain unavailable until their minimum sample sizes are met." bordered />
        <MethodologyRow icon="alert-circle-outline" title="Interpret estimates carefully" detail="Readiness and recall probability guide study priorities; they are not validated predictions of an exam grade or a guarantee of remembering." bordered />
      </Card>
    </>
  );
}

function MasteryAnalytics({ analytics }: { analytics: AnalyticsSnapshot }) {
  const { colors } = useStudyBolt();
  return (
    <>
      <SectionHeader title="Mastery & retention" action="Recall over time" />
      <Card style={[styles.sectionHero, { backgroundColor: colors.purpleSoft }]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.card }]}><Icon name="brain" color={colors.purple} size={25} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionHeroTitle, { color: colors.text }]}>Durable knowledge, not familiarity</Text>
          <Text style={[styles.sectionHeroText, { color: colors.textSecondary }]}>A concept becomes convincing only when recall succeeds again after time has passed.</Text>
        </View>
      </Card>
      <View style={styles.metricGrid}>
        <MetricCard icon="memory" label="Retention rate" value={percent(analytics.retention.rate)} detail={`${analytics.retention.spacedAttempts} spaced attempts`} tone="mint" />
        <MetricCard icon="shield-star-outline" label="Retention confidence" value={percent(analytics.retention.confidence)} detail="Needs 5+ active days" tone="purple" muted={analytics.retention.confidence === null} />
        <MetricCard icon="target-account" label="First-try accuracy" value={percent(analytics.quizzes.firstTryAccuracy)} detail="First attempt per question" tone="blue" />
        <MetricCard icon="backup-restore" label="Repeat accuracy" value={percent(analytics.quizzes.repeatAccuracy)} detail="After prior exposure" tone="orange" />
        <MetricCard icon="calendar-sync-outline" label="Long-term retention" value={percent(analytics.retention.longTermSuccess)} detail="Repeated success 7+ days apart" tone="mint" muted={analytics.retention.longTermSuccess === null} />
        <MetricCard icon="eye-off-outline" label="Unseen concepts" value={`${analytics.unseenConcepts.length}`} detail="No recall evidence yet" tone="red" />
      </View>

      <SectionHeader title="Topic mastery" action="Strongest to weakest" />
      <Card>
        {analytics.topicMastery.slice(0, 12).map((topic, index) => (
          <ProgressRow key={topic.id} label={topic.title} detail={topic.courseName} value={topic.value} last={index === Math.min(11, analytics.topicMastery.length - 1)} />
        ))}
      </Card>

      <StatusSection title="Strongest concepts" action="Most secure" concepts={analytics.strongestConcepts} icon="shield-check-outline" />
      <StatusSection title="Unseen concepts" action="Not studied yet" concepts={analytics.unseenConcepts} icon="eye-off-outline" />
      <StatusSection title="At-risk concepts" action="Previously stronger" concepts={analytics.atRiskConcepts} icon="trending-down" />
      <StatusSection title="Improving concepts" action="Most improved" concepts={analytics.improvingConcepts} icon="trending-up" />
      <StatusSection title="Concepts forgotten" action="Relearn soon" concepts={analytics.forgottenConcepts} icon="head-question-outline" />

      <SectionHeader title="How the estimate works" action="Transparent by design" />
      <Card>
        {analytics.readiness.components.map((component, index) => (
          <View key={component.label} style={[styles.formulaRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.formulaLabel, { color: colors.text }]}>{component.label}</Text>
              <ProgressBar progress={component.value} color={colors.primary} />
            </View>
            <Text style={[styles.formulaValue, { color: colors.text }]}>{component.value}%</Text>
            <Pill label={`${component.weight}% weight`} tone="neutral" />
          </View>
        ))}
        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>Readiness is an evidence-informed StudyBolt estimate, not a validated prediction of an exam grade. It stays hidden until there is enough varied activity to calculate it responsibly.</Text>
      </Card>

      <SectionHeader title="Learning science" action="Primary research" />
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
  const activity = analytics.activity;
  return (
    <>
      <SectionHeader title="Study activity" action={`${activity.activeDays} active days this month`} />
      <Card style={[styles.goalCard, { backgroundColor: colors.primarySoft }]}>
        <View style={[styles.goalIcon, { backgroundColor: colors.primary }]}><Icon name="flag-checkered" color={colors.primaryText} /></View>
        <View style={{ flex: 1 }}>
          <View style={styles.progressHeading}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>Today’s study goal</Text>
            <Text style={[styles.progressValue, { color: colors.primary }]}>{activity.today} / {goalMinutes} min</Text>
          </View>
          <ProgressBar progress={(activity.today / Math.max(1, goalMinutes)) * 100} color={colors.primary} />
        </View>
      </Card>
      <View style={styles.metricGrid}>
        <MetricCard icon="calendar-today" label="Study time today" value={formatMinutes(activity.today)} detail="Tracked activity" tone="blue" />
        <MetricCard icon="calendar-week" label="This week" value={formatMinutes(activity.week)} detail={`${activity.daysThisWeek} days studied`} tone="mint" />
        <MetricCard icon="calendar-month-outline" label="This month" value={formatMinutes(activity.month)} detail={`${activity.activeDays} active days`} tone="purple" />
        <MetricCard icon="clock-outline" label="Total study time" value={formatMinutes(activity.total)} detail="Includes legacy totals" tone="orange" />
        <MetricCard icon="chart-timeline-variant" label="Daily average" value={formatMinutes(activity.averageDaily)} detail="On active days" tone="mint" />
        <MetricCard icon="timer-sand" label="Average session" value={formatMinutes(activity.averageSession)} detail={`${activity.sessions} tracked sessions`} tone="blue" />
      </View>

      <SectionHeader title="7-day activity" action={`${formatMinutes(activity.week)} total`} />
      <Card>
        <BarChart values={activity.sevenDays.map((day) => day.minutes)} labels={activity.sevenDays.map((day) => day.label)} minutes />
      </Card>

      <SectionHeader title="30-day history" action="Consistency over intensity" />
      <Card>
        <View style={styles.heatmap}>
          {activity.thirtyDays.map((day) => {
            const opacity = day.minutes === 0 ? 0.08 : Math.min(1, 0.25 + day.minutes / 60);
            return <View key={day.key} accessibilityLabel={`${day.key}: ${day.minutes} minutes`} style={[styles.heatCell, { backgroundColor: colors.primary, opacity }]} />;
          })}
        </View>
        <View style={styles.heatLegend}>
          <Text style={[styles.chartCaption, { color: colors.textMuted }]}>Less</Text>
          {[0.08, 0.3, 0.55, 0.8, 1].map((opacity) => <View key={opacity} style={[styles.legendCell, { backgroundColor: colors.primary, opacity }]} />)}
          <Text style={[styles.chartCaption, { color: colors.textMuted }]}>More</Text>
        </View>
      </Card>

      <SectionHeader title="Time by class" />
      <Card>
        {analytics.classes.map((course, index) => (
          <HorizontalValue key={course.id} label={course.name} value={course.studyMinutes} max={Math.max(1, ...analytics.classes.map((item) => item.studyMinutes))} formatted={formatMinutes(course.studyMinutes)} color={course.color} last={index === analytics.classes.length - 1} />
        ))}
      </Card>

      <SectionHeader title="Time by Study Pack" />
      <Card>
        {analytics.packs.map((pack, index) => {
          return <HorizontalValue key={pack.id} label={pack.title} value={pack.studyMinutes} max={Math.max(1, ...analytics.packs.map((item) => item.studyMinutes))} formatted={pack.studyMinutes ? formatMinutes(pack.studyMinutes) : '—'} color={pack.color} last={index === analytics.packs.length - 1} />;
        })}
      </Card>

      <SectionHeader title="More activity stats" action="Secondary insights" />
      <View style={styles.compactStats}>
        <CompactStat label="Longest session" value={activity.longestSession === null ? 'More history needed' : formatMinutes(activity.longestSession)} />
        <CompactStat label="Most productive day" value={activity.productiveDay ?? 'More history needed'} />
        <CompactStat label="Most productive time" value={activity.productiveTime ?? 'More history needed'} />
        <CompactStat label="Study sessions" value={`${activity.sessions}`} />
      </View>
    </>
  );
}

function MethodAnalytics({ analytics }: { analytics: AnalyticsSnapshot }) {
  const { colors } = useStudyBolt();
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
        <View style={styles.splitMetric}>
          <View style={[styles.bigStatusIcon, { backgroundColor: colors.mintSoft }]}><Icon name="check-bold" color={colors.mint} size={25} /></View>
          <Text style={[styles.splitValue, { color: colors.text }]}>{methods.packsCompleted}</Text>
          <Text style={[styles.splitLabel, { color: colors.textMuted }]}>Completed</Text>
        </View>
        <View style={[styles.splitDivider, { backgroundColor: colors.border }]} />
        <View style={styles.splitMetric}>
          <View style={[styles.bigStatusIcon, { backgroundColor: colors.primarySoft }]}><Icon name="progress-clock" color={colors.primary} size={25} /></View>
          <Text style={[styles.splitValue, { color: colors.text }]}>{methods.packsIncomplete}</Text>
          <Text style={[styles.splitLabel, { color: colors.textMuted }]}>In progress</Text>
        </View>
      </Card>
      <View style={[styles.stack, { marginTop: 10 }]}>
        {analytics.packs.map((pack) => <PackRow key={pack.id} pack={pack} />)}
      </View>

      <SectionHeader title="More stats" action="Collected, not emphasized" />
      <View style={styles.compactStats}>
        <CompactStat label="Classes created" value={`${analytics.more.classesCreated}`} />
        <CompactStat label="Lectures uploaded" value={`${analytics.more.lecturesUploaded}`} />
        <CompactStat label="Study Packs created" value={`${analytics.more.packsCreated}`} />
        <CompactStat label="Pages / slides" value={`${analytics.more.totalPages}`} />
        <CompactStat label="Slides reviewed" value={`≈ ${analytics.more.slidesReviewed}`} />
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
  const color = tone === 'mint' ? colors.mint : tone === 'purple' ? colors.purple : tone === 'orange' ? colors.warning : tone === 'red' ? colors.danger : colors.primary;
  const background = tone === 'mint' ? colors.mintSoft : tone === 'purple' ? colors.purpleSoft : tone === 'orange' ? `${colors.warning}18` : tone === 'red' ? `${colors.danger}14` : colors.primarySoft;
  return (
    <Card style={[styles.metricCard, muted && { opacity: 0.72 }]}>
      <View style={[styles.metricIcon, { backgroundColor: background }]}><Icon name={icon} size={19} color={color} /></View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.metricValue, { color: muted ? colors.textMuted : colors.text }]}>{muted ? '—' : value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricDetail, { color: colors.textMuted }]}>{detail}</Text>
    </Card>
  );
}

function RiskConceptRow({ concept, last }: { concept: ConceptInsight; last: boolean }) {
  const { colors } = useStudyBolt();
  const probability = concept.recallProbability ?? 0;
  const color = probability >= 70 ? colors.mint : probability >= 50 ? colors.warning : colors.danger;
  return (
    <View style={[styles.conceptRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.riskIcon, { backgroundColor: `${color}16` }]}><Icon name="memory" color={color} size={19} /></View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.text }]}>{concept.title}</Text>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{concept.courseName} · {concept.lastEvidenceAt ? `last evidence ${formatDate(concept.lastEvidenceAt)}` : 'no dated evidence'}</Text>
      </View>
      <View style={styles.conceptScore}><Text style={[styles.conceptPercent, { color }]}>{probability}%</Text><Text style={[styles.riskLabel, { color: colors.textMuted }]}>RECALL</Text></View>
    </View>
  );
}

function CalibrationCell({ label, value, color, background }: { label: string; value: number; color: string; background: string }) {
  return (
    <View style={[styles.calibrationCell, { backgroundColor: background }]}>
      <Text style={[styles.calibrationValue, { color }]}>{value}</Text>
      <Text style={[styles.calibrationLabel, { color }]}>{label}</Text>
    </View>
  );
}

function BreakdownRows({ values }: { values: BreakdownValue[] }) {
  const { colors } = useStudyBolt();
  return (
    <>
      {values.map((item, index) => (
        <View key={item.label} style={[styles.performanceRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.text }]}>{friendlyLabel(item.label)}</Text><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{item.count ? `${item.count} recorded attempts` : 'Not collected by the current study tools'}</Text></View>
          <Text style={[styles.performanceValue, { color: item.value === null ? colors.textMuted : colors.primary }]}>{item.value === null ? '—' : `${item.value}%`}</Text>
        </View>
      ))}
    </>
  );
}

function DistributionCard({ values }: { values: DistributionValue[] }) {
  const { colors } = useStudyBolt();
  return (
    <Card>
      {values.map((item, index) => {
        const color = index === values.length - 1 ? colors.mint : index === 0 ? colors.textMuted : colors.primary;
        return (
          <View key={item.label} style={[styles.distributionRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={styles.distributionHeading}><Text style={[styles.rowTitle, { color: colors.text }]}>{item.label}</Text><Text style={[styles.distributionValue, { color }]}>{item.count} · {item.percent}%</Text></View>
            <ProgressBar progress={item.percent} color={color} />
          </View>
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
  const color = concept.mastery >= 80 ? colors.mint : concept.mastery >= 55 ? colors.warning : colors.danger;
  return (
    <View style={[styles.conceptRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      {rank ? <View style={[styles.rank, { backgroundColor: `${color}18` }]}><Text style={[styles.rankText, { color }]}>{rank}</Text></View> : null}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[styles.rowTitle, { color: colors.text }]}>{concept.title}</Text>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{concept.courseName} · {concept.deckTitle}</Text>
      </View>
      <View style={styles.conceptScore}>
        <Text style={[styles.conceptPercent, { color }]}>{concept.mastery}%</Text>
        {concept.due ? <Text style={[styles.dueText, { color: colors.danger }]}>DUE</Text> : null}
      </View>
    </View>
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

function ProgressRow({ label, detail, value, last }: { label: string; detail: string; value: number; last: boolean }) {
  const { colors } = useStudyBolt();
  const color = value >= 80 ? colors.mint : value >= 55 ? colors.primary : colors.danger;
  return (
    <View style={[styles.topicRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.progressHeading}>
        <View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: colors.text }]}>{label}</Text><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{detail}</Text></View>
        <Text style={[styles.progressValue, { color }]}>{value}%</Text>
      </View>
      <ProgressBar progress={value} color={color} />
    </View>
  );
}

function PackRow({ pack }: { pack: AnalyticsSnapshot['packs'][number] }) {
  const { colors } = useStudyBolt();
  return (
    <Card style={styles.packCard}>
      <View style={styles.progressHeading}>
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.progressTitle, { color: colors.text }]}>{pack.title}</Text><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{pack.courseName}</Text></View>
        <Text style={[styles.progressValue, { color: pack.color }]}>{pack.completion}%</Text>
      </View>
      <ProgressBar progress={pack.completion} color={pack.color} />
      <Text style={[styles.progressMeta, { color: colors.textMuted }]}>{pack.remaining}% of this pack remains</Text>
    </Card>
  );
}

function BreakdownCard({ title, values }: { title: string; values: BreakdownValue[] }) {
  const { colors } = useStudyBolt();
  return (
    <Card style={styles.breakdownCard}>
      <Text style={[styles.breakdownTitle, { color: colors.text }]}>{title}</Text>
      {values.map((item) => (
        <View key={item.label} style={styles.breakdownRow}>
          <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>{friendlyLabel(item.label)}</Text>
          <Text style={[styles.breakdownValue, { color: item.value === null ? colors.textMuted : colors.text }]}>{item.value === null ? '—' : `${item.value}%`}</Text>
          <Text style={[styles.breakdownCount, { color: colors.textMuted }]}>{item.count} Q</Text>
        </View>
      ))}
    </Card>
  );
}

function BarChart({ values, labels, minutes = false }: { values: number[]; labels: string[]; minutes?: boolean }) {
  const { colors } = useStudyBolt();
  const max = Math.max(1, ...values);
  if (!values.length) return <EmptyInsight icon="chart-bar" title="No trend yet" detail="Complete a quiz to start this chart." />;
  return (
    <View style={styles.chart}>
      {values.map((value, index) => (
        <View key={`${labels[index]}-${index}`} style={styles.chartColumn}>
          <Text style={[styles.chartValue, { color: colors.textSecondary }]}>{minutes ? value : `${value}%`}</Text>
          <View style={[styles.barTrack, { backgroundColor: colors.cardStrong }]}>
            <View style={[styles.bar, { height: `${Math.max(value ? 8 : 0, (value / max) * 100)}%`, backgroundColor: index === values.length - 1 ? colors.purple : colors.primary }]} />
          </View>
          <Text style={[styles.dayLabel, { color: colors.textMuted }]}>{labels[index]}</Text>
        </View>
      ))}
    </View>
  );
}

function HorizontalValue({ label, value, max, formatted, color, last }: { label: string; value: number; max: number; formatted: string; color: string; last: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <View style={[styles.horizontalRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.progressHeading}><Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>{label}</Text><Text style={[styles.horizontalValue, { color }]}>{formatted}</Text></View>
      <ProgressBar progress={(value / max) * 100} color={color} />
    </View>
  );
}

function MethodCard({ icon, color, background, title, value, detail }: { icon: IconName; color: string; background: string; title: string; value: string; detail: string }) {
  const { colors } = useStudyBolt();
  return (
    <Card style={styles.methodCard}>
      <View style={[styles.methodIcon, { backgroundColor: background }]}><Icon name={icon} color={color} size={24} /></View>
      <View style={{ flex: 1 }}><Text style={[styles.methodTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.methodDetail, { color: colors.textMuted }]}>{detail}</Text></View>
      <Text style={[styles.methodValue, { color }]}>{value}</Text>
    </Card>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  const { colors } = useStudyBolt();
  return (
    <Card style={styles.compactStat}>
      <Text numberOfLines={2} adjustsFontSizeToFit style={[styles.compactValue, { color: colors.text }]}>{value}</Text>
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

const percent = (value: number | null) => value === null ? 'Not enough data' : `${value}%`;
const capitalize = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
const friendlyLabel = (value: string) => value.split('-').map(capitalize).join(' ');
const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const formatSigned = (value: number) => `${value > 0 ? '+' : ''}${value}`;
const formatPointGap = (value: number) => `${formatSigned(value)} pts`;
function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
}
function readinessLabel(value: number): string {
  if (value >= 80) return 'Strong evidence across coverage, recall, and retention.';
  if (value >= 65) return 'On track. Close remaining gaps with spaced retrieval.';
  if (value >= 45) return 'Building. Prioritize due and weak concepts next.';
  return 'Early foundation. Increase coverage before relying on this estimate.';
}

const styles = StyleSheet.create({
  title: { fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 17, maxWidth: 510 },
  tabs: { gap: 7, paddingBottom: 4 },
  tab: { height: 39, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: 11, fontWeight: '800' },
  advancedHero: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  advancedHeroIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  advancedHeroTitle: { fontSize: 14, fontWeight: '900' },
  advancedHeroText: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  advancedHeroMode: { fontSize: 9, lineHeight: 13, fontWeight: '800', marginTop: 5 },
  readinessCard: { padding: 20, marginTop: 14, borderColor: 'transparent' },
  readinessTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  heroEyebrow: { color: '#AAB6C2', fontSize: 9, fontWeight: '900', letterSpacing: 1.15 },
  heroValue: { color: '#EDF1F5', fontSize: 40, lineHeight: 47, fontWeight: '900', letterSpacing: -1.2, marginTop: 3 },
  heroDetail: { color: '#C6CED6', fontSize: 11, lineHeight: 16, marginTop: 3, maxWidth: 350 },
  readinessRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 11 },
  confidenceText: { flex: 1, color: '#AAB6C2', fontSize: 10, lineHeight: 14 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  metricCard: { width: '48%', minHeight: 140, padding: 14 },
  metricIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 21, lineHeight: 27, fontWeight: '900', letterSpacing: -0.5, marginTop: 9 },
  metricLabel: { fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 1 },
  metricDetail: { fontSize: 9, lineHeight: 13, marginTop: 4 },
  stack: { gap: 9 },
  insightCard: { paddingVertical: 3 },
  conceptRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12 },
  rank: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, fontWeight: '900' },
  rowTitle: { fontSize: 12, lineHeight: 17, fontWeight: '800' },
  rowMeta: { fontSize: 9, lineHeight: 13, marginTop: 2 },
  conceptScore: { alignItems: 'flex-end', gap: 2 },
  conceptPercent: { fontSize: 14, fontWeight: '900' },
  dueText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  riskIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  riskLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  calibrationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  calibrationCell: { width: '48.5%', minHeight: 74, borderRadius: 13, padding: 12, justifyContent: 'center' },
  calibrationValue: { fontSize: 21, fontWeight: '900' },
  calibrationLabel: { fontSize: 9, fontWeight: '800', marginTop: 2 },
  confusionRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  confusionCount: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confusionCountText: { fontSize: 12, fontWeight: '900' },
  confusionCorrection: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  performanceRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  performanceValue: { fontSize: 15, fontWeight: '900' },
  distributionRow: { paddingVertical: 12 },
  distributionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  distributionValue: { fontSize: 10, fontWeight: '900' },
  forecastCard: { minHeight: 100, justifyContent: 'center' },
  forecastTop: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  forecastIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  forecastValue: { fontSize: 18, fontWeight: '900' },
  forecastText: { fontSize: 10, marginTop: 3 },
  methodologyRow: { minHeight: 75, flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingVertical: 12 },
  methodologyIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  methodologyText: { fontSize: 9, lineHeight: 14, marginTop: 3 },
  progressCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  courseIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  progressTitle: { fontSize: 12, fontWeight: '800' },
  progressValue: { fontSize: 12, fontWeight: '900' },
  progressMeta: { fontSize: 9, marginTop: 7 },
  packCard: { padding: 14 },
  sectionHero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  heroIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionHeroTitle: { fontSize: 13, fontWeight: '900' },
  sectionHeroText: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  topicRow: { paddingVertical: 12 },
  formulaRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 12 },
  formulaLabel: { fontSize: 11, fontWeight: '800', marginBottom: 7 },
  formulaValue: { width: 38, textAlign: 'right', fontSize: 12, fontWeight: '900' },
  disclaimer: { fontSize: 9, lineHeight: 14, marginTop: 9 },
  evidenceCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  evidenceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  evidenceTitle: { fontSize: 12, fontWeight: '900' },
  evidenceText: { fontSize: 9, lineHeight: 14, marginTop: 2 },
  evidenceSource: { fontSize: 9, fontWeight: '800', marginTop: 4 },
  chart: { height: 190, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5 },
  chartColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  chartValue: { fontSize: 8, fontWeight: '700' },
  barTrack: { width: '68%', maxWidth: 27, height: 125, borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 7 },
  dayLabel: { fontSize: 9, fontWeight: '800' },
  chartCaption: { fontSize: 9, lineHeight: 13, textAlign: 'center', marginTop: 8 },
  resultRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  scoreBadge: { width: 48, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  scoreBadgeText: { fontSize: 12, fontWeight: '900' },
  breakdownGrid: { flexDirection: 'row', gap: 9 },
  breakdownCard: { flex: 1, padding: 13 },
  breakdownTitle: { fontSize: 12, fontWeight: '900', marginBottom: 10 },
  breakdownRow: { marginTop: 8 },
  breakdownLabel: { fontSize: 9, fontWeight: '700' },
  breakdownValue: { fontSize: 15, fontWeight: '900', marginTop: 1 },
  breakdownCount: { fontSize: 8, marginTop: 1 },
  missRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  missBadge: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  missBadgeText: { fontSize: 12, fontWeight: '900' },
  compactStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  compactStat: { width: '48%', minHeight: 89, justifyContent: 'center', padding: 14 },
  compactValue: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  compactLabel: { fontSize: 9, lineHeight: 13, marginTop: 4 },
  goalCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  goalIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  heatCell: { width: '8.3%', aspectRatio: 1, borderRadius: 5 },
  heatLegend: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 5, marginTop: 10 },
  legendCell: { width: 11, height: 11, borderRadius: 3 },
  horizontalRow: { paddingVertical: 12 },
  horizontalValue: { fontSize: 10, fontWeight: '900' },
  methodStack: { gap: 9 },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  methodTitle: { fontSize: 13, fontWeight: '900' },
  methodDetail: { fontSize: 9, lineHeight: 14, marginTop: 3 },
  methodValue: { fontSize: 12, fontWeight: '900', textAlign: 'right' },
  splitCard: { flexDirection: 'row', alignItems: 'center' },
  splitMetric: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  splitDivider: { width: StyleSheet.hairlineWidth, height: 78 },
  bigStatusIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  splitValue: { fontSize: 24, fontWeight: '900', marginTop: 8 },
  splitLabel: { fontSize: 9, marginTop: 1 },
  milestone: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  milestoneIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  emptyInsight: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  emptyIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
