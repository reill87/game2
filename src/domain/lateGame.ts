import type { RndId, RndState } from './rnd';
import { normalizeProjectSignals } from './projectSignals';
import type { GameState } from './types';

export const LATE_GAME_START_PRODUCT = 55;

export type LateGameContractId =
  | 'sovereign-cloud'
  | 'global-saas-rewrite'
  | 'ai-transformation'
  | 'industrial-os';

export const REALITY_RND_IDS: ReadonlyArray<RndId> = [
  'test-automation',
  'ci-cd',
  'design-system',
  'process-standard',
  'employer-branding',
  'finance-automation',
  'data-driven',
  'global-expansion',
  'ai-pair-programming',
  'auto-design-tools',
  'continuous-integration',
  'analytics-platform',
  'i18n-platform',
  'security-program',
  'cloud-migration',
  'remote-collaboration',
  'self-cloud-infra',
  'global-hr-network',
  'autonomous-deploy',
  'ai-pm-assistant',
  'quantum-deploy',
  'satellite-network',
  'neural-architecture',
  'company-os',
  'ai-coder',
  'global-data-fabric',
  'company-llm',
  'metaverse-office',
];

export interface LateGameMetrics {
  readonly platform: number;
  readonly enterpriseTrust: number;
  readonly operationalStability: number;
  readonly techDebt: number;
  readonly aiAutonomy: number;
  readonly realityStability: number;
  readonly singularity: number;
}

export interface LateGameState {
  readonly activeContract: LateGameContractId | null;
  readonly completedContracts: ReadonlyArray<LateGameContractId>;
  readonly contractProgress: number;
  readonly metrics: LateGameMetrics;
  readonly transcendenceUnlocked: boolean;
  readonly transcendenceNotified: boolean;
  readonly fantasyCycle: number;
}

export interface LateGameContract {
  readonly id: LateGameContractId;
  readonly name: string;
  readonly desc: string;
  readonly rewardLabel: string;
  readonly pressureLabel: string;
  readonly revenueMul: number;
  readonly progressBase: number;
  readonly deltas: Partial<LateGameMetrics>;
}

export interface LateGameReleaseUpdate {
  readonly state: LateGameState;
  readonly contract: LateGameContract | null;
  readonly revenueBonus: number;
  readonly progressGain: number;
  readonly completed: boolean;
  readonly transcendenceJustUnlocked: boolean;
}

export const EMPTY_LATE_GAME: LateGameState = {
  activeContract: null,
  completedContracts: [],
  contractProgress: 0,
  metrics: {
    platform: 0,
    enterpriseTrust: 0,
    operationalStability: 0,
    techDebt: 0,
    aiAutonomy: 0,
    realityStability: 100,
    singularity: 0,
  },
  transcendenceUnlocked: false,
  transcendenceNotified: false,
  fantasyCycle: 0,
};

export const LATE_GAME_CONTRACTS: ReadonlyArray<LateGameContract> = [
  {
    id: 'sovereign-cloud',
    name: '국가 클라우드 전환',
    desc: '정부·공공기관을 묶는 장기 인프라 계약. 안정성과 신뢰가 핵심입니다.',
    rewardLabel: '매출 ×1.35 · 신뢰↑',
    pressureLabel: '버그/연체 시 신뢰 하락',
    revenueMul: 1.35,
    progressBase: 22,
    deltas: { enterpriseTrust: 8, operationalStability: 5, techDebt: 4 },
  },
  {
    id: 'global-saas-rewrite',
    name: '글로벌 SaaS 대개편',
    desc: '다국가 고객용 플랫폼을 재구축합니다. 플랫폼 영향력이 빠르게 커집니다.',
    rewardLabel: '매출 ×1.45 · 플랫폼↑',
    pressureLabel: '기술부채 누적',
    revenueMul: 1.45,
    progressBase: 20,
    deltas: { platform: 11, enterpriseTrust: 3, techDebt: 8 },
  },
  {
    id: 'ai-transformation',
    name: 'AI 전환 컨설팅',
    desc: '대기업 운영을 AI로 바꿉니다. 초월 국면의 첫 기반을 쌓습니다.',
    rewardLabel: '매출 ×1.55 · AI자율↑',
    pressureLabel: '현실 안정도 관리 필요',
    revenueMul: 1.55,
    progressBase: 18,
    deltas: { platform: 5, aiAutonomy: 9, techDebt: 10, realityStability: -3 },
  },
  {
    id: 'industrial-os',
    name: '산업 운영 OS',
    desc: '물류·제조·금융 운영망을 하나로 묶는 초대형 프로젝트입니다.',
    rewardLabel: '매출 ×1.50 · 안정성↑',
    pressureLabel: '운영 실패 리스크',
    revenueMul: 1.5,
    progressBase: 19,
    deltas: { operationalStability: 10, platform: 7, enterpriseTrust: 4, techDebt: 7 },
  },
];

const VALID_CONTRACT_IDS = new Set<LateGameContractId>(LATE_GAME_CONTRACTS.map((c) => c.id));

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function metric(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? clamp(Math.round(n), 0, 100) : fallback;
}

export function isLateGameEligible(productIndex: number): boolean {
  return productIndex >= LATE_GAME_START_PRODUCT;
}

export function getLateGameContract(id: LateGameContractId | null | undefined): LateGameContract | null {
  if (!id) return null;
  return LATE_GAME_CONTRACTS.find((c) => c.id === id) ?? null;
}

export function defaultLateGameContract(productIndex: number): LateGameContractId {
  return LATE_GAME_CONTRACTS[productIndex % LATE_GAME_CONTRACTS.length]?.id ?? 'sovereign-cloud';
}

export function normalizeLateGame(raw: unknown): LateGameState {
  if (!raw || typeof raw !== 'object') return EMPTY_LATE_GAME;
  const obj = raw as Record<string, unknown>;
  const rawMetrics = obj['metrics'] && typeof obj['metrics'] === 'object'
    ? obj['metrics'] as Record<string, unknown>
    : {};
  const completed = Array.isArray(obj['completedContracts'])
    ? (obj['completedContracts'] as unknown[]).filter(
        (id): id is LateGameContractId => typeof id === 'string' && VALID_CONTRACT_IDS.has(id as LateGameContractId),
      )
    : [];
  const activeContract = typeof obj['activeContract'] === 'string' && VALID_CONTRACT_IDS.has(obj['activeContract'] as LateGameContractId)
    ? obj['activeContract'] as LateGameContractId
    : null;
  return {
    activeContract,
    completedContracts: [...new Set(completed)],
    contractProgress: metric(obj['contractProgress'], 0),
    metrics: {
      platform: metric(rawMetrics['platform'], 0),
      enterpriseTrust: metric(rawMetrics['enterpriseTrust'], 0),
      operationalStability: metric(rawMetrics['operationalStability'], 0),
      techDebt: metric(rawMetrics['techDebt'], 0),
      aiAutonomy: metric(rawMetrics['aiAutonomy'], 0),
      realityStability: metric(rawMetrics['realityStability'], 100),
      singularity: metric(rawMetrics['singularity'], 0),
    },
    transcendenceUnlocked: obj['transcendenceUnlocked'] === true,
    transcendenceNotified: obj['transcendenceNotified'] === true,
    fantasyCycle: typeof obj['fantasyCycle'] === 'number' ? Math.max(0, Math.floor(obj['fantasyCycle'])) : 0,
  };
}

export function setLateGameContract(state: LateGameState | undefined, id: LateGameContractId): LateGameState {
  const current = normalizeLateGame(state);
  return {
    ...current,
    activeContract: id,
    contractProgress: current.activeContract === id ? current.contractProgress : 0,
  };
}

export function isRealityRndComplete(rnd: RndState | undefined): boolean {
  const purchased = new Set(rnd?.purchased ?? []);
  return REALITY_RND_IDS.every((id) => purchased.has(id));
}

export function applyLateGameRelease(
  prev: GameState,
  baseRevenue: number,
  stars: number,
  reviewScore: number,
): LateGameReleaseUpdate {
  const current = normalizeLateGame(prev.lateGame);
  const eligible = isLateGameEligible(prev.productIndex) || current.transcendenceUnlocked;
  const contract = eligible
    ? getLateGameContract(current.activeContract ?? defaultLateGameContract(prev.productIndex))
    : null;
  const metrics = current.metrics;
  const signals = normalizeProjectSignals(prev.project.signals);
  const signalAverage = (signals.tech + signals.ux + signals.creative + signals.market) / 4;
  const overrun = Math.max(0, prev.project.weeksElapsed - prev.project.weeksTarget);
  const bugPressure = Math.round(prev.project.bugDebt / 12) + overrun * 2;
  const qualityGain = stars * 2 + Math.round(reviewScore / 20) + Math.round(signalAverage / 18);
  const progressGain = contract ? Math.max(8, contract.progressBase + qualityGain - bugPressure) : 0;
  const nextProgress = clamp(current.contractProgress + progressGain, 0, 100);
  const completed = !!contract && nextProgress >= 100;
  const completedContracts = completed && !current.completedContracts.includes(contract.id)
    ? [...current.completedContracts, contract.id]
    : current.completedContracts;
  const revenueBonus = contract
    ? Math.round(baseRevenue * (contract.revenueMul - 1) * (completed ? 1.25 : 1))
    : 0;
  const stabilityBonus = stars >= 4 && overrun === 0 ? 4 : stars <= 2 || overrun > 2 ? -5 : 0;
  const trustBonus = stars >= 4 ? 4 : stars <= 2 ? -4 : 0;
  const techDebtDelta = (contract?.deltas.techDebt ?? 0) + bugPressure - Math.round(metrics.operationalStability / 35);
  const transcendenceJustUnlocked = isRealityRndComplete(prev.rnd) && !current.transcendenceUnlocked;
  const transcendenceUnlocked = current.transcendenceUnlocked || transcendenceJustUnlocked;
  const aiPulse = transcendenceUnlocked
    ? Math.max(3, Math.round(signals.tech / 20) + (contract?.id === 'ai-transformation' ? 5 : 1))
    : 0;
  const realityDelta = transcendenceUnlocked
    ? Math.round(metrics.operationalStability / 35) - Math.round((metrics.aiAutonomy + aiPulse) / 45)
    : 0;

  const nextMetrics: LateGameMetrics = {
    platform: clamp(metrics.platform + (contract?.deltas.platform ?? 0) + Math.round(signals.market / 18), 0, 100),
    enterpriseTrust: clamp(metrics.enterpriseTrust + (contract?.deltas.enterpriseTrust ?? 0) + trustBonus, 0, 100),
    operationalStability: clamp(metrics.operationalStability + (contract?.deltas.operationalStability ?? 0) + stabilityBonus, 0, 100),
    techDebt: clamp(metrics.techDebt + techDebtDelta, 0, 100),
    aiAutonomy: clamp(metrics.aiAutonomy + (contract?.deltas.aiAutonomy ?? 0) + aiPulse, 0, 100),
    realityStability: clamp(metrics.realityStability + (contract?.deltas.realityStability ?? 0) + realityDelta, 0, 100),
    singularity: clamp(
      metrics.singularity + (transcendenceUnlocked ? Math.round((metrics.aiAutonomy + aiPulse) / 22) + completedContracts.length : 0),
      0,
      100,
    ),
  };

  return {
    state: {
      ...current,
      activeContract: completed ? null : contract?.id ?? current.activeContract,
      completedContracts,
      contractProgress: completed ? 0 : nextProgress,
      metrics: nextMetrics,
      transcendenceUnlocked,
      fantasyCycle: transcendenceUnlocked ? current.fantasyCycle + 1 : current.fantasyCycle,
    },
    contract,
    revenueBonus,
    progressGain,
    completed,
    transcendenceJustUnlocked,
  };
}
