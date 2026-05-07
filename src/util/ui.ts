import Phaser from 'phaser';

/**
 * Kenney UI Pack에서 추출한 9-slice 텍스처 키. 모두 Grey/Default 단색 베이스라
 * Phaser .setTint()로 의미 색을 입혀 다크 팔레트와 톤을 맞춘다.
 *
 * 추가 시:
 *  1) PNG는 public/assets/ui/kenney/ 아래에 두고
 *  2) 아래 키 + 경로를 등록하고
 *  3) preloadUITextures()가 BootScene.preload에서 자동 로드
 */
export const UI_TEX = {
  /** flat 사각 패널 (라인 없음). */
  panelFlat: 'ui-rect-flat',
  /** 라인 보더가 있는 사각 패널. */
  panelLine: 'ui-rect-line',
  /** 깊이감(아래쪽 그림자) 있는 버튼 베이스. */
  buttonDepth: 'ui-rect-depth-flat',
} as const;

const ASSET_BASE = '/assets/ui/kenney/PNG/Grey/Default';

export function preloadUITextures(scene: Phaser.Scene): void {
  scene.load.image(UI_TEX.panelFlat, `${ASSET_BASE}/button_rectangle_flat.png`);
  scene.load.image(UI_TEX.panelLine, `${ASSET_BASE}/button_rectangle_line.png`);
  scene.load.image(UI_TEX.buttonDepth, `${ASSET_BASE}/button_rectangle_depth_flat.png`);
}

/** Kenney rectangle 자산 모서리 곡률. 8~12 범위에서 잘 늘어남. */
const CORNER = 10;

/**
 * 9-slice 패널 생성. (x, y)는 좌상단, 크기 (w, h).
 * @param withBorder false면 보더 없는 flat, true면 라인 보더.
 */
export function makePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fillTint: number,
  withBorder = true,
): Phaser.GameObjects.NineSlice {
  const tex = withBorder ? UI_TEX.panelLine : UI_TEX.panelFlat;
  const ns = scene.add.nineslice(x, y, tex, undefined, w, h, CORNER, CORNER, CORNER, CORNER);
  ns.setOrigin(0, 0);
  ns.setTint(fillTint);
  return ns;
}

/**
 * 9-slice 버튼 배경. Graphics 기반 redraw에 견주어, 색만 바꾸면 되므로 setTint로 갱신.
 */
export function makeButton9Slice(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fillTint: number,
  variant: 'depth' | 'flat' = 'depth',
): Phaser.GameObjects.NineSlice {
  const tex = variant === 'depth' ? UI_TEX.buttonDepth : UI_TEX.panelFlat;
  const ns = scene.add.nineslice(x, y, tex, undefined, w, h, CORNER, CORNER, CORNER, CORNER);
  ns.setOrigin(0, 0);
  ns.setTint(fillTint);
  return ns;
}
