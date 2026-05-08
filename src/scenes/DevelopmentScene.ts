import Phaser from 'phaser';
import type { Types } from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '@/constants';
import { isMatched, SLOT_ORDER } from '@/domain/match';
import { PROMO } from '@/domain/balance';
import { pickRandomEvent, type GameEvent } from '@/domain/events';
import { GENRE_LABEL, JOB_LABEL, SLOT_ICON, SLOT_LABEL, THEME_LABEL } from '@/domain/seed';
import { shipProject } from '@/domain/result';
import { advanceWeek, canRelease, polishWeek } from '@/domain/tick';
import type { GameState, PromoTier, SlotKind } from '@/domain/types';
import { ICONS } from '@/icons';
import { COLOR, FONT_STACK, TEXT_COLOR, TINT } from '@/theme';
import { drawConditionFill } from '@/util/condition';
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
 * 토글 가능한 컨트롤 버튼 — 액티브(현재 선택)/비액티브 색이 다르고, setActive로 전환.
 * 재생 컨트롤(⏸/1×/2×/4×)에 사용.
 */
interface ControlButton {
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  rect: Phaser.Geom.Rectangle;
  hit: Phaser.GameObjects.Zone;
  setActive: (active: boolean) => void;
  setVisible: (visible: boolean) => void;
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
  private slotSummaryViews = new Map<
    SlotKind,
    {
      text: Phaser.GameObjects.Text;
      moraleFill: Phaser.GameObjects.Graphics;
      staminaFill: Phaser.GameObjects.Graphics;
      barX: number;
      barW: number;
      moraleBarY: number;
      staminaBarY: number;
      barH: number;
    }
  >();
  private statusText!: Phaser.GameObjects.Text;

  // Playback controls (Slice 5)
  private paused = true;
  private speed: 1 | 2 | 4 = 1;
  private weekTimer: Phaser.Time.TimerEvent | null = null;
  private controlPause!: ControlButton;
  private controlSpeed1!: ControlButton;
  private controlSpeed2!: ControlButton;
  private controlSpeed4!: ControlButton;

  // Random events (Slice 7)
  private weeksSinceEvent = 0;
  private eventModalContainer: Phaser.GameObjects.Container | null = null;

  // 화면 표시 값 — state로 점프 안 하고 부드럽게 따라가도록 tween 타깃 (Slice 9).
  private displayStats = { p: 0, b: 0, a: 0, g: 0 };
  private statsTween: Phaser.Tweens.Tween | null = null;

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
    // 재생 컨트롤 — 매 진입 시 일시정지 상태로 리셋. 기존 타이머 정리.
    this.paused = true;
    this.speed = 1;
    this.weekTimer?.remove();
    this.weekTimer = null;
    // 이벤트 카운터 초기화 + 떠있던 모달 정리
    this.weeksSinceEvent = 0;
    this.eventModalContainer?.destroy(true);
    this.eventModalContainer = null;
    // 표시 값을 현재 state로 즉시 동기화 (다음 tween 시작점).
    this.displayStats = {
      p: this.state.project.progress,
      b: this.state.project.bugDebt,
      a: this.state.project.appeal,
      g: this.state.gold,
    };
    this.statsTween?.stop();
    this.statsTween = null;
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

      // 슬롯 아이콘 (좌상단) + 라벨
      this.add
        .image(x + 14, y + 18, ICONS[SLOT_ICON[slot]].key)
        .setDisplaySize(12, 12)
        .setOrigin(0, 0.5)
        .setTint(TINT.dim);
      this.add.text(x + 14 + 16, y + 12, SLOT_LABEL[slot], {
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

      // 컨디션 미니바 — 우측에 두 줄 (사기 위, 체력 아래)
      const barW = 56;
      const barH = 3;
      const barX = x + tileW - 14 - barW;
      const moraleBarY = y + 30;
      const staminaBarY = y + 38;
      const moraleBg = this.add.graphics();
      moraleBg.fillStyle(COLOR.gaugeBg, 1);
      moraleBg.fillRect(barX, moraleBarY, barW, barH);
      const moraleFill = this.add.graphics();
      const staminaBg = this.add.graphics();
      staminaBg.fillStyle(COLOR.gaugeBg, 1);
      staminaBg.fillRect(barX, staminaBarY, barW, barH);
      const staminaFill = this.add.graphics();

      this.slotSummaryViews.set(slot, {
        text: t,
        moraleFill,
        staminaFill,
        barX,
        barW,
        moraleBarY,
        staminaBarY,
        barH,
      });
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
    // 재생 컨트롤 — ⏸ / 1× / 2× / 4×
    const ctrlW = 80;
    const ctrlH = 56;
    const ctrlGap = 8;
    const ctrlTotal = ctrlW * 4 + ctrlGap * 3;
    const ctrlStartX = CX - ctrlTotal / 2;
    const ctrlY = 978;
    this.controlPause = this.makeControlButton({
      x: ctrlStartX,
      y: ctrlY,
      w: ctrlW,
      h: ctrlH,
      label: '⏸',
      fontSize: 22,
      onTap: () => this.handlePause(),
    });
    this.controlSpeed1 = this.makeControlButton({
      x: ctrlStartX + (ctrlW + ctrlGap),
      y: ctrlY,
      w: ctrlW,
      h: ctrlH,
      label: '1×',
      onTap: () => this.handleSpeed(1),
    });
    this.controlSpeed2 = this.makeControlButton({
      x: ctrlStartX + 2 * (ctrlW + ctrlGap),
      y: ctrlY,
      w: ctrlW,
      h: ctrlH,
      label: '2×',
      onTap: () => this.handleSpeed(2),
    });
    this.controlSpeed4 = this.makeControlButton({
      x: ctrlStartX + 3 * (ctrlW + ctrlGap),
      y: ctrlY,
      w: ctrlW,
      h: ctrlH,
      label: '4×',
      onTap: () => this.handleSpeed(4),
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

    // 씬 종료 시 타이머 해제
    this.events.once('shutdown', () => {
      this.weekTimer?.remove();
      this.weekTimer = null;
    });
  }

  private makeControlButton(opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    fontSize?: number;
    onTap: () => void;
  }): ControlButton {
    const rect = new Phaser.Geom.Rectangle(opts.x, opts.y, opts.w, opts.h);
    const bg = this.add.graphics();
    const text = this.add
      .text(opts.x + opts.w / 2, opts.y + opts.h / 2, opts.label, {
        fontFamily: FONT_STACK,
        fontSize: `${opts.fontSize ?? 18}px`,
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    let active = false;
    let pressed = false;
    const draw = (): void => {
      const color = pressed
        ? active
          ? COLOR.btnDown
          : COLOR.btnSecondaryDown
        : active
          ? COLOR.btn
          : COLOR.btnSecondary;
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
      text.setColor(active ? TEXT_COLOR.primary : TEXT_COLOR.dim);
    };
    const hit = this.add
      .zone(opts.x + opts.w / 2, opts.y + opts.h / 2, opts.w, opts.h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      pressed = true;
      draw();
    });
    hit.on('pointerout', () => {
      pressed = false;
      draw();
    });
    hit.on('pointerup', () => {
      pressed = false;
      draw();
      opts.onTap();
    });
    draw();
    return {
      bg,
      text,
      rect,
      hit,
      setActive: (a: boolean) => {
        active = a;
        draw();
      },
      setVisible: (v: boolean) => {
        bg.setVisible(v);
        text.setVisible(v);
        if (hit.input) hit.input.enabled = v;
      },
    };
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
    const showControls = !visible;
    this.controlPause.setVisible(showControls);
    this.controlSpeed1.setVisible(showControls);
    this.controlSpeed2.setVisible(showControls);
    this.controlSpeed4.setVisible(showControls);
    setButtonShown(this.releaseBtn, visible);
    setButtonShown(this.polishBtn, visible);
    this.setPromoVisible(visible);
  }

  // ────────────────────────── playback controls ──────────────────────────
  private handlePause(): void {
    this.paused = true;
    this.refreshPlaybackHighlight();
    this.refreshTimer();
  }

  private handleSpeed(s: 1 | 2 | 4): void {
    this.paused = false;
    this.speed = s;
    this.refreshPlaybackHighlight();
    this.refreshTimer();
  }

  private refreshPlaybackHighlight(): void {
    this.controlPause.setActive(this.paused);
    this.controlSpeed1.setActive(!this.paused && this.speed === 1);
    this.controlSpeed2.setActive(!this.paused && this.speed === 2);
    this.controlSpeed4.setActive(!this.paused && this.speed === 4);
  }

  private refreshTimer(): void {
    this.weekTimer?.remove();
    this.weekTimer = null;
    if (this.paused || canRelease(this.state)) return;
    // 1× = 1주 / 1.5초, 2× = 0.75초, 4× = 0.375초
    const delay = 1500 / this.speed;
    this.weekTimer = this.time.addEvent({
      delay,
      loop: true,
      callback: () => this.tickWeek(),
    });
  }

  private tickWeek(): void {
    if (this.paused) return;
    if (canRelease(this.state)) {
      this.handlePause();
      return;
    }
    this.state = advanceWeek(this.state);
    this.weeksSinceEvent += 1;
    this.redraw();

    if (canRelease(this.state)) {
      // 출시 가능 도달 — 자동 일시정지하고 출시 패널 노출(redraw가 처리).
      this.handlePause();
      return;
    }

    // 랜덤 이벤트 발동 — 마지막 이벤트로부터 3주 이상 + 35% 확률.
    if (this.weeksSinceEvent >= 3 && Math.random() < 0.35) {
      const ev = pickRandomEvent(this.state);
      if (ev) {
        this.weeksSinceEvent = 0;
        this.handlePause();
        this.showEventModal(ev);
      }
    }
  }

  // ────────────────────────── event modal ──────────────────────────
  private showEventModal(ev: GameEvent): void {
    const c = this.add.container(0, 0).setDepth(100);

    // 어두운 오버레이 — 뒤쪽 입력 차단.
    const overlay = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setOrigin(0, 0)
      .setInteractive();
    c.add(overlay);

    // 이벤트 패널
    const panelW = 640;
    const panelH = 700;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;
    const panel = makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);
    c.add(panel);

    // 헤더 라벨 ("이벤트")
    c.add(
      this.add
        .text(panelX + 30, panelY + 28, '이벤트', {
          fontFamily: FONT_STACK,
          fontSize: '12px',
          fontStyle: 'bold',
          color: TEXT_COLOR.warn,
        })
        .setOrigin(0, 0),
    );

    // 제목
    c.add(
      this.add
        .text(panelX + panelW / 2, panelY + 70, ev.title, {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5, 0),
    );

    // 설명
    c.add(
      this.add
        .text(panelX + 30, panelY + 130, ev.description, {
          fontFamily: FONT_STACK,
          fontSize: '15px',
          color: TEXT_COLOR.dim,
          wordWrap: { width: panelW - 60, useAdvancedWrap: true },
          lineSpacing: 4,
        })
        .setOrigin(0, 0),
    );

    // 선택지
    const choiceX = panelX + 30;
    const choiceW = panelW - 60;
    const choiceH = 88;
    const choiceGap = 14;
    const choicesTotalH = ev.choices.length * choiceH + (ev.choices.length - 1) * choiceGap;
    const choicesStartY = panelY + panelH - choicesTotalH - 30;

    ev.choices.forEach((ch, i) => {
      const y = choicesStartY + i * (choiceH + choiceGap);
      const btnBg = this.add.graphics();
      const drawBtn = (pressed: boolean): void => {
        btnBg.clear();
        btnBg.fillStyle(pressed ? COLOR.btnSecondaryDown : COLOR.btnSecondary, 1);
        btnBg.fillRoundedRect(choiceX, y, choiceW, choiceH, 14);
      };
      drawBtn(false);

      const label = this.add.text(choiceX + 22, y + 18, ch.label, {
        fontFamily: FONT_STACK,
        fontSize: '17px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      });
      const summary = this.add.text(choiceX + 22, y + 50, ch.summary, {
        fontFamily: FONT_STACK,
        fontSize: '12px',
        color: TEXT_COLOR.dim,
      });

      const hit = this.add
        .zone(choiceX + choiceW / 2, y + choiceH / 2, choiceW, choiceH)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => drawBtn(true));
      hit.on('pointerout', () => drawBtn(false));
      hit.on('pointerup', () => {
        drawBtn(false);
        this.handleEventChoice(ev, i);
      });

      c.add([btnBg, label, summary, hit]);
    });

    this.eventModalContainer = c;
    // 새로 추가된 텍스트들도 HiDPI 해상도로 다시 래스터화.
    applyHiDPI(this);

    // 가벼운 fade-in.
    c.setAlpha(0);
    this.tweens.add({
      targets: c,
      alpha: 1,
      duration: 200,
      ease: 'Cubic.easeOut',
    });
  }

  private handleEventChoice(ev: GameEvent, index: number): void {
    const choice = ev.choices[index];
    if (!choice) return;
    this.state = choice.apply(this.state);
    this.eventModalContainer?.destroy(true);
    this.eventModalContainer = null;
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

    // 게이지·매출 등 수치는 tween으로 부드럽게 변화.
    this.tweenStats();

    if (this.state.productIndex >= 1) this.drawCrunchToggle();
    this.redrawAssignmentRecap();
    this.updateStatus();
    this.updateActionPanel();
  }

  /** displayStats가 state의 현재값으로 부드럽게 따라가게 하고, 매 프레임 패널을 다시 그린다. */
  private tweenStats(): void {
    this.statsTween?.stop();
    this.statsTween = this.tweens.add({
      targets: this.displayStats,
      p: this.state.project.progress,
      b: this.state.project.bugDebt,
      a: this.state.project.appeal,
      g: this.state.gold,
      duration: 600,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.drawStatPanel(),
      onComplete: () => this.drawStatPanel(),
    });
    this.drawStatPanel();
  }

  private drawStatPanel(): void {
    const { p, b, a, g } = this.displayStats;
    this.progressText.setText(`${p.toFixed(1)}%`);
    this.bugText
      .setText(`${Math.round(b)} / 100`)
      .setColor(b >= 70 ? TEXT_COLOR.bad : TEXT_COLOR.primary);
    this.goldText.setText(String(Math.round(g)));

    const panelX = (GAME_WIDTH - 690) / 2 + 24;
    this.drawGauge(this.progressBar, panelX, 172, p / 100, COLOR.gaugeFillProgress);
    this.drawGauge(this.bugBar, panelX, 252, b / 100, COLOR.gaugeFillBug);
    if (this.appealBar && this.appealText) {
      this.drawGauge(this.appealBar, panelX, 332, a / 100, COLOR.gaugeFillProgress);
      this.appealText.setText(`${Math.round(a)} / 100`);
    }
  }

  private redrawAssignmentRecap(): void {
    const empById = new Map(this.state.employees.map((e) => [e.id, e] as const));
    for (const slot of SLOT_ORDER) {
      const view = this.slotSummaryViews.get(slot);
      if (!view) continue;
      const empId = this.state.assignment[slot];
      const emp = empId ? empById.get(empId) : undefined;

      if (!emp) {
        view.text.setText('비어 있음').setColor(TEXT_COLOR.disabled);
        // 비어 있으면 컨디션 바 비움
        view.moraleFill.clear();
        view.staminaFill.clear();
        continue;
      }

      const matched = isMatched(slot, emp.job);
      view.text
        .setText(`${emp.name} · ${JOB_LABEL[emp.job]} ${matched ? '✓' : '✗'}`)
        .setColor(matched ? TEXT_COLOR.ok : TEXT_COLOR.bad);
      drawConditionFill(view.moraleFill, view.barX, view.moraleBarY, view.barW, view.barH, emp.morale);
      drawConditionFill(view.staminaFill, view.barX, view.staminaBarY, view.barW, view.barH, emp.stamina);
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
      this.refreshPlaybackHighlight();
    }
  }
}
