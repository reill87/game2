/**
 * 직원 이탈 / 추천 채용 — 슬라이스 E.
 *
 * 메커닉:
 *  - **이탈**: morale이 EXIT_MORALE_THRESHOLD 미만으로 EXIT_CONSECUTIVE_WEEKS 연속 누적되면
 *    퇴사 모달 트리거. 회복(>=임계) 시 카운터 0 리셋.
 *  - **추천 채용**: 평균 morale >= REFERRAL_AVG_MORALE_THRESHOLD 일 때 출시 시
 *    REFERRAL_PROBABILITY 확률로 추천 후보 1명 등장. 비용 ×REFERRAL_DISCOUNT.
 */
import type { Employee, GameState } from './types';

export const EXIT_MORALE_THRESHOLD = 25;
export const EXIT_CONSECUTIVE_WEEKS = 4;

export const REFERRAL_AVG_MORALE_THRESHOLD = 75;
export const REFERRAL_PROBABILITY = 0.3;
export const REFERRAL_DISCOUNT = 0.5;

/** 면담으로 붙잡기 비용·효과. */
export const RETAIN_COST = 150;
export const RETAIN_MORALE_BOOST = 30;

/**
 * 한 직원의 lowMoraleStreak 갱신:
 *  - morale<임계 → streak +1
 *  - morale>=임계 → 0 리셋
 */
export function tickExitStreak(emp: Employee): Employee {
  const streak = emp.morale < EXIT_MORALE_THRESHOLD ? (emp.lowMoraleStreak ?? 0) + 1 : 0;
  return { ...emp, lowMoraleStreak: streak };
}

/** 이탈 후보 — streak >= EXIT_CONSECUTIVE_WEEKS 인 직원 리스트. */
export function pickExitCandidates(state: GameState): ReadonlyArray<Employee> {
  return state.employees.filter(
    (e) => (e.lowMoraleStreak ?? 0) >= EXIT_CONSECUTIVE_WEEKS,
  );
}

/** 평균 morale (직원 0명이면 100). */
export function avgMorale(state: GameState): number {
  if (state.employees.length === 0) return 100;
  return state.employees.reduce((s, e) => s + e.morale, 0) / state.employees.length;
}
