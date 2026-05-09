import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import { AssignmentScene } from './scenes/AssignmentScene';
import { BootScene } from './scenes/BootScene';
import { DevelopmentScene } from './scenes/DevelopmentScene';
import { GenreSelectScene } from './scenes/GenreSelectScene';
import { EndingScene } from './scenes/EndingScene';
import { ResultScene } from './scenes/ResultScene';
import { StatsScene } from './scenes/StatsScene';
import { SettingsScene } from './scenes/SettingsScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  // transparent 캔버스 — letterbox 영역은 CSS #app 그라디언트가 비춤.
  transparent: true,
  scale: {
    // NONE: 자동 리사이즈 끔. main.ts가 window resize 이벤트로 직접 game.scale.resize() 호출.
    // RESIZE 모드는 우리가 DPR로 키운 사이즈를 다시 CSS px로 줄여 다운샘플 효과를 무력화함.
    // 캔버스 드로잉 버퍼는 viewport × DPR (예: iPhone 1170×2532).
    // CSS는 100%×100%로 다운샘플 → 폰트·도형 선명.
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: window.innerWidth * (window.devicePixelRatio || 1),
    height: window.innerHeight * (window.devicePixelRatio || 1),
    expandParent: false,
  },
  render: {
    antialias: true,
    roundPixels: false,
  },
  plugins: {
    scene: [
      {
        key: 'rexUI',
        plugin: UIPlugin,
        mapping: 'rexUI',
      },
    ],
  },
  scene: [BootScene, AssignmentScene, GenreSelectScene, DevelopmentScene, ResultScene, StatsScene, EndingScene, SettingsScene],
};
