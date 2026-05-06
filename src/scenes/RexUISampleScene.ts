import type { Types } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config';

const PANEL = 0x2a2a38;
const PANEL_STROKE = 0x4a4a62;
const BTN = 0x4f6fff;
const BTN_DOWN = 0x3d58cc;

function setFill(el: unknown, color: number): void {
  if (
    el &&
    typeof el === 'object' &&
    'setFillStyle' in el &&
    typeof (el as { setFillStyle: unknown }).setFillStyle === 'function'
  ) {
    (el as { setFillStyle: (c: number) => void }).setFillStyle(color);
  }
}

/**
 * rexUI(Sizer + RoundRectangle + Label) 스모크 테스트.
 * 경영 시뮬 본체 로직 없음 — UI 스택 검증 전용.
 */
export class RexUISampleScene extends Phaser.Scene {
  static readonly KEY = 'RexUISampleScene';

  constructor() {
    super({ key: RexUISampleScene.KEY });
  }

  create(): void {
    const titleStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Pretendard, system-ui, sans-serif',
      fontSize: '26px',
      fontStyle: '600',
      color: '#f2f2f7',
    };

    const bodyStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Pretendard, system-ui, sans-serif',
      fontSize: '18px',
      color: '#c8c8d4',
    };

    const buttonText = this.add.text(0, 0, '다음 턴(샘플)', bodyStyle);
    const statusText = this.add.text(0, 0, '버튼을 눌러 보세요.', {
      ...bodyStyle,
      fontSize: '16px',
      color: '#9b9bb0',
    });

    const actionLabel = this.rexUI.add
      .label({
        orientation: 'x',
        background: this.rexUI.add.roundRectangle(0, 0, 4, 4, 10, BTN),
        text: buttonText,
        space: { left: 18, right: 18, top: 12, bottom: 12 },
      })
      .setInteractive({ useHandCursor: true });

    actionLabel.on('pointerdown', () => {
      setFill(actionLabel.getElement('background'), BTN_DOWN);
    });

    actionLabel.on('pointerup', () => {
      setFill(actionLabel.getElement('background'), BTN);
      statusText.setText('rexUI 버튼 동작 확인됨');
    });

    const panelBg = this.rexUI.add
      .roundRectangle(0, 0, 8, 8, 18, PANEL)
      .setStrokeStyle(2, PANEL_STROKE);

    const panel = this.rexUI.add
      .sizer({
        orientation: 'y',
        space: { item: 16, top: 24, bottom: 24, left: 24, right: 24 },
      })
      .addBackground(panelBg)
      .add(this.add.text(0, 0, 'rexUI 패널', titleStyle), { align: 'center' })
      .add(
        this.add.text(
          0,
          0,
          'Kenney·아이콘 에셋은 public/assets/에 배치 후\n본 씬에서 ninepatch·이미지로 교체하면 됩니다.',
          { ...bodyStyle, align: 'center' },
        ),
        { align: 'center' },
      )
      .add(statusText, { align: 'center' })
      .add(actionLabel, { align: 'center' })
      .layout();

    panel.setOrigin(0.5, 0.5);
    panel.setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }
}
