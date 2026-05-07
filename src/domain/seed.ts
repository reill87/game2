import { BALANCE } from './balance';
import type { Employee, GameState, GenreId, Job, SlotKind, ThemeId } from './types';

/** 튜토리얼 첫 작품 — 직원 3명 (사운드 직군 없음). */
export const TUTORIAL_EMPLOYEES: ReadonlyArray<Employee> = [
  { id: 'emp-planner', name: '기획자 김PM', job: 'planner', skill: 1 },
  { id: 'emp-designer', name: '디자이너 이D', job: 'designer', skill: 1 },
  { id: 'emp-programmer', name: '개발자 박코더', job: 'programmer', skill: 1 },
] as const;

/** 사무실 2단계 해금 시 채용 가능한 사운드 후보 (단일 v1). */
export const SOUND_HIRE_CANDIDATE: Employee = {
  id: 'emp-sound',
  name: '사운드 정비트',
  job: 'sound',
  skill: 1,
};

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

/** 슬롯/직군 아이콘 매핑 — src/icons.ts ICONS의 키. */
export const SLOT_ICON: Readonly<Record<SlotKind, 'lightbulb' | 'brush' | 'music' | 'code'>> = {
  planning: 'lightbulb',
  graphics: 'brush',
  sound: 'music',
  programming: 'code',
};

export const JOB_ICON: Readonly<Record<Job, 'lightbulb' | 'brush' | 'music' | 'code'>> = {
  planner: 'lightbulb',
  designer: 'brush',
  programmer: 'code',
  sound: 'music',
};

export const GENRE_LABEL: Readonly<Record<GenreId, { name: string; desc: string }>> = {
  G1: { name: '초단타 터치', desc: '기간 짧음, 매출 변동 大' },
  G2: { name: '한 판마다 새로', desc: '디버깅 부담↑ 명성 롤러코스터' },
  G3: { name: '말이 주인공', desc: '그래픽 부담↓ 시나리오 비중↑' },
};

export const THEME_LABEL: Readonly<Record<ThemeId, { name: string; desc: string }>> = {
  T1: { name: '야근과 치킨', desc: '일정 압박과 어울림' },
  T2: { name: '회의가 레벨이다', desc: '진행 느림·버그 적음' },
  T3: { name: '버그한테 잡아먹힘', desc: '버그 ↑ 디버깅 시너지' },
};

/** 새 작품을 시작할 때 GameState를 만든다. */
export function newProject(opts: {
  productIndex: number;
  genre: GenreId;
  theme: ThemeId;
  gold: number;
  employees: ReadonlyArray<Employee>;
  appealEnabled?: boolean;
}): GameState {
  return {
    employees: opts.employees,
    assignment: {},
    project: {
      genre: opts.genre,
      theme: opts.theme,
      weeksTarget: BALANCE.tutorialWeeksTarget,
      weeksElapsed: 0,
      progress: 0,
      bugDebt: 0,
      appeal: 0,
      appealEnabled: opts.appealEnabled ?? false,
      released: false,
    },
    gold: opts.gold,
    crunch: false,
    productIndex: opts.productIndex,
  };
}

/** G1 + T1 고정 튜토리얼 시작 상태. */
export function newTutorialGame(): GameState {
  return newProject({
    productIndex: 0,
    genre: 'G1',
    theme: 'T1',
    gold: 0,
    employees: TUTORIAL_EMPLOYEES,
    appealEnabled: false,
  });
}
