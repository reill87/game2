/**
 * 경쟁사 시스템 — 매 분기 라이벌 출시, 시장 점유율 분배.
 */
import type { GenreId, ThemeId } from './types';

export type RivalId = 'kakao-clone' | 'naver-clone' | 'startup-rocket' | 'global-giant' | 'gov-corp';

/** 라이벌 강점. 자기 작품 점수 계산에 사용. */
export type RivalStrength = 'design' | 'tech' | 'marketing' | 'data' | 'operations';

export interface Rival {
  readonly id: RivalId;
  readonly name: string;
  readonly desc: string;
  readonly strength: RivalStrength;
  /** 자기 작품 평균 별점(1~5). 강점에 따라 차등. */
  readonly avgStars: number;
  /** 자기 작품 매출 평균 (g). */
  readonly avgRevenue: number;
  /** 선호 장르·테마 — 자기 작품에 자주 등장. */
  readonly preferredGenres: ReadonlyArray<GenreId>;
  readonly preferredThemes: ReadonlyArray<ThemeId>;
}

export const RIVALS: ReadonlyArray<Rival> = [
  {
    id: 'kakao-clone',
    name: '카오톡 컴퍼니',
    desc: '대형 IT — 광고/AdTech 강세, 안정적 매출',
    strength: 'marketing',
    avgStars: 3.5,
    avgRevenue: 800,
    preferredGenres: ['G1', 'G2'],
    preferredThemes: ['T1', 'T2'],
  },
  {
    id: 'naver-clone',
    name: '네이비 코프',
    desc: 'AI/추천 강자',
    strength: 'data',
    avgStars: 4.0,
    avgRevenue: 1000,
    preferredGenres: ['G3', 'G4'],
    preferredThemes: ['T2', 'T4'],
  },
  {
    id: 'startup-rocket',
    name: '스타트로켓',
    desc: '빠른 출시·실험 — 변동성 大',
    strength: 'tech',
    avgStars: 3.0,
    avgRevenue: 600,
    preferredGenres: ['G3', 'G5'],
    preferredThemes: ['T3', 'T5'],
  },
  {
    id: 'global-giant',
    name: '글로벌 GIANT',
    desc: '글로벌 진출 완료 — 규모 강점',
    strength: 'operations',
    avgStars: 4.5,
    avgRevenue: 2000,
    preferredGenres: ['G2', 'G4'],
    preferredThemes: ['T2', 'T4'],
  },
  {
    id: 'gov-corp',
    name: '정부 출자 SI',
    desc: '안정적이지만 매출 작음',
    strength: 'operations',
    avgStars: 2.5,
    avgRevenue: 400,
    preferredGenres: ['G1', 'G2'],
    preferredThemes: ['T1', 'T2'],
  },
];

export interface RivalRelease {
  readonly rivalId: RivalId;
  readonly genre: GenreId;
  readonly theme: ThemeId;
  readonly stars: number;     // 라이벌 작품 별점
  readonly revenue: number;   // 라이벌 작품 매출
  readonly quarter: number;   // 출시 분기 (productCount)
}

export interface RivalState {
  /** 최근 라이벌 출시 이력. cap 20. */
  readonly recentReleases: ReadonlyArray<RivalRelease>;
}

export const EMPTY_RIVALS: RivalState = { recentReleases: [] };

function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function pickSeeded<T>(items: ReadonlyArray<T>, seed: string): T | undefined {
  if (items.length === 0) return undefined;
  const idx = Math.min(items.length - 1, Math.floor(seededUnit(seed) * items.length));
  return items[idx];
}

/**
 * 이번 분기 라이벌 출시 예고. productCount+rivalId 기반 결정값이라
 * 장르 선택 화면에서 본 예고와 결과 화면의 실제 경쟁작이 일치한다.
 */
export function forecastRivalReleases(productCount: number): ReadonlyArray<RivalRelease> {
  const releases: RivalRelease[] = [];
  const scaleMul = 1 + Math.max(0, productCount) * 0.045;
  const qualityRamp = Math.min(0.8, Math.max(0, productCount) * 0.025);

  for (const rival of RIVALS) {
    const releaseChance = Math.min(0.72, 0.42 + productCount * 0.012);
    if (seededUnit(`${productCount}:${rival.id}:release`) > releaseChance) continue;

    const genre = pickSeeded(rival.preferredGenres, `${productCount}:${rival.id}:genre`) ?? 'G1';
    const theme = pickSeeded(rival.preferredThemes, `${productCount}:${rival.id}:theme`) ?? 'T1';
    const volatility = (seededUnit(`${productCount}:${rival.id}:stars`) - 0.5) * 1.4;
    const stars = Math.max(1, Math.min(5, Math.round(rival.avgStars + qualityRamp + volatility)));
    const revenueVariance = 0.75 + seededUnit(`${productCount}:${rival.id}:revenue`) * 0.65;
    const revenue = Math.round(rival.avgRevenue * scaleMul * revenueVariance);

    releases.push({ rivalId: rival.id, genre, theme, stars, revenue, quarter: productCount });
  }
  return releases;
}

/**
 * 매 출시마다 호출. 이번 분기 예고된 라이벌 출시를 최근 이력에 반영한다.
 */
export function tickRivalReleases(prev: RivalState | undefined, productCount: number): RivalState {
  const cur = prev ?? EMPTY_RIVALS;
  const newReleases = forecastRivalReleases(productCount);
  // 누적 + cap 20
  const allReleases = [...cur.recentReleases, ...newReleases].slice(-20);
  return { recentReleases: allReleases };
}

/**
 * 우리 출시와 같은 분기에 같은 장르·테마 매치된 라이벌 작품들 찾기.
 * 우리보다 별점 높은 라이벌 수에 따라 매출 점유율 ↓.
 */
export function computeMarketShareEffect(
  ourGenre: GenreId,
  ourTheme: ThemeId,
  ourStars: number,
  ourQuarter: number,
  rivals: RivalState | undefined,
): {
  /** 우리 매출에 곱할 점유율 배수 (0.5~1.0). */
  readonly revenueMul: number;
  /** 우리보다 잘한 라이벌 수 — 명성 영향. */
  readonly betterRivalCount: number;
  /** 매치된 라이벌 출시 목록 — UI 표시용. */
  readonly matchedReleases: ReadonlyArray<RivalRelease>;
} {
  if (!rivals?.recentReleases.length) return { revenueMul: 1, betterRivalCount: 0, matchedReleases: [] };
  // 같은 분기 ±1 내, 같은 장르 또는 테마 매치된 라이벌
  const matched = rivals.recentReleases.filter((r) => {
    if (Math.abs(r.quarter - ourQuarter) > 1) return false;
    return r.genre === ourGenre || r.theme === ourTheme;
  });
  if (matched.length === 0) return { revenueMul: 1, betterRivalCount: 0, matchedReleases: [] };
  // 매치 라이벌 수에 따라 점유율 ↓ (3개 매치 시 0.7, 5개 시 0.5).
  const revenueMul = rivalPressureRevenueMul(matched.length);
  const betterRivalCount = matched.filter((r) => r.stars > ourStars).length;
  return { revenueMul, betterRivalCount, matchedReleases: matched };
}

function rivalPressureRevenueMul(matchedReleaseCount: number): number {
  return matchedReleaseCount === 0
    ? 1
    : Math.max(0.5, 1 - matchedReleaseCount * 0.1);
}

export function forecastRivalPressure(
  genre: GenreId,
  theme: ThemeId,
  productCount: number,
  rivals?: RivalState,
): {
  readonly releases: ReadonlyArray<RivalRelease>;
  readonly matchedReleases: ReadonlyArray<RivalRelease>;
  readonly revenueMul: number;
  readonly pressure: '낮음' | '보통' | '높음' | '정면승부';
} {
  const currentReleases = forecastRivalReleases(productCount);
  const priorRelevant = (rivals?.recentReleases ?? []).filter(
    (r) => Math.abs(r.quarter - productCount) <= 1,
  );
  const releases = [...priorRelevant, ...currentReleases];
  const matchedReleases = releases.filter((r) => r.genre === genre || r.theme === theme);
  const revenueMul = rivalPressureRevenueMul(matchedReleases.length);
  const strongest = matchedReleases.reduce((max, r) => Math.max(max, r.stars), 0);
  const pressure =
    matchedReleases.length >= 3 || strongest >= 5
      ? '정면승부'
      : matchedReleases.length >= 2 || strongest >= 4
        ? '높음'
        : matchedReleases.length === 1
          ? '보통'
          : '낮음';
  return { releases, matchedReleases, revenueMul, pressure };
}
