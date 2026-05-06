import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { AssignmentScene } from './scenes/AssignmentScene';
import { BootScene } from './scenes/BootScene';
import { DevelopmentScene } from './scenes/DevelopmentScene';
import { ResultScene } from './scenes/ResultScene';

export { GAME_HEIGHT, GAME_WIDTH };

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0e0e12',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    // 일부 환경에서 expandParent + flex 부모가 캔버스 기준점을 어색하게 만들 수 있어 끔
    expandParent: false,
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
  scene: [BootScene, AssignmentScene, DevelopmentScene, ResultScene],
};
