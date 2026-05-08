/**
 * 마일스톤 — 회사 성장의 "처음 일어난 일"들을 감지하고 명성 보너스를 부여.
 * ResultScene 진입 시 detectNewMilestones()를 호출해 신규 달성 목록을 얻는다.
 */
import type { GameState } from './types';
import type { SavedResult } from '@/save';

export type MilestoneId =
  | 'first-release'
  | 'first-five-star'
  | 'first-1000g'
  | 'first-10000g'
  | 'first-lead'
  | 'first-employee-hired'
  | 'first-rnd'
  | 'first-office-2'
  | 'first-office-3'
  | 'first-100reputation';

export interface Milestone {
  readonly id: MilestoneId;
  readonly title: string;
  readonly desc: string;
  readonly reputationBonus: number;
}

export const MILESTONES: ReadonlyArray<Milestone> = [
  { id: 'first-release', title: '첫 출시', desc: '회사가 첫 작품을 세상에 내놓다.', reputationBonus: 5 },
  { id: 'first-five-star', title: '첫 ★5', desc: '리뷰가 별 다섯을 기록.', reputationBonus: 15 },
  { id: 'first-1000g', title: '첫 1,000골드', desc: '누적 매출 1,000g 돌파.', reputationBonus: 5 },
  { id: 'first-10000g', title: '첫 10,000골드', desc: '누적 매출 10,000g 돌파.', reputationBonus: 20 },
  { id: 'first-lead', title: '첫 리더 배출', desc: '직원 한 명이 리더로 진급.', reputationBonus: 10 },
  { id: 'first-employee-hired', title: '첫 채용', desc: '바깥에서 사람을 들이다.', reputationBonus: 5 },
  { id: 'first-rnd', title: '첫 R&D 도입', desc: '회사가 영구 능력치를 강화.', reputationBonus: 5 },
  { id: 'first-office-2', title: '판교 임대', desc: '분당 셰어를 떠나 판교로.', reputationBonus: 10 },
  { id: 'first-office-3', title: '강남 자가', desc: '회사가 자기 사옥을 갖다.', reputationBonus: 25 },
  { id: 'first-100reputation', title: '명성 100', desc: '업계에서 이름이 회자됨.', reputationBonus: 0 },
];

/**
 * 이번 ResultScene 진입 시점에 새로 달성된 마일스톤 목록 반환.
 * @param prevMilestones 저장된 누적 마일스톤 ID 셋.
 */
export function detectNewMilestones(opts: {
  prevMilestones: ReadonlyArray<MilestoneId>;
  state: GameState;
  totalRevenue: number;
  history: ReadonlyArray<SavedResult>;
  hiredEmployeeCount: number;
  rndPurchasedCount: number;
}): ReadonlyArray<Milestone> {
  const prev = new Set(opts.prevMilestones);
  const earned: Milestone[] = [];

  const award = (id: MilestoneId): void => {
    if (prev.has(id)) return;
    const ms = MILESTONES.find((m) => m.id === id);
    if (ms) earned.push(ms);
  };

  if (opts.history.length >= 1) award('first-release');
  if (opts.history.some((h) => h.stars === 5)) award('first-five-star');
  if (opts.totalRevenue >= 1000) award('first-1000g');
  if (opts.totalRevenue >= 10000) award('first-10000g');
  if (opts.state.employees.some((e) => e.rank === 'lead')) award('first-lead');
  if (opts.hiredEmployeeCount >= 1) award('first-employee-hired');
  if (opts.rndPurchasedCount >= 1) award('first-rnd');
  if (opts.state.officeLevel >= 2) award('first-office-2');
  if (opts.state.officeLevel >= 3) award('first-office-3');
  if (opts.state.reputation >= 100) award('first-100reputation');

  return earned;
}
