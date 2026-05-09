/**
 * 온보딩 힌트 헬퍼.
 * 화살표 + 반투명 말풍선을 화면 위에 띄운다. 사용자 입력을 막지 않는다.
 *
 * 좌표 기준: logical 720×1280.
 * 사용법: const hint = showHint(scene, { ... }); ... hint.destroy(true);
 */
import Phaser from 'phaser';
import { FONT_STACK, TEXT_COLOR } from '@/theme';

/** 온보딩 단계 식별자. */
export type OnboardingStep =
  | 'assign-first'
  | 'assign-rest'
  | 'click-start'
  | 'pick-speed'
  | 'click-employee'
  | 'release-time';

/** 힌트 하나의 표시 파라미터. */
export interface OnboardingHint {
  /** 화살표가 가리키는 대상 화면 좌표(logical 720×1280). */
  readonly targetX: number;
  readonly targetY: number;
  /**
   * 화살표 방향.
   *  'down'  = 화살표가 대상 위에서 아래를 가리킴 (말풍선은 화살표 위쪽).
   *  'up'    = 대상 아래에서 위를 가리킴 (말풍선은 아래쪽).
   *  'right' = 왼쪽에서 오른쪽 가리킴.
   *  'left'  = 오른쪽에서 왼쪽 가리킴.
   */
  readonly arrowDir: 'up' | 'down' | 'left' | 'right';
  /** 말풍선 텍스트. */
  readonly text: string;
}

/** 화살표 길이(픽셀). */
const ARROW_LEN = 44;
/** 화살촉 크기. */
const ARROW_HEAD = 14;
/** 말풍선 내부 패딩(상하/좌우). */
const PAD_X = 24;
const PAD_Y = 16;
/** 말풍선 최대 너비. */
const BUBBLE_MAX_W = 460;
/** 말풍선 모서리 반지름. */
const BUBBLE_RADIUS = 14;
/** 말풍선 배경색. */
const BUBBLE_BG = 0x1e2040;
/** 말풍선 테두리색. */
const BUBBLE_STROKE = 0x4f6fff;
/** 펄스 알파 하한. */
const PULSE_MIN = 0.75;
/** 펄스 알파 상한. */
const PULSE_MAX = 1.0;
/** 펄스 1회 지속 시간(ms). */
const PULSE_DURATION = 900;

/**
 * 화살표 + 반투명 말풍선 컨테이너를 씬에 추가하고 반환한다.
 * destroy(true)로 제거 가능. 클릭 이벤트는 차단하지 않는다.
 *
 * @param scene   대상 씬
 * @param hint    위치·방향·텍스트 파라미터
 * @param depth   렌더 깊이 (기본 200 — 대부분 UI 위)
 */
export function showHint(
  scene: Phaser.Scene,
  hint: OnboardingHint,
  depth = 200,
): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(depth);

  // ── 말풍선 텍스트 (크기 측정 후 배경 그림) ──────────────────────────
  const textObj = scene.add.text(0, 0, hint.text, {
    fontFamily: FONT_STACK,
    fontSize: '26px',
    color: TEXT_COLOR.primary,
    wordWrap: { width: BUBBLE_MAX_W - PAD_X * 2, useAdvancedWrap: true },
    align: 'center',
  });
  // 텍스트 크기 확정 후 말풍선 크기 결정.
  const bw = Math.min(BUBBLE_MAX_W, textObj.width + PAD_X * 2);
  const bh = textObj.height + PAD_Y * 2;

  // ── 화살표 시작점 / 말풍선 위치 결정 ────────────────────────────────
  // arrowDir: 화살촉이 targetX/Y를 가리키는 방향.
  // 화살표 시작점은 targetX/Y에서 반대 방향으로 ARROW_LEN만큼.
  let arrowStartX = hint.targetX;
  let arrowStartY = hint.targetY;
  let bubbleCX = hint.targetX; // 말풍선 중심 X
  let bubbleCY = hint.targetY; // 말풍선 중심 Y

  switch (hint.arrowDir) {
    case 'down':
      // 화살촉 → target, 화살표는 target 위에서 내려옴.
      arrowStartY = hint.targetY - ARROW_LEN;
      bubbleCX = hint.targetX;
      bubbleCY = arrowStartY - bh / 2 - 6;
      break;
    case 'up':
      arrowStartY = hint.targetY + ARROW_LEN;
      bubbleCX = hint.targetX;
      bubbleCY = arrowStartY + bh / 2 + 6;
      break;
    case 'right':
      arrowStartX = hint.targetX - ARROW_LEN;
      bubbleCX = arrowStartX - bw / 2 - 6;
      bubbleCY = hint.targetY;
      break;
    case 'left':
      arrowStartX = hint.targetX + ARROW_LEN;
      bubbleCX = arrowStartX + bw / 2 + 6;
      bubbleCY = hint.targetY;
      break;
  }

  // 말풍선이 화면 밖으로 나가지 않도록 clamp.
  const bx = Math.max(8, Math.min(720 - bw - 8, bubbleCX - bw / 2));
  const by = Math.max(8, Math.min(1280 - bh - 8, bubbleCY - bh / 2));

  // ── 말풍선 배경 ──────────────────────────────────────────────────────
  const bg = scene.add.graphics();
  bg.fillStyle(BUBBLE_BG, 0.92);
  bg.lineStyle(2, BUBBLE_STROKE, 1);
  bg.fillRoundedRect(bx, by, bw, bh, BUBBLE_RADIUS);
  bg.strokeRoundedRect(bx, by, bw, bh, BUBBLE_RADIUS);
  c.add(bg);

  // ── 말풍선 텍스트 배치 ────────────────────────────────────────────────
  textObj.setPosition(bx + bw / 2 - textObj.width / 2, by + PAD_Y);
  c.add(textObj);

  // ── 화살표 ───────────────────────────────────────────────────────────
  const arrow = scene.add.graphics();
  arrow.lineStyle(3, BUBBLE_STROKE, 1);
  arrow.fillStyle(BUBBLE_STROKE, 1);

  // 화살 줄기
  arrow.beginPath();
  arrow.moveTo(arrowStartX, arrowStartY);
  arrow.lineTo(hint.targetX, hint.targetY);
  arrow.strokePath();

  // 화살촉(삼각형)
  const ang = Math.atan2(hint.targetY - arrowStartY, hint.targetX - arrowStartX);
  const a1 = ang + Math.PI * 0.8;
  const a2 = ang - Math.PI * 0.8;
  arrow.beginPath();
  arrow.moveTo(hint.targetX, hint.targetY);
  arrow.lineTo(hint.targetX + Math.cos(a1) * ARROW_HEAD, hint.targetY + Math.sin(a1) * ARROW_HEAD);
  arrow.lineTo(hint.targetX + Math.cos(a2) * ARROW_HEAD, hint.targetY + Math.sin(a2) * ARROW_HEAD);
  arrow.closePath();
  arrow.fillPath();

  c.add(arrow);

  // ── 펄스 애니메이션 ───────────────────────────────────────────────────
  scene.tweens.add({
    targets: c,
    alpha: { from: PULSE_MIN, to: PULSE_MAX },
    duration: PULSE_DURATION,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  return c;
}
