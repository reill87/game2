/**
 * 순수 도메인 리듀서. Phaser·DOM 비의존.
 * 모든 함수는 입력 state를 변경하지 않고 새 객체를 반환한다.
 */
import { BALANCE, GENRE_MOD, THEME_MOD } from './balance';
import { isMatched, SLOT_ORDER } from './match';
import type { Assignment, GameState, SlotKind } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 1주 개발 틱. 출시된 작품에는 변화 없음. */
export function advanceWeek(prev: GameState): GameState {
  if (prev.project.released) return prev;

  const employeesById = new Map(prev.employees.map((e) => [e.id, e] as const));

  let progressDelta = 0;
  let appealDelta = 0;
  let mismatchedCount = 0;
  const appealEnabled = prev.project.appealEnabled;

  for (const slot of SLOT_ORDER) {
    const empId = prev.assignment[slot];
    if (!empId) continue;
    const emp = employeesById.get(empId);
    if (!emp) continue;
    const matched = isMatched(slot, emp.job);
    const factor = matched ? 1 : BALANCE.mismatchContribFactor;
    progressDelta += BALANCE.matchedProgressPerWeek * emp.skill * factor;
    if (appealEnabled) {
      appealDelta += BALANCE.appealBySlot[slot] * emp.skill * factor;
    }
    if (!matched) mismatchedCount += 1;
  }

  // 장르 × 테마 보정 — progress·bugDebt 둘 다 곱연산
  const gMod = GENRE_MOD[prev.project.genre];
  const tMod = THEME_MOD[prev.project.theme];
  progressDelta *= gMod.progressMul * tMod.progressMul;

  let bugDebtDelta =
    (BALANCE.baseBugDebtPerWeek + mismatchedCount * BALANCE.mismatchBugDebt) *
    gMod.bugMul *
    tMod.bugMul;
  if (prev.crunch) {
    progressDelta *= BALANCE.crunchProgressMul;
    bugDebtDelta += BALANCE.crunchBugDebtBonus;
    if (appealEnabled) appealDelta += BALANCE.appealCrunchBonus;
  }
  if (appealEnabled && !prev.assignment.sound) {
    appealDelta += BALANCE.appealSoundEmpty;
  }

  const weeksElapsed = prev.project.weeksElapsed + 1;
  const overdue = weeksElapsed > prev.project.weeksTarget;
  const goldDelta = overdue ? BALANCE.overrunGoldPenalty : 0;

  return {
    ...prev,
    gold: clamp(prev.gold + goldDelta, 0, Number.MAX_SAFE_INTEGER),
    project: {
      ...prev.project,
      weeksElapsed,
      progress: clamp(prev.project.progress + progressDelta, 0, 100),
      bugDebt: clamp(prev.project.bugDebt + bugDebtDelta, 0, 100),
      appeal: appealEnabled ? clamp(prev.project.appeal + appealDelta, 0, 100) : prev.project.appeal,
    },
  };
}

/** 1주 폴리싱: 1주 경과 + BugDebt 감소. 목표 주 초과 시 골드 페널티는 advanceWeek와 동일하게 적용. */
export function polishWeek(prev: GameState): GameState {
  if (prev.project.released) return prev;
  const weeksElapsed = prev.project.weeksElapsed + 1;
  const overdue = weeksElapsed > prev.project.weeksTarget;
  const goldDelta = overdue ? BALANCE.overrunGoldPenalty : 0;
  return {
    ...prev,
    gold: clamp(prev.gold + goldDelta, 0, Number.MAX_SAFE_INTEGER),
    project: {
      ...prev.project,
      weeksElapsed,
      bugDebt: clamp(prev.project.bugDebt + BALANCE.polishBugDebtDelta, 0, 100),
    },
  };
}

/** 출시 확정. 결과 화면 전환은 호출 측에서 처리. */
export function release(prev: GameState): GameState {
  if (prev.project.released) return prev;
  return { ...prev, project: { ...prev.project, released: true } };
}

/** 직원 배치/이동/해제. 같은 직원이 다른 슬롯에 있었다면 자동 제거 후 재배치. */
export function place(state: GameState, slot: SlotKind, empId: string | null): GameState {
  const next: Assignment = { ...state.assignment };
  if (empId) {
    for (const s of SLOT_ORDER) {
      if (next[s] === empId) delete next[s];
    }
    next[slot] = empId;
  } else {
    delete next[slot];
  }
  return { ...state, assignment: next };
}

export function canRelease(state: GameState): boolean {
  return !state.project.released && state.project.progress >= 100;
}

/** 튜토리얼 기준: 사운드 외 3슬롯이 모두 채워졌는가. */
export function isTutorialAssignmentReady(state: GameState): boolean {
  const a = state.assignment;
  return Boolean(a.planning && a.graphics && a.programming);
}
