/**
 * ScrollArea — 모달 안의 컨텐츠 영역을 세로 스크롤 가능하게.
 *
 * Phaser는 native 스크롤 컨테이너가 없어 mask + 드래그/wheel 입력으로 직접 처리.
 *
 * 사용:
 *   const sa = createScrollArea(this, {
 *     x: panelX + 20, y: cardsY0, w: cardW, h: viewportH,
 *     contentH: items.length * (cardH + gap),
 *   });
 *   layer.add(sa.container);
 *
 *   // 카드들은 sa.container에 추가하고 좌표는 (0, 0) 기준 절대 좌표로.
 *   sa.container.add(cardObjects);
 *
 *   // 외부에서 destroy 시:
 *   sa.destroy();
 */
import Phaser from 'phaser';

export interface ScrollAreaConfig {
  x: number;
  y: number;
  w: number;
  /** Viewport 높이 (보이는 영역). */
  h: number;
  /** 컨텐츠 전체 높이. h보다 크면 스크롤 활성화. */
  contentH: number;
}

export interface ScrollAreaHandle {
  /** 자식 GameObject를 add할 컨테이너. */
  container: Phaser.GameObjects.Container;
  /** 마스크된 hit zone (드래그용). */
  hit: Phaser.GameObjects.Zone;
  destroy(): void;
}

export function createScrollArea(scene: Phaser.Scene, cfg: ScrollAreaConfig): ScrollAreaHandle {
  const container = scene.add.container(cfg.x, cfg.y);

  // Mask — viewport 안만 보이게.
  const maskShape = scene.make.graphics({ x: 0, y: 0 });
  maskShape.fillStyle(0xffffff, 1);
  maskShape.fillRect(cfg.x, cfg.y, cfg.w, cfg.h);
  const mask = maskShape.createGeometryMask();
  container.setMask(mask);

  // Hit zone — 드래그/wheel 입력 받기.
  const hit = scene.add
    .zone(cfg.x + cfg.w / 2, cfg.y + cfg.h / 2, cfg.w, cfg.h)
    .setInteractive({ draggable: true });

  let scrollY = 0;
  const maxScroll = Math.max(0, cfg.contentH - cfg.h);

  // 드래그 (모바일·마우스).
  let lastPointerY = 0;
  hit.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
    lastPointerY = ptr.y;
  });
  hit.on('pointermove', (ptr: Phaser.Input.Pointer) => {
    if (!ptr.isDown) return;
    const dy = ptr.y - lastPointerY;
    lastPointerY = ptr.y;
    scrollY = Math.max(0, Math.min(maxScroll, scrollY - dy));
    container.setY(cfg.y - scrollY);
  });

  // Wheel (PC).
  hit.on('wheel', (_ptr: Phaser.Input.Pointer, _dx: number, dy: number) => {
    scrollY = Math.max(0, Math.min(maxScroll, scrollY + dy));
    container.setY(cfg.y - scrollY);
  });

  return {
    container,
    hit,
    destroy(): void {
      container.destroy(true);
      hit.destroy();
      maskShape.destroy();
    },
  };
}
