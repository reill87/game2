/**
 * Modal factory — overlay + 패널 + 헤더 띠 + X 닫기.
 *
 * 기존 패턴(scrim rect + makePanel + addModalCloseX 직접 호출)을 한 함수로 묶어
 * 카테고리만 바꾸면 모든 모달이 동일한 형태로 나오게 한다.
 *
 * 사용:
 *   const m = createModal(this, {
 *     w: 600, h: 800,
 *     category: 'rnd',
 *     title: 'R&D 연구소',
 *     subtitle: '영구 업그레이드 — 한 번 구매하면 모든 프로젝트에 적용',
 *   });
 *   // m.layer는 Phaser.Container — 모든 자식이 여기 추가됨.
 *   m.layer.add(myCard);
 *   // m.contentArea는 헤더 아래 컨텐츠가 들어갈 영역(절대 좌표 + 크기).
 *   const { x, y, width, height } = m.contentArea;
 *
 *   // 닫기:
 *   m.close();
 *   // 또는 헤더 X 버튼이 자동으로 m.close() 호출.
 *
 *   // onClose 후처리:
 *   m.onClose = () => { ... };
 */
import Phaser from 'phaser';
import { CATEGORY, type CategoryKey, COLOR, ELEVATION, SPACING, TEXT_COLOR, TYPE } from '@/theme';
import { addCategoryHeaderBand } from '../categoryStripe';
import { slideUpIn } from '../animations';
import { createButton } from './button';
import { makePanel } from '@/util/ui';

const HEADER_TITLE_OFFSET_Y = 18;
const HEADER_SUBTITLE_OFFSET_Y = 44;
const HEADER_BAND_THICKNESS = 3;
const HEADER_PADDING_LEFT = 24;
const HEADER_TOTAL_HEIGHT_NO_SUBTITLE = 56;
const HEADER_TOTAL_HEIGHT_WITH_SUBTITLE = 78;

export interface ModalConfig {
  /** 모달 패널 너비 (logical px). */
  w: number;
  /** 모달 패널 높이 (logical px). */
  h: number;
  /** 카테고리 — 헤더 띠 색 + 의미 구분. */
  category?: CategoryKey;
  /** 제목 (필수). */
  title: string;
  /** 부제 (선택). */
  subtitle?: string;
  /** 좌상단 x. 미지정 시 화면 가운데 정렬 (contentX 기준). */
  x?: number;
  /** 좌상단 y. 미지정 시 viewport 안에 fitted. */
  y?: number;
  /** scrim alpha (기본 0.7). */
  scrimAlpha?: number;
  /** depth (기본 ELEVATION.modal). */
  depth?: number;
  /** 닫기 시 호출. */
  onClose?: () => void;
  /** slide-up 애니메이션 사용 (기본 true). */
  animate?: boolean;
}

export interface ModalHandle {
  /** 모든 자식이 들어가는 컨테이너. */
  layer: Phaser.GameObjects.Container;
  /** 헤더 아래 컨텐츠가 그려질 절대 좌표·크기. */
  contentArea: { x: number; y: number; width: number; height: number };
  /** 패널 좌상단 절대 좌표·크기. */
  panel: { x: number; y: number; width: number; height: number };
  /** 닫기 — onClose 트리거 후 layer destroy. */
  close(): void;
  /** 외부에서 onClose를 갈아끼울 수 있게. */
  onClose: (() => void) | undefined;
}

/**
 * 720×1280 logical 좌표계 가정. 가운데 정렬은 (720 - w) / 2 기준.
 */
export function createModal(scene: Phaser.Scene, cfg: ModalConfig): ModalHandle {
  const panelW = cfg.w;
  const panelH = cfg.h;
  const panelX = cfg.x ?? Math.round((720 - panelW) / 2);
  const panelY = cfg.y ?? Math.max(SPACING.xl, Math.round((1280 - panelH) / 2));
  const depth = cfg.depth ?? ELEVATION.modal;

  const layer = scene.add.container(0, 0).setDepth(depth);

  // Scrim — 클릭 차단.
  const scrim = scene.add
    .rectangle(0, 0, 720, 1280, COLOR.scrim, cfg.scrimAlpha ?? 0.7)
    .setOrigin(0, 0)
    .setInteractive();
  layer.add(scrim);

  // 패널.
  const panel = makePanel(scene, panelX, panelY, panelW, panelH, COLOR.panel);
  layer.add(panel);

  // 카테고리 헤더 띠 (선택).
  if (cfg.category) {
    const band = addCategoryHeaderBand(scene, panelX, panelY, panelW, cfg.category, HEADER_BAND_THICKNESS);
    layer.add(band);
  }

  // 제목.
  const titleText = scene.add.text(panelX + HEADER_PADDING_LEFT, panelY + HEADER_TITLE_OFFSET_Y, cfg.title, {
    ...TYPE.leadBold,
    color: cfg.category ? CATEGORY[cfg.category].str : TEXT_COLOR.warn,
  });
  layer.add(titleText);

  // 부제 (있으면).
  if (cfg.subtitle) {
    const subtitleText = scene.add.text(panelX + HEADER_PADDING_LEFT, panelY + HEADER_SUBTITLE_OFFSET_Y, cfg.subtitle, {
      ...TYPE.meta,
      color: TEXT_COLOR.dim,
      wordWrap: { width: panelW - HEADER_PADDING_LEFT * 2 - 56 }, // X 닫기 공간 확보.
    });
    layer.add(subtitleText);
  }

  // X 닫기 버튼 (우상단).
  const xSize = 36;
  const xX = panelX + panelW - xSize - 12;
  const xY = panelY + 12;
  const closeBtn = createButton(scene, {
    x: xX, y: xY, w: xSize, h: xSize,
    label: '✕',
    variant: 'secondary',
    size: 'md',
  });
  layer.add(closeBtn.bg);
  layer.add(closeBtn.text);
  layer.add(closeBtn.hit);

  const headerH = cfg.subtitle ? HEADER_TOTAL_HEIGHT_WITH_SUBTITLE : HEADER_TOTAL_HEIGHT_NO_SUBTITLE;
  const contentArea = {
    x: panelX,
    y: panelY + headerH,
    width: panelW,
    height: panelH - headerH,
  };

  let closed = false;
  const handle: ModalHandle = {
    layer,
    contentArea,
    panel: { x: panelX, y: panelY, width: panelW, height: panelH },
    close(): void {
      if (closed) return;
      closed = true;
      handle.onClose?.();
      layer.destroy();
    },
    onClose: cfg.onClose,
  };

  closeBtn.hit.on('pointerup', () => handle.close());

  // Slide-up 진입.
  if (cfg.animate !== false) {
    slideUpIn(scene, layer, 12);
  }

  return handle;
}
