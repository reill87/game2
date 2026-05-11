/**
 * Tabs factory — 탭 바 표준화. R&D modal의 T1~T5처럼 active 인디케이터가 있는 탭.
 *
 * 사용:
 *   const tabs = createTabs(scene, {
 *     x: 24, y: 76, w: 552,
 *     items: [
 *       { id: 'T1', label: 'T1 0/8' },
 *       { id: 'T2', label: 'T2 0/8' },
 *       ...
 *     ],
 *     activeId: 'T1',
 *     onChange: (id) => switchTier(id),
 *   });
 *   layer.add(tabs.layer);
 *   tabs.setActive('T2');  // 외부에서 갱신
 *   tabs.destroy();
 */
import Phaser from 'phaser';
import { COLOR, RADIUS, TEXT_COLOR, TYPE } from '@/theme';
import { pressTap } from '../animations';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsConfig {
  x: number;
  y: number;
  w: number;
  /** 탭 높이 (기본 40). */
  h?: number;
  /** 탭 간 간격 (기본 8). */
  gap?: number;
  items: ReadonlyArray<TabItem>;
  activeId: string;
  /** 클릭 시 호출. 같은 탭은 호출 안 됨. */
  onChange: (id: string) => void;
}

export interface TabsHandle {
  layer: Phaser.GameObjects.Container;
  setActive(id: string): void;
  destroy(): void;
}

const DEFAULT_TAB_H = 40;
const DEFAULT_GAP = 8;

export function createTabs(scene: Phaser.Scene, cfg: TabsConfig): TabsHandle {
  const tabH = cfg.h ?? DEFAULT_TAB_H;
  const gap = cfg.gap ?? DEFAULT_GAP;
  const count = cfg.items.length;
  const tabW = (cfg.w - gap * (count - 1)) / count;
  const layer = scene.add.container(0, 0);

  let activeId = cfg.activeId;

  const tabRefs: Array<{
    id: string;
    bg: Phaser.GameObjects.Graphics;
    text: Phaser.GameObjects.Text;
    indicator: Phaser.GameObjects.Graphics;
  }> = [];

  cfg.items.forEach((item, i) => {
    const tx = cfg.x + i * (tabW + gap);
    const isActive = item.id === activeId;

    const bg = scene.add.graphics();
    bg.fillStyle(isActive ? COLOR.btn : COLOR.btnSecondary, 1);
    bg.fillRoundedRect(tx, cfg.y, tabW, tabH, RADIUS.md);
    layer.add(bg);

    const text = scene.add
      .text(tx + tabW / 2, cfg.y + tabH / 2, item.label, {
        ...TYPE.metaBold,
        color: isActive ? TEXT_COLOR.primary : TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
    layer.add(text);

    // Active 인디케이터 — 탭 하단 2px stripe (slide 애니메이션 대상).
    const indicator = scene.add.graphics();
    if (isActive) {
      indicator.fillStyle(0xffffff, 0.85);
      indicator.fillRect(tx + 12, cfg.y + tabH - 3, tabW - 24, 2);
    }
    layer.add(indicator);

    const hit = scene.add
      .zone(tx + tabW / 2, cfg.y + tabH / 2, tabW, tabH)
      .setInteractive({ useHandCursor: true });
    layer.add(hit);
    hit.on('pointerdown', () => pressTap(scene, bg));
    hit.on('pointerup', () => {
      if (item.id === activeId) return;
      cfg.onChange(item.id);
    });

    tabRefs.push({ id: item.id, bg, text, indicator });
  });

  function setActive(nextId: string): void {
    if (activeId === nextId) return;
    activeId = nextId;
    tabRefs.forEach((ref, i) => {
      const tx = cfg.x + i * (tabW + gap);
      const isActive = ref.id === activeId;
      ref.bg.clear();
      ref.bg.fillStyle(isActive ? COLOR.btn : COLOR.btnSecondary, 1);
      ref.bg.fillRoundedRect(tx, cfg.y, tabW, tabH, RADIUS.md);
      ref.text.setColor(isActive ? TEXT_COLOR.primary : TEXT_COLOR.dim);
      ref.indicator.clear();
      if (isActive) {
        ref.indicator.fillStyle(0xffffff, 0.85);
        ref.indicator.fillRect(tx + 12, cfg.y + tabH - 3, tabW - 24, 2);
      }
    });
  }

  return {
    layer,
    setActive,
    destroy(): void {
      layer.destroy(true);
    },
  };
}
