/**
 * 글로벌 시장 진출 시스템 — 진출한 시장만큼 매출 곱연산 적용.
 * 한 번 진출하면 이후 모든 프로젝트에 효과 영구 적용.
 */

export type MarketId = 'jp' | 'us' | 'eu' | 'sea';

export interface Market {
  readonly id: MarketId;
  readonly name: string;
  readonly desc: string;
  readonly cost: number;
  /** 진출 시 매출 곱연산 배수. */
  readonly revenueMul: number;
  readonly minProductCount?: number;
  readonly minReputation?: number;
}

export const MARKETS: ReadonlyArray<Market> = [
  {
    id: 'jp',
    name: '일본 시장',
    desc: '인접 시장 — 진출 부담 낮음, 안정 매출.',
    cost: 5000,
    revenueMul: 1.20,
    minProductCount: 8,
    minReputation: 50,
  },
  {
    id: 'sea',
    name: '동남아 시장',
    desc: '신흥 시장 — 변동성 있지만 성장률 ↑.',
    cost: 8000,
    revenueMul: 1.15,
    minProductCount: 10,
    minReputation: 80,
  },
  {
    id: 'eu',
    name: 'EU 시장',
    desc: '규제 엄격 — 진출 비용 ↑, 안정적 매출.',
    cost: 20000,
    revenueMul: 1.25,
    minProductCount: 15,
    minReputation: 150,
  },
  {
    id: 'us',
    name: '미국 시장',
    desc: '최대 시장 — 비용 ↑, 매출도 ↑.',
    cost: 12000,
    revenueMul: 1.30,
    minProductCount: 12,
    minReputation: 100,
  },
];

export interface MarketState {
  readonly entered: ReadonlyArray<MarketId>;
}

export const EMPTY_MARKETS: MarketState = { entered: [] };

export function isMarketEntered(ms: MarketState | undefined, id: MarketId): boolean {
  return !!ms?.entered.includes(id);
}

export function isMarketAvailable(
  ms: MarketState | undefined,
  m: Market,
  productCount: number,
  reputation: number,
): boolean {
  if (isMarketEntered(ms, m.id)) return false;
  if (m.minProductCount !== undefined && productCount < m.minProductCount) return false;
  if (m.minReputation !== undefined && reputation < m.minReputation) return false;
  return true;
}

export function enterMarket(ms: MarketState, id: MarketId): MarketState {
  if (ms.entered.includes(id)) return ms;
  return { entered: [...ms.entered, id] };
}

/**
 * 진출한 시장의 매출 곱 합산.
 * 모든 시장 진출 시 ≈ 1.20 × 1.15 × 1.25 × 1.30 ≈ 2.24×.
 */
export function computeMarketRevenueMul(ms: MarketState | undefined): number {
  if (!ms || ms.entered.length === 0) return 1;
  const idMap = new Map(MARKETS.map((m) => [m.id, m] as const));
  let mul = 1;
  for (const id of ms.entered) {
    const m = idMap.get(id);
    if (m) mul *= m.revenueMul;
  }
  return mul;
}
