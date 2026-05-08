import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import { AssignmentScene } from './scenes/AssignmentScene';
import { BootScene } from './scenes/BootScene';
import { DevelopmentScene } from './scenes/DevelopmentScene';
import { GenreSelectScene } from './scenes/GenreSelectScene';
import { EndingScene } from './scenes/EndingScene';
import { ResultScene } from './scenes/ResultScene';
import { StatsScene } from './scenes/StatsScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  // transparent 캔버스 — letterbox 영역은 CSS #app 그라디언트가 비춤.
  transparent: true,
  scale: {
    // RESIZE: 캔버스가 viewport를 가득 채움. 콘텐츠 컬럼 좌표는 viewport.ts 헬퍼로 계산.
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: window.innerWidth,
    height: window.innerHeight,
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
  scene: [BootScene, AssignmentScene, GenreSelectScene, DevelopmentScene, ResultScene, StatsScene, EndingScene],
};
