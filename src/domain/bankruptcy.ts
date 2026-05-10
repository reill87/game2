/**
 * 파산 / 폐업 위협 도메인.
 * - 골드 마이너스 누적 시 파산 위기.
 * - 명성 0 도달 시 폐업 위기.
 */
import type { GameState } from './types';

/** 파산 임계 — 골드가 이 값 이하로 N주 연속이면 파산 모달. */
export const BANKRUPTCY_GOLD_THRESHOLD = -500;
export const BANKRUPTCY_CONSECUTIVE_WEEKS = 5;

/** 명성 폭락 임계 — 0 도달 시 폐업 위기. */
export const COLLAPSE_REPUTATION_THRESHOLD = 0;

export interface BankruptcyState {
  /** 골드가 BANKRUPTCY_GOLD_THRESHOLD 이하 연속 주차. */
  readonly lowGoldStreak: number;
}

export const EMPTY_BANKRUPTCY: BankruptcyState = { lowGoldStreak: 0 };

/** 매 주 tick — 골드 임계 연속 주차 갱신. */
export function tickBankruptcy(state: Pick<GameState, 'gold'>, current: BankruptcyState | undefined): BankruptcyState {
  const cur = current ?? EMPTY_BANKRUPTCY;
  const streak = state.gold <= BANKRUPTCY_GOLD_THRESHOLD ? cur.lowGoldStreak + 1 : 0;
  return { lowGoldStreak: streak };
}

/** N주 연속 저골드 → 파산 판정. */
export function isBankrupt(_state: Pick<GameState, 'gold'>, b: BankruptcyState | undefined): boolean {
  return (b?.lowGoldStreak ?? 0) >= BANKRUPTCY_CONSECUTIVE_WEEKS;
}

/** 명성 0 이하 → 폐업 위기 판정. */
export function isCollapsing(state: Pick<GameState, 'reputation'>): boolean {
  return state.reputation <= COLLAPSE_REPUTATION_THRESHOLD;
}
