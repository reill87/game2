/**
 * 씬 공용 상수. config.ts에서 재export 하지만 씬은 이 파일을 직접 import 하여
 * config ↔ 씬 사이의 순환 import(TDZ)를 끊는다.
 */
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;
