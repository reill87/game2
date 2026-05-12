/**
 * Button factory — primary/secondary/ghost/danger × sm/md/lg.
 *
 * Phaser는 native Button이 없어 Graphics + Text + Zone 묶음을 매번 만든다.
 * 이 factory가 그 패턴을 표준화해서 토큰만 바꾸면 모든 버튼이 함께 진화.
 *
 * 사용:
 *   const btn = createButton(scene, {
 *     x: 100, y: 200, w: 200, h: 48,
 *     label: '구매',
 *     variant: 'primary',
 *     onTap: () => buy(),
 *   });
 *   container.add([btn.bg, btn.text, btn.hit]);
 *
 *   btn.setEnabled(false);   // 비활성으로 전환
 *   btn.setLabel('완료');     // 라벨 갱신
 *   btn.destroy();           // 일괄 제거
 */
import Phaser from 'phaser';
import { COLOR, RADIUS, TEXT_COLOR, TYPE } from '@/theme';
import { drawRaisedRect } from '@/util/ui';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonConfig {
  /** 좌상단 x. */
  x: number;
  /** 좌상단 y. */
  y: number;
  w: number;
  h: number;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 비활성 상태로 시작. */
  disabled?: boolean;
  /** 라벨 좌측 옆에 두는 단색 SVG 아이콘 키 (선택). */
  iconKey?: string;
  /** pointerup 핸들러. disabled면 호출 안 됨. */
  onTap?: () => void;
}

export interface ButtonHandle {
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Zone;
  icon: Phaser.GameObjects.Image | null;
  setEnabled(enabled: boolean): void;
  setLabel(label: string): void;
  setVariant(variant: ButtonVariant): void;
  /** 일괄 제거 — bg/text/hit/icon 모두. */
  destroy(): void;
}

/** size별 fontSize 토큰 매핑. */
function sizeStyle(size: ButtonSize) {
  switch (size) {
    case 'sm': return TYPE.metaBold;
    case 'lg': return TYPE.leadBold;
    case 'md':
    default:   return TYPE.bodyBold;
  }
}

function variantColors(variant: ButtonVariant, enabled: boolean): { bg: number; text: string } {
  if (!enabled) return { bg: COLOR.btnDisabled, text: TEXT_COLOR.disabled };
  switch (variant) {
    case 'primary':   return { bg: COLOR.btn,          text: TEXT_COLOR.primary };
    case 'secondary': return { bg: COLOR.btnSecondary, text: TEXT_COLOR.primary };
    case 'ghost':     return { bg: 0x000000,           text: TEXT_COLOR.primary }; // alpha 0으로 처리
    case 'danger':    return { bg: COLOR.btnDanger,    text: TEXT_COLOR.primary };
  }
}

function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + amount);
  const b = Math.min(255, (color & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}

export function createButton(scene: Phaser.Scene, cfg: ButtonConfig): ButtonHandle {
  const variant: ButtonVariant = cfg.variant ?? 'primary';
  const size: ButtonSize = cfg.size ?? 'md';
  let enabled = !cfg.disabled;
  let currentVariant = variant;
  let hovered = false;
  let pressed = false;
  let pressOffsetApplied = false;

  const cx = cfg.x + cfg.w / 2;
  const cy = cfg.y + cfg.h / 2;

  // 배경 — Graphics(redrawable).
  const bg = scene.add.graphics();
  const drawBg = (): void => {
    bg.clear();
    const { bg: bgColor } = variantColors(currentVariant, enabled);
    if (currentVariant === 'ghost') {
      // ghost는 배경 없이 테두리만.
      bg.lineStyle(1.5, hovered ? COLOR.selected : COLOR.panelStroke, hovered ? 0.95 : 0.8);
      bg.strokeRoundedRect(cfg.x, cfg.y, cfg.w, cfg.h, RADIUS.md);
    } else {
      const hoverFill = enabled && hovered && !pressed && currentVariant !== 'danger'
        ? lighten(bgColor, 10)
        : bgColor;
      drawRaisedRect(bg, cfg.x, cfg.y, cfg.w, cfg.h, hoverFill, {
        radius: RADIUS.md,
        pressed,
        gloss: enabled,
        shadow: true,
      });
    }
  };
  drawBg();

  // 라벨 텍스트.
  const text = scene.add
    .text(cx, cy, cfg.label, {
      ...sizeStyle(size),
      color: variantColors(currentVariant, enabled).text,
    })
    .setOrigin(0.5);

  // 아이콘 (선택) — 라벨 좌측 6px 갭.
  let icon: Phaser.GameObjects.Image | null = null;
  if (cfg.iconKey) {
    const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
    icon = scene.add
      .image(cx - text.width / 2 - 6 - iconSize / 2, cy, cfg.iconKey)
      .setDisplaySize(iconSize, iconSize)
      .setOrigin(0.5);
  }

  // 클릭 영역.
  const hit = scene.add
    .zone(cx, cy, cfg.w, cfg.h)
    .setInteractive({ useHandCursor: true });

  hit.on('pointerover', () => {
    hovered = true;
    drawBg();
  });
  hit.on('pointerout', () => {
    hovered = false;
    pressed = false;
    drawBg();
    if (pressOffsetApplied) {
      text.setY(text.y - 2);
      if (icon) icon.setY(icon.y - 2);
      pressOffsetApplied = false;
    }
  });
  hit.on('pointerdown', () => {
    if (!enabled) return;
    pressed = true;
    drawBg();
    if (!pressOffsetApplied) {
      text.setY(text.y + 2);
      if (icon) icon.setY(icon.y + 2);
      pressOffsetApplied = true;
    }
  });
  hit.on('pointerup', () => {
    pressed = false;
    drawBg();
    if (pressOffsetApplied) {
      text.setY(text.y - 2);
      if (icon) icon.setY(icon.y - 2);
      pressOffsetApplied = false;
    }
    if (enabled && cfg.onTap) cfg.onTap();
  });

  return {
    bg, text, hit, icon,
    setEnabled(next: boolean): void {
      if (enabled === next) return;
      enabled = next;
      drawBg();
      text.setColor(variantColors(currentVariant, enabled).text);
    },
    setLabel(label: string): void {
      text.setText(label);
      // 아이콘 위치 재계산.
      if (icon) icon.setX(cx - text.width / 2 - 6 - icon.displayWidth / 2);
    },
    setVariant(v: ButtonVariant): void {
      currentVariant = v;
      drawBg();
      text.setColor(variantColors(currentVariant, enabled).text);
    },
    destroy(): void {
      bg.destroy();
      text.destroy();
      hit.destroy();
      icon?.destroy();
    },
  };
}
