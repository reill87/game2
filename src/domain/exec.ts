/**
 * 임원 압박 / CEO 교체 위협 도메인.
 * - 출시 시 명성 획득이 낮은 작품이 연속되면 이사회 경고 → CEO 교체.
 */

/** 작품당 명성 획득이 이 값 미만이면 부진 1회로 카운트. */
export const EXEC_LOW_REPUTATION_GAIN = 5;
/** N회 연속 부진 → 이사회 경고 (warning). */
export const EXEC_PRESSURE_THRESHOLD = 3;
/** N회 연속 부진 → CEO 교체 (fatal, 게임 오버). */
export const EXEC_FATAL_THRESHOLD = 6;

export interface ExecState {
  readonly poorPerformanceStreak: number;
}

export const EMPTY_EXEC: ExecState = { poorPerformanceStreak: 0 };

/** 출시 직후 호출 — 명성 획득에 따라 streak 갱신. */
export function tickExec(prev: ExecState | undefined, lastReleaseRepGain: number): ExecState {
  const cur = prev ?? EMPTY_EXEC;
  const streak = lastReleaseRepGain < EXEC_LOW_REPUTATION_GAIN
    ? cur.poorPerformanceStreak + 1
    : 0;
  return { poorPerformanceStreak: streak };
}

export type ExecPressureLevel = 'none' | 'warning' | 'fatal';

/** 현재 압박 수준 반환. */
export function getExecPressure(s: ExecState | undefined): ExecPressureLevel {
  const streak = s?.poorPerformanceStreak ?? 0;
  if (streak >= EXEC_FATAL_THRESHOLD) return 'fatal';
  if (streak >= EXEC_PRESSURE_THRESHOLD) return 'warning';
  return 'none';
}
