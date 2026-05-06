import Phaser from 'phaser';
import { newTutorialGame } from '@/domain/seed';
import { loadData, type SavedResult } from '@/save';
import { SCENE_KEYS } from './keys';

/** 최소 부트: localStorage에서 이월 골드를 로드해 튜토리얼 작품 새로 시작. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Boot });
  }

  create(): void {
    const saved = loadData();
    const fresh = newTutorialGame();
    const state = saved ? { ...fresh, gold: saved.gold } : fresh;
    const carry: { lastResult?: SavedResult } = {};
    if (saved?.lastResult) carry.lastResult = saved.lastResult;
    this.scene.start(SCENE_KEYS.Assignment, { state, ...carry });
  }
}
