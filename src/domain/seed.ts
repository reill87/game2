import { BALANCE, CONDITION } from './balance';
import type {
  CompanyPolicy,
  Employee,
  GameState,
  GenreId,
  Job,
  Rank,
  SlotKind,
  Stance,
  ThemeId,
  Trait,
} from './types';

/** 기본 회사 정책 — 새 게임 시작 시. */
export const DEFAULT_POLICY: CompanyPolicy = {
  commute: 'office',
  dressCode: 'casual_guide',
  perks: {
    shuttle: false,
    teamHoodie: false,
    espresso: false,
    cafeteria: false,
  },
};

const M0 = CONDITION.defaultMorale;
const S0 = CONDITION.defaultStamina;

/**
 * 튜토리얼 첫 프로젝트 — 5인 미만 스타트업 가정. 모두 주니어로 시작해 작품을
 * 거치며 진급해 가는 재미를 남긴다.
 *
 * 페르소나(PIVOT-3):
 *  - PM 김기획: 보수파, 주니어
 *  - 디자이너 이UX: 급진파, 주니어
 *  - 개발자 박코더: 보수파, 주니어, 트레이트 '고인물' (직급은 낮지만 효율 ↑)
 */
export const TUTORIAL_EMPLOYEES: ReadonlyArray<Employee> = [
  {
    id: 'emp-planner',
    name: 'PM 김기획',
    job: 'planner',
    skill: 1,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'junior',
    shippedProjects: 0,
  },
  {
    id: 'emp-designer',
    name: '디자이너 이UX',
    job: 'designer',
    skill: 1,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'junior',
    shippedProjects: 0,
  },
  {
    id: 'emp-programmer',
    name: '개발자 박코더',
    job: 'programmer',
    skill: 1,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'junior',
    shippedProjects: 0,
    trait: 'oldTimer',
  },
] as const;

/** 사무실 2단계(판교 임대) 해금 시 채용 가능한 QA 후보. */
export const QA_HIRE_CANDIDATE: Employee = {
  id: 'emp-qa',
  name: 'QA 정꼼꼼',
  job: 'qa',
  skill: 1,
  morale: M0,
  stamina: S0,
  stance: 'progressive',
  rank: 'junior',
  shippedProjects: 0,
};

/** 슬라이스 5의 SOUND_HIRE_CANDIDATE 호환 alias — 옛 import 경로 보존. */
export const SOUND_HIRE_CANDIDATE = QA_HIRE_CANDIDATE;

export const SLOT_LABEL: Readonly<Record<SlotKind, string>> = {
  planning: '기획',
  graphics: '디자인',
  qa: 'QA',
  programming: '개발',
};

export const JOB_LABEL: Readonly<Record<Job, string>> = {
  planner: 'PM',
  designer: '디자이너',
  programmer: '개발자',
  qa: 'QA',
};

export const STANCE_LABEL: Readonly<Record<Stance, string>> = {
  progressive: '급진',
  conservative: '보수',
};

export const TRAIT_LABEL: Readonly<Record<Trait, string>> = {
  oldTimer: '고인물',
  allTalk: '입 개발',
  remoteSlacker: '재택 빌런',
};

export const RANK_LABEL: Readonly<Record<Rank, string>> = {
  newbie: '신입',
  junior: '주니어',
  senior: '시니어',
  lead: '리더',
};

/** rank 1글자 약어 — 카드 배지용. */
export const RANK_SHORT: Readonly<Record<Rank, string>> = {
  newbie: 'N',
  junior: 'J',
  senior: 'S',
  lead: 'L',
};

/** 슬롯/직군 아이콘 매핑 — src/icons.ts ICONS의 키. */
export const SLOT_ICON: Readonly<Record<SlotKind, 'lightbulb' | 'brush' | 'check' | 'code'>> = {
  planning: 'lightbulb',
  graphics: 'brush',
  qa: 'check',
  programming: 'code',
};

export const JOB_ICON: Readonly<Record<Job, 'lightbulb' | 'brush' | 'check' | 'code'>> = {
  planner: 'lightbulb',
  designer: 'brush',
  programmer: 'code',
  qa: 'check',
};

export const GENRE_ICON: Readonly<Record<GenreId, 'pointer' | 'dice' | 'chat'>> = {
  G1: 'pointer',
  G2: 'dice',
  G3: 'chat',
};

export const THEME_ICON: Readonly<Record<ThemeId, 'moon' | 'users' | 'alert'>> = {
  T1: 'moon',
  T2: 'users',
  T3: 'alert',
};

export const GENRE_LABEL: Readonly<Record<GenreId, { name: string; desc: string }>> = {
  G1: { name: '광고/AdTech', desc: 'MVP 짧음, 매출 변동 大' },
  G2: { name: '커머스 플랫폼', desc: '개발 부담↑ 평판 롤러코스터' },
  G3: { name: 'AI/추천 서비스', desc: '디자인 부담↓ 알고리즘 비중↑' },
};

export const THEME_LABEL: Readonly<Record<ThemeId, { name: string; desc: string }>> = {
  T1: { name: '야근과 치킨', desc: '일정 압박과 어울림' },
  T2: { name: '회의가 레벨이다', desc: '진행 느림·버그 적음' },
  T3: { name: '장애 컨퍼런스콜', desc: '버그 ↑ 디버깅 시너지' },
};

/** 사무실 단계별 표시 라벨. 도메인이 직접 단계 수를 다루진 않지만 UI 일관성 확보용. */
export const OFFICE_STAGE_LABEL: Readonly<Record<1 | 2, string>> = {
  1: '분당 셰어오피스',
  2: '판교 임대 사무실',
};

/** 새 프로젝트 시작 시 GameState 생성. */
export function newProject(opts: {
  productIndex: number;
  genre: GenreId;
  theme: ThemeId;
  gold: number;
  employees: ReadonlyArray<Employee>;
  officeLevel?: 1 | 2;
  reputation?: number;
  appealEnabled?: boolean;
  policy?: CompanyPolicy;
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
    officeLevel: opts.officeLevel ?? 1,
    reputation: opts.reputation ?? 0,
    policy: opts.policy ?? DEFAULT_POLICY,
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
    officeLevel: 1,
    reputation: 0,
  });
}
