import type { Job, SlotKind } from './types';

/** 슬롯별 정배치 직무 (v1 이진 매칭). marketing/data 신규 추가. */
const MATCH: Readonly<Record<SlotKind, Job>> = {
  planning: 'planner',
  graphics: 'designer',
  qa: 'qa',
  programming: 'programmer',
  marketing: 'marketing',
  data: 'data',
};

/**
 * 슬롯 순서 — 6종.
 * 기존 4종 앞, marketing/data 뒤.
 * SLOT_ORDER를 순회하는 advanceWeek/computeSlotContributions가 자동으로
 * 새 슬롯을 처리하므로 tick.ts/result.ts 변경 불필요.
 */
export const SLOT_ORDER: ReadonlyArray<SlotKind> = [
  'planning',
  'graphics',
  'qa',
  'programming',
  'marketing',
  'data',
];

export function isMatched(slot: SlotKind, job: Job): boolean {
  return MATCH[slot] === job;
}

export function expectedJob(slot: SlotKind): Job {
  return MATCH[slot];
}
