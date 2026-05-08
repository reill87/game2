import type { Job, SlotKind } from './types';

/** 슬롯별 정배치 직무 (v1 이진 매칭). */
const MATCH: Readonly<Record<SlotKind, Job>> = {
  planning: 'planner',
  graphics: 'designer',
  qa: 'qa',
  programming: 'programmer',
};

export const SLOT_ORDER: ReadonlyArray<SlotKind> = [
  'planning',
  'graphics',
  'qa',
  'programming',
];

export function isMatched(slot: SlotKind, job: Job): boolean {
  return MATCH[slot] === job;
}

export function expectedJob(slot: SlotKind): Job {
  return MATCH[slot];
}
