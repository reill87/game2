/**
 * 도메인 타입 — Phaser 비의존.
 * @see docs/PRODUCT_LOOP.md, docs/BALANCE.md
 */

/** 직원 직무. 1단계 사무실에서는 QA 직군 없음 (2단계 채용). */
export type Job = 'planner' | 'designer' | 'programmer' | 'qa';

/** 프로젝트 담당 슬롯. 4종 고정. */
export type SlotKind = 'planning' | 'graphics' | 'qa' | 'programming';

/** 직원 성향 — 모든 직원이 둘 중 하나를 보유. 일부 이벤트의 사기 영향을 좌우. */
export type Stance = 'progressive' | 'conservative';

/** 특수 트레이트 — 일부 직원만 보유. 효율·이벤트에 추가 영향. */
export type Trait =
  | 'oldTimer' // 고인물 — effective skill ×1.3
  | 'allTalk' // 입 개발 — 평소 기여 ×0.7 (해커톤 보너스 별도, PIVOT-3.5)
  | 'remoteSlacker'; // 재택 빌런 — 재택 시 5% 발현 (PIVOT-5)

/** 직급 4단계. */
export type Rank = 'newbie' | 'junior' | 'senior' | 'lead';

/** 출퇴근 모드 — 작품 단위로 토글. */
export type CommuteMode = 'office' | 'remote';

/** 복장 정책 — 회사 단위. */
export type DressCode = 'casual_free' | 'casual_guide' | 'formal';

/** 영구 구매형 복지 메뉴 (PIVOT-5). */
export interface PerkSet {
  /** 통근 셔틀버스 — 매주 stamina drain 완화. */
  readonly shuttle: boolean;
  /** 후드 팀복 — 매주 모든 직원 사기 +. */
  readonly teamHoodie: boolean;
  /** 캡슐 커피머신 — 매주 사기 +. */
  readonly espresso: boolean;
  /** 사내 식당 — 매주 사기 +. */
  readonly cafeteria: boolean;
}

/** 회사 정책 — 작품 사이에 결정, 영구 적용 (재택은 작품 단위 변경 가능). */
export interface CompanyPolicy {
  readonly commute: CommuteMode;
  readonly dressCode: DressCode;
  readonly perks: PerkSet;
}

export type GenreId = 'G1' | 'G2' | 'G3';
export type ThemeId = 'T1' | 'T2' | 'T3';

/** 출시 직전 홍보 단계 — 2작부터 노출. BALANCE.md §7. */
export type PromoTier = 'none' | 'small' | 'medium';

/** 시장 트렌드 — N개 작품 동안 유지되며 출시 매출에 곱연산 보정. */
export type TrendId =
  | 'ai_spring'
  | 'commerce_winter'
  | 'platform_consolidation'
  | 'remote_first'
  | 'data_governance'
  | 'metaverse_thaw';

export interface TrendStatus {
  readonly id: TrendId;
  /** 남은 작품 수. 0 도달 시 새 트렌드 결정. */
  readonly remainingProjects: number;
}

export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly job: Job;
  /** 1.0 = baseline. 추후 성장 시 변동. */
  readonly skill: number;
  /** 사기 — 0~100. 효율(effective skill)에 곱연산. 야근·고BugDebt에 감소, 휴식에 회복. */
  readonly morale: number;
  /** 체력 — 0~100. 효율에 곱연산. 작업 시 감소, 미배치/폴리싱에 회복. */
  readonly stamina: number;
  /** 직원 성향. 신기술 vs 안정 의사결정 사기 영향. */
  readonly stance: Stance;
  /** 직급. effective skill 곱연산 + 리더는 다른 직원에 보너스. */
  readonly rank: Rank;
  /** 정배치로 출시 완료한 프로젝트 수 — 진급 조건. */
  readonly shippedProjects: number;
  /** 특수 트레이트(선택). */
  readonly trait?: Trait;
}

/** 슬롯 → 직원 id. 빈 슬롯은 키 부재. */
export type Assignment = Partial<Record<SlotKind, string>>;

export interface ProjectState {
  readonly genre: GenreId;
  readonly theme: ThemeId;
  readonly weeksTarget: number;
  weeksElapsed: number;
  /** 0~100 (%) */
  progress: number;
  /** 0~100 */
  bugDebt: number;
  /** 0~100, 튜토리얼 동안은 0 고정 */
  appeal: number;
  /** 두 번째 작품부터 true */
  appealEnabled: boolean;
  released: boolean;
}

export interface GameState {
  readonly employees: ReadonlyArray<Employee>;
  readonly assignment: Assignment;
  readonly project: ProjectState;
  readonly gold: number;
  /** 야근 토글. UI는 2작부터 노출. */
  readonly crunch: boolean;
  /** 0 = 첫 작품 (튜토리얼). 출시 직후 +1. UI/도메인 분기에 사용. */
  readonly productIndex: number;
  /** 사무실 단계 — 1: 분당 셰어, 2: 판교 임대. burn rate 계산에 사용. */
  readonly officeLevel: 1 | 2;
  /** 회사 누적 명성 (작품 사이 영구 누적). 매출 보너스에 사용. */
  readonly reputation: number;
  /** 회사 정책(출퇴근/복장/복지). 작품 사이 결정, 매주 효과. */
  readonly policy: CompanyPolicy;
  /** 진행 중인 시장 트렌드 — 출시 매출에 보정. null이면 트렌드 없음. */
  readonly trend: TrendStatus | null;
}
