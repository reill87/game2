import Phaser from 'phaser';
import { COLOR, RADIUS, TEXT_COLOR, TYPE } from '@/theme';

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

export interface RaisedRectOptions {
  radius?: number;
  alpha?: number;
  stroke?: number;
  strokeAlpha?: number;
  shadow?: boolean;
  gloss?: boolean;
  pressed?: boolean;
}

export function drawScreenBackdrop(scene: Phaser.Scene, alpha = 1): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x070812, alpha);
  g.fillRect(0, 0, 720, 1280);
  g.fillStyle(0x1f1740, 0.72 * alpha);
  g.fillTriangle(0, 0, 720, 0, 0, 520);
  g.fillStyle(0x0d2745, 0.55 * alpha);
  g.fillTriangle(720, 1280, 720, 420, 80, 1280);
  g.lineStyle(1, 0xffffff, 0.035 * alpha);
  for (let y = 96; y < 1280; y += 96) g.lineBetween(0, y, 720, y - 120);
  g.fillStyle(0xffffff, 0.12 * alpha);
  for (let i = 0; i < 56; i++) {
    const x = (i * 97) % 720;
    const y = (i * 173 + 41) % 1280;
    g.fillRect(x, y, i % 4 === 0 ? 2 : 1, 1);
  }
  return g;
}

export function drawRaisedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  opts: RaisedRectOptions = {},
): void {
  const r = opts.radius ?? RADIUS.md;
  const alpha = opts.alpha ?? 1;
  const pressed = opts.pressed ?? false;
  if (opts.shadow !== false) {
    g.fillStyle(COLOR.panelShadow, pressed ? 0.28 : 0.42);
    g.fillRoundedRect(x + 2, y + (pressed ? 2 : 5), w, h, r);
  }
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y + (pressed ? 2 : 0), w, h, r);
  if (opts.gloss !== false) {
    g.fillStyle(0xffffff, pressed ? 0.05 : 0.11);
    g.fillRoundedRect(x + 2, y + 2 + (pressed ? 2 : 0), w - 4, Math.max(4, h * 0.42), {
      tl: Math.max(1, r - 2),
      tr: Math.max(1, r - 2),
      bl: 3,
      br: 3,
    });
  }
  g.lineStyle(1, COLOR.panelHighlight, pressed ? 0.18 : 0.32);
  g.strokeRoundedRect(x + 0.5, y + 0.5 + (pressed ? 2 : 0), w - 1, h - 1, r);
  if (opts.stroke !== undefined) {
    g.lineStyle(1.5, opts.stroke, opts.strokeAlpha ?? 0.8);
    g.strokeRoundedRect(x + 0.5, y + 0.5 + (pressed ? 2 : 0), w - 1, h - 1, r);
  }
}

export function drawGaugeBar(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: number,
  topFill: number,
): void {
  const r = h / 2;
  const clamped = Math.max(0, Math.min(1, ratio));
  const fillW = clamped * w;
  g.clear();
  g.fillStyle(COLOR.panelShadow, 0.45);
  g.fillRoundedRect(x + 1, y + 3, w, h, r);
  g.fillStyle(COLOR.gaugeBg, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(1, COLOR.panelHighlight, 0.16);
  g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, r);
  if (fillW <= 0) return;
  g.fillStyle(fill, 0.25);
  g.fillRoundedRect(x - 3, y - 3, Math.min(w + 6, fillW + 6), h + 6, r + 3);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, fillW, h, r);
  g.fillStyle(topFill, 0.72);
  g.fillRoundedRect(x + 1, y + 1, Math.max(0, fillW - 2), Math.max(3, h * 0.42), r);
}

export function addEmptyState(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { iconKey: string; title: string; body: string; tint?: number },
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const ring = scene.add.graphics();
  ring.lineStyle(2, opts.tint ?? COLOR.panelStroke, 0.42);
  ring.fillStyle(COLOR.panelEmpty, 0.86);
  ring.fillRoundedRect(-170, -72, 340, 144, RADIUS.lg);
  const icon = scene.add.image(-120, 0, opts.iconKey).setDisplaySize(44, 44).setTint(opts.tint ?? 0x9b9bb0);
  const title = scene.add.text(-70, -30, opts.title, {
    ...TYPE.leadBold,
    color: TEXT_COLOR.primary,
  });
  const body = scene.add.text(-70, 2, opts.body, {
    ...TYPE.meta,
    color: TEXT_COLOR.dim,
    wordWrap: { width: 210, useAdvancedWrap: true },
  });
  c.add([ring, icon, title, body]);
  return c;
}

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
  const tex = withBorder ? UI_TEX.panelLine : UI_TEX.buttonDepth;
  const ns = scene.add.nineslice(x, y, tex, undefined, w, h, CORNER, CORNER, CORNER, CORNER);
  ns.setOrigin(0, 0);
  ns.setTint(fillTint);
  ns.setAlpha(0.98);
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
