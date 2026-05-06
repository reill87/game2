import Phaser from 'phaser';
import { RexUISampleScene } from './RexUISampleScene';

/** 최소 부트: 다음 씬으로 즉시 전환 (추후 프리로드 확장). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.scene.start(RexUISampleScene.KEY);
  }
}
