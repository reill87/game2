import type { EventCategory } from './events';
import type { GameState, Job, ProjectSignals, ProjectState, SlotKind } from './types';

export type ProjectSignalKey = keyof ProjectSignals;
export type ProjectSignalDelta = Partial<Record<ProjectSignalKey, number>>;

export const EMPTY_PROJECT_SIGNALS: ProjectSignals = {
  tech: 0,
  ux: 0,
  creative: 0,
  market: 0,
};

export const PROJECT_SIGNAL_LABEL: Readonly<Record<ProjectSignalKey, string>> = {
  tech: '기술',
  ux: 'UX',
  creative: '창의',
  market: '시장',
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function normalizeProjectSignals(signals: ProjectState['signals']): ProjectSignals {
  return {
    tech: clamp100(signals?.tech ?? 0),
    ux: clamp100(signals?.ux ?? 0),
    creative: clamp100(signals?.creative ?? 0),
    market: clamp100(signals?.market ?? 0),
  };
}

export function addProjectSignalDelta(signals: ProjectState['signals'], delta: ProjectSignalDelta): ProjectSignals {
  const base = normalizeProjectSignals(signals);
  return {
    tech: clamp100(base.tech + (delta.tech ?? 0)),
    ux: clamp100(base.ux + (delta.ux ?? 0)),
    creative: clamp100(base.creative + (delta.creative ?? 0)),
    market: clamp100(base.market + (delta.market ?? 0)),
  };
}

export function sumProjectSignalDelta(delta: ProjectSignalDelta): number {
  return (delta.tech ?? 0) + (delta.ux ?? 0) + (delta.creative ?? 0) + (delta.market ?? 0);
}

export function addProjectSignals(
  state: GameState,
  delta: ProjectSignalDelta,
  appealDelta = 0,
): GameState {
  const project = state.project;
  const nextAppeal = project.appealEnabled
    ? Math.max(0, project.appeal + appealDelta)
    : project.appeal;
  return {
    ...state,
    project: {
      ...project,
      appeal: nextAppeal,
      signals: addProjectSignalDelta(project.signals, delta),
    },
  };
}

export function signalWeightsForSlot(slot: SlotKind): ProjectSignals {
  switch (slot) {
    case 'planning':
      return { tech: 0.05, ux: 0.2, creative: 0.25, market: 0.5 };
    case 'graphics':
      return { tech: 0.05, ux: 0.55, creative: 0.4, market: 0 };
    case 'qa':
      return { tech: 0.35, ux: 0.45, creative: 0, market: 0.2 };
    case 'programming':
      return { tech: 0.75, ux: 0.15, creative: 0, market: 0.1 };
    case 'marketing':
      return { tech: 0, ux: 0.1, creative: 0.15, market: 0.75 };
    case 'data':
      return { tech: 0.3, ux: 0.15, creative: 0, market: 0.55 };
  }
}

export function signalWeightsForJob(job: Job): ProjectSignals {
  switch (job) {
    case 'planner':
      return signalWeightsForSlot('planning');
    case 'designer':
      return signalWeightsForSlot('graphics');
    case 'programmer':
      return signalWeightsForSlot('programming');
    case 'qa':
      return signalWeightsForSlot('qa');
    case 'marketing':
      return signalWeightsForSlot('marketing');
    case 'data':
      return signalWeightsForSlot('data');
  }
}

export function addScaledSignals(
  target: ProjectSignals,
  weights: ProjectSignals,
  amount: number,
): ProjectSignals {
  return {
    tech: target.tech + weights.tech * amount,
    ux: target.ux + weights.ux * amount,
    creative: target.creative + weights.creative * amount,
    market: target.market + weights.market * amount,
  };
}

const EVENT_SIGNAL_BASE: Readonly<Record<EventCategory, ProjectSignalDelta>> = {
  A: { ux: 0.8, market: 0.4 },
  B: { market: 1.2, creative: 0.3 },
  C: { tech: 1.2 },
  D: { ux: 0.4, creative: 0.6 },
  E: { ux: 0.5, market: 1.0 },
  F: { market: 1.2 },
  G: { creative: 0.5 },
  H: { creative: 0.8 },
  I: { tech: 0.7 },
  J: { ux: 0.5, creative: 0.2 },
  K: { creative: 1.0, market: 0.3 },
};

export function applyEventProjectSignals(
  before: GameState,
  after: GameState,
  category: EventCategory,
): GameState {
  const delta: ProjectSignalDelta = { ...EVENT_SIGNAL_BASE[category] };
  const bugReduction = before.project.bugDebt - after.project.bugDebt;
  if (bugReduction > 0) delta.tech = (delta.tech ?? 0) + Math.min(4, bugReduction * 0.25);

  const progressGain = after.project.progress - before.project.progress;
  if (progressGain > 0) delta.market = (delta.market ?? 0) + Math.min(3, progressGain * 0.08);

  const appealGain = after.project.appeal - before.project.appeal;
  if (appealGain > 0) {
    delta.ux = (delta.ux ?? 0) + Math.min(2, appealGain * 0.12);
    delta.creative = (delta.creative ?? 0) + Math.min(2, appealGain * 0.12);
  }

  const investmentMul = after.gold < before.gold ? 1.2 : 1;
  const adjusted: ProjectSignalDelta = {
    tech: (delta.tech ?? 0) * investmentMul,
    ux: (delta.ux ?? 0) * investmentMul,
    creative: (delta.creative ?? 0) * investmentMul,
    market: (delta.market ?? 0) * investmentMul,
  };
  return addProjectSignals(after, adjusted, sumProjectSignalDelta(adjusted) * 0.35);
}
