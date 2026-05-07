import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { AssignmentScene } from './scenes/AssignmentScene';
import { BootScene } from './scenes/BootScene';
import { DevelopmentScene } from './scenes/DevelopmentScene';
import { GenreSelectScene } from './scenes/GenreSelectScene';
import { ResultScene } from './scenes/ResultScene';

export { GAME_HEIGHT, GAME_WIDTH };

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0e0e12',
  scale: {
    mode: Phaser.Scale.FIT,
    // autoCenter는 #app(display:flex)와 이중 중앙 정렬이 충돌해 캔버스가 어긋나는 사례가 있음 — CSS flex만 사용.
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
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
  scene: [BootScene, AssignmentScene, GenreSelectScene, DevelopmentScene, ResultScene],
};
