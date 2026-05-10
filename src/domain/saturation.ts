/**
 * 시장 포화 도메인.
 * 같은 장르·테마 반복 출시 시 매출 점차 감소.
 */
import type { SavedResult } from '@/save';
import type { GenreId, ThemeId } from './types';

/**
 * 최근 N개 출시 history에서 같은 장르·테마 카운트해 매출 배수 계산.
 * - 같은 장르가 최근 5개 중 3개면 ×0.85
 * - 같은 테마가 최근 5개 중 3개면 ×0.9
 * - 같은 장르 + 같은 테마 둘 다 반복 시 곱셈 누적
 */
export function computeSaturationMultiplier(
  history: ReadonlyArray<SavedResult>,
  genre: GenreId,
  theme: ThemeId,
): number {
  const recent = history.slice(-5);
  const sameGenre = recent.filter((r) => r.genre === genre).length;
  const sameTheme = recent.filter((r) => r.theme === theme).length;
  let mul = 1;
  if (sameGenre >= 3) mul *= 1 - (sameGenre - 2) * 0.15; // 3개=0.85, 4개=0.70, 5개=0.55
  if (sameTheme >= 3) mul *= 1 - (sameTheme - 2) * 0.10; // 3개=0.90, 4개=0.80, 5개=0.70
  return Math.max(0.3, mul);
}

/**
 * 포화 힌트 문자열 — GenreSelectScene 미리보기용.
 * 포화 없으면 null 반환.
 */
export function saturationHint(
  history: ReadonlyArray<SavedResult>,
  genre: GenreId,
  theme: ThemeId,
): string | null {
  const recent = history.slice(-5);
  const sameGenre = recent.filter((r) => r.genre === genre).length;
  const sameTheme = recent.filter((r) => r.theme === theme).length;
  const parts: string[] = [];
  if (sameGenre >= 3) parts.push(`장르 최근5작 ${sameGenre}회`);
  if (sameTheme >= 3) parts.push(`테마 최근5작 ${sameTheme}회`);
  if (parts.length === 0) return null;
  const mul = computeSaturationMultiplier(history, genre, theme);
  return `시장 포화: ${parts.join(', ')} → 매출 ×${mul.toFixed(2)}`;
}
