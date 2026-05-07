import Phaser from 'phaser';

/**
 * HiDPI(레티나·4K) 환경에서 Phaser.Text가 흐려지는 문제 보정.
 *
 * Phaser는 캔버스 드로잉 버퍼를 게임 사이즈(720×1280) 그대로 두고 CSS만 늘려 표시한다.
 * DPR > 1 환경에서는 픽셀이 부족해 폰트가 흐릿해지는데, Text 객체에 한해
 * setResolution(dpr)를 걸면 텍스처가 dpr배 해상도로 래스터링되어 선명해진다.
 *
 * 도형(Graphics)는 벡터라 영향이 적어 그대로 둔다.
 */
export function applyHiDPIText(scene: Phaser.Scene): void {
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  if (dpr <= 1) return;
  scene.children.each((child) => {
    if (child instanceof Phaser.GameObjects.Text) {
      child.setResolution(dpr);
    }
    return null;
  });
}
