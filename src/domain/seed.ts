import { BALANCE, CONDITION, TRENDS, TREND_DURATION } from './balance';
import { EMPTY_RND, type RndState } from './rnd';
import { type PrestigeBonus, NO_PRESTIGE } from './prestige';
import type {
  CompanyPolicy,
  Employee,
  GameState,
  GenreId,
  Job,
  OfficeLevel,
  Rank,
  SlotKind,
  Stance,
  ThemeId,
  Trait,
  TrendId,
  TrendStatus,
} from './types';

/** 무작위 새 트렌드 결정. duration은 TREND_DURATION 사용. */
export function pickRandomTrend(): TrendStatus {
  const ids = Object.keys(TRENDS) as TrendId[];
  const idx = Math.floor(Math.random() * ids.length);
  return { id: ids[idx] ?? 'ai_spring', remainingProjects: TREND_DURATION };
}

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
    // 무난한 성장 — 평균.
    growthRate: 1.0,
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
    // 재능충 — 빠른 성장.
    growthRate: 1.3,
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
    // 고인물 — 이미 효율 높지만 새로 배우는 속도는 느림.
    growthRate: 0.7,
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

/**
 * 채용 면접 — 후보 3명 풀에서 sampling.
 *
 * 디자인 원칙:
 *  - 직군 다양화: planner/designer/programmer/qa 각 1명 풀에서 3명 무작위.
 *  - rank/skill/trait 변화로 의사결정 만들기 (스킬↑이지만 trait 부정 효과).
 *  - id는 채용 시점 epoch ms로 고유성 확보 — 같은 후보를 중복 채용해도 별 직원으로.
 *
 * 호출 측이 hiredEmployees에 push 후 persist.
 */
export interface HireCandidate extends Employee {
  /** 면접 카드 표시용 한 줄 소개. */
  readonly tagline: string;
  /** 채용 비용(골드). 한 번 차감. */
  readonly hireCost: number;
}

const CANDIDATE_POOL: ReadonlyArray<Omit<HireCandidate, 'id'>> = [
  {
    name: '디자이너 한픽셀',
    job: 'designer',
    skill: 1.2,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'junior',
    shippedProjects: 0,
    tagline: '포트폴리오에 트렌디 UI 산더미',
    hireCost: 80,
  },
  {
    name: '개발자 송콘솔',
    job: 'programmer',
    skill: 1.4,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'senior',
    shippedProjects: 6,
    tagline: '3년차에 시니어, 야근 베테랑',
    hireCost: 180,
  },
  {
    name: 'QA 정꼼꼼',
    job: 'qa',
    skill: 1.0,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'junior',
    shippedProjects: 0,
    tagline: '버그 못 보면 잠을 못 잠',
    hireCost: 100,
  },
  {
    name: 'PM 황팀장',
    job: 'planner',
    skill: 1.5,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'lead',
    shippedProjects: 12,
    tagline: '회의 잘함 / 회의가 일임',
    hireCost: 260,
  },
  {
    name: '개발자 박입개발',
    job: 'programmer',
    skill: 1.1,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'junior',
    shippedProjects: 1,
    trait: 'allTalk',
    tagline: '말로는 풀스택, 실은…',
    hireCost: 60,
  },
  {
    name: '디자이너 노재택',
    job: 'designer',
    skill: 1.3,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'junior',
    shippedProjects: 2,
    trait: 'remoteSlacker',
    tagline: '재택만 가능. 재택 ON시 효율 ↓',
    hireCost: 90,
  },
  {
    name: 'QA 김매크로',
    job: 'qa',
    skill: 1.2,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'junior',
    shippedProjects: 3,
    tagline: '자동화 좋아함',
    hireCost: 120,
  },
  {
    name: 'PM 신규파',
    job: 'planner',
    skill: 1.0,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'newbie',
    shippedProjects: 0,
    tagline: '의욕 폭발 신입',
    hireCost: 40,
  },
  {
    name: '디자이너 윤완벽',
    job: 'designer',
    skill: 1.3,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'junior',
    shippedProjects: 2,
    trait: 'perfectionist',
    tagline: '픽셀 하나도 못 넘어감',
    hireCost: 110,
  },
  {
    name: '개발자 최인기',
    job: 'programmer',
    skill: 1.1,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'junior',
    shippedProjects: 1,
    trait: 'crowd-pleaser',
    tagline: '팀 분위기 메이커',
    hireCost: 90,
  },
  {
    name: 'QA 이고민',
    job: 'qa',
    skill: 1.2,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'junior',
    shippedProjects: 2,
    trait: 'over-thinker',
    tagline: '버그 있나 없나 3번씩 생각',
    hireCost: 95,
  },
  // ── 마케팅 직군 후보 ──
  {
    name: '마케터 조바이럴',
    job: 'marketing' as const,
    skill: 1.1,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'junior',
    shippedProjects: 0,
    tagline: 'SNS 팔로워 10만. 콘텐츠는 단거리',
    hireCost: 110,
  },
  {
    name: '마케터 강캠페인',
    job: 'marketing' as const,
    skill: 1.3,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'senior',
    shippedProjects: 5,
    tagline: '전략 기반 마케팅, ROI 집착',
    hireCost: 200,
  },
  {
    name: '마케터 유그로스',
    job: 'marketing' as const,
    skill: 1.0,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'newbie',
    shippedProjects: 0,
    trait: 'crowd-pleaser',
    tagline: '팬덤 만들기 좋아함',
    hireCost: 70,
  },
  {
    name: '마케터 임퍼포먼스',
    job: 'marketing' as const,
    skill: 1.2,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'junior',
    shippedProjects: 2,
    tagline: '퍼포먼스 마케팅 전문, ROAS 철학',
    hireCost: 130,
  },
  // ── 데이터 분석 직군 후보 ──
  {
    name: '데이터 분석가 최쿼리',
    job: 'data' as const,
    skill: 1.2,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'junior',
    shippedProjects: 1,
    tagline: 'SQL 장인, 대시보드 달인',
    hireCost: 130,
  },
  {
    name: '데이터 분석가 박인사이트',
    job: 'data' as const,
    skill: 1.4,
    morale: M0,
    stamina: S0,
    stance: 'conservative',
    rank: 'senior',
    shippedProjects: 7,
    tagline: '데이터 기반 의사결정 전도사',
    hireCost: 220,
  },
  {
    name: '데이터 분석가 허신입',
    job: 'data' as const,
    skill: 1.0,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'newbie',
    shippedProjects: 0,
    tagline: '파이썬 배우는 중, 열정 충만',
    hireCost: 55,
  },
  {
    name: '데이터 분석가 권모델',
    job: 'data' as const,
    skill: 1.3,
    morale: M0,
    stamina: S0,
    stance: 'progressive',
    rank: 'junior',
    shippedProjects: 3,
    trait: 'over-thinker',
    tagline: 'A/B 테스트 없이는 못 움직임',
    hireCost: 150,
  },
];

/** 0.7~1.3 범위에서 무작위 성장률 — 채용마다 개인차 부여. */
function rollGrowthRate(): number {
  return Math.round((0.7 + Math.random() * 0.6) * 100) / 100;
}

/** 면접 후보 3명 sampling — 중복 없이. seed 인자로 결정성 추가 가능. */
export function pickHireCandidates(count = 3): ReadonlyArray<HireCandidate> {
  const pool = [...CANDIDATE_POOL];
  const picks: HireCandidate[] = [];
  const now = Date.now();
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const sel = pool.splice(idx, 1)[0];
    if (!sel) continue;
    picks.push({ ...sel, id: `hire-${now}-${i}`, growthRate: rollGrowthRate() });
  }
  return picks;
}

/**
 * 추천 채용 후보 — 평균 morale 높을 때 출시 시 등장.
 * CANDIDATE_POOL에서 1명 random pick + 비용 ×REFERRAL_DISCOUNT, tagline에 추천 마커.
 */
export function pickReferralCandidate(referrerName?: string): HireCandidate {
  const idx = Math.floor(Math.random() * CANDIDATE_POOL.length);
  const sel = CANDIDATE_POOL[idx] ?? CANDIDATE_POOL[0];
  if (!sel) throw new Error('CANDIDATE_POOL is empty');
  const taglinePrefix = referrerName ? `💡 ${referrerName} 추천 — ` : '💡 추천 후보 — ';
  return {
    ...sel,
    id: `referral-${Date.now()}`,
    tagline: taglinePrefix + sel.tagline,
    hireCost: Math.round(sel.hireCost * 0.5),
    // 추천 후보는 평균 이상의 성장률 (0.9~1.4) — 직원 추천이라 그만큼 자신 있는 사람.
    growthRate: Math.round((0.9 + Math.random() * 0.5) * 100) / 100,
  };
}

export const SLOT_LABEL: Readonly<Record<SlotKind, string>> = {
  planning: '기획',
  graphics: '디자인',
  qa: 'QA',
  programming: '개발',
  marketing: '마케팅',
  data: '데이터',
};

export const JOB_LABEL: Readonly<Record<Job, string>> = {
  planner: 'PM',
  designer: '디자이너',
  programmer: '개발자',
  qa: 'QA',
  marketing: '마케터',
  data: '데이터',
};

export const STANCE_LABEL: Readonly<Record<Stance, string>> = {
  progressive: '급진',
  conservative: '보수',
};

export const TRAIT_LABEL: Readonly<Record<Trait, string>> = {
  oldTimer: '고인물',
  allTalk: '입 개발',
  remoteSlacker: '재택 빌런',
  perfectionist: '완벽주의',
  'crowd-pleaser': '인기인',
  'over-thinker': '고민병',
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
export const SLOT_ICON: Readonly<Record<SlotKind, 'lightbulb' | 'brush' | 'check' | 'code' | 'megaphone' | 'chartLine'>> = {
  planning: 'lightbulb',
  graphics: 'brush',
  qa: 'check',
  programming: 'code',
  marketing: 'megaphone',
  data: 'chartLine',
};

export const JOB_ICON: Readonly<Record<Job, 'lightbulb' | 'brush' | 'check' | 'code' | 'megaphone' | 'chartLine'>> = {
  planner: 'lightbulb',
  designer: 'brush',
  programmer: 'code',
  qa: 'check',
  marketing: 'megaphone',
  data: 'chartLine',
};

export const GENRE_ICON: Readonly<Record<GenreId, 'pointer' | 'dice' | 'chat' | 'coins' | 'sparkle'>> = {
  G1: 'pointer',
  G2: 'dice',
  G3: 'chat',
  /** G4 SaaS 구독 — 구독/결제 이미지로 coins 아이콘 재활용 */
  G4: 'coins',
  /** G5 블록체인/NFT — 반짝이는 특이성으로 sparkle 아이콘 */
  G5: 'sparkle',
};

export const THEME_ICON: Readonly<Record<ThemeId, 'moon' | 'users' | 'alert' | 'star' | 'calendar'>> = {
  T1: 'moon',
  T2: 'users',
  T3: 'alert',
  /** T4 글로벌 진출 — 별(세계 무대) */
  T4: 'star',
  /** T5 인플루언서 마케팅 — 캘린더(일정 기반 마케팅) */
  T5: 'calendar',
};

export const GENRE_LABEL: Readonly<Record<GenreId, { name: string; desc: string }>> = {
  G1: { name: '광고/AdTech', desc: 'MVP 짧음, 매출 변동 大' },
  G2: { name: '커머스 플랫폼', desc: '개발 부담↑ 평판 롤러코스터' },
  G3: { name: 'AI/추천 서비스', desc: '디자인 부담↓ 알고리즘 비중↑' },
  G4: { name: 'SaaS 구독', desc: '초기 부담 ↑, 매출 안정' },
  G5: { name: '블록체인/NFT', desc: '매출 변동 大, 트렌드 영향 大' },
};

export const THEME_LABEL: Readonly<Record<ThemeId, { name: string; desc: string }>> = {
  T1: { name: '야근과 치킨', desc: '일정 압박과 어울림' },
  T2: { name: '회의가 레벨이다', desc: '진행 느림·버그 적음' },
  T3: { name: '장애 컨퍼런스콜', desc: '버그 ↑ 디버깅 시너지' },
  T4: { name: '글로벌 진출', desc: 'BugDebt ↓ Appeal ↑' },
  T5: { name: '인플루언서 마케팅', desc: 'Progress ↑ 매출 변동' },
};

/** 사무실 단계별 표시 라벨. 도메인이 직접 단계 수를 다루진 않지만 UI 일관성 확보용. */
export const OFFICE_STAGE_LABEL: Readonly<Record<OfficeLevel, string>> = {
  1: '분당 셰어오피스',
  2: '판교 임대 사무실',
  3: '강남 자가 사옥',
  4: '성수 글로벌 캠퍼스',
  5: '판교 R&D 메가 캠퍼스',
  6: '글로벌 본사 타워',
};

/**
 * 사옥 단계별 support 슬롯 활성 여부.
 *  - 1단계: support 없음
 *  - 2단계: programming + graphics support 활성
 *  - 3단계: 기존 4 슬롯 support 활성
 *  - 4~6단계: 모든 슬롯 support 활성 (고용 상한만 단계별 증가)
 */
export const SUPPORT_SLOTS_BY_OFFICE: Readonly<Record<OfficeLevel, ReadonlySet<SlotKind>>> = {
  1: new Set<SlotKind>(),
  2: new Set<SlotKind>(['programming', 'graphics']),
  3: new Set<SlotKind>(['planning', 'graphics', 'qa', 'programming']),
  4: new Set<SlotKind>(['planning', 'graphics', 'qa', 'programming', 'marketing', 'data']),
  5: new Set<SlotKind>(['planning', 'graphics', 'qa', 'programming', 'marketing', 'data']),
  6: new Set<SlotKind>(['planning', 'graphics', 'qa', 'programming', 'marketing', 'data']),
};

/** 해당 사옥 단계에서 슬롯의 support 배치가 가능한지 여부. */
export function isSupportSlotActive(officeLevel: OfficeLevel, slot: SlotKind): boolean {
  return SUPPORT_SLOTS_BY_OFFICE[officeLevel].has(slot);
}

/**
 * 사옥 단계별 활성 primary 슬롯 목록.
 *  - 1단계: 기본 4 슬롯
 *  - 2단계: + marketing (5)
 *  - 3~6단계: 6 슬롯 모두 (단계별 차이는 정원/시설 보너스로 표현)
 */
export const ACTIVE_SLOTS_BY_OFFICE: Readonly<Record<OfficeLevel, ReadonlyArray<SlotKind>>> = {
  1: ['planning', 'graphics', 'qa', 'programming'],
  2: ['planning', 'graphics', 'qa', 'programming', 'marketing'],
  3: ['planning', 'graphics', 'qa', 'programming', 'marketing', 'data'],
  4: ['planning', 'graphics', 'qa', 'programming', 'marketing', 'data'],
  5: ['planning', 'graphics', 'qa', 'programming', 'marketing', 'data'],
  6: ['planning', 'graphics', 'qa', 'programming', 'marketing', 'data'],
};

/** 해당 사옥 단계에서 슬롯이 활성(primary 배치 가능)인지 여부. */
export function isSlotActive(officeLevel: OfficeLevel, slot: SlotKind): boolean {
  return (ACTIVE_SLOTS_BY_OFFICE[officeLevel] as ReadonlyArray<string>).includes(slot);
}

/** 새 프로젝트 시작 시 GameState 생성. */
export function newProject(opts: {
  productIndex: number;
  genre: GenreId;
  theme: ThemeId;
  gold: number;
  employees: ReadonlyArray<Employee>;
  officeLevel?: OfficeLevel;
  reputation?: number;
  appealEnabled?: boolean;
  policy?: CompanyPolicy;
  trend?: TrendStatus | null;
  rnd?: RndState;
  facilities?: import('./facilities').FacilityState;
  markets?: import('./markets').MarketState;
  /** 직전 프로젝트 슬롯 배정 — 자동 복원용. */
  assignment?: import('./types').Assignment;
  /** 직전 프로젝트 support 배정 — 자동 복원용. */
  support?: import('./types').SupportAssignment;
  /** 파산 상태 — 옵셔널 (옛 데이터 호환). */
  bankruptcy?: import('./bankruptcy').BankruptcyState;
  /** 임원 압박 상태 — 옵셔널 (옛 데이터 호환). */
  exec?: import('./exec').ExecState;
  /** 경기 사이클 상태 — 옵셔널 (옛 데이터 호환). */
  economy?: import('./economy').EconomyState;
  /** 경쟁사 출시 이력 — 옵셔널 (옛 데이터 호환). */
  rivals?: import('./rivals').RivalState;
  /** 후반부 대형 계약 / 초월 국면 상태 — 옵셔널 (옛 데이터 호환). */
  lateGame?: import('./lateGame').LateGameState;
}): GameState {
  return {
    employees: opts.employees,
    assignment: opts.assignment ?? {},
    ...(opts.support ? { support: opts.support } : {}),
    project: {
      genre: opts.genre,
      theme: opts.theme,
      // (밸런스 v2) 후반부 난이도 ↑: 2작마다 +1주 (0~1작=10주, 2~3작=11주, 4~5작=12주 …).
      weeksTarget: BALANCE.tutorialWeeksTarget + Math.floor(opts.productIndex / 2),
      weeksElapsed: 0,
      progress: 0,
      bugDebt: 0,
      appeal: 0,
      appealEnabled: opts.appealEnabled ?? false,
      signals: {
        tech: 0,
        ux: 0,
        creative: 0,
        market: 0,
      },
      released: false,
    },
    gold: opts.gold,
    crunch: false,
    productIndex: opts.productIndex,
    officeLevel: opts.officeLevel ?? 1,
    reputation: opts.reputation ?? 0,
    policy: opts.policy ?? DEFAULT_POLICY,
    trend: opts.trend ?? null,
    rnd: opts.rnd ?? EMPTY_RND,
    availableAp: 0,
    ...(opts.facilities ? { facilities: opts.facilities } : {}),
    ...(opts.markets ? { markets: opts.markets } : {}),
    ...(opts.bankruptcy ? { bankruptcy: opts.bankruptcy } : {}),
    ...(opts.exec ? { exec: opts.exec } : {}),
    ...(opts.economy ? { economy: opts.economy } : {}),
    ...(opts.rivals ? { rivals: opts.rivals } : {}),
    ...(opts.lateGame ? { lateGame: opts.lateGame } : {}),
  };
}

/**
 * G1 + T1 고정 튜토리얼 시작 상태.
 * prestige 보너스가 있으면 시작 골드와 직원 skill에 반영한다.
 */
export function newTutorialGame(rnd?: RndState, prestige?: PrestigeBonus): GameState {
  const pb = prestige ?? NO_PRESTIGE;
  // 프레스티지 skillBonus를 튜토리얼 직원 base skill에 가산.
  const employees: ReadonlyArray<Employee> =
    pb.skillBonus > 0
      ? TUTORIAL_EMPLOYEES.map((e) => ({ ...e, skill: e.skill + pb.skillBonus }))
      : TUTORIAL_EMPLOYEES;
  return newProject({
    productIndex: 0,
    genre: 'G1',
    theme: 'T1',
    gold: BALANCE.tutorialStartingGold + pb.startingGoldBonus,
    employees,
    appealEnabled: false,
    officeLevel: 1,
    reputation: 0,
    rnd,
  });
}
