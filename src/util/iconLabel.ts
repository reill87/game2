import Phaser from 'phaser';
import { FONT_STACK } from '@/theme';

export interface IconLabelOpts {
  iconSize?: number;
  iconTint: number;
  textColor: string;
  fontSize?: number;
  bold?: boolean;
  /** 아이콘 ↔ 라벨 사이 간격. */
  gap?: number;
}

/**
 * 아이콘 + 라벨을 한 단위로 (centerX, centerY) 중앙 정렬.
 * 라벨 width를 측정해 두 객체의 합이 정확히 가운데 오도록 위치를 잡는다.
 */
export function addIconLabel(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  iconKey: string,
  labelText: string,
  opts: IconLabelOpts,
): { icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text } {
  const iconSize = opts.iconSize ?? 16;
  const gap = opts.gap ?? 6;
  const label = scene.add
    .text(0, centerY, labelText, {
      fontFamily: FONT_STACK,
      fontSize: `${opts.fontSize ?? 14}px`,
      fontStyle: opts.bold ? 'bold' : 'normal',
      color: opts.textColor,
    })
    .setOrigin(0, 0.5);
  const totalW = iconSize + gap + label.width;
  const startX = centerX - totalW / 2;
  const icon = scene.add
    .image(startX, centerY, iconKey)
    .setDisplaySize(iconSize, iconSize)
    .setOrigin(0, 0.5)
    .setTint(opts.iconTint);
  label.setX(startX + iconSize + gap);
  return { icon, label };
}
