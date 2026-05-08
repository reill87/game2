/**
 * 장르·테마 해금 규칙 — productCount(출시 누계) 기반 점진 해금.
 * 0이면 처음부터 선택 가능, N이면 N작 출시 후 해금.
 */
import type { GenreId, ThemeId } from './types';

export interface UnlockRule {
  /** productCount(출시 누계)가 이 값 이상이어야 노출. 0이면 처음부터 해금. */
  readonly minProductCount: number;
}

export const GENRE_UNLOCK: Readonly<Record<GenreId, UnlockRule>> = {
  G1: { minProductCount: 0 },
  G2: { minProductCount: 0 },
  G3: { minProductCount: 0 },
  G4: { minProductCount: 5 },
  G5: { minProductCount: 12 },
};

export const THEME_UNLOCK: Readonly<Record<ThemeId, UnlockRule>> = {
  T1: { minProductCount: 0 },
  T2: { minProductCount: 0 },
  T3: { minProductCount: 0 },
  T4: { minProductCount: 8 },
  T5: { minProductCount: 15 },
};

export function isGenreUnlocked(id: GenreId, productCount: number): boolean {
  return productCount >= GENRE_UNLOCK[id].minProductCount;
}

export function isThemeUnlocked(id: ThemeId, productCount: number): boolean {
  return productCount >= THEME_UNLOCK[id].minProductCount;
}
