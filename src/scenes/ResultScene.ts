import Phaser from 'phaser';
import type { Types } from 'phaser';

import { GAME_WIDTH } from '@/constants';
import type { GameState } from '@/domain/types';
import { COLOR, FONT_STACK, TEXT_COLOR } from '@/theme';

import { SCENE_KEYS } from './keys';

const CX = GAME_WIDTH / 2;

/**
 * 결과 화면 — 슬라이스 2 placeholder.
 * 슬라이스 3에서 매출/리뷰 헤드라인/명성 변화/localStorage 저장을 추가한다.
 */
export class ResultScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.Result;

  private state!: GameState;
  private polishCount = 0;

  constructor() {
    super({ key: SCENE_KEYS.Result });
  }

  init(data: { state: GameState; polishCount?: number }): void {
    this.state = data.state;
    this.polishCount = data.polishCount ?? 0;
  }

  create(): void {
    const titleStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '26px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    };
    const labelStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '14px',
      color: TEXT_COLOR.dim,
    };
    const valueStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '18px',
      color: TEXT_COLOR.primary,
    };

    this.add.text(CX, 80, '출시 완료', titleStyle).setOrigin(0.5);

    const project = this.state.project;
    const summary = [
      ['작품', `${project.genre} × ${project.theme}`],
      ['주차', `${project.weeksElapsed} / ${project.weeksTarget}${project.weeksElapsed > project.weeksTarget ? ' (연체)' : ''}`],
      ['Progress', `${project.progress.toFixed(1)} %`],
      ['BugDebt', `${Math.round(project.bugDebt)} / 100`],
      ['폴리싱', `${this.polishCount}주`],
      ['Gold', `${this.state.gold}`],
    ] as const;

    const panelX = (GAME_WIDTH - 600) / 2;
    const panelY = 160;
    const panelW = 600;
    const rowH = 56;
    const panelH = rowH * summary.length + 32;

    const panel = this.add.graphics();
    panel.fillStyle(COLOR.panel, 1);
    panel.lineStyle(2, COLOR.panelStroke, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 14);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 14);

    summary.forEach(([k, v], i) => {
      const y = panelY + 16 + i * rowH + rowH / 2;
      this.add.text(panelX + 24, y, k, labelStyle).setOrigin(0, 0.5);
      this.add.text(panelX + panelW - 24, y, v, valueStyle).setOrigin(1, 0.5);
    });

    this.add
      .text(CX, panelY + panelH + 28, '리뷰·매출은 다음 슬라이스에서 본격 구현 예정입니다.', {
        fontFamily: FONT_STACK,
        fontSize: '12px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    this.buildResetButton(panelY + panelH + 80);
  }

  private buildResetButton(y: number): void {
    const w = 360;
    const h = 72;
    const x = CX - w / 2;
    const rect = new Phaser.Geom.Rectangle(x, y, w, h);
    const bg = this.add.graphics();
    const text = this.add
      .text(CX, y + h / 2, '처음으로', {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);

    const draw = (pressed: boolean): void => {
      bg.clear();
      bg.fillStyle(pressed ? COLOR.btnDown : COLOR.btn, 1);
      bg.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 14);
    };
    draw(false);
    text.setVisible(true);

    const hit = this.add
      .zone(CX, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerup', () => {
      draw(false);
      this.scene.start(SCENE_KEYS.Assignment);
    });
  }
}
