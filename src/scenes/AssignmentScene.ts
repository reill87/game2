import Phaser from 'phaser';
import type { Types } from 'phaser';

import { GAME_WIDTH } from '@/constants';
import { isMatched, SLOT_ORDER } from '@/domain/match';
import { JOB_LABEL, newTutorialGame, SLOT_LABEL } from '@/domain/seed';
import { isTutorialAssignmentReady, place } from '@/domain/tick';
import type { Employee, GameState, SlotKind } from '@/domain/types';

const FONT_STACK =
  '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Pretendard, system-ui, sans-serif';

/** 색상 토큰. 후속에서 src/theme.ts로 분리 예정. */
const COLOR = {
  panel: 0x2a2a38,
  panelStroke: 0x4a4a62,
  panelEmpty: 0x20202a,
  selected: 0x4f6fff,
  matchOk: 0x3ec07b,
  matchBad: 0xe55f5f,
  btn: 0x4f6fff,
  btnDown: 0x3d58cc,
  btnDisabled: 0x3a3a48,
} as const;

const TEXT_COLOR = {
  primary: '#f2f2f7',
  dim: '#9b9bb0',
  ok: '#3ec07b',
  bad: '#e55f5f',
  disabled: '#6a6a78',
} as const;

const CX = GAME_WIDTH / 2;

interface SlotView {
  bg: Phaser.GameObjects.Graphics;
  slotLabel: Phaser.GameObjects.Text;
  empNameText: Phaser.GameObjects.Text;
  matchHint: Phaser.GameObjects.Text;
  rect: Phaser.Geom.Rectangle;
  hit: Phaser.GameObjects.Zone;
}

interface EmployeeView {
  bg: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  jobText: Phaser.GameObjects.Text;
  placedText: Phaser.GameObjects.Text;
  rect: Phaser.Geom.Rectangle;
  hit: Phaser.GameObjects.Zone;
}

/** 슬롯 4×직원 3 배치 화면. v1 튜토리얼 — 사운드 슬롯은 비어 있어도 진행 가능. */
export class AssignmentScene extends Phaser.Scene {
  static readonly KEY = 'AssignmentScene';

  private state: GameState = newTutorialGame();
  private selectedEmpId: string | null = null;

  private slotViews = new Map<SlotKind, SlotView>();
  private empViews = new Map<string, EmployeeView>();
  private startBtnBg!: Phaser.GameObjects.Graphics;
  private startBtnText!: Phaser.GameObjects.Text;
  private startBtnRect!: Phaser.Geom.Rectangle;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: AssignmentScene.KEY });
  }

  create(): void {
    this.buildHeader();
    this.buildSlots();
    this.buildEmployees();
    this.buildStartButton();
    this.buildStatus();
    this.redraw();
  }

  // ────────────────────────── header ──────────────────────────
  private buildHeader(): void {
    const titleStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '24px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    };
    const subStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '14px',
      color: TEXT_COLOR.dim,
      align: 'center',
      wordWrap: { width: GAME_WIDTH - 80, useAdvancedWrap: true },
    };

    this.add.text(CX, 56, '첫 작품 — 초단타 터치 × 야근과 치킨', titleStyle).setOrigin(0.5);
    this.add
      .text(
        CX,
        96,
        '직원을 담당에 배치하세요. 정배치 시 효율 100%, 오배치 시 50% + BugDebt +2/주.',
        subStyle,
      )
      .setOrigin(0.5);
  }

  // ────────────────────────── slots ──────────────────────────
  private buildSlots(): void {
    const tileW = 290;
    const tileH = 150;
    const gapX = 20;
    const gapY = 20;
    const startX = (GAME_WIDTH - (tileW * 2 + gapX)) / 2;
    const startY = 150;

    SLOT_ORDER.forEach((slot, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (tileW + gapX);
      const y = startY + row * (tileH + gapY);
      this.slotViews.set(slot, this.makeSlotView(slot, x, y, tileW, tileH));
    });
  }

  private makeSlotView(slot: SlotKind, x: number, y: number, w: number, h: number): SlotView {
    const rect = new Phaser.Geom.Rectangle(x, y, w, h);
    const bg = this.add.graphics();

    const slotLabel = this.add
      .text(x + w / 2, y + 28, SLOT_LABEL[slot], {
        fontFamily: FONT_STACK,
        fontSize: '16px',
        fontStyle: 'bold',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    const empNameText = this.add
      .text(x + w / 2, y + h / 2 + 6, '비어 있음', {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        color: TEXT_COLOR.disabled,
      })
      .setOrigin(0.5);

    const matchHint = this.add
      .text(x + w / 2, y + h - 26, '', {
        fontFamily: FONT_STACK,
        fontSize: '13px',
        color: TEXT_COLOR.ok,
      })
      .setOrigin(0.5);

    const hit = this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setRectangleDropZone(w, h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.onSlotTap(slot));

    return { bg, slotLabel, empNameText, matchHint, rect, hit };
  }

  // ────────────────────────── employee cards ──────────────────────────
  private buildEmployees(): void {
    const cardW = 200;
    const cardH = 150;
    const gap = 14;
    const totalW = cardW * 3 + gap * 2;
    const startX = (GAME_WIDTH - totalW) / 2;
    const startY = 540;

    this.add
      .text(CX, startY - 26, '직원 (3명)', {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    this.state.employees.forEach((emp, i) => {
      const x = startX + i * (cardW + gap);
      this.empViews.set(emp.id, this.makeEmployeeView(emp, x, startY, cardW, cardH));
    });
  }

  private makeEmployeeView(emp: Employee, x: number, y: number, w: number, h: number): EmployeeView {
    const rect = new Phaser.Geom.Rectangle(x, y, w, h);
    const bg = this.add.graphics();

    const nameText = this.add
      .text(x + w / 2, y + 30, emp.name, {
        fontFamily: FONT_STACK,
        fontSize: '15px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
        align: 'center',
        wordWrap: { width: w - 16, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);

    const jobText = this.add
      .text(x + w / 2, y + h / 2 + 4, JOB_LABEL[emp.job], {
        fontFamily: FONT_STACK,
        fontSize: '13px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    const placedText = this.add
      .text(x + w / 2, y + h - 26, '', {
        fontFamily: FONT_STACK,
        fontSize: '12px',
        color: TEXT_COLOR.ok,
      })
      .setOrigin(0.5);

    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.onEmployeeTap(emp.id));

    return { bg, nameText, jobText, placedText, rect, hit };
  }

  // ────────────────────────── start button ──────────────────────────
  private buildStartButton(): void {
    const w = 360;
    const h = 72;
    const x = CX - w / 2;
    const y = 1140;
    this.startBtnRect = new Phaser.Geom.Rectangle(x, y, w, h);
    this.startBtnBg = this.add.graphics();
    this.startBtnText = this.add
      .text(CX, y + h / 2, '개발 시작', {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);

    const hit = this.add
      .zone(CX, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.onStartButtonDown());
    hit.on('pointerup', () => this.onStartButtonUp());
    hit.on('pointerout', () => this.drawStartButton(false));
  }

  private buildStatus(): void {
    this.statusText = this.add
      .text(CX, 1090, '', {
        fontFamily: FONT_STACK,
        fontSize: '13px',
        color: TEXT_COLOR.dim,
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  // ────────────────────────── interactions ──────────────────────────
  private onEmployeeTap(empId: string): void {
    this.selectedEmpId = this.selectedEmpId === empId ? null : empId;
    this.redraw();
  }

  private onSlotTap(slot: SlotKind): void {
    const occupant = this.state.assignment[slot];
    if (this.selectedEmpId) {
      this.state = place(this.state, slot, this.selectedEmpId);
      this.selectedEmpId = null;
    } else if (occupant) {
      this.state = place(this.state, slot, null);
    }
    this.redraw();
  }

  private onStartButtonDown(): void {
    if (!isTutorialAssignmentReady(this.state)) return;
    this.drawStartButton(true);
  }

  private onStartButtonUp(): void {
    this.drawStartButton(false);
    if (!isTutorialAssignmentReady(this.state)) return;
    // 다음 슬라이스(개발 씬)는 후속 커밋. 지금은 상태만 표시.
    this.statusText
      .setText('배치 완료. (다음 슬라이스에서 개발 씬으로 전환)')
      .setColor(TEXT_COLOR.ok);
  }

  // ────────────────────────── render ──────────────────────────
  private redraw(): void {
    this.drawSlots();
    this.drawEmployees();
    this.drawStartButton(false);
    this.updateStatus();
  }

  private drawSlots(): void {
    const empById = new Map(this.state.employees.map((e) => [e.id, e] as const));
    for (const slot of SLOT_ORDER) {
      const view = this.slotViews.get(slot);
      if (!view) continue;
      const empId = this.state.assignment[slot];
      const emp = empId ? empById.get(empId) : undefined;
      const matched = emp ? isMatched(slot, emp.job) : null;

      const fill: number = emp ? COLOR.panel : COLOR.panelEmpty;
      let stroke: number = COLOR.panelStroke;
      if (this.selectedEmpId && !emp) stroke = COLOR.selected;
      if (matched === true) stroke = COLOR.matchOk;
      if (matched === false) stroke = COLOR.matchBad;

      view.bg.clear();
      view.bg.fillStyle(fill, 1);
      view.bg.lineStyle(2, stroke, 1);
      view.bg.fillRoundedRect(view.rect.x, view.rect.y, view.rect.width, view.rect.height, 14);
      view.bg.strokeRoundedRect(view.rect.x, view.rect.y, view.rect.width, view.rect.height, 14);

      if (emp) {
        view.empNameText.setText(emp.name).setColor(TEXT_COLOR.primary);
        view.matchHint
          .setText(matched ? '정배치' : '오배치 — 효율 50% / BugDebt +2')
          .setColor(matched ? TEXT_COLOR.ok : TEXT_COLOR.bad)
          .setVisible(true);
      } else {
        view.empNameText.setText('비어 있음').setColor(TEXT_COLOR.disabled);
        view.matchHint.setVisible(false);
      }
    }
  }

  private drawEmployees(): void {
    const placedSlotByEmp = new Map<string, SlotKind>();
    for (const slot of SLOT_ORDER) {
      const id = this.state.assignment[slot];
      if (id) placedSlotByEmp.set(id, slot);
    }

    for (const emp of this.state.employees) {
      const view = this.empViews.get(emp.id);
      if (!view) continue;
      const placedSlot = placedSlotByEmp.get(emp.id);
      const selected = this.selectedEmpId === emp.id;

      view.bg.clear();
      view.bg.fillStyle(placedSlot ? COLOR.panelEmpty : COLOR.panel, 1);
      view.bg.lineStyle(selected ? 3 : 2, selected ? COLOR.selected : COLOR.panelStroke, 1);
      view.bg.fillRoundedRect(view.rect.x, view.rect.y, view.rect.width, view.rect.height, 14);
      view.bg.strokeRoundedRect(view.rect.x, view.rect.y, view.rect.width, view.rect.height, 14);

      if (placedSlot) {
        view.placedText
          .setText(`배치됨 · ${SLOT_LABEL[placedSlot]}`)
          .setColor(TEXT_COLOR.dim)
          .setVisible(true);
        view.nameText.setColor(TEXT_COLOR.dim);
        view.jobText.setColor(TEXT_COLOR.dim);
      } else {
        view.placedText.setVisible(false);
        view.nameText.setColor(TEXT_COLOR.primary);
        view.jobText.setColor(TEXT_COLOR.dim);
      }
    }
  }

  private drawStartButton(pressed: boolean): void {
    const ready = isTutorialAssignmentReady(this.state);
    const color = !ready ? COLOR.btnDisabled : pressed ? COLOR.btnDown : COLOR.btn;
    this.startBtnBg.clear();
    this.startBtnBg.fillStyle(color, 1);
    this.startBtnBg.fillRoundedRect(
      this.startBtnRect.x,
      this.startBtnRect.y,
      this.startBtnRect.width,
      this.startBtnRect.height,
      14,
    );
    this.startBtnText.setColor(ready ? TEXT_COLOR.primary : TEXT_COLOR.disabled);
  }

  private updateStatus(): void {
    if (!isTutorialAssignmentReady(this.state)) {
      this.statusText
        .setText('아직 배치되지 않은 직원이 있습니다. (사운드 슬롯은 비워도 됩니다)')
        .setColor(TEXT_COLOR.dim);
      return;
    }
    const mismatches = this.countMismatches();
    if (mismatches === 0) {
      this.statusText.setText('정배치 완료. 개발을 시작할 수 있습니다.').setColor(TEXT_COLOR.ok);
    } else {
      this.statusText
        .setText(`오배치 ${mismatches}건. 시작은 가능하지만 일정·버그 페널티가 누적됩니다.`)
        .setColor(TEXT_COLOR.bad);
    }
  }

  private countMismatches(): number {
    const empById = new Map(this.state.employees.map((e) => [e.id, e] as const));
    let count = 0;
    for (const slot of SLOT_ORDER) {
      const id = this.state.assignment[slot];
      if (!id) continue;
      const emp = empById.get(id);
      if (emp && !isMatched(slot, emp.job)) count += 1;
    }
    return count;
  }
}
