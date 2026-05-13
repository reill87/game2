/**
 * 랜덤 이벤트 runtime facade.
 *
 * Event content lives under src/content/events so the content pack can grow by
 * category without expanding this domain runtime file.
 */
import { EVENTS } from '@/content/events';
import type { GameEvent } from '@/content/events';
import type { GameState } from './types';

export { EVENTS, EVENT_CATEGORY_LABEL, categoryOf } from '@/content/events';
export type { EventChoice, EventCategory, GameEvent } from '@/content/events';

/**
 * 발동 가능한 후보를 추려 하나를 무작위로 반환. 후보 없으면 null.
 * @param recentIds 최근 발동된 이벤트 id 배열(중복 방지용). 가능하면 풀에서 제외.
 */
export function pickRandomEvent(
  state: GameState,
  recentIds: ReadonlyArray<string> = [],
): GameEvent | null {
  const baseEligible = EVENTS.filter((e) => {
    // productCount 게이트: 출시한 제품 수 미달이면 제외
    if (e.minProductCount !== undefined && state.productIndex < e.minProductCount) return false;
    // reputation 게이트: 누적 명성 미달이면 제외
    if (e.minReputation !== undefined && state.reputation < e.minReputation) return false;
    // 기존 canTrigger 게이트 (AND 합성)
    if (e.canTrigger && !e.canTrigger(state)) return false;
    return true;
  });
  if (baseEligible.length === 0) return null;
  // 중복 방지: 최근 발동된 이벤트 제외. 모두 제외되면 fallback으로 풀 전체 사용.
  const recentSet = new Set(recentIds);
  const fresh = baseEligible.filter((e) => !recentSet.has(e.id));
  const eligible = fresh.length > 0 ? fresh : baseEligible;
  const idx = Math.floor(Math.random() * eligible.length);
  return eligible[idx] ?? null;
}
