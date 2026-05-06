import { BALANCE } from './balance';
import type { Employee, GameState, Job, SlotKind } from './types';

/** 튜토리얼 첫 작품 — 직원 3명 (사운드 직군 없음). */
export const TUTORIAL_EMPLOYEES: ReadonlyArray<Employee> = [
  { id: 'emp-planner', name: '기획자 김PM', job: 'planner', skill: 1 },
  { id: 'emp-designer', name: '디자이너 이D', job: 'designer', skill: 1 },
  { id: 'emp-programmer', name: '개발자 박코더', job: 'programmer', skill: 1 },
] as const;

export const SLOT_LABEL: Readonly<Record<SlotKind, string>> = {
  planning: '기획',
  graphics: '그래픽',
  sound: '사운드',
  programming: '프로그래밍',
};

export const JOB_LABEL: Readonly<Record<Job, string>> = {
  planner: '기획자',
  designer: '디자이너',
  programmer: '개발자',
  sound: '사운드',
};

/** G1 + T1 고정 튜토리얼 시작 상태. */
export function newTutorialGame(): GameState {
  return {
    employees: TUTORIAL_EMPLOYEES,
    assignment: {},
    project: {
      genre: 'G1',
      theme: 'T1',
      weeksTarget: BALANCE.tutorialWeeksTarget,
      weeksElapsed: 0,
      progress: 0,
      bugDebt: 0,
      appeal: 0,
      appealEnabled: false,
      released: false,
    },
    gold: 0,
    crunch: false,
  };
}
