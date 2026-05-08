/**
 * 카메라 줌 fit — 720×1280 logical 월드를 viewport 안에 비율 유지하며 맞춤.
 *
 * 동작:
 *  - 캔버스는 viewport를 가득 채움(RESIZE 모드).
 *  - 카메라 zoom = min(viewW/720, viewH/1280, 1) → 항상 월드 전체가 보임.
 *  - 카메라 centerOn(360, 640) → 월드 중앙 정렬.
 *  - 캔버스가 transparent라 letterbox 영역은 CSS 그라디언트가 비침.
 *
 * 모든 씬 좌표는 720×1280 logical 그대로 유지(고정 좌표 OK).
 */
import Phaser from 'phaser';

import { CONTENT_H, CONTENT_W } from './viewport';

export function fitCamera(scene: Phaser.Scene): void {
  const w = scene.scale.gameSize.width;
  const h = scene.scale.gameSize.height;
  // 가로/세로 모두 자연스럽게 맞춰지도록 min 사용. 1보다 클 수 있어 클램프.
  const zoom = Math.min(w / CONTENT_W, h / CONTENT_H, 1);
  const cam = scene.cameras.main;
  cam.setZoom(zoom);
  cam.centerOn(CONTENT_W / 2, CONTENT_H / 2);
}
