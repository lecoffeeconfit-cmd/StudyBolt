import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Keyboard, Platform, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { useGuidePreferences } from '../hooks/useGuidePreferences';
import { isCommunityConfigured } from '../services/community';
import {
  autoGuideEligible, GUIDANCE_GAP_MS, GUIDES, guidanceIsIdle, guideFor, POMODORO_STORAGE_KEY, type GuideDefinition,
  type GuideId, type GuidePage, type GuideRect, type GuideStatus,
} from '../services/studyGuidance';
import { GuidanceHelp, GuidanceSpotlight, InlineGuidanceTip } from './StudyGuidanceViews';

export type GuidanceAnchor = {
  measure: (callback: (rect: GuideRect) => void) => void;
  onLayout: (listener: () => void) => () => void;
  activate?: () => void;
  actionLabel?: string;
};
type GuidanceContextValue = {
  register: (id: string, anchor: GuidanceAnchor) => () => void;
  setBusy: (owner: symbol, active: boolean) => void;
  setFocusTimer: (endAt: number) => void;
  openHelp: () => void;
  offerTip: (id: GuideId) => boolean;
  hideTip: (id: GuideId) => void;
  tip: GuideId | null;
  finishTip: (id: GuideId, status: GuideStatus) => void;
};
const GuidanceContext = createContext<GuidanceContextValue | null>(null);
const availableGuides: readonly GuideDefinition[] = GUIDES.filter(guide => guide.page !== 'discover' || isCommunityConfigured);
const replayable = availableGuides.filter(guide => guide.kind === 'tour' || guide.kind === 'update');
const isTextInputFocused = () => Platform.OS === 'web'
  ? Boolean(typeof document !== 'undefined' && document.activeElement?.matches('input, textarea, [contenteditable="true"]'))
  : TextInput.State.currentlyFocusedInput() !== null;

type Presentation = { guide: GuideDefinition; index: number; owner: string; page: GuidePage | null };

export function StudyGuidanceProvider({ children, page, pageKey, newAccountId, onReplayPage, onReplayIntro }: {
  children: ReactNode;
  page: GuidePage | null;
  pageKey: string;
  newAccountId?: string;
  onReplayPage: (page: GuidePage) => boolean;
  onReplayIntro: () => void;
}) {
  const { key, ready, state, finish } = useGuidePreferences(newAccountId);
  const anchors = useRef(new Map<string, GuidanceAnchor>());
  const blockers = useRef(new Set<symbol>());
  const [busy, setBusyCount] = useState(0);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [helpOwner, setHelpOwner] = useState<string | null>(null);
  const [requested, setRequested] = useState<{ guide: GuideDefinition; owner: string; origin: string } | null>(null);
  const [tip, setTip] = useState<{ id: GuideId; pageKey: string; owner: string } | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [foreground, setForeground] = useState(true);
  const [focusUntil, setFocusTimer] = useState(0);
  const [timerKnown, setTimerKnown] = useState(false);
  const lastShown = useRef(0);
  const shownOnVisit = useRef(false);
  const pageIdentity = useRef(pageKey);
  const helpOpen = helpOwner === key;
  const safe = guidanceIsIdle({ busy: Boolean(busy), keyboard, foreground, timerKnown, focusUntil });
  const active = presentation?.owner === key && presentation.page === page && pageIdentity.current === pageKey && safe && !helpOpen ? presentation : null;
  const shownTip = tip?.owner === key && tip.pageKey === pageKey && safe && !helpOpen && !active ? tip.id : null;

  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(POMODORO_STORAGE_KEY).then(raw => {
      if (!live || !raw) return;
      const timer = JSON.parse(raw) as { status?: string; endAt?: number };
      if (timer.status === 'running' && typeof timer.endAt === 'number' && timer.endAt > Date.now()) {
        setFocusTimer(previous => Math.max(previous, timer.endAt!));
      }
    }).catch(() => undefined).finally(() => { if (live) setTimerKnown(true); });
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    const app = AppState.addEventListener('change', next => setForeground(next === 'active'));
    return () => { live = false; show.remove(); hide.remove(); app.remove(); };
  }, []);

  useEffect(() => {
    if (focusUntil <= Date.now()) return;
    const end = setTimeout(() => setFocusTimer(0), focusUntil - Date.now() + 50);
    return () => clearTimeout(end);
  }, [focusUntil]);

  useEffect(() => {
    pageIdentity.current = pageKey;
    shownOnVisit.current = false;
    setPresentation(null);
    setTip(null);
  }, [pageKey, key]);

  useEffect(() => {
    lastShown.current = 0;
    setHelpOwner(null);
  }, [key]);

  useEffect(() => {
    if (requested && (requested.owner !== key || (page !== requested.guide.page && pageKey !== requested.origin))) setRequested(null);
  }, [key, page, pageKey, requested]);

  useEffect(() => {
    if (!safe) { setPresentation(null); setTip(null); }
  }, [safe]);

  const register = useCallback((id: string, anchor: GuidanceAnchor) => {
    anchors.current.set(id, anchor);
    return () => { if (anchors.current.get(id) === anchor) anchors.current.delete(id); };
  }, []);
  const setBusy = useCallback((owner: symbol, blocking: boolean) => {
    if (blocking) blockers.current.add(owner);
    else blockers.current.delete(owner);
    setBusyCount(blockers.current.size);
  }, []);
  const openHelp = useCallback(() => setHelpOwner(key), [key]);

  useEffect(() => {
    if (!safe || helpOpen || active || shownTip) return;
    const replay = requested?.owner === key && requested.guide.page === page ? requested.guide : null;
    const next = replay ?? (page && ready ? availableGuides.find(guide => guide.kind !== 'tip' && autoGuideEligible(guide, state, page)) : undefined);
    if (!next || (!replay && (shownOnVisit.current || (next.kind !== 'welcome' && Date.now() - lastShown.current < GUIDANCE_GAP_MS)))) return;
    const timer = setTimeout(() => {
      if (isTextInputFocused() || blockers.current.size > 0) return;
      lastShown.current = Date.now();
      shownOnVisit.current = true;
      if (replay) setRequested(null);
      setPresentation({ guide: next, index: 0, owner: key, page });
    }, replay ? 250 : 650);
    return () => clearTimeout(timer);
  }, [active, helpOpen, key, page, pageKey, ready, requested, safe, shownTip, state]);

  const offerTip = useCallback((id: GuideId) => {
    if (!page || !ready || !safe || requested || helpOpen || active || tip || isTextInputFocused() || blockers.current.size) return false;
    if (shownOnVisit.current || Date.now() - lastShown.current < GUIDANCE_GAP_MS || !autoGuideEligible(guideFor(id), state, page)) return false;
    lastShown.current = Date.now();
    shownOnVisit.current = true;
    setTip({ id, pageKey, owner: key });
    return true;
  }, [active, helpOpen, key, page, pageKey, ready, requested, safe, state, tip]);

  const hideTip = useCallback((id: GuideId) => setTip(current => current?.id === id ? null : current), []);
  const finishTip = useCallback((id: GuideId, status: GuideStatus) => {
    finish(guideFor(id), status);
    hideTip(id);
  }, [finish, hideTip]);

  const context = useMemo(() => ({ register, setBusy, setFocusTimer, openHelp, offerTip, hideTip, tip: shownTip, finishTip }),
    [register, setBusy, openHelp, offerTip, hideTip, shownTip, finishTip]);

  const closePresentation = (status: GuideStatus) => {
    if (active) finish(active.guide, status);
    setPresentation(null);
  };

  return (
    <GuidanceContext.Provider value={context}>
      {children}
      {helpOpen ? <GuidanceHelp guides={replayable} onClose={() => setHelpOwner(null)} onIntro={() => {
        setHelpOwner(null);
        onReplayIntro();
      }} onReplay={guide => {
        setHelpOwner(null);
        lastShown.current = Date.now();
        if (onReplayPage(guide.page)) setRequested({ guide, owner: key, origin: pageKey });
        else setPresentation({ guide, index: 0, owner: key, page });
      }} /> : null}
      {active ? <GuidanceSpotlight
        guide={active.guide}
        stepIndex={active.index}
        getAnchor={id => anchors.current.get(id)}
        onSkip={() => closePresentation('skipped')}
        onNext={() => {
          if (active.index + 1 >= active.guide.steps.length) closePresentation('completed');
          else setPresentation({ ...active, index: active.index + 1 });
        }}
        onActivate={action => { closePresentation('completed'); action(); }}
      /> : null}
    </GuidanceContext.Provider>
  );
}

export function useGuidance() { return useContext(GuidanceContext); }

export function useGuidanceBlocker(blocking: boolean) {
  const setBusy = useGuidance()?.setBusy;
  const owner = useRef(Symbol('guidance-blocker')).current;
  useEffect(() => {
    if (!blocking || !setBusy) return;
    setBusy(owner, true);
    return () => setBusy(owner, false);
  }, [blocking, owner, setBusy]);
}

export function useGuidanceScroll() {
  const [scrolling, setScrolling] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const move = useCallback(() => { clearTimeout(idle.current); setScrolling(true); }, []);
  const settle = useCallback(() => { clearTimeout(idle.current); idle.current = setTimeout(() => setScrolling(false), 180); }, []);
  useEffect(() => () => clearTimeout(idle.current), []);
  useGuidanceBlocker(scrolling);
  return { onScrollBeginDrag: move, onScrollEndDrag: settle, onMomentumScrollBegin: move, onMomentumScrollEnd: settle };
}

export function GuideAnchor({ id, children, style, onActivate, actionLabel }: {
  id?: string; children: ReactNode; style?: StyleProp<ViewStyle>; onActivate?: () => void; actionLabel?: string;
}) {
  const register = useGuidance()?.register;
  const ref = useRef<View>(null);
  const layoutListener = useRef<(() => void) | undefined>(undefined);
  const activate = useRef(onActivate);
  activate.current = onActivate;
  const interactive = Boolean(onActivate);
  useEffect(() => id ? register?.(id, {
    measure: callback => ref.current?.measureInWindow((x, y, width, height) => callback({ x, y, width, height })),
    onLayout: listener => {
      layoutListener.current = listener;
      return () => { if (layoutListener.current === listener) layoutListener.current = undefined; };
    },
    activate: interactive ? () => activate.current?.() : undefined,
    actionLabel,
  }) : undefined, [actionLabel, id, interactive, register]);
  return id || style ? <View ref={ref} collapsable={false} style={style} onLayout={() => layoutListener.current?.()}>{children}</View> : <>{children}</>;
}

export function GuideTip({ id, eligible }: { id: GuideId; eligible: boolean }) {
  const { offerTip, hideTip, tip, finishTip } = useGuidance() ?? {};
  useEffect(() => {
    if (!eligible || !offerTip || tip === id) return;
    const timer = setTimeout(() => offerTip(id), 400);
    return () => clearTimeout(timer);
  }, [eligible, id, offerTip, tip]);
  useEffect(() => () => hideTip?.(id), [hideTip, id]);
  useEffect(() => { if (!eligible) hideTip?.(id); }, [eligible, hideTip, id]);
  if (!eligible || tip !== id || !finishTip) return null;
  return <InlineGuidanceTip step={guideFor(id).steps[0]!} onDismiss={() => finishTip(id, 'skipped')} />;
}
