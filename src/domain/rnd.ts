/**
 * R&D 카탈로그 — 영구 업그레이드 시스템.
 * 한 번 구매하면 이후 모든 프로젝트에 효과 적용.
 */

export type RndId =
  | 'test-automation'
  | 'ci-cd'
  | 'design-system'
  | 'process-standard'
  | 'employer-branding'
  | 'finance-automation'
  | 'data-driven'
  | 'global-expansion'
  // Tier 2
  | 'ai-pair-programming'
  | 'auto-design-tools'
  | 'continuous-integration'
  | 'analytics-platform'
  | 'i18n-platform'
  | 'security-program'
  | 'cloud-migration'
  | 'remote-collaboration'
  // Tier 3
  | 'self-cloud-infra'
  | 'global-hr-network'
  | 'autonomous-deploy'
  | 'ai-pm-assistant';

export interface RndItem {
  readonly id: RndId;
  readonly name: string;
  readonly desc: string;
  readonly cost: number;
  /** 한 줄 효과 요약(UI 표시). */
  readonly effectLabel: string;
  /** 의존: 이 R&D들 먼저 구매해야 노출(0개면 즉시 노출). */
  readonly requires?: ReadonlyArray<RndId>;
  /** productCount 게이트 — 너무 빨리 풀리는 거 방지. */
  readonly minProductCount?: number;
}

export const RND_ITEMS: ReadonlyArray<RndItem> = [
  {
    id: 'test-automation',
    name: '테스트 자동화',
    desc: '회귀 테스트를 CI에 포함. 매주 BugDebt 자연 증가가 줄어든다.',
    cost: 250,
    effectLabel: 'BugDebt /주 −1',
    minProductCount: 2,
  },
  {
    id: 'ci-cd',
    name: 'CI/CD 파이프라인',
    desc: '빌드·배포를 자동화. 매주 Progress가 약간 더 잘 나온다.',
    cost: 350,
    effectLabel: 'Progress 배수 ×1.05',
    requires: ['test-automation'],
    minProductCount: 4,
  },
  {
    id: 'design-system',
    name: '사내 디자인 시스템',
    desc: '컴포넌트 재사용. Appeal 누적이 빨라진다.',
    cost: 300,
    effectLabel: 'Appeal /주 +0.4',
    minProductCount: 3,
  },
  {
    id: 'process-standard',
    name: '개발 표준화',
    desc: '직군 외 슬롯에서 일하는 사람의 손실을 줄인다.',
    cost: 200,
    effectLabel: '오배치 기여 ×0.5 → ×0.65',
    minProductCount: 2,
  },
  {
    id: 'employer-branding',
    name: '고용 브랜딩',
    desc: '입사 지원 풀이 좋아져 채용 비용이 낮아진다.',
    cost: 400,
    effectLabel: '채용 비용 ×0.7',
    minProductCount: 5,
  },
  {
    id: 'finance-automation',
    name: '재무 자동화',
    desc: '운영비를 줄여 매주 burn rate를 깎는다.',
    cost: 300,
    effectLabel: 'Burn Rate ×0.85',
    minProductCount: 4,
  },
  {
    id: 'data-driven',
    name: '데이터 기반 의사결정',
    desc: '시장 트렌드를 읽고 사업 결정. 트렌드 매출 보정 효과가 강해진다.',
    cost: 500,
    effectLabel: '트렌드 매출 배수 ×1.2',
    requires: ['design-system'],
    minProductCount: 6,
  },
  {
    id: 'global-expansion',
    name: '글로벌 진출',
    desc: '해외 시장 매출 채널 확보. 모든 출시 매출 +15%.',
    cost: 700,
    effectLabel: '매출 ×1.15',
    requires: ['data-driven'],
    minProductCount: 10,
  },
  // ── Tier 2 ────────────────────────────────────────────────────────────────
  {
    id: 'ai-pair-programming',
    name: 'AI 페어 프로그래밍',
    desc: 'AI가 코드 리뷰와 자동완성을 지원. BugDebt 주간 감소량 추가 +2.',
    cost: 3000,
    effectLabel: 'BugDebt /주 −2 추가 (합 −3)',
    requires: ['test-automation', 'ci-cd'],
    minProductCount: 8,
  },
  {
    id: 'auto-design-tools',
    name: '자동 디자인 도구',
    desc: '디자인 컴포넌트 자동 생성. Appeal 주간 누적 +0.6 추가.',
    cost: 2500,
    effectLabel: 'Appeal /주 +0.6 추가',
    requires: ['design-system'],
    minProductCount: 8,
  },
  {
    id: 'continuous-integration',
    name: '지속 통합 강화',
    desc: '통합 파이프라인 추가 강화. Progress 배수 추가 ×1.08.',
    cost: 1800,
    effectLabel: 'Progress 배수 ×1.08 추가',
    requires: ['ci-cd'],
    minProductCount: 6,
  },
  {
    id: 'analytics-platform',
    name: '분석 플랫폼',
    desc: '고도화 데이터 분석으로 트렌드 대응력 극대화. 트렌드 매출 배수 ×1.3.',
    cost: 2000,
    effectLabel: '트렌드 매출 배수 ×1.3',
    requires: ['data-driven'],
    minProductCount: 9,
  },
  {
    id: 'i18n-platform',
    name: '다국어화 플랫폼',
    desc: '전 세계 언어 지원 인프라. 매출 ×1.25.',
    cost: 4000,
    effectLabel: '매출 ×1.25',
    requires: ['global-expansion'],
    minProductCount: 12,
  },
  {
    id: 'security-program',
    name: '보안 프로그램',
    desc: '취약점 스캔·대응 체계 구축. 위기 발동 확률 ×0.5.',
    cost: 3500,
    effectLabel: '위기 발동 확률 ×0.5',
    requires: ['test-automation'],
    minProductCount: 10,
  },
  {
    id: 'cloud-migration',
    name: '클라우드 마이그레이션',
    desc: '온프레미스 인프라를 클라우드로 이전. Burn Rate ×0.7.',
    cost: 5000,
    effectLabel: 'Burn Rate ×0.7',
    requires: ['finance-automation'],
    minProductCount: 10,
  },
  {
    id: 'remote-collaboration',
    name: '원격 협업 강화',
    desc: '비동기 협업 툴과 문화 정착. 채용 비용 ×0.5.',
    cost: 2500,
    effectLabel: '채용 비용 ×0.5',
    requires: ['employer-branding'],
    minProductCount: 8,
  },
  // ── Tier 3 ────────────────────────────────────────────────────────────────
  {
    id: 'self-cloud-infra',
    name: '자체 클라우드 인프라',
    desc: '전용 클라우드 구축으로 운영 비용 대폭 절감. Burn Rate ×0.6.',
    cost: 15000,
    effectLabel: 'Burn Rate ×0.6',
    requires: ['cloud-migration'],
    minProductCount: 15,
  },
  {
    id: 'global-hr-network',
    name: '글로벌 채용 네트워크',
    desc: '전 세계 인재 파이프라인. 채용 비용 ×0.4 + 후보 성장률 +0.2.',
    cost: 25000,
    effectLabel: '채용 비용 ×0.4, 후보 성장률 +0.2',
    requires: ['remote-collaboration'],
    minProductCount: 18,
  },
  {
    id: 'autonomous-deploy',
    name: '자율 배포 시스템',
    desc: '출시 후 운영 결정 결과를 강화. 좋은 결과는 더 좋게, 나쁜 결과는 덜 나쁘게.',
    cost: 20000,
    effectLabel: '출시 후 매출 modifier 강화',
    requires: ['self-cloud-infra', 'ai-pair-programming'],
    minProductCount: 20,
  },
  {
    id: 'ai-pm-assistant',
    name: 'AI PM 어시스턴트',
    desc: 'AI가 스프린트 계획을 최적화. 모든 sprint phase 슬롯 가중치 ×1.1.',
    cost: 30000,
    effectLabel: 'Sprint 슬롯 가중치 ×1.1',
    requires: ['continuous-integration', 'analytics-platform'],
    minProductCount: 22,
  },
];

export interface RndState {
  readonly purchased: ReadonlyArray<RndId>;
}

export const EMPTY_RND: RndState = { purchased: [] };

export function isRndPurchased(rnd: RndState | undefined, id: RndId): boolean {
  return !!rnd?.purchased.includes(id);
}

export function isRndAvailable(
  rnd: RndState | undefined,
  item: RndItem,
  productCount: number,
): boolean {
  if (item.minProductCount !== undefined && productCount < item.minProductCount) return false;
  if (item.requires) {
    for (const req of item.requires) if (!isRndPurchased(rnd, req)) return false;
  }
  return true;
}

/** R&D 항목의 티어 반환. T2/T3 화이트리스트로 판정. */
export function getRndTier(id: RndId): 1 | 2 | 3 {
  const T3_IDS: ReadonlySet<RndId> = new Set([
    'self-cloud-infra',
    'global-hr-network',
    'autonomous-deploy',
    'ai-pm-assistant',
  ]);
  const T2_IDS: ReadonlySet<RndId> = new Set([
    'ai-pair-programming',
    'auto-design-tools',
    'continuous-integration',
    'analytics-platform',
    'i18n-platform',
    'security-program',
    'cloud-migration',
    'remote-collaboration',
  ]);
  if (T3_IDS.has(id)) return 3;
  if (T2_IDS.has(id)) return 2;
  return 1;
}

/** RndState에 새 항목 추가 (불변 복사). */
export function purchaseRnd(rnd: RndState, id: RndId): RndState {
  if (rnd.purchased.includes(id)) return rnd;
  return { purchased: [...rnd.purchased, id] };
}
