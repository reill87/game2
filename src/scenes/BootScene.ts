import Phaser from 'phaser';
import { newTutorialGame } from '@/domain/seed';
import { SCENE_KEYS } from './keys';

/** 최소 부트: 튜토리얼 초기 상태를 만들어 배치 씬으로 인계. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Boot });
  }

  create(): void {
    this.scene.start(SCENE_KEYS.Assignment, { state: newTutorialGame() });
  }
}
