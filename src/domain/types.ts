/**
 * 도메인 타입 — Phaser 비의존.
 * @see docs/PRODUCT_LOOP.md, docs/BALANCE.md
 */

/** 직원 직무. v1 튜토리얼은 사운드 직군 없음. */
export type Job = 'planner' | 'designer' | 'programmer' | 'sound';

/** 작품 담당 슬롯. 4종 고정. */
export type SlotKind = 'planning' | 'graphics' | 'sound' | 'programming';

export type GenreId = 'G1' | 'G2' | 'G3';
export type ThemeId = 'T1' | 'T2' | 'T3';

export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly job: Job;
  /** 1.0 = baseline. 추후 성장 시 변동. */
  readonly skill: number;
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
  /** 야근 토글. v1 튜토리얼은 OFF 고정 노출 안 함. */
  readonly crunch: boolean;
}
