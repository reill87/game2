import Phaser from 'phaser';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { AssignmentScene } from './scenes/AssignmentScene';
import { BootScene } from './scenes/BootScene';
import { DevelopmentScene } from './scenes/DevelopmentScene';
import { GenreSelectScene } from './scenes/GenreSelectScene';
import { ResultScene } from './scenes/ResultScene';
import { DPR } from './util/hidpi';

export { GAME_HEIGHT, GAME_WIDTH };

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0e0e12',
  scale: {
    mode: Phaser.Scale.FIT,
    // autoCenter는 #app(display:flex)와 이중 중앙 정렬이 충돌해 캔버스가 어긋나는 사례가 있음 — CSS flex만 사용.
    autoCenter: Phaser.Scale.NO_CENTER,
    // 드로잉 버퍼를 DPR배 키우고 각 씬에서 카메라 zoom = DPR로 좌표계는 (720×1280)을 유지.
    width: GAME_WIDTH * DPR,
    height: GAME_HEIGHT * DPR,
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
