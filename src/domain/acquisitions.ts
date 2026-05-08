/**
 * 자회사 인수 시스템 — IPO 엔딩 이후 골드 싱크 + 직원 영입 + 명성 부스트.
 */
import type { Employee } from './types';

export type AcquisitionId =
  | 'small-design-shop'
  | 'mid-dev-house'
  | 'overseas-studio'
  | 'big-platform'
  | 'startup-unicorn';

export interface Acquisition {
  readonly id: AcquisitionId;
  readonly name: string;
  readonly desc: string;
  readonly cost: number;
  /** 영입 직원 수 (자동으로 high-skill mid-rank 직원 N명 추가). */
  readonly empCount: number;
  /** 일회성 명성 보너스. */
  readonly reputationGain: number;
  /** 누적 매출 게이트. */
  readonly minTotalRevenue: number;
}

export const ACQUISITIONS: ReadonlyArray<Acquisition> = [
  {
    id: 'small-design-shop',
    name: '소형 디자인 샵',
    desc: '신생 디자인 스튜디오 인수 — 디자이너 1~2명 영입.',
    cost: 25000,
    empCount: 2,
    reputationGain: 30,
    minTotalRevenue: 25000,
  },
  {
    id: 'mid-dev-house',
    name: '중형 개발 하우스',
    desc: '실력 있는 개발 회사 인수 — 시니어 2~3명 영입.',
    cost: 60000,
    empCount: 3,
    reputationGain: 80,
    minTotalRevenue: 60000,
  },
  {
    id: 'overseas-studio',
    name: '해외 스튜디오',
    desc: '글로벌 거점 확보 — 글로벌 인재 3명 영입.',
    cost: 100000,
    empCount: 3,
    reputationGain: 120,
    minTotalRevenue: 100000,
  },
  {
    id: 'big-platform',
    name: '대형 플랫폼',
    desc: '경쟁사 흡수 — 리드 2명 영입 + 시장 점유.',
    cost: 200000,
    empCount: 4,
    reputationGain: 250,
    minTotalRevenue: 200000,
  },
  {
    id: 'startup-unicorn',
    name: '유니콘 스타트업',
    desc: '주가 상승 + 직원 5명 영입.',
    cost: 500000,
    empCount: 5,
    reputationGain: 500,
    minTotalRevenue: 500000,
  },
];

export interface AcquisitionState {
  readonly completed: ReadonlyArray<AcquisitionId>;
}

export const EMPTY_ACQUISITIONS: AcquisitionState = { completed: [] };

export function isAcquisitionCompleted(s: AcquisitionState | undefined, id: AcquisitionId): boolean {
  return !!s?.completed.includes(id);
}

export function isAcquisitionAvailable(
  s: AcquisitionState | undefined,
  a: Acquisition,
  totalRevenue: number,
): boolean {
  if (s?.completed.includes(a.id)) return false;
  if (totalRevenue < a.minTotalRevenue) return false;
  return true;
}

export function completeAcquisition(s: AcquisitionState, id: AcquisitionId): AcquisitionState {
  if (s.completed.includes(id)) return s;
  return { completed: [...s.completed, id] };
}

/**
 * 인수 시 자동 생성되는 직원 (랜덤 직군 + senior/lead rank, 적당히 좋은 능력치).
 * 이름은 인수 회사명 기반 + 랜덤 surname.
 */
export function generateAcquiredEmployees(acq: Acquisition): ReadonlyArray<Employee> {
  const jobs: ReadonlyArray<Employee['job']> = ['planner', 'designer', 'programmer', 'qa'];
  const surnames = ['김', '이', '박', '최', '정', '강', '조', '윤'];
  const tags = ['에이스', '리드', '베테랑', '시니어', '프로'];
  const result: Employee[] = [];
  const now = Date.now();
  for (let i = 0; i < acq.empCount; i++) {
    const job = jobs[Math.floor(Math.random() * jobs.length)] ?? 'programmer';
    const surname = surnames[Math.floor(Math.random() * surnames.length)] ?? '김';
    const tag = tags[Math.floor(Math.random() * tags.length)] ?? '시니어';
    const skill = 1.3 + Math.random() * 0.3;  // 1.3~1.6
    const growthRate = 0.9 + Math.random() * 0.4;  // 0.9~1.3
    const rank: Employee['rank'] = Math.random() < 0.4 ? 'lead' : 'senior';
    result.push({
      id: `acq-${acq.id}-${now}-${i}`,
      name: `${surname}${tag}`,
      job,
      skill,
      morale: 80,
      stamina: 80,
      stance: Math.random() < 0.5 ? 'progressive' : 'conservative',
      rank,
      shippedProjects: rank === 'lead' ? 8 : 5,
      growthRate,
    });
  }
  return result;
}
