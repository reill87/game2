/**
 * Sprint 단계 — 프로젝트 진행률에 따라 4단계로 구분.
 * 단계별 슬롯 효율 가중치를 적용해 어떤 직군이 이번 단계에 핵심인지 반영한다.
 */
import type { SlotKind } from './types';

export type SprintPhase = 'planning' | 'design' | 'build' | 'qa';

export const SPRINT_PHASES: ReadonlyArray<SprintPhase> = ['planning', 'design', 'build', 'qa'];

export const SPRINT_PHASE_LABEL: Readonly<Record<SprintPhase, string>> = {
  planning: '기획 단계',
  design: '디자인 단계',
  build: '개발 단계',
  qa: 'QA 단계',
};

/**
 * 단계별 슬롯 효율 배수.
 * effectiveSkill 계산 후 추가 곱연산.
 */
export const SPRINT_SLOT_WEIGHT: Readonly<Record<SprintPhase, Readonly<Record<SlotKind, number>>>> = {
  planning: { planning: 1.5, graphics: 0.7, programming: 0.7, qa: 0.7 },
  design:   { planning: 0.85, graphics: 1.5, programming: 0.85, qa: 0.85 },
  build:    { planning: 0.85, graphics: 0.7, programming: 1.5, qa: 1.0 },
  qa:       { planning: 0.7, graphics: 0.7, programming: 1.1, qa: 1.5 },
};

/**
 * 진행률(0~100)로 현재 sprint 단계를 결정한다.
 *  - 0~25%:  planning
 *  - 25~50%: design
 *  - 50~80%: build
 *  - 80~100%: qa
 */
export function getSprintPhase(progress: number): SprintPhase {
  if (progress < 25) return 'planning';
  if (progress < 50) return 'design';
  if (progress < 80) return 'build';
  return 'qa';
}
