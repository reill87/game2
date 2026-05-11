/**
 * 숫자·문자열 포매팅 헬퍼 — UI 일관성 확보.
 *
 * 사용 규칙:
 *  - 화면에 표시되는 모든 골드/매출 숫자는 `formatGold` 사용 (천 단위 콤마).
 *  - 부호 있는 변화량은 `formatGain` (-100 → "-100", +100 → "+100").
 *  - 짧은 표기(K/M)는 `formatCompact` (큰 화면 영역 절약 시).
 */

/** 26962 → "26,962" */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** 26962 → "26,962g" */
export function formatGold(n: number): string {
  return `${formatNumber(n)}g`;
}

/** 100 → "+100", -50 → "-50", 0 → "0" */
export function formatGain(n: number): string {
  if (n > 0) return `+${formatNumber(n)}`;
  return formatNumber(n);
}

/** 26962 → "+26,962g", -50 → "-50g" */
export function formatGoldGain(n: number): string {
  return `${formatGain(n)}g`;
}

/** 12500 → "12.5K", 1500000 → "1.5M". 큰 화면 영역 절약 시 사용. */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/** 0.95 → "95%", 1.25 → "125%". */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** 0.05 → "+5%", -0.1 → "-10%". 변화량 표시. */
export function formatPercentGain(ratio: number): string {
  const pct = Math.round(ratio * 100);
  if (pct > 0) return `+${pct}%`;
  return `${pct}%`;
}

/** N주를 "N주" 또는 "M개월"로 변환 (12주 이상이면 개월). */
export function formatWeeks(weeks: number): string {
  if (weeks >= 12) {
    const months = Math.round(weeks / 4);
    return `${months}개월`;
  }
  return `${weeks}주`;
}
