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
    // 캔버스 드로잉 버퍼는 DPR 배수로 — 모바일(DPR=3)에서 폰트·도형 선명도 확보.
    // CSS는 100%×100% (style.css)이라 브라우저가 다운샘플해서 sharp.
    mode: Phaser.Scale.RESIZE,
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
  scene: [BootScene, AssignmentScene, GenreSelectScene, DevelopmentScene, ResultScene, StatsScene, EndingScene],
};
