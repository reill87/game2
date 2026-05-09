/**
 * 카메라 줌 fit — 720×1280 logical 월드를 viewport(드로잉 버퍼) 안에 비율 유지하며 맞춤.
 *
 * 동작:
 *  - 캔버스 드로잉 버퍼는 viewport × DPR 크기(고해상도). CSS는 100%×100%로 다운샘플.
 *  - 카메라 zoom = min(bufferW/720, bufferH/1280) → 가능한 한 크게(1 클램프 없음).
 *  - 카메라 centerOn(360, 640) → 월드 중앙 정렬.
 *  - 캔버스가 transparent라 letterbox 영역은 CSS 그라디언트가 비침.
 *
 * 모든 씬 좌표는 720×1280 logical 그대로 유지(고정 좌표 OK).
 *
 * 예: 모바일 viewport 390×844, DPR=3 → 캔버스 1170×2532 → zoom = min(1.625, 1.978) = 1.625
 *     → 월드 720×1280을 1170×2080으로 렌더 → 가로 가득, 위·아래 letterbox.
 *     CSS 다운샘플로 폰트·도형 선명.
 */
import Phaser from 'phaser';

import { CONTENT_H, CONTENT_W } from './viewport';

export function fitCamera(scene: Phaser.Scene): void {
  const w = scene.scale.gameSize.width;
  const h = scene.scale.gameSize.height;
  // 1 클램프 제거 — DPR 곱 캔버스에서는 zoom이 1보다 커야 가득 차게 보임.
  const zoom = Math.min(w / CONTENT_W, h / CONTENT_H);
  const cam = scene.cameras.main;
  cam.setZoom(zoom);
  cam.centerOn(CONTENT_W / 2, CONTENT_H / 2);
}
