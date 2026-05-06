/**
 * 밸런스 v0.1 상수. 모든 수치는 docs/BALANCE.md의 표와 1:1 대응.
 * 변경 시 문서도 함께 갱신할 것.
 */
export const BALANCE = {
  /** 정배치 직원 1명이 1주에 내는 진행도(%) — 3명 정배치 시 약 +10.5%/주 (목표 +9~11%). */
  matchedProgressPerWeek: 3.5,
  /** 오배치 시 진행 기여 배수. */
  mismatchContribFactor: 0.5,
  /** 오배치 직원 1명당 추가 BugDebt. */
  mismatchBugDebt: 2,
  /** 매주 기본 BugDebt 증가. */
  baseBugDebtPerWeek: 6,
  /** 야근 ON 시 BugDebt 가산(+4). */
  crunchBugDebtBonus: 4,
  /** 야근 ON 시 Progress 배수. */
  crunchProgressMul: 1.18,
  /** 폴리싱 1주당 BugDebt 변화량(음수). */
  polishBugDebtDelta: -12,
  /** 연체 1주당 골드 페널티(음수). */
  overrunGoldPenalty: -8,
  /** G1 튜토리얼 목표 주 수. */
  tutorialWeeksTarget: 10,
} as const;
