import Phaser from 'phaser';
import type { Types } from 'phaser';

import { GAME_WIDTH } from '@/constants';
import { isMatched, SLOT_ORDER } from '@/domain/match';
import { PROMO } from '@/domain/balance';
import { GENRE_LABEL, JOB_LABEL, SLOT_LABEL, THEME_LABEL } from '@/domain/seed';
import { shipProject } from '@/domain/result';
import { advanceWeek, canRelease, polishWeek } from '@/domain/tick';
import type { GameState, PromoTier, SlotKind } from '@/domain/types';
import { ICONS } from '@/icons';
import { COLOR, FONT_STACK, TEXT_COLOR, TINT } from '@/theme';
import { applyHiDPI } from '@/util/hidpi';
import { makePanel } from '@/util/ui';

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
 * - 야근 토글은 우상단에 작은 버튼. 노출 정책은 추후 productCount 기반으로 좁힘.
 */
export class DevelopmentScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.Development;

  private state!: GameState;
  /** 폴리싱 회수 카운터 (결과 화면에서 표시용). */
  private polishCount = 0;

  private weekText!: Phaser.GameObjects.Text;
  private weekIcon!: Phaser.GameObjects.Image;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;
  private bugBar!: Phaser.GameObjects.Graphics;
  private bugText!: Phaser.GameObjects.Text;
  private appealBar: Phaser.GameObjects.Graphics | null = null;
  private appealText: Phaser.GameObjects.Text | null = null;
  private goldText!: Phaser.GameObjects.Text;
  private slotSummaryTexts = new Map<SlotKind, Phaser.GameObjects.Text>();
  private statusText!: Phaser.GameObjects.Text;

  private weekBtn!: ButtonView;
  private releaseBtn!: ButtonView;
  private polishBtn!: ButtonView;

  // crunch (야근) toggle
  private crunchBtnBg!: Phaser.GameObjects.Graphics;
  private crunchBtnText!: Phaser.GameObjects.Text;
  private crunchBtnRect!: Phaser.Geom.Rectangle;

  // promo selector (2작부터, 출시 패널 동안만 노출)
  private selectedPromo: PromoTier = 'none';
  private promoLabel: Phaser.GameObjects.Text | null = null;
  private promoButtons = new Map<
    PromoTier,
    {
      bg: Phaser.GameObjects.Graphics;
      text: Phaser.GameObjects.Text;
      rect: Phaser.Geom.Rectangle;
      hit: Phaser.GameObjects.Zone;
    }
  >();

  constructor() {
    super({ key: SCENE_KEYS.Development });
  }

  init(data: { state: GameState }): void {
    // 튜토리얼은 야근 토글을 노출하지 않으므로, 외부에서 crunch=true가 흘러 들어와도
    // 토글 없이 ON 상태로 잠기는 일을 방지한다.
    const incoming = data.state;
    this.state =
      incoming.productIndex < 1 && incoming.crunch ? { ...incoming, crunch: false } : incoming;
    this.polishCount = 0;
    this.selectedPromo = 'none';
  }

  create(): void {
    this.buildHeader();
    if (this.state.productIndex >= 1) this.buildCrunchToggle();
    this.buildStats();
    this.buildAssignmentRecap();
    this.buildStatus();
    this.buildActions();
    if (this.state.productIndex >= 1) this.buildPromoSelector();
    this.redraw();
    applyHiDPI(this);
  }

  // ────────────────────────── header ──────────────────────────
  private buildHeader(): void {
    const titleStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '22px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    };
    const genre = GENRE_LABEL[this.state.project.genre].name;
    const theme = THEME_LABEL[this.state.project.theme].name;
    this.add.text(CX, 50, `개발 중 — ${genre} × ${theme}`, titleStyle).setOrigin(0.5);

    this.weekText = this.add
      .text(CX, 88, '', {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
    this.weekIcon = this.add
      .image(0, 88, ICONS.calendar.key)
      .setDisplaySize(14, 14)
      .setOrigin(1, 0.5)
      .setTint(TINT.dim);
  }

  // ────────────────────────── crunch toggle ──────────────────────────
  private buildCrunchToggle(): void {
    const w = 124;
    const h = 40;
    const x = GAME_WIDTH - 14 - w;
    const y = 18;
    this.crunchBtnRect = new Phaser.Geom.Rectangle(x, y, w, h);
    this.crunchBtnBg = this.add.graphics();
    this.crunchBtnText = this.add
      .text(x + w / 2, y + h / 2, '', {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);

    const hit = this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.handleToggleCrunch());
  }

  private drawCrunchToggle(): void {
    const on = this.state.crunch;
    const fill = on ? COLOR.matchBad : COLOR.btnSecondary;
    const r = this.crunchBtnRect;
    this.crunchBtnBg.clear();
    this.crunchBtnBg.fillStyle(fill, 1);
    this.crunchBtnBg.fillRoundedRect(r.x, r.y, r.width, r.height, 12);
    this.crunchBtnText.setText(on ? '야근 ON' : '야근 OFF');
  }

  private handleToggleCrunch(): void {
    this.state = { ...this.state, crunch: !this.state.crunch };
    this.drawCrunchToggle();
    this.updateStatus();
  }

  // ────────────────────────── stats panel ──────────────────────────
  private buildStats(): void {
    const appealEnabled = this.state.project.appealEnabled;
    const panelX = (GAME_WIDTH - 690) / 2;
    const panelY = 120;
    const panelW = 690;
    const panelH = appealEnabled ? 320 : 260;

    makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);

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

    const ICON_SIZE = 16;
    const ICON_GAP = 8;
    const labelX = panelX + 24 + ICON_SIZE + ICON_GAP;

    // Progress
    this.addLabelIcon(panelX + 24, panelY + 28, ICONS.progress.key, TINT.dim);
    this.add.text(labelX, panelY + 20, 'Progress', labelStyle);
    this.progressText = this.add
      .text(panelX + panelW - 24, panelY + 20, '0.0%', valueStyle)
      .setOrigin(1, 0);
    this.progressBar = this.add.graphics();
    this.drawGauge(this.progressBar, panelX + 24, panelY + 52, 0, COLOR.gaugeFillProgress);

    // BugDebt
    this.addLabelIcon(panelX + 24, panelY + 108, ICONS.bug.key, TINT.bad);
    this.add.text(labelX, panelY + 100, 'BugDebt', labelStyle);
    this.bugText = this.add
      .text(panelX + panelW - 24, panelY + 100, '0 / 100', valueStyle)
      .setOrigin(1, 0);
    this.bugBar = this.add.graphics();
    this.drawGauge(this.bugBar, panelX + 24, panelY + 132, 0, COLOR.gaugeFillBug);

    // Appeal (해금 시에만)
    if (appealEnabled) {
      this.addLabelIcon(panelX + 24, panelY + 188, ICONS.sparkle.key, TINT.dim);
      this.add.text(labelX, panelY + 180, 'Appeal', labelStyle);
      this.appealText = this.add
        .text(panelX + panelW - 24, panelY + 180, '0 / 100', valueStyle)
        .setOrigin(1, 0);
      this.appealBar = this.add.graphics();
      this.drawGauge(this.appealBar, panelX + 24, panelY + 212, 0, COLOR.gaugeFillProgress);
    }

    // Gold
    const goldY = appealEnabled ? panelY + 260 : panelY + 180;
    this.addLabelIcon(panelX + 24, goldY + 8, ICONS.coins.key, TINT.warn);
    this.add.text(labelX, goldY, 'Gold', labelStyle);
    this.goldText = this.add
      .text(panelX + panelW - 24, goldY, '0', valueStyle)
      .setOrigin(1, 0);

    // Hint
    const hintY = appealEnabled ? panelY + 298 : panelY + 218;
    this.add.text(
      panelX + 24,
      hintY,
      '폴리싱은 출시 화면에서 가능 — BugDebt를 1주에 12씩 감소.',
      {
        fontFamily: FONT_STACK,
        fontSize: '12px',
        color: TEXT_COLOR.dim,
      },
    );
  }

  private addLabelIcon(x: number, centerY: number, key: string, tint: number): void {
    this.add
      .image(x, centerY, key)
      .setDisplaySize(16, 16)
      .setOrigin(0, 0.5)
      .setTint(tint);
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
    const startY = this.state.project.appealEnabled ? 470 : 410;
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

      makePanel(this, x, y, tileW, tileH, COLOR.panelEmpty);

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

  private buildPromoSelector(): void {
    const tiers: ReadonlyArray<PromoTier> = ['none', 'small', 'medium'];
    const labelStyle = {
      fontFamily: FONT_STACK,
      fontSize: '12px',
      color: TEXT_COLOR.dim,
    } satisfies Types.GameObjects.Text.TextStyle;

    this.promoLabel = this.add
      .text(CX, 866, '홍보 (출시 시 골드 차감)', labelStyle)
      .setOrigin(0.5);

    const btnW = 184;
    const btnH = 44;
    const gap = 14;
    const totalW = btnW * 3 + gap * 2;
    const startX = (GAME_WIDTH - totalW) / 2;
    const y = 890;

    tiers.forEach((tier, i) => {
      const x = startX + i * (btnW + gap);
      const rect = new Phaser.Geom.Rectangle(x, y, btnW, btnH);
      const bg = this.add.graphics();
      const promo = PROMO[tier];
      const labelText =
        tier === 'none' ? promo.label : `${promo.label} · -${promo.cost}g · +${Math.round((promo.revenueMul - 1) * 100)}%`;
      const text = this.add
        .text(x + btnW / 2, y + btnH / 2, labelText, {
          fontFamily: FONT_STACK,
          fontSize: '13px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5);
      const hit = this.add
        .zone(x + btnW / 2, y + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.handlePromoTap(tier));
      this.promoButtons.set(tier, { bg, text, rect, hit });
    });
  }

  private handlePromoTap(tier: PromoTier): void {
    if (this.state.gold < PROMO[tier].cost) return;
    this.selectedPromo = tier;
    this.drawPromoSelector();
  }

  private drawPromoSelector(): void {
    for (const [tier, view] of this.promoButtons) {
      const promo = PROMO[tier];
      const affordable = this.state.gold >= promo.cost;
      const selected = this.selectedPromo === tier;
      const fill = !affordable
        ? COLOR.btnDisabled
        : selected
          ? COLOR.btn
          : COLOR.btnSecondary;
      view.bg.clear();
      view.bg.fillStyle(fill, 1);
      view.bg.fillRoundedRect(view.rect.x, view.rect.y, view.rect.width, view.rect.height, 12);
      view.text.setColor(affordable ? TEXT_COLOR.primary : TEXT_COLOR.disabled);
      if (view.hit.input) view.hit.input.enabled = affordable;
    }
  }

  private setPromoVisible(visible: boolean): void {
    if (this.state.productIndex < 1) return;
    if (this.promoLabel) this.promoLabel.setVisible(visible);
    for (const view of this.promoButtons.values()) {
      view.bg.setVisible(visible);
      view.text.setVisible(visible);
      if (view.hit.input) view.hit.input.enabled = visible;
    }
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
    this.setPromoVisible(visible);
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
    const outcome = shipProject(this.state, this.polishCount, this.selectedPromo);
    this.scene.start(SCENE_KEYS.Result, {
      outcome,
      polishCount: this.polishCount,
    });
  }

  // ────────────────────────── render ──────────────────────────
  private redraw(): void {
    const { project } = this.state;
    this.weekText.setText(`Week ${project.weeksElapsed} / ${project.weeksTarget}`);
    // calendar 아이콘은 weekText 좌측에 — 텍스트 폭에 따라 위치 보정.
    this.weekIcon.setX(this.weekText.x - this.weekText.width / 2 - 6);
    this.progressText.setText(`${project.progress.toFixed(1)}%`);
    this.bugText
      .setText(`${Math.round(project.bugDebt)} / 100`)
      .setColor(project.bugDebt >= 70 ? TEXT_COLOR.bad : TEXT_COLOR.primary);
    this.goldText.setText(String(this.state.gold));

    const panelX = (GAME_WIDTH - 690) / 2 + 24;
    this.drawGauge(this.progressBar, panelX, 172, project.progress / 100, COLOR.gaugeFillProgress);
    this.drawGauge(this.bugBar, panelX, 252, project.bugDebt / 100, COLOR.gaugeFillBug);
    if (this.appealBar && this.appealText) {
      this.drawGauge(this.appealBar, panelX, 332, project.appeal / 100, COLOR.gaugeFillProgress);
      this.appealText.setText(`${Math.round(project.appeal)} / 100`);
    }

    if (this.state.productIndex >= 1) this.drawCrunchToggle();
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
    const crunchHint = this.state.crunch
      ? '야근 ON — 이번 주 Progress ×1.18, BugDebt +4. '
      : '';

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
        .setText(
          `${crunchHint}연체 ${project.weeksElapsed - project.weeksTarget}주 — 매주 골드 -8 페널티 누적.`,
        )
        .setColor(TEXT_COLOR.warn);
      return;
    }

    if (this.state.crunch) {
      this.statusText.setText(crunchHint.trimEnd()).setColor(TEXT_COLOR.bad);
      return;
    }

    this.statusText.setText('한 주씩 진행하세요.').setColor(TEXT_COLOR.dim);
  }

  private updateActionPanel(): void {
    const releaseReady = canRelease(this.state);
    // 보유 골드가 떨어져 현재 선택 단계가 더 이상 살 수 없으면 자동 강등.
    if (this.state.gold < PROMO[this.selectedPromo].cost) {
      this.selectedPromo = 'none';
    }
    this.setReleasePanelVisible(releaseReady);
    if (releaseReady) {
      this.releaseBtn.redraw(false);
      this.polishBtn.redraw(false);
      if (this.state.productIndex >= 1) this.drawPromoSelector();
    } else {
      this.weekBtn.redraw(false);
    }
  }
}
