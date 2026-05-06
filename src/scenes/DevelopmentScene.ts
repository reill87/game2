import Phaser from 'phaser';
import type { Types } from 'phaser';

import { GAME_WIDTH } from '@/constants';
import { isMatched, SLOT_ORDER } from '@/domain/match';
import { JOB_LABEL, SLOT_LABEL } from '@/domain/seed';
import { shipProject } from '@/domain/result';
import { advanceWeek, canRelease, polishWeek } from '@/domain/tick';
import type { GameState, SlotKind } from '@/domain/types';
import { COLOR, FONT_STACK, TEXT_COLOR } from '@/theme';

import { SCENE_KEYS } from './keys';

const CX = GAME_WIDTH / 2;
const GAUGE_W = 600;
const GAUGE_H = 18;

function setButtonShown(view: ButtonView, shown: boolean): void {
  view.bg.setVisible(shown);
  view.text.setVisible(shown);
  view.enabled = shown;
  if (view.hit.input) view.hit.input.enabled = shown;
}

interface ButtonView {
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  rect: Phaser.Geom.Rectangle;
  hit: Phaser.GameObjects.Zone;
  /** 비활성 시 입력 무시. */
  enabled: boolean;
  /** 색·텍스트 갱신용 */
  redraw: (pressed: boolean) => void;
}

/**
 * 주간 개발 틱 화면.
 * - [다음 주 →] 탭 = advanceWeek()
 * - Progress 100% 도달 시 출시 패널로 전환 (액션 영역만 교체)
 * - 출시 패널: [지금 출시] / [1주 더 다듬기]
 * - 야근 토글은 v1 튜토리얼에서 비노출 (docs/PRODUCT_LOOP.md 정책)
 */
export class DevelopmentScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.Development;

  private state!: GameState;
  /** 폴리싱 회수 카운터 (결과 화면에서 표시용). */
  private polishCount = 0;

  private weekText!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private bugBar!: Phaser.GameObjects.Graphics;
  private bugText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private slotSummaryTexts = new Map<SlotKind, Phaser.GameObjects.Text>();
  private statusText!: Phaser.GameObjects.Text;

  private weekBtn!: ButtonView;
  private releaseBtn!: ButtonView;
  private polishBtn!: ButtonView;

  constructor() {
    super({ key: SCENE_KEYS.Development });
  }

  init(data: { state: GameState }): void {
    this.state = data.state;
    this.polishCount = 0;
  }

  create(): void {
    this.buildHeader();
    this.buildStats();
    this.buildAssignmentRecap();
    this.buildStatus();
    this.buildActions();
    this.redraw();
  }

  // ────────────────────────── header ──────────────────────────
  private buildHeader(): void {
    const titleStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '22px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    };
    this.add
      .text(CX, 50, '개발 중 — 초단타 터치 × 야근과 치킨', titleStyle)
      .setOrigin(0.5);

    this.weekText = this.add
      .text(CX, 88, '', {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
  }

  // ────────────────────────── stats panel ──────────────────────────
  private buildStats(): void {
    const panelX = (GAME_WIDTH - 690) / 2;
    const panelY = 120;
    const panelW = 690;
    const panelH = 260;

    const g = this.add.graphics();
    g.fillStyle(COLOR.panel, 1);
    g.lineStyle(2, COLOR.panelStroke, 1);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, 14);
    g.strokeRoundedRect(panelX, panelY, panelW, panelH, 14);

    const labelStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '15px',
      fontStyle: 'bold',
      color: TEXT_COLOR.dim,
    };
    const valueStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '15px',
      color: TEXT_COLOR.primary,
    };

    // Progress
    this.add.text(panelX + 24, panelY + 20, 'Progress', labelStyle);
    this.progressText = this.add
      .text(panelX + panelW - 24, panelY + 20, '0.0%', valueStyle)
      .setOrigin(1, 0);
    this.progressBar = this.add.graphics();
    this.drawGauge(this.progressBar, panelX + 24, panelY + 52, 0, COLOR.gaugeFillProgress);

    // BugDebt
    this.add.text(panelX + 24, panelY + 100, 'BugDebt', labelStyle);
    this.bugText = this.add
      .text(panelX + panelW - 24, panelY + 100, '0 / 100', valueStyle)
      .setOrigin(1, 0);
    this.bugBar = this.add.graphics();
    this.drawGauge(this.bugBar, panelX + 24, panelY + 132, 0, COLOR.gaugeFillBug);

    // Gold
    this.add.text(panelX + 24, panelY + 180, 'Gold', labelStyle);
    this.goldText = this.add
      .text(panelX + panelW - 24, panelY + 180, '0', valueStyle)
      .setOrigin(1, 0);

    // Hint
    this.add.text(
      panelX + 24,
      panelY + 218,
      '폴리싱은 출시 화면에서 가능 — BugDebt를 1주에 12씩 감소.',
      {
        fontFamily: FONT_STACK,
        fontSize: '12px',
        color: TEXT_COLOR.dim,
      },
    );
  }

  private drawGauge(g: Phaser.GameObjects.Graphics, x: number, y: number, ratio: number, fill: number): void {
    g.clear();
    g.fillStyle(COLOR.gaugeBg, 1);
    g.fillRoundedRect(x, y, GAUGE_W, GAUGE_H, GAUGE_H / 2);
    const w = Math.max(0, Math.min(1, ratio)) * GAUGE_W;
    if (w > 0) {
      g.fillStyle(fill, 1);
      g.fillRoundedRect(x, y, w, GAUGE_H, GAUGE_H / 2);
    }
  }

  // ────────────────────────── assignment recap ──────────────────────────
  private buildAssignmentRecap(): void {
    const startY = 410;
    this.add
      .text(CX, startY, '배치 요약', {
        fontFamily: FONT_STACK,
        fontSize: '13px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    const tileW = 320;
    const tileH = 70;
    const gapX = 18;
    const gapY = 14;
    const startX = (GAME_WIDTH - (tileW * 2 + gapX)) / 2;

    SLOT_ORDER.forEach((slot, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (tileW + gapX);
      const y = startY + 24 + row * (tileH + gapY);

      const g = this.add.graphics();
      g.fillStyle(COLOR.panelEmpty, 1);
      g.lineStyle(1, COLOR.panelStroke, 1);
      g.fillRoundedRect(x, y, tileW, tileH, 10);
      g.strokeRoundedRect(x, y, tileW, tileH, 10);

      this.add.text(x + 14, y + 12, SLOT_LABEL[slot], {
        fontFamily: FONT_STACK,
        fontSize: '12px',
        fontStyle: 'bold',
        color: TEXT_COLOR.dim,
      });

      const t = this.add.text(x + 14, y + 36, '', {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        color: TEXT_COLOR.primary,
      });
      this.slotSummaryTexts.set(slot, t);
    });
  }

  // ────────────────────────── status + actions ──────────────────────────
  private buildStatus(): void {
    this.statusText = this.add
      .text(CX, 920, '', {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        color: TEXT_COLOR.dim,
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  private buildActions(): void {
    // [다음 주] 풀폭 큰 버튼
    this.weekBtn = this.makeButton({
      x: CX - 360 / 2,
      y: 970,
      w: 360,
      h: 72,
      label: '다음 주 →',
      onTap: () => this.handleAdvanceWeek(),
      primary: true,
    });

    // 출시 패널 — 좌: 1주 더 다듬기 (보조), 우: 지금 출시 (주요)
    const polishX = CX - 360 - 8;
    const releaseX = CX + 8;
    this.polishBtn = this.makeButton({
      x: polishX,
      y: 970,
      w: 360,
      h: 72,
      label: '1주 더 다듬기',
      onTap: () => this.handlePolish(),
      primary: false,
    });
    this.releaseBtn = this.makeButton({
      x: releaseX,
      y: 970,
      w: 360,
      h: 72,
      label: '지금 출시',
      onTap: () => this.handleRelease(),
      primary: true,
    });

    // 출시 패널은 처음에 숨김
    this.setReleasePanelVisible(false);
  }

  private makeButton(opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    onTap: () => void;
    primary: boolean;
  }): ButtonView {
    const rect = new Phaser.Geom.Rectangle(opts.x, opts.y, opts.w, opts.h);
    const bg = this.add.graphics();
    const text = this.add
      .text(opts.x + opts.w / 2, opts.y + opts.h / 2, opts.label, {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    const hit = this.add
      .zone(opts.x + opts.w / 2, opts.y + opts.h / 2, opts.w, opts.h)
      .setInteractive({ useHandCursor: true });

    const view: ButtonView = {
      bg,
      text,
      rect,
      hit,
      enabled: true,
      redraw: (pressed: boolean) => {
        const baseColor = opts.primary ? COLOR.btn : COLOR.btnSecondary;
        const downColor = opts.primary ? COLOR.btnDown : COLOR.btnSecondaryDown;
        const color = !view.enabled ? COLOR.btnDisabled : pressed ? downColor : baseColor;
        bg.clear();
        bg.fillStyle(color, 1);
        bg.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 14);
        text.setColor(view.enabled ? TEXT_COLOR.primary : TEXT_COLOR.disabled);
      },
    };

    hit.on('pointerdown', () => {
      if (!view.enabled) return;
      view.redraw(true);
    });
    hit.on('pointerout', () => view.redraw(false));
    hit.on('pointerup', () => {
      view.redraw(false);
      if (!view.enabled) return;
      opts.onTap();
    });

    view.redraw(false);
    return view;
  }

  private setReleasePanelVisible(visible: boolean): void {
    setButtonShown(this.weekBtn, !visible);
    setButtonShown(this.releaseBtn, visible);
    setButtonShown(this.polishBtn, visible);
  }

  // ────────────────────────── interactions ──────────────────────────
  private handleAdvanceWeek(): void {
    this.state = advanceWeek(this.state);
    this.redraw();
  }

  private handlePolish(): void {
    this.state = polishWeek(this.state);
    this.polishCount += 1;
    this.redraw();
  }

  private handleRelease(): void {
    const outcome = shipProject(this.state, this.polishCount);
    this.scene.start(SCENE_KEYS.Result, {
      outcome,
      polishCount: this.polishCount,
    });
  }

  // ────────────────────────── render ──────────────────────────
  private redraw(): void {
    const { project } = this.state;
    this.weekText.setText(`Week ${project.weeksElapsed} / ${project.weeksTarget}`);
    this.progressText.setText(`${project.progress.toFixed(1)}%`);
    this.bugText
      .setText(`${Math.round(project.bugDebt)} / 100`)
      .setColor(project.bugDebt >= 70 ? TEXT_COLOR.bad : TEXT_COLOR.primary);
    this.goldText.setText(String(this.state.gold));

    const panelX = (GAME_WIDTH - 690) / 2 + 24;
    this.drawGauge(this.progressBar, panelX, 172, project.progress / 100, COLOR.gaugeFillProgress);
    this.drawGauge(this.bugBar, panelX, 252, project.bugDebt / 100, COLOR.gaugeFillBug);

    this.redrawAssignmentRecap();
    this.updateStatus();
    this.updateActionPanel();
  }

  private redrawAssignmentRecap(): void {
    const empById = new Map(this.state.employees.map((e) => [e.id, e] as const));
    for (const slot of SLOT_ORDER) {
      const t = this.slotSummaryTexts.get(slot);
      if (!t) continue;
      const empId = this.state.assignment[slot];
      if (!empId) {
        t.setText('비어 있음').setColor(TEXT_COLOR.disabled);
        continue;
      }
      const emp = empById.get(empId);
      if (!emp) {
        t.setText('—').setColor(TEXT_COLOR.disabled);
        continue;
      }
      const matched = isMatched(slot, emp.job);
      t.setText(`${emp.name} · ${JOB_LABEL[emp.job]} ${matched ? '✓' : '✗'}`).setColor(
        matched ? TEXT_COLOR.ok : TEXT_COLOR.bad,
      );
    }
  }

  private updateStatus(): void {
    const { project } = this.state;
    const overdue = project.weeksElapsed > project.weeksTarget;

    if (canRelease(this.state)) {
      const headline =
        project.bugDebt >= 70
          ? '출시 준비 완료 — 다만 BugDebt가 높아 리뷰가 험할 수 있습니다.'
          : '출시 준비 완료 — 폴리싱으로 BugDebt를 더 깎거나 바로 출시할 수 있습니다.';
      this.statusText
        .setText(headline)
        .setColor(project.bugDebt >= 70 ? TEXT_COLOR.bad : TEXT_COLOR.ok);
      return;
    }

    if (overdue) {
      this.statusText
        .setText(`연체 ${project.weeksElapsed - project.weeksTarget}주 — 매주 골드 -8 페널티 누적.`)
        .setColor(TEXT_COLOR.warn);
      return;
    }

    this.statusText.setText('한 주씩 진행하세요.').setColor(TEXT_COLOR.dim);
  }

  private updateActionPanel(): void {
    const releaseReady = canRelease(this.state);
    this.setReleasePanelVisible(releaseReady);
    if (releaseReady) {
      this.releaseBtn.redraw(false);
      this.polishBtn.redraw(false);
    } else {
      this.weekBtn.redraw(false);
    }
  }
}
