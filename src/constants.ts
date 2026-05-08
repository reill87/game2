/**
 * 씬 공용 상수. 기존 import 호환을 위해 CONTENT_W/H의 alias로 재export.
 * 신규 코드는 src/util/viewport.ts의 CONTENT_W / CONTENT_H 직접 사용 권장.
 */
import { CONTENT_W, CONTENT_H } from './util/viewport';

/** @deprecated CONTENT_W 사용. */
export const GAME_WIDTH = CONTENT_W;
/** @deprecated CONTENT_H 사용. */
export const GAME_HEIGHT = CONTENT_H;
