import type { Types } from 'phaser';
import { GAME_WIDTH } from '@/constants';

/** Phaser Text: 숫자 weight는 fontStyle이 아니라 fontFamily 스택으로 (fontStyle은 bold/italic 만 안전) */
const FONT_STACK =
  '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Pretendard, system-ui, sans-serif';

const PANEL = 0x2a2a38;
const PANEL_STROKE = 0x4a4a62;
const BTN = 0x4f6fff;
const BTN_DOWN = 0x3d58cc;

const CX = GAME_WIDTH / 2;

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
 * rexUI 스모크: **Label(버튼)** 만 rexUI, 나머지는 Phaser 고정 배치.
 * (Sizer + 잘못된 fontStyle 등으로 Text 메트릭이 0이 되면 패널이 막대로만 보일 수 있음)
 */
export class RexUISampleScene extends Phaser.Scene {
  static readonly KEY = 'RexUISampleScene';

  constructor() {
    super({ key: RexUISampleScene.KEY });
  }

  create(): void {
    const titleStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#f2f2f7',
    };

    const bodyStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '15px',
      color: '#c8c8d4',
      align: 'center',
      wordWrap: { width: 600, useAdvancedWrap: true },
    };

    const panelW = 660;
    const panelH = 280;
    const panelY = 260;

    this.rexUI.add
      .roundRectangle(CX, panelY, panelW, panelH, 18, PANEL)
      .setStrokeStyle(2, PANEL_STROKE)
      .setDepth(0);

    this.add
      .text(CX, panelY - panelH / 2 + 28, 'rexUI 패널', titleStyle)
      .setOrigin(0.5, 0)
      .setDepth(1);

    this.add
      .text(
        CX,
        panelY - panelH / 2 + 68,
        'Kenney·아이콘은 public/assets/에 두고, 이후 ninepatch·이미지로 바꿀 수 있습니다.',
        bodyStyle,
      )
      .setOrigin(0.5, 0)
      .setDepth(1);

    const statusText = this.add
      .text(CX, panelY + panelH / 2 - 56, '아래 파란 버튼(rexUI Label)을 눌러 보세요.', {
        ...bodyStyle,
        fontSize: '14px',
        color: '#9b9bb0',
      })
      .setOrigin(0.5, 0)
      .setDepth(1);

    const buttonText = this.add.text(0, 0, '다음 턴(샘플)', {
      fontFamily: FONT_STACK,
      fontSize: '16px',
      color: '#ffffff',
    });

    const actionLabel = this.rexUI.add
      .label({
        orientation: 'x',
        background: this.rexUI.add.roundRectangle(0, 0, 220, 48, 12, BTN),
        text: buttonText,
        space: { left: 18, right: 18, top: 0, bottom: 0 },
      })
      .setInteractive({ useHandCursor: true });

    actionLabel.on('pointerdown', () => {
      setFill(actionLabel.getElement('background'), BTN_DOWN);
    });

    actionLabel.on('pointerup', () => {
      setFill(actionLabel.getElement('background'), BTN);
      statusText.setText('rexUI 버튼 동작 확인됨');
    });

    actionLabel.layout();
    actionLabel.setDepth(2);
    actionLabel.setPosition(CX, panelY + panelH / 2 + 52);
  }
}
