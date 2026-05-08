/**
 * 순수 도메인 리듀서. Phaser·DOM 비의존.
 * 모든 함수는 입력 state를 변경하지 않고 새 객체를 반환한다.
 */
import { BALANCE, CONDITION, GENRE_MOD, SKILL_GROWTH, THEME_MOD } from './balance';
import { isMatched, SLOT_ORDER } from './match';
import type { Assignment, Employee, GameState, SlotKind } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 효과 스킬 = base × moraleFactor × staminaFactor. */
export function effectiveSkill(emp: Employee): number {
  const m = CONDITION.moraleFactorMin + (emp.morale / 100) * CONDITION.moraleFactorRange;
  const s = CONDITION.staminaFactorMin + (emp.stamina / 100) * CONDITION.staminaFactorRange;
  return emp.skill * m * s;
}

function findAssignedSlot(state: GameState, empId: string): SlotKind | null {
  for (const s of SLOT_ORDER) if (state.assignment[s] === empId) return s;
  return null;
}

/** 한 직원의 한 주 컨디션 변화. 작업 모드(advanceWeek)와 휴식 모드(polishWeek)를 구분. */
function tickCondition(emp: Employee, state: GameState, mode: 'work' | 'rest'): Employee {
  const assigned = findAssignedSlot(state, emp.id);

  let dStamina = 0;
  let dMorale = 0;
  let dSkill = 0;

  if (mode === 'rest') {
    // 폴리싱·휴식 주: 모두가 회복.
    dStamina = CONDITION.staminaRest;
  } else if (!assigned) {
    // 미배치는 휴식.
    dStamina = CONDITION.staminaRest;
  } else {
    const matched = isMatched(assigned, emp.job);
    dStamina = matched ? CONDITION.staminaMatched : CONDITION.staminaMismatch;
    if (state.crunch) dStamina += CONDITION.staminaCrunchExtra;
    if (state.crunch) dMorale += CONDITION.moraleCrunch;
    if (state.project.bugDebt > CONDITION.moraleBugDebtThreshold) {
      dMorale += CONDITION.moraleBugDebtPenalty;
    }
    // 정배치 작업이 누적되면 자연 성장.
    if (matched) dSkill = SKILL_GROWTH.perWeekMatched;
  }

  return {
    ...emp,
    skill: clamp(emp.skill + dSkill, 0, SKILL_GROWTH.maxSkill),
    morale: clamp(emp.morale + dMorale, 0, 100),
    stamina: clamp(emp.stamina + dStamina, 0, 100),
  };
}

/** 1주 개발 틱. 출시된 작품에는 변화 없음. */
export function advanceWeek(prev: GameState): GameState {
  if (prev.project.released) return prev;

  const employeesById = new Map(prev.employees.map((e) => [e.id, e] as const));

  let progressDelta = 0;
  let appealDelta = 0;
  let mismatchedCount = 0;
  const appealEnabled = prev.project.appealEnabled;

  // 1) 이번 주 작업 기여 — 현재 morale/stamina 기반 effective skill로 산출.
  for (const slot of SLOT_ORDER) {
    const empId = prev.assignment[slot];
    if (!empId) continue;
    const emp = employeesById.get(empId);
    if (!emp) continue;
    const matched = isMatched(slot, emp.job);
    const factor = matched ? 1 : BALANCE.mismatchContribFactor;
    const eff = effectiveSkill(emp);
    progressDelta += BALANCE.matchedProgressPerWeek * eff * factor;
    if (appealEnabled) {
      appealDelta += BALANCE.appealBySlot[slot] * eff * factor;
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
  if (appealEnabled && !prev.assignment.qa) {
    appealDelta += BALANCE.appealSoundEmpty;
  }

  // 2) 직원 컨디션 업데이트(다음 주를 위해)
  const nextEmployees = prev.employees.map((e) => tickCondition(e, prev, 'work'));

  const weeksElapsed = prev.project.weeksElapsed + 1;
  const overdue = weeksElapsed > prev.project.weeksTarget;
  const goldDelta = overdue ? BALANCE.overrunGoldPenalty : 0;

  return {
    ...prev,
    employees: nextEmployees,
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

/** 1주 폴리싱: 1주 경과 + BugDebt 감소. 모두가 휴식 모드로 컨디션 회복. */
export function polishWeek(prev: GameState): GameState {
  if (prev.project.released) return prev;
  const weeksElapsed = prev.project.weeksElapsed + 1;
  const overdue = weeksElapsed > prev.project.weeksTarget;
  const goldDelta = overdue ? BALANCE.overrunGoldPenalty : 0;
  const nextEmployees = prev.employees.map((e) => tickCondition(e, prev, 'rest'));
  return {
    ...prev,
    employees: nextEmployees,
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
