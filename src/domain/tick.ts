/**
 * 순수 도메인 리듀서. Phaser·DOM 비의존.
 * 모든 함수는 입력 state를 변경하지 않고 새 객체를 반환한다.
 */
import {
  BALANCE,
  BURN,
  COMMUTE_DRAIN_BY_OFFICE,
  CONDITION,
  DRESS_CODE_EFFECT,
  GENRE_MOD,
  LEAD_TEAM_BONUS,
  PERK,
  RANK_MULTIPLIER,
  REMOTE,
  SKILL_GROWTH,
  THEME_MOD,
  TRACK_EFFECT,
  TRAIT_EFFECT,
} from './balance';
import { AP_CAP, AP_PER_WEEK } from './weeklyActions';
import { isMatched, SLOT_ORDER } from './match';
import { tickExitStreak } from './retention';
import { isRndPurchased } from './rnd';
import { getSprintPhase, SPRINT_SLOT_WEIGHT } from './sprintPhase';
import { computeEquipmentBonuses } from './equipment';
import { isFacilityBuilt } from './facilities';
import type { Assignment, Employee, GameState, SlotKind, SupportAssignment } from './types';

/** support 직원이 primary 대비 기여하는 배수. */
export const SUPPORT_CONTRIBUTION_FACTOR = 0.5;

/** 매주 자동 차감되는 회사 운영비(인건비 + 사옥 임대료). */
export function computeBurnRate(state: GameState): number {
  const payroll = state.employees.reduce(
    (acc, e) => acc + BURN.payrollByRank[e.rank],
    0,
  );
  const rent = BURN.officeRentByStage[state.officeLevel];
  const base = payroll + rent;
  // R&D: 재무 자동화 ×0.85 / 클라우드 마이그레이션 ×0.7 / 자체 클라우드 인프라 ×0.6.
  // 여러 개 보유 시 가장 큰 할인(가장 작은 배수) 적용.
  let burnMul = 1.0;
  if (isRndPurchased(state.rnd, 'finance-automation')) burnMul = Math.min(burnMul, 0.85);
  if (isRndPurchased(state.rnd, 'cloud-migration'))    burnMul = Math.min(burnMul, 0.70);
  if (isRndPurchased(state.rnd, 'self-cloud-infra'))   burnMul = Math.min(burnMul, 0.60);
  return burnMul < 1.0 ? Math.round(base * burnMul) : base;
}

/** 직원 한 명의 한 주 기여 — UI 표시용. advanceWeek와 같은 식. */
export interface SlotContribution {
  slot: SlotKind;
  empId: string;
  matched: boolean;
  /** 이번 주 progress(%) 기여. */
  progressDelta: number;
  /** 이번 주 appeal 기여. appealEnabled가 false면 0. */
  appealDelta: number;
}

/** 현재 state에서 다음 주 advanceWeek가 발생시킬 직원별 기여를 미리 계산. */
export function computeSlotContributions(state: GameState): SlotContribution[] {
  const employeesById = new Map(state.employees.map((e) => [e.id, e] as const));
  const totalUnits = totalTeamWeight(state.employees);
  const gMod = GENRE_MOD[state.project.genre];
  const tMod = THEME_MOD[state.project.theme];
  const result: SlotContribution[] = [];

  // Sprint 단계 — 현재 진행률 기반.
  const phase = getSprintPhase(state.project.progress);
  const phaseWeights = SPRINT_SLOT_WEIGHT[phase];

  // R&D: 개발 표준화 — 오배치 기여 배수 0.5 → 0.65.
  const mismatchFactor = isRndPurchased(state.rnd, 'process-standard')
    ? 0.65
    : BALANCE.mismatchContribFactor;

  for (const slot of SLOT_ORDER) {
    const empId = state.assignment[slot];
    if (!empId) continue;
    const emp = employeesById.get(empId);
    if (!emp) continue;
    const matched = isMatched(slot, emp.job);
    const factor = matched ? 1 : mismatchFactor;
    const teamUnitsForOthers = totalUnits - teamWeight(emp);
    const eff = effectiveSkill(emp, state, teamUnitsForOthers);

    // Sprint 가중치 적용 — ai-pm-assistant 보유 시 ×1.05 추가. (밸런스 v2) 1.1 → 1.05.
    const aiPmMul = isRndPurchased(state.rnd, 'ai-pm-assistant') ? 1.05 : 1.0;
    const phaseWeight = phaseWeights[slot] * aiPmMul;
    let progressDelta = BALANCE.matchedProgressPerWeek * eff * factor;
    progressDelta *= gMod.progressMul * tMod.progressMul;
    progressDelta *= phaseWeight;
    // R&D: CI/CD 파이프라인 — Progress 배수 ×1.05.
    if (isRndPurchased(state.rnd, 'ci-cd')) progressDelta *= 1.05;
    // R&D: 지속 통합 강화 — Progress 배수 추가 ×1.05. (밸런스 v2) 1.08 → 1.05.
    if (isRndPurchased(state.rnd, 'continuous-integration')) progressDelta *= 1.05;
    if (state.crunch) progressDelta *= BALANCE.crunchProgressMul;

    let appealDelta = state.project.appealEnabled
      ? BALANCE.appealBySlot[slot] * eff * factor
      : 0;
    appealDelta *= phaseWeight;

    // support 직원 기여 — primary 기여의 ×0.5 (정배치) 또는 ×0.25 (오배치).
    const suppId = state.support?.[slot];
    if (suppId) {
      const suppEmp = employeesById.get(suppId);
      if (suppEmp) {
        const suppMatched = isMatched(slot, suppEmp.job);
        const suppFactor = suppMatched ? 1 : mismatchFactor;
        const suppTeamUnits = totalUnits - teamWeight(suppEmp);
        const suppEff = effectiveSkill(suppEmp, state, suppTeamUnits);
        let suppProgress = BALANCE.matchedProgressPerWeek * suppEff * suppFactor * SUPPORT_CONTRIBUTION_FACTOR;
        suppProgress *= gMod.progressMul * tMod.progressMul;
        suppProgress *= phaseWeight;
        if (isRndPurchased(state.rnd, 'ci-cd')) suppProgress *= 1.05;
        if (isRndPurchased(state.rnd, 'continuous-integration')) suppProgress *= 1.08;
        if (state.crunch) suppProgress *= BALANCE.crunchProgressMul;
        progressDelta += suppProgress;
        if (state.project.appealEnabled) {
          const suppAppeal = BALANCE.appealBySlot[slot] * suppEff * suppFactor * SUPPORT_CONTRIBUTION_FACTOR;
          appealDelta += suppAppeal * phaseWeight;
        }
      }
    }

    result.push({ slot, empId, matched, progressDelta, appealDelta });
  }
  return result;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 한 직원이 다른 팀원에게 주는 팀 보너스 가중(곱연산 단위).
 *  - lead         : 1.0 (LEAD_TEAM_BONUS 그대로)
 *  - senior+manager: 0.5 (lead 도달 전이지만 매니저 트랙은 일부 발현)
 *  - 그 외        : 0
 */
function teamWeight(emp: Employee): number {
  if (emp.rank === 'lead') return 1.0;
  if (emp.rank === 'senior' && emp.track === 'manager') return 0.5;
  return 0;
}

/** state 전체의 teamWeight 합. effectiveSkill 호출 측에서 자기 자신 가중치를 빼 사용. */
export function totalTeamWeight(employees: ReadonlyArray<Employee>): number {
  let sum = 0;
  for (const e of employees) sum += teamWeight(e);
  return sum;
}

/**
 * Effective skill — 작업 기여 계산에 쓰이는 최종 효율.
 *  base × morale × stamina × rank × trait × track × dressMul × remoteVillain × leadBonus
 *
 * teamBonusUnitsForOthers는 자기 자신을 제외한 팀 가중 합 (lead=1 / senior+manager=0.5).
 * remote(재택) ON일 때 trait이 'remoteSlacker'면 effective skill ×0.5.
 */
export function effectiveSkill(
  emp: Employee,
  state: GameState,
  teamBonusUnitsForOthers: number = 0,
): number {
  const m = CONDITION.moraleFactorMin + (emp.morale / 100) * CONDITION.moraleFactorRange;
  const s = CONDITION.staminaFactorMin + (emp.stamina / 100) * CONDITION.staminaFactorRange;
  const rankMul = RANK_MULTIPLIER[emp.rank];
  const traitMul = emp.trait ? TRAIT_EFFECT[emp.trait].effectiveSkillMul : 1.0;
  const trackMul = emp.track ? TRACK_EFFECT[emp.track].skillMul : 1.0;
  const leadBonus = 1 + teamBonusUnitsForOthers * LEAD_TEAM_BONUS;
  const dressMul = DRESS_CODE_EFFECT[state.policy.dressCode].skillMul;
  const remoteVillainMul =
    state.policy.commute === 'remote' && emp.trait === 'remoteSlacker'
      ? REMOTE.villainSkillMul
      : 1.0;
  // 장비 skill 보너스 — 4슬롯 합산.
  const eqBonus = computeEquipmentBonuses(emp.equipment);
  const baseSkill = emp.skill + eqBonus.skillBonus;
  // 시설: AI 코파일럿 — 모든 effective skill ×1.07. (밸런스 v2) 1.1 → 1.07.
  const aiMul = isFacilityBuilt(state.facilities, 'ai-copilot') ? 1.07 : 1.0;
  const raw = baseSkill * m * s * rankMul * traitMul * trackMul * dressMul * remoteVillainMul * leadBonus * aiMul;
  // (밸런스 v2) 풀스펙 스택 남용 방지 — effective skill 최대 3.0.
  return Math.min(raw, BALANCE.maxEffectiveSkill);
}

interface AssignedSlotResult {
  slot: SlotKind;
  isSupport: boolean;
}

/** primary + support 모두 검색해 배치된 슬롯 반환. 미배치면 null. */
function findAssignedSlot(state: GameState, empId: string): AssignedSlotResult | null {
  for (const s of SLOT_ORDER) {
    if (state.assignment[s] === empId) return { slot: s, isSupport: false };
    if (state.support?.[s] === empId) return { slot: s, isSupport: true };
  }
  return null;
}

/** 한 직원의 한 주 컨디션 변화. 작업 모드(advanceWeek)와 휴식 모드(polishWeek)를 구분. */
function tickCondition(emp: Employee, state: GameState, mode: 'work' | 'rest'): Employee {
  const assignedResult = findAssignedSlot(state, emp.id);

  let dStamina = 0;
  let dMorale = 0;
  let dSkill = 0;

  if (mode === 'rest') {
    // 폴리싱·휴식 주: 모두가 회복.
    dStamina = CONDITION.staminaRest;
  } else if (!assignedResult) {
    // 미배치는 휴식.
    dStamina = CONDITION.staminaRest;
  } else {
    const matched = isMatched(assignedResult.slot, emp.job);
    dStamina = matched ? CONDITION.staminaMatched : CONDITION.staminaMismatch;
    if (state.crunch) dStamina += CONDITION.staminaCrunchExtra;
    if (state.crunch) dMorale += CONDITION.moraleCrunch;
    if (state.project.bugDebt > CONDITION.moraleBugDebtThreshold) {
      dMorale += CONDITION.moraleBugDebtPenalty;
    }
    // 정배치 작업이 누적되면 자연 성장. 개인 성장률 곱수로 진급 타이밍 차등.
    if (matched) dSkill = SKILL_GROWTH.perWeekMatched * (emp.growthRate ?? 1.0);

    // 출퇴근 / 재택 — 배치된 직원만 출근 또는 재택.
    if (state.policy.commute === 'office') {
      let commute = COMMUTE_DRAIN_BY_OFFICE[state.officeLevel];
      if (state.policy.perks.shuttle) {
        commute = Math.max(0, commute - PERK.shuttle.staminaPerWeek);
      }
      // 시설: 사내 트레이너 — stamina drain ×0.7.
      if (isFacilityBuilt(state.facilities, 'wellness-trainer')) {
        commute *= 0.7;
      }
      dStamina -= commute;
    } else {
      dMorale += REMOTE.moralePerWeek;
    }
  }

  // 복장 + 복지 — 작업/휴식 모두 적용.
  dMorale += DRESS_CODE_EFFECT[state.policy.dressCode].moralePerWeek;
  if (state.policy.perks.teamHoodie) dMorale += PERK.teamHoodie.moralePerWeek;
  // 시설: 실내 카페 — espresso 효과 ×2 (cafeteria-deluxe 보유 시).
  const espressoMul = isFacilityBuilt(state.facilities, 'cafeteria-deluxe') ? 2 : 1;
  if (state.policy.perks.espresso) dMorale += PERK.espresso.moralePerWeek * espressoMul;
  if (state.policy.perks.cafeteria) dMorale += PERK.cafeteria.moralePerWeek;

  // 시설 컨디션 보너스 — 작업/휴식 모두.
  if (isFacilityBuilt(state.facilities, 'gym'))            dStamina += 1;
  if (isFacilityBuilt(state.facilities, 'gameroom'))       dMorale  += 1;
  if (isFacilityBuilt(state.facilities, 'rooftop-garden')) dMorale  += 2;

  // 장비 morale/stamina 보너스 — 4슬롯 합산.
  const eqBonus = computeEquipmentBonuses(emp.equipment);
  dMorale  += eqBonus.moraleBonus;
  dStamina += eqBonus.staminaBonus;

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
  const totalUnits = totalTeamWeight(prev.employees);

  let progressDelta = 0;
  let appealDelta = 0;
  let mismatchedCount = 0;
  const appealEnabled = prev.project.appealEnabled;

  // Sprint 단계 — 현재 진행률 기반.
  const phase = getSprintPhase(prev.project.progress);
  const phaseWeights = SPRINT_SLOT_WEIGHT[phase];

  // R&D: 개발 표준화 — 오배치 기여 배수 0.5 → 0.65.
  const mismatchFactor = isRndPurchased(prev.rnd, 'process-standard')
    ? 0.65
    : BALANCE.mismatchContribFactor;

  // 1) 이번 주 작업 기여 — 현재 morale/stamina 기반 effective skill로 산출.
  for (const slot of SLOT_ORDER) {
    const empId = prev.assignment[slot];
    if (!empId) continue;
    const emp = employeesById.get(empId);
    if (!emp) continue;
    const matched = isMatched(slot, emp.job);
    const factor = matched ? 1 : mismatchFactor;
    // 자기 자신의 팀 가중을 빼서 lead bonus 대상에서 제외.
    const teamUnitsForOthers = totalUnits - teamWeight(emp);
    const eff = effectiveSkill(emp, prev, teamUnitsForOthers);
    // Sprint 단계 슬롯 가중치 적용 — ai-pm-assistant 보유 시 ×1.05 추가. (밸런스 v2) 1.1 → 1.05.
    const aiPmMul = isRndPurchased(prev.rnd, 'ai-pm-assistant') ? 1.05 : 1.0;
    const phaseWeight = phaseWeights[slot] * aiPmMul;
    progressDelta += BALANCE.matchedProgressPerWeek * eff * factor * phaseWeight;
    if (appealEnabled) {
      appealDelta += BALANCE.appealBySlot[slot] * eff * factor * phaseWeight;
    }
    if (!matched) mismatchedCount += 1;

    // support 직원 기여 — primary 기여의 ×0.5 (정배치 기준).
    const suppId = prev.support?.[slot];
    if (suppId) {
      const suppEmp = employeesById.get(suppId);
      if (suppEmp) {
        const suppMatched = isMatched(slot, suppEmp.job);
        const suppFactor = suppMatched ? 1 : mismatchFactor;
        const suppTeamUnits = totalUnits - teamWeight(suppEmp);
        const suppEff = effectiveSkill(suppEmp, prev, suppTeamUnits);
        progressDelta += BALANCE.matchedProgressPerWeek * suppEff * suppFactor * phaseWeight * SUPPORT_CONTRIBUTION_FACTOR;
        if (appealEnabled) {
          appealDelta += BALANCE.appealBySlot[slot] * suppEff * suppFactor * phaseWeight * SUPPORT_CONTRIBUTION_FACTOR;
        }
        if (!suppMatched) mismatchedCount += 1;
      }
    }
  }

  // 장르 × 테마 보정 — progress·bugDebt 둘 다 곱연산
  const gMod = GENRE_MOD[prev.project.genre];
  const tMod = THEME_MOD[prev.project.theme];
  progressDelta *= gMod.progressMul * tMod.progressMul;

  // R&D: CI/CD 파이프라인 — Progress 배수 ×1.05.
  if (isRndPurchased(prev.rnd, 'ci-cd')) {
    progressDelta *= 1.05;
  }
  // R&D: 지속 통합 강화 — Progress 배수 추가 ×1.05. (밸런스 v2) 1.08 → 1.05.
  if (isRndPurchased(prev.rnd, 'continuous-integration')) {
    progressDelta *= 1.05;
  }

  let bugDebtDelta =
    (BALANCE.baseBugDebtPerWeek + mismatchedCount * BALANCE.mismatchBugDebt) *
    gMod.bugMul *
    tMod.bugMul;
  if (prev.crunch) {
    progressDelta *= BALANCE.crunchProgressMul;
    bugDebtDelta += BALANCE.crunchBugDebtBonus;
    if (appealEnabled) appealDelta += BALANCE.appealCrunchBonus;
  }
  // R&D: 테스트 자동화 — BugDebt 자연 증가 −1/주.
  if (isRndPurchased(prev.rnd, 'test-automation')) {
    bugDebtDelta -= 1;
  }
  // R&D: AI 페어 프로그래밍 — BugDebt 추가 −1/주. (밸런스 v2) -2 → -1.
  if (isRndPurchased(prev.rnd, 'ai-pair-programming')) {
    bugDebtDelta -= 1;
  }
  // 재택근무 — 협업 비용 (BugDebt +1/주)
  if (prev.policy.commute === 'remote') {
    bugDebtDelta += REMOTE.bugDebtPerWeek;
  }
  // 후반부 난이도 램프 — 5작마다 BugDebt +0.5/주.
  const bugRamp = Math.floor(prev.productIndex / 5) * 0.5;
  bugDebtDelta += bugRamp;
  if (appealEnabled && !prev.assignment.qa) {
    appealDelta += BALANCE.appealSoundEmpty;
  }
  // R&D: 사내 디자인 시스템 — Appeal 누적 +0.4/주.
  if (appealEnabled && isRndPurchased(prev.rnd, 'design-system')) {
    appealDelta += 0.4;
  }
  // R&D: 자동 디자인 도구 — Appeal 추가 +0.6/주.
  if (appealEnabled && isRndPurchased(prev.rnd, 'auto-design-tools')) {
    appealDelta += 0.6;
  }
  // 시설: 사내 스튜디오 — Appeal +0.5/주.
  if (appealEnabled && isFacilityBuilt(prev.facilities, 'inhouse-studio')) {
    appealDelta += 0.5;
  }

  // 2) 직원 컨디션 업데이트(다음 주를 위해) + lowMoraleStreak 갱신 + weeklyActionUsed 리셋.
  const nextEmployees = prev.employees
    .map((e) => tickCondition(e, prev, 'work'))
    .map(tickExitStreak)
    .map((e) => ({ ...e, weeklyActionUsed: false }));

  // 남는 인력(슬롯 미배치) 보조 효과 — 매주 직원 1명당:
  //  - 사이드 컨설팅 +2g
  //  - 백그라운드 유지 BugDebt −0.4
  // primary + support 모두 배치 인원으로 간주한다.
  const assignedIds = new Set(
    [
      prev.assignment.planning, prev.assignment.graphics, prev.assignment.qa, prev.assignment.programming,
      prev.support?.planning, prev.support?.graphics, prev.support?.qa, prev.support?.programming,
    ].filter((v): v is string => typeof v === 'string'),
  );
  const idleCount = prev.employees.filter((e) => !assignedIds.has(e.id)).length;
  const idleGold = idleCount * 2;
  bugDebtDelta -= idleCount * 0.4;

  const weeksElapsed = prev.project.weeksElapsed + 1;
  const overdue = weeksElapsed > prev.project.weeksTarget;
  const overdueDelta = overdue ? BALANCE.overrunGoldPenalty : 0;
  const burn = computeBurnRate(prev);
  const goldDelta = overdueDelta - burn + idleGold;

  // 3) AP 누적 — 매주 +1(+대회의실 보너스), AP_CAP 이하로 clamp.
  const apGain = AP_PER_WEEK + (isFacilityBuilt(prev.facilities, 'big-meeting-room') ? 1 : 0);
  const nextAp = Math.min(AP_CAP, (prev.availableAp ?? 0) + apGain);

  return {
    ...prev,
    employees: nextEmployees,
    gold: clamp(prev.gold + goldDelta, 0, Number.MAX_SAFE_INTEGER),
    availableAp: nextAp,
    project: {
      ...prev.project,
      weeksElapsed,
      progress: clamp(prev.project.progress + progressDelta, 0, 100),
      bugDebt: clamp(prev.project.bugDebt + bugDebtDelta, 0, 100),
      appeal: appealEnabled ? clamp(prev.project.appeal + appealDelta, 0, 100) : prev.project.appeal,
    },
  };
}

/** 1주 폴리싱: 1주 경과 + BugDebt 감소. 모두가 휴식 모드로 컨디션 회복. burn은 그대로 차감. */
export function polishWeek(prev: GameState): GameState {
  if (prev.project.released) return prev;
  const weeksElapsed = prev.project.weeksElapsed + 1;
  const overdue = weeksElapsed > prev.project.weeksTarget;
  const overdueDelta = overdue ? BALANCE.overrunGoldPenalty : 0;
  const burn = computeBurnRate(prev);
  const goldDelta = overdueDelta - burn;
  const nextEmployees = prev.employees
    .map((e) => tickCondition(e, prev, 'rest'))
    .map(tickExitStreak);
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

/** support 직원 배치/이동/해제. 같은 직원이 다른 support 슬롯에 있었다면 자동 제거. */
export function placeSupport(state: GameState, slot: SlotKind, empId: string | null): GameState {
  const next: SupportAssignment = { ...(state.support ?? {}) };
  if (empId) {
    for (const s of SLOT_ORDER) {
      if (next[s] === empId) delete next[s];
    }
    next[slot] = empId;
  } else {
    delete next[slot];
  }
  return { ...state, support: next };
}

export function canRelease(state: GameState): boolean {
  return !state.project.released && state.project.progress >= 100;
}

/**
 * 시작 가능 조건 — 직원 수에 따라 적응적 게이트.
 *  - 직원 3명 이상: 3슬롯(planning/graphics/programming) 모두 채워야
 *  - 직원 2명: 2슬롯 이상 채워야
 *  - 직원 1명: 1슬롯 이상 채워야
 *  - 직원 0명: 시작 불가
 *
 * 직원이 퇴사해 인원 부족해도 남은 인원으로 출발 가능. 효율은 자연히 낮음.
 */
export function isTutorialAssignmentReady(state: GameState): boolean {
  const empCount = state.employees.length;
  if (empCount === 0) return false;
  const a = state.assignment;
  const filled = [a.planning, a.graphics, a.programming, a.qa].filter(Boolean).length;
  // 직원 수만큼만 채우면 OK (최소 1, 최대 3 슬롯).
  const required = Math.min(empCount, 3);
  return filled >= required;
}
