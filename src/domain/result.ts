/**
 * 출시 결과 산정 — 순수 함수.
 * 모든 수치는 docs/BALANCE.md v0.1 대역에 맞춤. 추후 문서 갱신과 함께 조정.
 */
import { BALANCE, PROMO, RANK_NEXT, RANK_PROMOTION, REPUTATION, SKILL_GROWTH, TRENDS } from './balance';
import { isMatched, SLOT_ORDER } from './match';
import { isRndPurchased } from './rnd';
import { isFacilityBuilt } from './facilities';
import { computeMarketRevenueMul } from './markets';
import { computeProjectScopeMultiplier, release } from './tick';
import { NO_PRESTIGE } from './prestige';
import { tickExec } from './exec';
import {
  getEconomyPhase,
  getEconomyRevenueMul,
  tickEconomy,
  ECONOMY_PHASE_LABEL,
  EMPTY_ECONOMY,
} from './economy';
import { computeMarketShareEffect, tickRivalReleases } from './rivals';
import type { RivalRelease } from './rivals';
import type { Employee, GameState, PromoTier, Rank } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 한 단계 진급 가능하면 다음 단계, 아니면 현 단계 그대로. 한 번에 한 단계만. */
function checkPromotion(rank: Rank, ships: number, skill: number): Rank {
  const next = RANK_NEXT[rank];
  const req = RANK_PROMOTION[rank];
  if (!next || !req) return rank;
  if (ships >= req.ships && skill >= req.skill) return next;
  return rank;
}

/** 출시 직후 변경된 직급(진급한 직원)을 비교해 알림용 목록을 만든다. */
export function diffPromotions(
  before: ReadonlyArray<Employee>,
  after: ReadonlyArray<Employee>,
): ReadonlyArray<{ employee: Employee; from: Rank; to: Rank }> {
  const beforeMap = new Map(before.map((e) => [e.id, e] as const));
  const promotions: { employee: Employee; from: Rank; to: Rank }[] = [];
  for (const a of after) {
    const b = beforeMap.get(a.id);
    if (b && b.rank !== a.rank) promotions.push({ employee: a, from: b.rank, to: a.rank });
  }
  return promotions;
}

export type ReviewStars = 1 | 2 | 3 | 4 | 5;

export interface ReleaseOutcome {
  readonly reviewScore: number;
  readonly stars: ReviewStars;
  readonly headline: string;
  readonly revenue: number;
  /** 컴포넌트 분해 — UI 표시·튜닝용. 합 = score (clamp 전). */
  readonly breakdown: {
    readonly base: number;
    readonly bugPenalty: number;
    readonly overrunPenalty: number;
    readonly polishBonus: number;
    /** Appeal이 활성화된 작품에서만 0보다 큼. */
    readonly appealBonus: number;
    /** 팀 평균 컨디션 보너스. */
    readonly conditionBonus: number;
    /** 슬롯-직무 정배치율 보너스. */
    readonly teamFitBonus: number;
    /** 큰 프로젝트 체급 보너스. */
    readonly scopeBonus: number;
    /** 홍보 단계에 따른 리뷰 가산. */
    readonly promoBonus: number;
  };
  readonly promo: {
    readonly tier: PromoTier;
    readonly cost: number;
    readonly revenueMul: number;
  };
  /** 명성 — 출시 시 누적. UI 표시용. */
  readonly reputation: {
    /** 이번 출시로 +N. */
    readonly gain: number;
    /** 매출에 적용된 명성 보너스 배수. */
    readonly multiplier: number;
    /** 누적 명성 (이번 출시 후). */
    readonly total: number;
  };
  /** 트렌드 매출 보정 — UI 표시용. 없으면 null. */
  readonly trend: {
    readonly id: string;
    readonly name: string;
    readonly multiplier: number;
  } | null;
  /** 경기 사이클 — UI 표시용. */
  readonly economy: {
    readonly phase: string;
    readonly index: number;
    readonly revenueMul: number;
    /** 이번 출시 후 새 사이클 시작 여부 (index 변경됨). */
    readonly cycleChanged: boolean;
    /** 이전 경기 지표 (cycleChanged=true일 때만 의미 있음). */
    readonly prevIndex: number;
  };
  /** 시장 경쟁 — 같은 분기 라이벌과의 매출 점유율 효과. */
  readonly marketShare: {
    /** 우리 매출에 곱한 배수. */
    readonly revenueMul: number;
    /** 우리보다 잘한 라이벌 수 — 명성 -5씩. */
    readonly betterRivalCount: number;
    /** 매치된 라이벌 출시 목록. */
    readonly matchedReleases: ReadonlyArray<RivalRelease>;
  };
  /** released=true, gold = (prev.gold − promo.cost) + revenue. reputation도 누적. */
  readonly state: GameState;
}

export const HEADLINE_BY_STARS: Readonly<Record<ReviewStars, string>> = {
  5: '★★★★★ 완성도가 빛난다.',
  4: '★★★★ 단단한 첫 작품.',
  3: '★★★ 무난하지만 거친 부분이 있다.',
  2: '★★ 야근 자국이 그대로 보인다.',
  1: '★ 출시한 것 자체가 성과.',
};

function computeStars(score: number): ReviewStars {
  if (score >= 80) return 5;
  if (score >= 65) return 4;
  if (score >= 50) return 3;
  if (score >= 35) return 2;
  return 1;
}

function computeReview(state: GameState, polishCount: number): {
  rawScore: number;
  base: number;
  bugPenalty: number;
  overrunPenalty: number;
  polishBonus: number;
  appealBonus: number;
  conditionBonus: number;
  teamFitBonus: number;
  scopeBonus: number;
} {
  const { project } = state;
  const base = project.appealEnabled ? BALANCE.appealEnabledBaseScore : 80;
  const bugPenalty = Math.round(project.bugDebt * 0.5);
  const overrun = Math.max(0, project.weeksElapsed - project.weeksTarget);
  const overrunPenalty = overrun * 3;
  const polishBonus = Math.min(polishCount * 2, 6);
  const appealBonus = project.appealEnabled
    ? Math.round(
        BALANCE.appealReviewSoftCap *
        (1 - Math.exp(-project.appeal / BALANCE.appealReviewSoftCap)) *
        BALANCE.appealReviewFactor,
      )
    : 0;
  const avgCondition = state.employees.length > 0
    ? state.employees.reduce((sum, e) => sum + (e.morale + e.stamina) / 2, 0) / state.employees.length
    : 100;
  const conditionRatio = Math.min(1, Math.max(0, (avgCondition - 60) / 40));
  const conditionBonus = Math.round(conditionRatio * BALANCE.conditionReviewBonusMax);
  let assigned = 0;
  let matched = 0;
  for (const slot of SLOT_ORDER) {
    const empId = state.assignment[slot];
    if (!empId) continue;
    assigned += 1;
    const emp = state.employees.find((e) => e.id === empId);
    if (emp && isMatched(slot, emp.job)) matched += 1;
  }
  const teamFitBonus = assigned > 0 ? Math.round((matched / assigned) * BALANCE.teamFitReviewBonusMax) : 0;
  const scopeBonus = Math.round((computeProjectScopeMultiplier(state) - 1) * BALANCE.scopeReviewBonusFactor);
  // promo bonus는 shipProject에서 합쳐 clamp.
  const rawScore =
    base -
    bugPenalty -
    overrunPenalty +
    polishBonus +
    appealBonus +
    conditionBonus +
    teamFitBonus +
    scopeBonus;
  return { rawScore, base, bugPenalty, overrunPenalty, polishBonus, appealBonus, conditionBonus, teamFitBonus, scopeBonus };
}

/** BALANCE.md 첫 매출 대역 약 150~400 골드. */
function computeRevenue(score: number): number {
  return Math.round(150 + score * 2.5);
}

export function shipProject(
  prev: GameState,
  polishCount: number,
  promoTier: PromoTier = 'none',
): ReleaseOutcome {
  const r = computeReview(prev, polishCount);
  const promo = PROMO[promoTier];
  // 홍보 비용이 보유 골드보다 크면 자동으로 'none'으로 강등.
  const effectiveTier: PromoTier = prev.gold >= promo.cost ? promoTier : 'none';
  const eff = PROMO[effectiveTier];

  const finalScore = clamp(r.rawScore + eff.reviewBonus, 0, 100);
  const stars = computeStars(finalScore);
  const baseRevenue = computeRevenue(finalScore);
  // 명성 보너스 — 누적 명성에 비례한 매출 곱연산.
  const reputationMul = 1 + prev.reputation / REPUTATION.revenueBonusDivisor;
  // 트렌드 보정 — 현재 트렌드의 genre/theme 매치별 곱연산.
  const trendDef = prev.trend ? TRENDS[prev.trend.id] : null;
  const trendGenreMul = trendDef?.genreMul[prev.project.genre] ?? 1;
  const trendThemeMul = trendDef?.themeMul[prev.project.theme] ?? 1;
  const rawTrendMul = trendGenreMul * trendThemeMul;
  // R&D: 데이터 기반 의사결정 ×1.2 / 분석 플랫폼 ×1.3 — 둘 다 보유 시 더 강한 1.3 우선.
  let trendMul: number;
  if (isRndPurchased(prev.rnd, 'analytics-platform')) {
    trendMul = 1 + (rawTrendMul - 1) * 1.3;
  } else if (isRndPurchased(prev.rnd, 'data-driven')) {
    trendMul = 1 + (rawTrendMul - 1) * 1.2;
  } else {
    trendMul = rawTrendMul;
  }
  // 글로벌 시장 진출 — 진출한 시장 매출 곱연산.
  const marketMul = computeMarketRevenueMul(prev.markets);
  // 프로젝트 scope — 커진 팀/사옥/제품 규모만큼 매출 체급도 커진다.
  const scopeRevenueMul =
    1 + (computeProjectScopeMultiplier(prev) - 1) * BALANCE.projectScopeRevenueFactor;
  // 프레스티지 매출 보너스 — 프레스티지 N회: 매출 × (1 + N×0.05).
  const prestigeRevenueMul = (prev.prestigeBonus ?? NO_PRESTIGE).revenueMul;
  const baseCalculated = Math.round(baseRevenue * eff.revenueMul * reputationMul * trendMul * marketMul * scopeRevenueMul * prestigeRevenueMul);
  // R&D: 다국어화 플랫폼 ×1.25 / 글로벌 진출 ×1.15 — 둘 다 보유 시 1.25 우선.
  // R&D T4: 위성 네트워크 ×1.3 — i18n-platform과 중첩 곱.
  const globalRevMul = isRndPurchased(prev.rnd, 'i18n-platform')
    ? 1.25
    : isRndPurchased(prev.rnd, 'global-expansion')
      ? 1.15
      : 1.0;
  const satelliteMul = isRndPurchased(prev.rnd, 'satellite-network') ? 1.3 : 1.0;
  // R&D T5: 글로벌 데이터 패브릭 — 매출 ×1.5.
  const dataFabricMul = isRndPurchased(prev.rnd, 'global-data-fabric') ? 1.5 : 1.0;
  // 경기 사이클 — 현재 경기 단계에 따른 매출 보정.
  const ecoPhase = getEconomyPhase(prev.economy?.index ?? EMPTY_ECONOMY.index);
  const ecoRevMul = getEconomyRevenueMul(ecoPhase);
  // L6 시설: 글로벌 방송 스튜디오 — 출시 매출 +5%.
  const broadcastMul = isFacilityBuilt(prev.facilities, 'global-broadcast-studio') ? 1.05 : 1.0;
  const preRivalRevenue = Math.round(baseCalculated * (globalRevMul > 1.0 ? globalRevMul : 1.0) * satelliteMul * dataFabricMul * ecoRevMul * broadcastMul);
  // 경쟁사 시장 점유율 — 같은 분기 같은 장르·테마 경쟁 시 매출 감소.
  const ms = computeMarketShareEffect(
    prev.project.genre,
    prev.project.theme,
    stars,
    prev.productIndex,
    prev.rivals,
  );
  const earlyRevenueBonus = BALANCE.earlyRevenueBonusByProduct[prev.productIndex] ?? 0;
  const revenue = Math.round(preRivalRevenue * ms.revenueMul) + earlyRevenueBonus;
  // 경기 tickEconomy — 출시마다 카운터 +1, 주기 도달 시 새 index 추첨.
  const prevEconomy = prev.economy ?? EMPTY_ECONOMY;
  const newEconomy = tickEconomy(prevEconomy);
  const economyCycleChanged = newEconomy.cyclesElapsed === 0 && newEconomy.index !== prevEconomy.index;
  // 시설: 회사 e스포츠팀 — 출시 시 명성 +1, 글로벌 방송 스튜디오 — +2.
  const esportsBonus = isFacilityBuilt(prev.facilities, 'esports-team') ? 1 : 0;
  const broadcastRepBonus = isFacilityBuilt(prev.facilities, 'global-broadcast-studio') ? 2 : 0;
  const baseReputationGain = stars * REPUTATION.perStarOnRelease + esportsBonus + broadcastRepBonus;
  // 경쟁사 명성 영향 — 우리보다 잘한 라이벌 1개당 명성 −5.
  const betterRivalRepDrop = ms.betterRivalCount * 5;
  const reputationGain = Math.max(0, baseReputationGain - betterRivalRepDrop);
  const newReputation = prev.reputation + reputationGain;
  // 라이벌 새 출시 (우리 출시 직후).
  const newRivals = tickRivalReleases(prev.rivals, prev.productIndex);
  // 트렌드 카운트다운 — 출시 후 −1, 0이면 null로 만료 (Boot에서 새 트렌드 결정).
  const nextTrend = prev.trend
    ? prev.trend.remainingProjects > 1
      ? { ...prev.trend, remainingProjects: prev.trend.remainingProjects - 1 }
      : null
    : null;

  const goldAfterPromo = Math.max(0, prev.gold - eff.cost);

  // 정배치 직원에게 출시 보너스: skill ↑ + shippedProjects ↑ + 진급 평가.
  const placedAndMatched = new Set<string>();
  for (const slot of SLOT_ORDER) {
    const id = prev.assignment[slot];
    if (!id) continue;
    const emp = prev.employees.find((e) => e.id === id);
    if (emp && isMatched(slot, emp.job)) placedAndMatched.add(id);
  }
  const boostedEmployees = prev.employees.map((e) => {
    if (!placedAndMatched.has(e.id)) return e;
    // 출시 보너스도 개인 성장률 반영.
    const releaseGain = SKILL_GROWTH.perReleaseBonus * (e.growthRate ?? 1.0);
    const newSkill = clamp(e.skill + releaseGain, 0, SKILL_GROWTH.maxSkill);
    const newShipped = e.shippedProjects + 1;
    const newRank = checkPromotion(e.rank, newShipped, newSkill);
    return { ...e, skill: newSkill, shippedProjects: newShipped, rank: newRank };
  });

  // 임원 압박 갱신 — 명성 획득 기반 streak.
  const nextExec = tickExec(prev.exec, reputationGain);
  const released = release({
    ...prev,
    gold: goldAfterPromo,
    employees: boostedEmployees,
    reputation: newReputation,
    trend: nextTrend,
    exec: nextExec,
    economy: newEconomy,
    rivals: newRivals,
  });
  const state: GameState = { ...released, gold: released.gold + revenue };

  return {
    reviewScore: finalScore,
    stars,
    headline: HEADLINE_BY_STARS[stars],
    revenue,
    breakdown: {
      base: r.base,
      bugPenalty: r.bugPenalty,
      overrunPenalty: r.overrunPenalty,
      polishBonus: r.polishBonus,
      appealBonus: r.appealBonus,
      conditionBonus: r.conditionBonus,
      teamFitBonus: r.teamFitBonus,
      scopeBonus: r.scopeBonus,
      promoBonus: eff.reviewBonus,
    },
    promo: {
      tier: effectiveTier,
      cost: eff.cost,
      revenueMul: eff.revenueMul,
    },
    reputation: {
      gain: reputationGain,
      multiplier: reputationMul,
      total: newReputation,
    },
    trend: trendDef
      ? { id: trendDef.id, name: trendDef.name, multiplier: rawTrendMul }
      : null,
    economy: {
      phase: ECONOMY_PHASE_LABEL[ecoPhase],
      index: prevEconomy.index,
      revenueMul: ecoRevMul,
      cycleChanged: economyCycleChanged,
      prevIndex: prevEconomy.index,
    },
    marketShare: {
      revenueMul: ms.revenueMul,
      betterRivalCount: ms.betterRivalCount,
      matchedReleases: ms.matchedReleases,
    },
    state,
  };
}
