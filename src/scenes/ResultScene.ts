import Phaser from 'phaser';
import type { Types } from 'phaser';

import { GAME_WIDTH } from '@/constants';
import type { ReleaseOutcome, ReviewStars } from '@/domain/result';
import { loadData, saveData } from '@/save';
import { COLOR, FONT_STACK, TEXT_COLOR } from '@/theme';

import { SCENE_KEYS } from './keys';

const CX = GAME_WIDTH / 2;

/** 출시 결과 화면. 자동 저장(localStorage)되며 [처음으로]는 Boot로 돌아가 골드를 이월한다. */
export class ResultScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.Result;

  private outcome!: ReleaseOutcome;
  private polishCount = 0;
  private savedAt: number | null = null;

  constructor() {
    super({ key: SCENE_KEYS.Result });
  }

  init(data: { outcome: ReleaseOutcome; polishCount?: number }): void {
    this.outcome = data.outcome;
    this.polishCount = data.polishCount ?? 0;
    this.savedAt = null;
  }

  create(): void {
    this.persistResult();
    this.buildHeader();
    this.buildHeadline();
    this.buildBreakdown();
    this.buildResetButton();
    this.buildSaveFooter();
  }

  // ────────────────────────── persistence ──────────────────────────
  private persistResult(): void {
    const o = this.outcome;
    const project = o.state.project;
    const existing = loadData();
    const saved = saveData({
      gold: o.state.gold,
      productCount: o.state.productIndex + 1,
      officeLevel: existing?.officeLevel ?? 1,
      hiredEmployees: existing?.hiredEmployees ?? [],
      lastResult: {
        genre: project.genre,
        theme: project.theme,
        weeksElapsed: project.weeksElapsed,
        weeksTarget: project.weeksTarget,
        bugDebt: Math.round(project.bugDebt),
        reviewScore: o.reviewScore,
        stars: o.stars,
        revenue: o.revenue,
        polishCount: this.polishCount,
      },
    });
    this.savedAt = saved?.savedAt ?? null;
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
      fontSize: '13px',
      color: TEXT_COLOR.dim,
    };

    this.add.text(CX, 60, '출시 완료', titleStyle).setOrigin(0.5);

    const { project } = this.outcome.state;
    const overdue = project.weeksElapsed > project.weeksTarget;
    const sub = `${project.genre} × ${project.theme} · Week ${project.weeksElapsed} / ${project.weeksTarget}${overdue ? ' (연체)' : ''}`;
    this.add.text(CX, 92, sub, subStyle).setOrigin(0.5);
  }

  // ────────────────────────── headline panel ──────────────────────────
  private buildHeadline(): void {
    const panelX = (GAME_WIDTH - 660) / 2;
    const panelY = 130;
    const panelW = 660;
    const panelH = 220;

    const g = this.add.graphics();
    g.fillStyle(COLOR.panel, 1);
    g.lineStyle(2, COLOR.panelStroke, 1);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, 16);
    g.strokeRoundedRect(panelX, panelY, panelW, panelH, 16);

    const stars = this.outcome.stars;
    this.add
      .text(CX, panelY + 50, this.starString(stars), {
        fontFamily: FONT_STACK,
        fontSize: '34px',
        fontStyle: 'bold',
        color: this.starColor(stars),
      })
      .setOrigin(0.5);

    this.add
      .text(CX, panelY + 110, this.outcome.headline, {
        fontFamily: FONT_STACK,
        fontSize: '17px',
        color: TEXT_COLOR.primary,
        align: 'center',
        wordWrap: { width: panelW - 48, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    this.add
      .text(CX, panelY + 160, `리뷰 점수 ${this.outcome.reviewScore} / 100`, {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
  }

  private starString(stars: ReviewStars): string {
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  }

  private starColor(stars: ReviewStars): string {
    if (stars >= 4) return TEXT_COLOR.ok;
    if (stars === 3) return TEXT_COLOR.warn;
    return TEXT_COLOR.bad;
  }

  // ────────────────────────── breakdown panel ──────────────────────────
  private buildBreakdown(): void {
    const o = this.outcome;
    const b = o.breakdown;
    const project = o.state.project;
    const overrun = Math.max(0, project.weeksElapsed - project.weeksTarget);

    const baseRows: ReadonlyArray<readonly [string, string, string]> = [
      ['매출', `+${o.revenue} 골드`, TEXT_COLOR.ok],
      ['보유 골드', `${o.state.gold}`, TEXT_COLOR.primary],
      ['BugDebt', `${Math.round(project.bugDebt)} / 100`, project.bugDebt >= 70 ? TEXT_COLOR.bad : TEXT_COLOR.primary],
      ...(project.appealEnabled
        ? ([['Appeal', `${Math.round(project.appeal)} / 100`, TEXT_COLOR.primary]] as const)
        : []),
      ['폴리싱', `${this.polishCount}주`, TEXT_COLOR.primary],
      ['연체', overrun > 0 ? `${overrun}주` : '없음', overrun > 0 ? TEXT_COLOR.warn : TEXT_COLOR.dim],
    ];
    const breakdownDetail = project.appealEnabled
      ? `기본 ${b.base}  −버그 ${b.bugPenalty}  −연체 ${b.overrunPenalty}  +폴리싱 ${b.polishBonus}  +매력 ${b.appealBonus}`
      : `기본 ${b.base}  −버그 ${b.bugPenalty}  −연체 ${b.overrunPenalty}  +폴리싱 ${b.polishBonus}`;
    const rows: ReadonlyArray<readonly [string, string, string]> = [
      ...baseRows,
      ['점수 분해', breakdownDetail, TEXT_COLOR.dim],
    ];

    const panelX = (GAME_WIDTH - 660) / 2;
    const panelY = 380;
    const panelW = 660;
    const rowH = 46;
    const panelH = rows.length * rowH + 28;

    const g = this.add.graphics();
    g.fillStyle(COLOR.panel, 1);
    g.lineStyle(2, COLOR.panelStroke, 1);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, 14);
    g.strokeRoundedRect(panelX, panelY, panelW, panelH, 14);

    const labelStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '14px',
      color: TEXT_COLOR.dim,
    };

    rows.forEach(([label, value, color], i) => {
      const y = panelY + 14 + i * rowH + rowH / 2;
      this.add.text(panelX + 20, y, label, labelStyle).setOrigin(0, 0.5);
      this.add
        .text(panelX + panelW - 20, y, value, {
          fontFamily: FONT_STACK,
          fontSize: '15px',
          color,
        })
        .setOrigin(1, 0.5);
    });
  }

  // ────────────────────────── reset button ──────────────────────────
  private buildResetButton(): void {
    const w = 360;
    const h = 72;
    const x = CX - w / 2;
    const y = 1000;
    const rect = new Phaser.Geom.Rectangle(x, y, w, h);
    const bg = this.add.graphics();
    this.add
      .text(CX, y + h / 2, '다음 작품으로', {
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

    const hit = this.add
      .zone(CX, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerup', () => {
      draw(false);
      // Boot로 돌아가 저장된 골드를 이월하여 새 작품 시작.
      this.scene.start(SCENE_KEYS.Boot);
    });
  }

  // ────────────────────────── save footer ──────────────────────────
  private buildSaveFooter(): void {
    const text = this.savedAt ? `저장됨 — ${this.formatTime(this.savedAt)}` : '저장 실패 (localStorage 비활성)';
    this.add
      .text(CX, 1110, text, {
        fontFamily: FONT_STACK,
        fontSize: '12px',
        color: this.savedAt ? TEXT_COLOR.dim : TEXT_COLOR.bad,
      })
      .setOrigin(0.5);
  }

  private formatTime(ts: number): string {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}
