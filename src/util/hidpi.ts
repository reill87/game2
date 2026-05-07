import Phaser from 'phaser';

/**
 * 디바이스 픽셀 비율. Retina/4K 등 DPR>1 환경에서 캔버스 픽셀 밀도를 끌어올린다.
 * window가 없는 환경(SSR/노드 테스트)에서는 1로 폴백.
 */
export const DPR =
  typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 1) : 1;

/**
 * 매 씬 create() 마지막에 호출해 두 가지를 동시에 처리:
 *  1) 카메라 zoom = DPR — 캔버스 드로잉 버퍼는 (GAME_WIDTH × DPR, GAME_HEIGHT × DPR)이고
 *     카메라 zoom이 좌표계를 DPR배 늘려, 우리 코드의 (720×1280) 좌표는 그대로 유지된다.
 *     결과적으로 동일 게임 픽셀이 DPR² 디바이스 픽셀에 칠해져 선명해진다.
 *  2) Phaser.Text의 setResolution(DPR) — 폰트 텍스처 자체도 고해상도로 래스터링.
 */
export function applyHiDPI(scene: Phaser.Scene): void {
  if (DPR <= 1) return;
  scene.cameras.main.setZoom(DPR);
  scene.children.each((child) => {
    if (child instanceof Phaser.GameObjects.Text) {
      child.setResolution(DPR);
    }
    return null;
  });
}
