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

export type GenreId = 'G1' | 'G2' | 'G3';
export type ThemeId = 'T1' | 'T2' | 'T3';

/** 출시 직전 홍보 단계 — 2작부터 노출. BALANCE.md §7. */
export type PromoTier = 'none' | 'small' | 'medium';

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
}
