import Phaser from 'phaser';

/**
 * 디바이스 픽셀 비율. Retina/4K 등 DPR>1 환경에서 캔버스 픽셀 밀도를 끌어올린다.
 * window가 없는 환경(SSR/노드 테스트)에서는 1로 폴백.
 */
export const DPR =
  typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 1) : 1;

/**
 * 매 씬 create() 마지막에 호출해 Phaser.Text의 setResolution(DPR)을 일괄 적용한다.
 *
 * 카메라 zoom + 캔버스 드로잉 버퍼 확대 트릭은 좌표계·뷰포트 정렬과 충돌이 잦아
 * 일단 빼두고, 폰트 래스터라이즈 해상도만 DPR로 맞춘다. 도형(Graphics)은
 * 벡터라 일부 환경에서 부드러워 보일 수 있지만 위치 어긋남·잘림은 없다.
 */
export function applyHiDPI(scene: Phaser.Scene): void {
  if (DPR <= 1) return;
  scene.children.each((child) => {
    if (child instanceof Phaser.GameObjects.Text) {
      child.setResolution(DPR);
    }
    return null;
  });
}
