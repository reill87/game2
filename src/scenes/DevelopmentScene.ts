import Phaser from 'phaser';
import type { Types } from 'phaser';

import { isMatched, SLOT_ORDER } from '@/domain/match';
import { PROMO, SIDE_PROJECT } from '@/domain/balance';
import { isRndPurchased } from '@/domain/rnd';
import { categoryOf, EVENT_CATEGORY_LABEL, pickRandomEvent, type GameEvent } from '@/domain/events';
import { GENRE_LABEL, JOB_LABEL, SLOT_ICON, SLOT_LABEL, THEME_LABEL } from '@/domain/seed';
import { HEADLINE_BY_STARS, type ReleaseOutcome, type ReviewStars, shipProject } from '@/domain/result';
import {
  pickExitCandidates,
  RETAIN_COST,
  RETAIN_MORALE_BOOST,
} from '@/domain/retention';
import {
  advanceWeek,
  canRelease,
  computeBurnRate,
  computeSlotContributions,
  polishWeek,
} from '@/domain/tick';
import type { Employee, GameState, PromoTier, SlotKind } from '@/domain/types';
import {
  getSprintPhase,
  SPRINT_PHASE_LABEL,
  SPRINT_SLOT_WEIGHT,
  type SprintPhase,
} from '@/domain/sprintPhase';
import { pickOpsDecision, type OpsDecision } from '@/domain/postRelease';
import { AP_CAP, WEEKLY_ACTIONS, type WeeklyAction } from '@/domain/weeklyActions';
import {
  CRISIS_COOLDOWN_WEEKS,
  CRISIS_MIN_PRODUCT_COUNT,
  CRISIS_TRIGGER_PROBABILITY,
  pickCrisis,
  type Crisis,
} from '@/domain/crises';
import { isBankrupt, isCollapsing } from '@/domain/bankruptcy';
import { BGM } from '@/bgm';
import { EVENT_CATEGORY_TEXTURE } from '@/eventCategoryAssets';
import { ICONS } from '@/icons';
import { loadData, DEFAULT_COMPANY_NAME, clearData } from '@/save';
import { playSfx, SFX } from '@/sounds';
import { COLOR, FONT_STACK, TEXT_COLOR, TINT } from '@/theme';
import { formatGold } from '@/ui';
import { addMuteToggle } from '@/util/muteToggle';
import { drawConditionFill } from '@/util/condition';
import { applyHiDPI } from '@/util/hidpi';
import { drawGaugeBar, drawRaisedRect, makePanel } from '@/util/ui';
import { fitCamera } from '@/util/cameraFit';
import { onResize } from '@/util/viewport';
import { showHint } from '@/util/onboarding';

import { SCENE_KEYS } from './keys';

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
  /** 현재 sprint 단계 표시 텍스트 (헤더 우측). */
  private sprintPhaseText!: Phaser.GameObjects.Text;
  /** 단계 전환 알림 — 경계 넘을 때 잠깐 표시. */
  private sprintToastText: Phaser.GameObjects.Text | null = null;
  private lastSprintPhase: SprintPhase | null = null;
  /** 슬롯 타일의 단계 가중치 텍스트 (단계 ×N.N 표시). */
  private slotPhaseWeightTexts = new Map<SlotKind, Phaser.GameObjects.Text>();
  /** 운영 결정 모달 컨테이너. */
  private opsModalContainer: Phaser.GameObjects.Container | null = null;
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
      contribText: Phaser.GameObjects.Text;
      moraleFill: Phaser.GameObjects.Graphics;
      staminaFill: Phaser.GameObjects.Graphics;
      barX: number;
      barW: number;
      moraleBarY: number;
      staminaBarY: number;
      barH: number;
      tileX: number;
      tileY: number;
      tileW: number;
      tileH: number;
    }
  >();
  private burnText: Phaser.GameObjects.Text | null = null;
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
  /** 최근 발동된 이벤트 id 큐(최대 7) — 중복 방지용. */
  private recentEventIds: string[] = [];

  // 주간 액션(AP) 모달
  private weeklyActionModalContainer: Phaser.GameObjects.Container | null = null;
  private weeklyActionApText: Phaser.GameObjects.Text | null = null;
  private weeklyActionCardViews: Array<{
    action: WeeklyAction;
    bg: Phaser.GameObjects.Graphics;
    labelText: Phaser.GameObjects.Text;
    descText: Phaser.GameObjects.Text;
    costBadge: Phaser.GameObjects.Text;
    hit: Phaser.GameObjects.Zone;
    rect: Phaser.Geom.Rectangle;
  }> = [];
  private apBtnBg: Phaser.GameObjects.Graphics | null = null;
  private apBtnText: Phaser.GameObjects.Text | null = null;
  private apBtnRect: Phaser.Geom.Rectangle | null = null;
  private apBtnHit: Phaser.GameObjects.Zone | null = null;

  // 위기 모먼트 모달 + cooldown
  private crisisModalContainer: Phaser.GameObjects.Container | null = null;
  private crisisCooldown = 0;
  private crisisTimerEvent: Phaser.Time.TimerEvent | null = null;

  // 파산 / 폐업 모달
  private bankruptcyModalContainer: Phaser.GameObjects.Container | null = null;
  // 명성 폭락 모달 — 이미 표시했으면 중복 방지.
  private collapseModalShown = false;

  // 직원 popup (per-employee actions)
  private empPopupContainer: Phaser.GameObjects.Container | null = null;
  /** 각 직원 타일의 interactive zone (recap redraw 시 재생성) */
  private empTileHits: Phaser.GameObjects.Zone[] = [];

  // 사이드 프로젝트 — 한 작품 내 cooldown.
  private sideProjectCooldown = 0;
  private sideBtnBg: Phaser.GameObjects.Graphics | null = null;
  private sideBtnText: Phaser.GameObjects.Text | null = null;
  private sideBtnRect: Phaser.Geom.Rectangle | null = null;
  private sideBtnHit: Phaser.GameObjects.Zone | null = null;

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

  /** logical 720×1280 고정 좌표. build* 메서드가 참조. */
  private cx = 360;
  private contentX = 0;

  // ── 온보딩 ────────────────────────────────────────────────────────────
  /** 온보딩 모드 여부 (productCount=0). */
  private isOnboarding = false;
  /** 현재 표시 중인 힌트 컨테이너. */
  private devHintContainer: Phaser.GameObjects.Container | null = null;
  /** pick-speed 힌트를 이미 제거했는지 — 중복 제거 방지. */
  private pickSpeedHintDone = false;
  /** click-employee 힌트를 이미 표시했는지. */
  private clickEmployeeHintShown = false;
  /** release-time 힌트를 이미 표시했는지. */
  private releaseHintShown = false;

  constructor() {
    super({ key: SCENE_KEYS.Development });
  }

  init(data: { state: GameState; isOnboarding?: boolean }): void {
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
    this.weeklyActionModalContainer?.destroy(true);
    this.weeklyActionModalContainer = null;
    this.crisisModalContainer?.destroy(true);
    this.crisisModalContainer = null;
    this.crisisTimerEvent?.remove();
    this.crisisTimerEvent = null;
    this.crisisCooldown = 0;
    this.bankruptcyModalContainer?.destroy(true);
    this.bankruptcyModalContainer = null;
    this.collapseModalShown = false;
    this.empPopupContainer?.destroy(true);
    this.empPopupContainer = null;
    this.empTileHits = [];
    this.sideProjectCooldown = 0;
    this.opsModalContainer?.destroy(true);
    this.opsModalContainer = null;
    this.lastSprintPhase = null;
    this.sprintToastText = null;
    this.slotPhaseWeightTexts.clear();
    // 표시 값을 현재 state로 즉시 동기화 (다음 tween 시작점).
    this.displayStats = {
      p: this.state.project.progress,
      b: this.state.project.bugDebt,
      a: this.state.project.appeal,
      g: this.state.gold,
    };
    this.statsTween?.stop();
    this.statsTween = null;
    // 온보딩 상태 초기화.
    this.isOnboarding = data.isOnboarding ?? (incoming.productIndex === 0);
    this.devHintContainer = null;
    this.pickSpeedHintDone = false;
    this.clickEmployeeHintShown = false;
    this.releaseHintShown = false;
  }

  create(): void {
    fitCamera(this);
    // logical 720×1280 좌표 고정 — viewport 크기 무관.
    this.cx = 360;
    this.contentX = 0;
    BGM.resume();
    BGM.setMood('focus');
    addMuteToggle(this);
    this.buildHeader();
    if (this.state.productIndex >= 1) this.buildCrunchToggle();
    if (this.state.productIndex >= 1) this.buildSideProjectButton();
    this.buildWeeklyActionButton();
    this.buildStats();
    this.buildAssignmentRecap();
    this.buildStatus();
    this.buildActions();
    if (this.state.productIndex >= 1) this.buildPromoSelector();
    this.redraw();
    // 온보딩 4단계: 재생 컨트롤 안내 힌트.
    if (this.isOnboarding) this.showPickSpeedHint();
    applyHiDPI(this);
    onResize(this, () => { this.scene.restart(); });
  }

  // ────────────────────────── header ──────────────────────────
  private buildHeader(): void {
    const titleStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '33px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    };
    const genre = GENRE_LABEL[this.state.project.genre].name;
    const theme = THEME_LABEL[this.state.project.theme].name;
    const companyName = loadData()?.companyName ?? DEFAULT_COMPANY_NAME;
    const titleBg = this.add.graphics();
    drawRaisedRect(titleBg, this.cx - 200, 24, 400, 42, COLOR.panelEmpty, {
      radius: 21,
      shadow: false,
      gloss: true,
      stroke: COLOR.panelStroke,
      strokeAlpha: 0.55,
    });
    this.add.text(this.cx, 45, companyName, titleStyle).setOrigin(0.5);
    const chipBg = this.add.graphics();
    drawRaisedRect(chipBg, this.cx - 170, 76, 340, 30, COLOR.btnSecondary, {
      radius: 15,
      shadow: false,
      gloss: true,
    });
    this.add.text(this.cx, 91, `개발 중 · ${genre} × ${theme}`, {
      fontFamily: FONT_STACK,
      fontSize: '19px',
      fontStyle: 'bold',
      color: TEXT_COLOR.dim,
    }).setOrigin(0.5);

    this.weekText = this.add
      .text(this.cx, 110, '', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
    this.weekIcon = this.add
      .image(0, 110, ICONS.calendar.key)
      .setDisplaySize(14, 14)
      .setOrigin(1, 0.5)
      .setTint(TINT.dim);

    // Sprint 단계 텍스트 — 헤더 Week 텍스트 우측에 표시.
    this.sprintPhaseText = this.add
      .text(this.contentX + 720 - 14, 110, '', {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        fontStyle: 'bold',
        color: TEXT_COLOR.warn,
      })
      .setOrigin(1, 0.5);
  }

  // ────────────────────────── crunch toggle ──────────────────────────
  private buildCrunchToggle(): void {
    // h: 40 → 48 — zoom 0.5 모바일에서 ~24px 물리 크기 확보.
    const w = 124;
    const h = 48;
    const x = this.contentX + 720 - 14 - w;
    const y = 14;
    this.crunchBtnRect = new Phaser.Geom.Rectangle(x, y, w, h);
    this.crunchBtnBg = this.add.graphics();
    this.crunchBtnText = this.add
      .text(x + w / 2, y + h / 2, '', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
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
    playSfx(this, SFX.toggle);
    this.state = { ...this.state, crunch: !this.state.crunch };
    this.drawCrunchToggle();
    this.updateStatus();
  }

  // ────────────────────────── side project (외주) ──────────────────────────
  private buildSideProjectButton(): void {
    // 야근 토글 좌측에 배치. 폭은 야근(124)보다 약간 좁게.
    // h: 40 → 48 (야근 버튼과 높이 통일).
    const w = 110;
    const h = 48;
    const x = this.contentX + 720 - 14 - 124 - 10 - w;
    const y = 14;
    this.sideBtnRect = new Phaser.Geom.Rectangle(x, y, w, h);
    this.sideBtnBg = this.add.graphics();
    this.sideBtnText = this.add
      .text(x + w / 2, y + h / 2, '', {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
        align: 'center',
      })
      .setOrigin(0.5);
    this.sideBtnHit = this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    this.sideBtnHit.on('pointerup', () => this.handleSideProject());
    this.drawSideProjectButton();
  }

  private drawSideProjectButton(): void {
    if (!this.sideBtnBg || !this.sideBtnText || !this.sideBtnRect || !this.sideBtnHit) return;
    const onCooldown = this.sideProjectCooldown > 0;
    const fill = onCooldown ? COLOR.btnDisabled : COLOR.btnSecondary;
    const r = this.sideBtnRect;
    this.sideBtnBg.clear();
    this.sideBtnBg.fillStyle(fill, 1);
    this.sideBtnBg.fillRoundedRect(r.x, r.y, r.width, r.height, 12);
    this.sideBtnText
      .setText(onCooldown ? `외주\n${this.sideProjectCooldown}주 후` : `외주\n+${formatGold(SIDE_PROJECT.gold)}`)
      .setColor(onCooldown ? TEXT_COLOR.disabled : TEXT_COLOR.primary);
    if (this.sideBtnHit.input) this.sideBtnHit.input.enabled = !onCooldown;
  }

  /**
   * 외주 수락 — 즉시 골드 +X, weeks +1, 전 직원 morale −Y, cooldown 셋.
   * 게임 흐름: paused 여부 무관, 즉발 적용.
   */
  private handleSideProject(): void {
    if (this.sideProjectCooldown > 0) return;
    if (canRelease(this.state)) return;
    playSfx(this, SFX.success, 0.5);

    const project = this.state.project;
    const newProject = { ...project, weeksElapsed: project.weeksElapsed + SIDE_PROJECT.weeksDelta };
    const drainedEmployees = this.state.employees.map((e) => ({
      ...e,
      morale: Math.max(0, e.morale - SIDE_PROJECT.moralePenalty),
    }));
    this.state = {
      ...this.state,
      gold: this.state.gold + SIDE_PROJECT.gold,
      project: newProject,
      employees: drainedEmployees,
    };
    this.sideProjectCooldown = SIDE_PROJECT.cooldownWeeks;
    this.drawSideProjectButton();
    this.redraw();
  }

  // ────────────────────────── stats panel ──────────────────────────
  private buildStats(): void {
    const appealEnabled = this.state.project.appealEnabled;
    const panelX = this.contentX + (720 - 690) / 2;
    const panelY = 120;
    const panelW = 690;
    const panelH = appealEnabled ? 320 : 260;

    makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);

    const labelStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '26px',
      fontStyle: 'bold',
      color: TEXT_COLOR.dim,
    };
    const valueStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '26px',
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
      this.drawGauge(this.appealBar, panelX + 24, panelY + 212, 0, COLOR.gaugeFillAppeal);
    }

    // Gold
    const goldY = appealEnabled ? panelY + 260 : panelY + 180;
    this.addLabelIcon(panelX + 24, goldY + 8, ICONS.coins.key, TINT.warn);
    this.add.text(labelX, goldY, 'Gold', labelStyle);
    this.goldText = this.add
      .text(panelX + panelW - 24, goldY, '0', valueStyle)
      .setOrigin(1, 0);

    // Burn rate (Gold 옆 매주 −Ng/주 표시)
    this.burnText = this.add
      .text(panelX + panelW - 24, goldY + 22, '', {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.bad,
      })
      .setOrigin(1, 0);

    // Hint
    const hintY = appealEnabled ? panelY + 298 : panelY + 218;
    this.add.text(
      panelX + 24,
      hintY,
      '폴리싱은 출시 화면에서 가능 — BugDebt를 1주에 12씩 감소.',
      {
        fontFamily: FONT_STACK,
        fontSize: '21px',
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
    const topFill =
      fill === COLOR.gaugeFillBug
        ? COLOR.gaugeFillBugTop
        : fill === COLOR.gaugeFillAppeal
          ? COLOR.gaugeFillAppealTop
          : COLOR.gaugeFillProgressTop;
    drawGaugeBar(g, x, y, GAUGE_W, GAUGE_H, ratio, fill, topFill);
  }

  // ────────────────────────── assignment recap ──────────────────────────
  private buildAssignmentRecap(): void {
    const startY = this.state.project.appealEnabled ? 470 : 410;
    this.add
      .text(this.cx, startY, '배치 요약', {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    const tileW = 320;
    const tileH = 70;
    const gapX = 18;
    const gapY = 14;
    const startX = this.contentX + (720 - (tileW * 2 + gapX)) / 2;

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
        fontSize: '21px',
        fontStyle: 'bold',
        color: TEXT_COLOR.dim,
      });

      // 단계 가중치 인디케이터 — 우상단 (예: "단계 ×1.5")
      const weightText = this.add.text(x + tileW - 14, y + 12, '', {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        fontStyle: 'bold',
        color: TEXT_COLOR.warn,
      }).setOrigin(1, 0);
      this.slotPhaseWeightTexts.set(slot, weightText);

      const t = this.add.text(x + 14, y + 32, '', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        color: TEXT_COLOR.primary,
      });

      // 이번 주 기여 — 직원 이름 아래 (왼쪽 정렬, 작은 노란 텍스트)
      const contribText = this.add.text(x + 14, y + 52, '', {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        fontStyle: 'bold',
        color: TEXT_COLOR.warn,
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
        contribText,
        moraleFill,
        staminaFill,
        barX,
        barW,
        moraleBarY,
        staminaBarY,
        barH,
        tileX: x,
        tileY: y,
        tileW,
        tileH,
      });
    });
  }

  // ────────────────────────── status + actions ──────────────────────────
  private buildStatus(): void {
    this.statusText = this.add
      .text(this.cx, 920, '', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        color: TEXT_COLOR.dim,
        align: 'center',
        wordWrap: { width: 640, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  private buildActions(): void {
    // 재생 컨트롤 — ⏸ / 1× / 2× / 4×
    // h: 56 → 64 — zoom 0.5 모바일에서 ~32px 물리 크기 확보.
    const ctrlW = 80;
    const ctrlH = 64;
    const ctrlGap = 8;
    const ctrlTotal = ctrlW * 4 + ctrlGap * 3;
    const ctrlStartX = this.cx - ctrlTotal / 2;
    // logical 1280 기준 고정 좌표.
    const ctrlY = 1170;
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
    const polishX = this.cx - 360 - 8;
    const releaseX = this.cx + 8;
    const releaseY = 1162;
    this.polishBtn = this.makeButton({
      x: polishX,
      y: releaseY,
      w: 360,
      h: 72,
      label: '1주 더 다듬기',
      onTap: () => this.handlePolish(),
      primary: false,
    });
    this.releaseBtn = this.makeButton({
      x: releaseX,
      y: releaseY,
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
      this.crisisTimerEvent?.remove();
      this.crisisTimerEvent = null;
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
      drawRaisedRect(bg, rect.x, rect.y, rect.width, rect.height, color, {
        radius: 12,
        pressed,
        gloss: true,
      });
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
      fontSize: '21px',
      color: TEXT_COLOR.dim,
    } satisfies Types.GameObjects.Text.TextStyle;

    // 출시 패널 위로 — release btn(1162)보다 위 + 라벨은 그 위.
    const promoY = 1080;
    this.promoLabel = this.add
      .text(this.cx, promoY - 24, '홍보 (출시 시 골드 차감)', labelStyle)
      .setOrigin(0.5);

    const btnW = 184;
    const btnH = 44;
    const gap = 14;
    const totalW = btnW * 3 + gap * 2;
    const startX = this.contentX + (720 - totalW) / 2;
    const y = promoY;

    tiers.forEach((tier, i) => {
      const x = startX + i * (btnW + gap);
      const rect = new Phaser.Geom.Rectangle(x, y, btnW, btnH);
      const bg = this.add.graphics();
      const promo = PROMO[tier];
      const labelText =
        tier === 'none' ? promo.label : `${promo.label} · -${formatGold(promo.cost)} · +${Math.round((promo.revenueMul - 1) * 100)}%`;
      const text = this.add
        .text(x + btnW / 2, y + btnH / 2, labelText, {
          fontFamily: FONT_STACK,
          fontSize: '23px',
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
    playSfx(this, SFX.tap);
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
      drawRaisedRect(view.bg, view.rect.x, view.rect.y, view.rect.width, view.rect.height, fill, {
        radius: 12,
        gloss: affordable,
        shadow: affordable,
        stroke: selected ? COLOR.selected : undefined,
        strokeAlpha: selected ? 0.9 : undefined,
      });
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
        fontSize: '30px',
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
        drawRaisedRect(bg, rect.x, rect.y, rect.width, rect.height, color, {
          radius: 14,
          pressed,
          gloss: view.enabled,
        });
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

  /** 모달 열릴 때 저장해둔 직전 속도 — 모달 닫힐 때 resumeAfterModal로 복원. */
  private speedBeforeModal: 1 | 2 | 4 | null = null;

  /** 모달 등장 시 호출 — 현재 속도 기억하고 일시정지(사용자 클릭 SFX 없이). */
  private pauseForModal(): void {
    if (!this.paused) this.speedBeforeModal = this.speed;
    this.paused = true;
    this.refreshPlaybackHighlight();
    this.refreshTimer();
  }

  /** 모달 닫힐 때 호출 — 직전 속도 복원. 직전이 없으면(이미 paused) 그대로. */
  private resumeAfterModal(): void {
    if (this.speedBeforeModal !== null) {
      this.paused = false;
      this.speed = this.speedBeforeModal;
      this.speedBeforeModal = null;
      this.refreshPlaybackHighlight();
      this.refreshTimer();
    }
  }

  // ────────────────────────── playback controls ──────────────────────────
  private handlePause(): void {
    if (!this.paused) playSfx(this, SFX.tap);
    this.paused = true;
    // 사용자 명시 일시정지 — 모달 자동 복원 큐 비움.
    this.speedBeforeModal = null;
    this.refreshPlaybackHighlight();
    this.refreshTimer();
  }

  private handleSpeed(s: 1 | 2 | 4): void {
    if (this.paused || this.speed !== s) playSfx(this, SFX.tap);
    this.paused = false;
    this.speed = s;
    this.speedBeforeModal = null;
    this.refreshPlaybackHighlight();
    this.refreshTimer();
    // 온보딩 4단계 힌트 제거 — 속도 선택 시.
    this.dismissPickSpeedHint();
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
    // (밸런스 v2) 1×=2200ms, 2×=1400ms, 4×=900ms — 전 속도 살짝 더 느리게.
    const delayBySpeed: Readonly<Record<1 | 2 | 4, number>> = { 1: 2200, 2: 1400, 4: 900 };
    const delay = delayBySpeed[this.speed];
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
    // tick 직전 기여도를 캡쳐해 floating 팝업으로 띄움.
    const contributions = computeSlotContributions(this.state);
    const prevAp = this.state.availableAp ?? 0;
    this.state = advanceWeek(this.state);
    this.weeksSinceEvent += 1;
    if (this.sideProjectCooldown > 0) {
      this.sideProjectCooldown -= 1;
      this.drawSideProjectButton();
    }
    if (this.crisisCooldown > 0) {
      this.crisisCooldown -= 1;
    }
    // 매주 진행 틱 — 약하게(0.18). 4× 속도에서 거슬리지 않도록.
    playSfx(this, SFX.tick, 0.18);
    this.redraw();

    // 각 정배치 직원의 +X.X% 텍스트가 타일 위로 떠오르며 사라짐.
    for (const c of contributions) {
      if (c.progressDelta <= 0) continue;
      const view = this.slotSummaryViews.get(c.slot);
      if (!view) continue;
      this.spawnContribPopup(
        view.tileX + view.tileW / 2,
        view.tileY + 8,
        `+${c.progressDelta.toFixed(1)}%`,
        c.matched ? TEXT_COLOR.ok : TEXT_COLOR.bad,
      );
    }

    // 온보딩 5단계: 첫 주 경과 후 직원 타일 클릭 안내 (1회만).
    if (this.isOnboarding && !this.clickEmployeeHintShown) {
      this.clickEmployeeHintShown = true;
      this.showClickEmployeeHint();
    }

    if (canRelease(this.state)) {
      // 출시 가능 도달 — 자동 일시정지하고 출시 패널 노출(redraw가 처리).
      this.handlePause();
      // 온보딩 6단계: 출시 힌트.
      if (this.isOnboarding && !this.releaseHintShown) {
        this.releaseHintShown = true;
        this.showReleaseHint();
      }
      return;
    }

    const nextAp = this.state.availableAp ?? 0;
    if (prevAp < AP_CAP && nextAp >= AP_CAP) {
      this.handlePause();
      this.statusText
        .setText(`행동 AP가 가득 찼습니다 (${AP_CAP}/${AP_CAP}) — 행동을 쓰고 다시 진행하세요.`)
        .setColor(TEXT_COLOR.warn);
      return;
    }

    // 이탈 후보 체크 — streak 임계 도달자가 있으면 퇴사 모달 우선 표시.
    // 단 직원 2명 이하 시엔 이탈 무시(게임 진행 불가 회피).
    if (this.state.employees.length > 2) {
      const exits = pickExitCandidates(this.state);
      if (exits.length > 0 && exits[0]) {
        this.pauseForModal();
        this.showExitModal(exits[0]);
        return;
      }
    }

    // 랜덤 이벤트 발동 — 2주 이상 + 35% 확률 + 최근 7개 중복 방지.
    // 평균 발동 주기 ~ 2 + 1/0.35 ≈ 4.86주 (10주 프로젝트당 ~2 이벤트).
    if (this.weeksSinceEvent >= 2 && Math.random() < 0.35) {
      const ev = pickRandomEvent(this.state, this.recentEventIds);
      if (ev) {
        this.weeksSinceEvent = 0;
        // 최근 큐에 추가, 7개 초과 시 가장 오래된 것 제거.
        this.recentEventIds.push(ev.id);
        if (this.recentEventIds.length > 7) this.recentEventIds.shift();
        this.pauseForModal();
        this.showEventModal(ev);
        return;
      }
    }

    // 위기 발동 — productIndex >= CRISIS_MIN_PRODUCT_COUNT + cooldown 없을 때.
    // R&D: 보안 프로그램 — 위기 발동 확률 ×0.5.
    const crisisProbability = isRndPurchased(this.state.rnd, 'security-program')
      ? CRISIS_TRIGGER_PROBABILITY * 0.5
      : CRISIS_TRIGGER_PROBABILITY;
    if (
      this.state.productIndex >= CRISIS_MIN_PRODUCT_COUNT &&
      this.crisisCooldown <= 0 &&
      Math.random() < crisisProbability
    ) {
      const crisis = pickCrisis();
      if (crisis) {
        this.crisisCooldown = CRISIS_COOLDOWN_WEEKS;
        this.pauseForModal();
        this.showCrisisModal(crisis);
        return;
      }
    }

    // 파산 위기 체크 — 골드 -500 이하 5주 연속.
    if (!this.bankruptcyModalContainer && isBankrupt(this.state, this.state.bankruptcy)) {
      this.pauseForModal();
      this.showBankruptcyModal();
      return;
    }

    // 명성 폭락 체크 — 명성 0 이하 (1회만).
    if (!this.collapseModalShown && this.state.productIndex >= 1 && isCollapsing(this.state)) {
      this.collapseModalShown = true;
      this.pauseForModal();
      this.showCollapseModal();
    }
  }

  /** 한 줄 텍스트가 위로 30px 떠오르며 페이드아웃되는 popup. */
  private spawnContribPopup(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.tweens.add({
      targets: t,
      y: y - 28,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // ────────────────────────── event modal ──────────────────────────
  private showEventModal(ev: GameEvent): void {
    playSfx(this, SFX.modal, 0.5);
    const c = this.add.container(0, 0).setDepth(100);

    // 어두운 오버레이 — logical 720×1280 풀 사이즈로 뒤쪽 입력 차단.
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.7)
      .setOrigin(0, 0)
      .setInteractive();
    c.add(overlay);

    // 이벤트 패널
    const panelW = 640;
    const panelH = 700;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panelY = Math.max(0, (1280 - panelH) / 2);
    const panel = makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);
    c.add(panel);

    // 카테고리 chip — 패널 상단 좌측. 작은 라벨로만.
    const cat = categoryOf(ev);
    c.add(
      this.add
        .text(panelX + 24, panelY + 22, `[${cat}] ${EVENT_CATEGORY_LABEL[cat]}`, {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          fontStyle: 'bold',
          color: TEXT_COLOR.warn,
        })
        .setOrigin(0, 0),
    );

    // 제목 — chip 아래.
    c.add(
      this.add
        .text(panelX + panelW / 2, panelY + 56, ev.title, {
          fontFamily: FONT_STACK,
          fontSize: '36px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5, 0),
    );

    // 설명 — 제목 아래. 폭 = panel-padding.
    const descX = panelX + 30;
    const descY = panelY + 102;
    const descText = this.add
      .text(descX, descY, ev.description, {
        fontFamily: FONT_STACK,
        fontSize: '26px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: panelW - 60, useAdvancedWrap: true },
        lineSpacing: 4,
      })
      .setOrigin(0, 0);
    c.add(descText);

    // 선택지 — 패널 하단부터 위로 쌓아 올림.
    const choiceX = panelX + 30;
    const choiceW = panelW - 60;
    const choiceH = 88;
    const choiceGap = 14;
    const choicesTotalH = ev.choices.length * choiceH + (ev.choices.length - 1) * choiceGap;
    const choicesStartY = panelY + panelH - choicesTotalH - 30;

    // 카테고리 일러스트 — 설명 아래 ~ 선택지 위 빈 공간에 배치.
    // 원본 SVG는 240×80(3:1) 배너 비율. 가용 공간 안에서 aspect 유지하며 가능한 크게.
    const illustGapTop = 18;
    const illustGapBottom = 20;
    const illustTop = descY + descText.height + illustGapTop;
    const illustBottom = choicesStartY - illustGapBottom;
    const availH = Math.max(0, illustBottom - illustTop);
    const availW = panelW - 60;
    if (availH > 60) {
      // aspect 유지: w/h = 3. h 우선 → w = h*3, 가용 폭 초과면 w 우선으로 컷.
      const aspect = 3;
      let illW = availW;
      let illH = illW / aspect;
      if (illH > availH) {
        illH = availH;
        illW = illH * aspect;
      }
      const illX = panelX + panelW / 2;
      const illY = illustTop + availH / 2; // 가용 영역 세로 중앙
      c.add(
        this.add
          .image(illX, illY, EVENT_CATEGORY_TEXTURE[cat])
          .setDisplaySize(illW, illH)
          .setOrigin(0.5),
      );
    }

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
        fontSize: '29px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      });
      const summary = this.add.text(choiceX + 22, y + 50, ch.summary, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
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
    this.resumeAfterModal();
  }

  // ────────────────────────── exit (퇴사) modal ──────────────────────────
  private showExitModal(emp: Employee): void {
    playSfx(this, SFX.modal, 0.5);
    const c = this.add.container(0, 0).setDepth(110);

    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.75)
      .setOrigin(0, 0)
      .setInteractive();
    c.add(overlay);

    const panelW = 600;
    const panelH = 440;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panelY = Math.max(0, (1280 - panelH) / 2);
    c.add(makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel));

    c.add(
      this.add.text(panelX + 24, panelY + 22, '퇴사 통보', {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        fontStyle: 'bold',
        color: TEXT_COLOR.bad,
      }),
    );
    c.add(
      this.add
        .text(panelX + panelW / 2, panelY + 60, `${emp.name} 면담 요청`, {
          fontFamily: FONT_STACK,
          fontSize: '33px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5, 0),
    );
    c.add(
      this.add.text(
        panelX + 30,
        panelY + 110,
        `${emp.name}이/가 자리를 비웠다. 장기 사기 부진(${emp.lowMoraleStreak ?? 0}주 연속 ${
          25
        } 미만)으로 회사를 떠나려 한다.\n\n붙잡으려면 면담 + 인센티브가 필요하다.`,
        {
          fontFamily: FONT_STACK,
          fontSize: '26px',
          color: TEXT_COLOR.dim,
          wordWrap: { width: panelW - 60, useAdvancedWrap: true },
          lineSpacing: 4,
        },
      ),
    );

    // 선택지 — 보내준다 / 면담으로 붙잡는다(-150g)
    const choiceX = panelX + 30;
    const choiceW = panelW - 60;
    const choiceH = 76;
    const gap = 12;
    const choicesStartY = panelY + panelH - (choiceH * 2 + gap) - 26;

    const canRetain = this.state.gold >= RETAIN_COST;

    // 보내준다
    {
      const y = choicesStartY;
      const bg = this.add.graphics();
      bg.fillStyle(COLOR.btnSecondary, 1);
      bg.fillRoundedRect(choiceX, y, choiceW, choiceH, 12);
      const label = this.add.text(choiceX + 18, y + 14, '보내준다', {
        fontFamily: FONT_STACK,
        fontSize: '27px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      });
      const sum = this.add.text(choiceX + 18, y + 42, `${emp.name}이 명단에서 제거됨`, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
      });
      const hit = this.add
        .zone(choiceX + choiceW / 2, y + choiceH / 2, choiceW, choiceH)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        playSfx(this, SFX.tap);
        c.destroy(true);
        this.applyExit(emp.id);
      });
      c.add([bg, label, sum, hit]);
    }

    // 면담으로 붙잡는다
    {
      const y = choicesStartY + choiceH + gap;
      const bg = this.add.graphics();
      bg.fillStyle(canRetain ? COLOR.btn : COLOR.btnDisabled, 1);
      bg.fillRoundedRect(choiceX, y, choiceW, choiceH, 12);
      const label = this.add.text(
        choiceX + 18,
        y + 14,
        `면담으로 붙잡는다 (-${formatGold(RETAIN_COST)})`,
        {
          fontFamily: FONT_STACK,
          fontSize: '27px',
          fontStyle: 'bold',
          color: canRetain ? TEXT_COLOR.primary : TEXT_COLOR.disabled,
        },
      );
      const sum = this.add.text(
        choiceX + 18,
        y + 42,
        `${emp.name} 사기 +${RETAIN_MORALE_BOOST}, 잔류`,
        {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          color: canRetain ? TEXT_COLOR.dim : TEXT_COLOR.disabled,
        },
      );
      c.add([bg, label, sum]);
      if (canRetain) {
        const hit = this.add
          .zone(choiceX + choiceW / 2, y + choiceH / 2, choiceW, choiceH)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
          playSfx(this, SFX.success);
          c.destroy(true);
          this.applyRetain(emp.id);
        });
        c.add(hit);
      }
    }
  }

  /** 직원 이탈 처리 — employees + assignment에서 제거. */
  private applyExit(empId: string): void {
    const remainingEmployees = this.state.employees.filter((e) => e.id !== empId);
    const newAssignment: typeof this.state.assignment = { ...this.state.assignment };
    for (const slot of SLOT_ORDER) {
      if (newAssignment[slot] === empId) delete newAssignment[slot];
    }
    this.state = {
      ...this.state,
      employees: remainingEmployees,
      assignment: newAssignment,
    };
    this.redraw();
    this.resumeAfterModal();
  }

  /** 면담 잔류 처리 — 골드 차감, morale +N, streak 0. */
  private applyRetain(empId: string): void {
    const updated = this.state.employees.map((e) =>
      e.id === empId
        ? { ...e, morale: Math.min(100, e.morale + RETAIN_MORALE_BOOST), lowMoraleStreak: 0 }
        : e,
    );
    this.state = {
      ...this.state,
      gold: Math.max(0, this.state.gold - RETAIN_COST),
      employees: updated,
    };
    this.redraw();
    this.resumeAfterModal();
  }

  private handlePolish(): void {
    playSfx(this, SFX.tap);
    this.state = polishWeek(this.state);
    this.polishCount += 1;
    this.redraw();
  }

  private handleRelease(): void {
    playSfx(this, SFX.click, 0.55);
    // 온보딩 힌트 모두 제거.
    this.devHintContainer?.destroy(true);
    this.devHintContainer = null;
    const outcome = shipProject(this.state, this.polishCount, this.selectedPromo);
    // 출시 직후 → ResultScene으로 직행하지 않고 운영 결정 모달 표시.
    this.startPostReleasePhase(outcome);
  }

  /** 출시 후 운영 결정 모달을 표시한다. 선택 후 수정된 outcome으로 ResultScene 전환. */
  private startPostReleasePhase(outcome: ReleaseOutcome): void {
    const decision = pickOpsDecision();
    this.showOpsModal(decision, outcome);
  }

  /** 운영 결정 모달 — 이벤트 모달과 동일한 톤. */
  private showOpsModal(decision: OpsDecision, outcome: ReleaseOutcome): void {
    playSfx(this, SFX.modal, 0.5);
    this.opsModalContainer?.destroy(true);
    const c = this.add.container(0, 0).setDepth(120);
    this.opsModalContainer = c;

    // 어두운 오버레이
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.75)
      .setOrigin(0, 0)
      .setInteractive();
    c.add(overlay);

    const panelW = 640;
    const panelH = 680;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panelY = Math.max(0, (1280 - panelH) / 2);
    const panel = makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);
    c.add(panel);

    // 헤더 chip
    c.add(
      this.add
        .text(panelX + 24, panelY + 22, '출시 후 — 운영 결정', {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          fontStyle: 'bold',
          color: TEXT_COLOR.warn,
        })
        .setOrigin(0, 0),
    );

    // 제목
    c.add(
      this.add
        .text(panelX + panelW / 2, panelY + 56, decision.title, {
          fontFamily: FONT_STACK,
          fontSize: '36px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5, 0),
    );

    // 설명
    const descX = panelX + 30;
    const descY = panelY + 110;
    const descText = this.add.text(descX, descY, decision.description, {
      fontFamily: FONT_STACK,
      fontSize: '26px',
      color: TEXT_COLOR.dim,
      wordWrap: { width: panelW - 60, useAdvancedWrap: true },
      lineSpacing: 4,
    }).setOrigin(0, 0);
    c.add(descText);

    // 선택지
    const choiceX = panelX + 30;
    const choiceW = panelW - 60;
    const choiceH = 88;
    const choiceGap = 12;
    const choicesTotalH = decision.choices.length * choiceH + (decision.choices.length - 1) * choiceGap;
    const choicesStartY = panelY + panelH - choicesTotalH - 30;

    decision.choices.forEach((ch, i) => {
      const y = choicesStartY + i * (choiceH + choiceGap);
      const btnBg = this.add.graphics();
      const drawBtn = (pressed: boolean): void => {
        btnBg.clear();
        btnBg.fillStyle(pressed ? COLOR.btnSecondaryDown : COLOR.btnSecondary, 1);
        btnBg.fillRoundedRect(choiceX, y, choiceW, choiceH, 14);
      };
      drawBtn(false);

      // 매출/별점 예고 힌트 — 우측 상단 작게
      const revenueHint = ch.revenueMul >= 1.0
        ? `매출 +${Math.round((ch.revenueMul - 1) * 100)}%`
        : `매출 ${Math.round((ch.revenueMul - 1) * 100)}%`;
      const starsHint = ch.starsDelta > 0
        ? `★ +${ch.starsDelta}`
        : ch.starsDelta < 0
          ? `★ ${ch.starsDelta}`
          : '';
      const hintParts = [revenueHint, starsHint].filter((s) => s !== '');
      const hintStr = hintParts.join(' / ');

      const label = this.add.text(choiceX + 22, y + 18, ch.label, {
        fontFamily: FONT_STACK,
        fontSize: '29px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      });
      const hint = this.add.text(choiceX + choiceW - 22, y + 20, hintStr, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: ch.revenueMul >= 1.0 ? TEXT_COLOR.ok : TEXT_COLOR.bad,
      }).setOrigin(1, 0);
      const summary = this.add.text(choiceX + 22, y + 52, ch.summary, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
      });

      const hit = this.add
        .zone(choiceX + choiceW / 2, y + choiceH / 2, choiceW, choiceH)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => drawBtn(true));
      hit.on('pointerout', () => drawBtn(false));
      hit.on('pointerup', () => {
        drawBtn(false);
        this.handleOpsChoice(ch.revenueMul, ch.starsDelta, ch.moraleDelta, outcome);
      });

      c.add([btnBg, label, hint, summary, hit]);
    });

    c.setAlpha(0);
    this.tweens.add({
      targets: c,
      alpha: 1,
      duration: 200,
      ease: 'Cubic.easeOut',
    });
    applyHiDPI(this);
  }

  /** 운영 결정 선택 처리 — outcome에 modifier 적용 후 ResultScene으로 이동. */
  private handleOpsChoice(
    revenueMul: number,
    starsDelta: number,
    moraleDelta: number,
    outcome: ReleaseOutcome,
  ): void {
    this.opsModalContainer?.destroy(true);
    this.opsModalContainer = null;

    const clamp = (n: number, lo: number, hi: number): number =>
      Math.max(lo, Math.min(hi, n));

    // R&D: 자율 배포 시스템 — 좋은 결과 강화, 나쁜 결과 완화.
    // revenueMul >= 1이면 ×1.3, < 1이면 손실 30% 완화 (1-(1-mul)*0.7).
    let effectiveRevenueMul = revenueMul;
    if (isRndPurchased(this.state.rnd, 'autonomous-deploy')) {
      if (revenueMul >= 1.0) {
        effectiveRevenueMul = 1 + (revenueMul - 1) * 1.3;
      } else {
        effectiveRevenueMul = 1 - (1 - revenueMul) * 0.7;
      }
    }

    const newRevenue = Math.round(outcome.revenue * effectiveRevenueMul);
    const rawStars = outcome.stars + starsDelta;
    const newStars = clamp(rawStars, 1, 5) as ReviewStars;
    const revenueDiff = newRevenue - outcome.revenue;

    const modified: ReleaseOutcome = {
      ...outcome,
      revenue: newRevenue,
      stars: newStars,
      headline: HEADLINE_BY_STARS[newStars],
      state: {
        ...outcome.state,
        gold: outcome.state.gold + revenueDiff,
        employees: outcome.state.employees.map((e) => ({
          ...e,
          morale: clamp(e.morale + moraleDelta, 0, 100),
        })),
      },
    };

    this.scene.start(SCENE_KEYS.Result, {
      outcome: modified,
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
    this.drawWeeklyActionButton();
    this.redrawAssignmentRecap();
    this.updateStatus();
    this.updateActionPanel();
    this.updateSprintPhaseDisplay();
  }

  /** Sprint 단계 텍스트 + 슬롯 가중치 인디케이터 갱신. */
  private updateSprintPhaseDisplay(): void {
    const phase = getSprintPhase(this.state.project.progress);
    const label = SPRINT_PHASE_LABEL[phase];
    const weights = SPRINT_SLOT_WEIGHT[phase];

    // 단계 색 — build=primary(파랑), design=ok(초록), planning/qa=warn(노랑)
    const phaseColor = phase === 'build'
      ? TEXT_COLOR.ok
      : phase === 'design'
        ? '#4f6fff'
        : TEXT_COLOR.warn;

    this.sprintPhaseText.setText(label).setColor(phaseColor);

    // 슬롯 타일 가중치 표시 갱신.
    for (const slot of SLOT_ORDER) {
      const wt = this.slotPhaseWeightTexts.get(slot);
      if (!wt) continue;
      const w = weights[slot];
      // 1.0보다 크면 강조(노란), 1.0이면 숨김, 작으면 희미한 회색.
      if (w > 1.0) {
        wt.setText(`×${w.toFixed(1)}`).setColor(TEXT_COLOR.warn).setVisible(true);
      } else if (w < 1.0) {
        wt.setText(`×${w.toFixed(2)}`).setColor(TEXT_COLOR.disabled).setVisible(true);
      } else {
        wt.setVisible(false);
      }
    }

    // 단계 전환 토스트 — 이전 단계와 달라졌을 때.
    if (this.lastSprintPhase !== null && this.lastSprintPhase !== phase) {
      this.showSprintToast(label);
    }
    this.lastSprintPhase = phase;
  }

  /** 단계 전환 토스트 — 상단에 잠깐 표시 후 페이드아웃. */
  private showSprintToast(label: string): void {
    this.sprintToastText?.destroy();
    const t = this.add.text(this.cx, 115, `→ ${label}`, {
      fontFamily: FONT_STACK,
      fontSize: '24px',
      fontStyle: 'bold',
      color: TEXT_COLOR.warn,
    }).setOrigin(0.5).setAlpha(1);
    this.sprintToastText = t;
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 1200,
      duration: 600,
      ease: 'Linear',
      onComplete: () => { t.destroy(); this.sprintToastText = null; },
    });
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

    const panelX = this.contentX + (720 - 690) / 2 + 24;
    this.drawGauge(this.progressBar, panelX, 172, p / 100, COLOR.gaugeFillProgress);
    this.drawGauge(this.bugBar, panelX, 252, b / 100, COLOR.gaugeFillBug);
    if (this.appealBar && this.appealText) {
      this.drawGauge(this.appealBar, panelX, 332, a / 100, COLOR.gaugeFillAppeal);
      this.appealText.setText(`${Math.round(a)} / 100`);
    }

    // Burn rate — 매주 자동 차감되는 운영비.
    if (this.burnText) {
      const burn = computeBurnRate(this.state);
      this.burnText.setText(`운영비 −${formatGold(burn)}/주`);
    }
  }

  private redrawAssignmentRecap(): void {
    const empById = new Map(this.state.employees.map((e) => [e.id, e] as const));
    const contributions = computeSlotContributions(this.state);
    const contribBySlot = new Map(contributions.map((c) => [c.slot, c] as const));
    // 직원 타일 hit zones 재생성 (배치 변경 반영)
    this.rebuildEmpTileHits();

    for (const slot of SLOT_ORDER) {
      const view = this.slotSummaryViews.get(slot);
      if (!view) continue;
      const empId = this.state.assignment[slot];
      const emp = empId ? empById.get(empId) : undefined;

      if (!emp) {
        view.text.setText('비어 있음').setColor(TEXT_COLOR.disabled);
        view.contribText.setText('');
        view.moraleFill.clear();
        view.staminaFill.clear();
        continue;
      }

      const matched = isMatched(slot, emp.job);
      view.text
        .setText(`${emp.name} · ${JOB_LABEL[emp.job]} ${matched ? '✓' : '✗'}`)
        .setColor(matched ? TEXT_COLOR.ok : TEXT_COLOR.bad);

      // 이번 주 기여도 — Progress %/주
      const c = contribBySlot.get(slot);
      if (c) {
        view.contribText
          .setText(`+${c.progressDelta.toFixed(1)}%/주`)
          .setColor(matched ? TEXT_COLOR.warn : TEXT_COLOR.dim);
      } else {
        view.contribText.setText('');
      }

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

  // ────────────────────────── 주간 액션(AP) 버튼 ──────────────────────────

  /**
   * AP 버튼 빌드 — 사이드 프로젝트 왼쪽에 배치.
   * productIndex 무관하게 항상 노출(AP는 1작부터 있음).
   */
  private buildWeeklyActionButton(): void {
    const w = 100;
    const h = 40;
    // 야근 버튼(124) + 사이드 프로젝트(110) + 간격(10+10) 왼쪽에 배치
    const sideX = this.contentX + 720 - 14 - 124 - 10 - 110;
    const x = sideX - 10 - w;
    const y = 18;
    this.apBtnRect = new Phaser.Geom.Rectangle(x, y, w, h);
    this.apBtnBg = this.add.graphics();
    this.apBtnText = this.add
      .text(x + w / 2, y + h / 2, '', {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
        align: 'center',
      })
      .setOrigin(0.5);
    this.apBtnHit = this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    this.apBtnHit.on('pointerup', () => this.handleOpenWeeklyActions());
    this.drawWeeklyActionButton();
  }

  private drawWeeklyActionButton(): void {
    if (!this.apBtnBg || !this.apBtnText || !this.apBtnRect || !this.apBtnHit) return;
    const ap = this.state.availableAp ?? 0;
    const hasAp = ap > 0;
    const fill = hasAp ? 0x2a5a2a : COLOR.btnSecondary;
    const r = this.apBtnRect;
    this.apBtnBg.clear();
    this.apBtnBg.fillStyle(fill, 1);
    this.apBtnBg.fillRoundedRect(r.x, r.y, r.width, r.height, 12);
    this.apBtnText
      .setText(`행동\nAP ${ap}/${AP_CAP}`)
      .setColor(hasAp ? TEXT_COLOR.ok : TEXT_COLOR.dim);
    if (this.apBtnHit.input) this.apBtnHit.input.enabled = true;
  }

  private handleOpenWeeklyActions(): void {
    if (this.weeklyActionModalContainer) return;
    playSfx(this, SFX.modal, 0.5);
    this.showWeeklyActionModal();
  }

  /** 주간 행동 모달 — 5개 액션 카드 세로 리스트. */
  private showWeeklyActionModal(): void {
    const c = this.add.container(0, 0).setDepth(100);
    this.weeklyActionCardViews = [];
    this.weeklyActionApText = null;
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.7)
      .setOrigin(0, 0)
      .setInteractive();
    c.add(overlay);

    const ap = this.state.availableAp ?? 0;
    const panelW = 640;
    const panelH = 740;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panelY = Math.max(0, (1280 - panelH) / 2);
    c.add(makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel));

    // 헤더
    c.add(
      this.add
        .text(panelX + 24, panelY + 22, '주간 행동', {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          fontStyle: 'bold',
          color: TEXT_COLOR.warn,
        })
        .setOrigin(0, 0),
    );
    this.weeklyActionApText = this.add
      .text(panelX + panelW / 2, panelY + 56, `행동 포인트 AP: ${ap} / ${AP_CAP}`, {
        fontFamily: FONT_STACK,
        fontSize: '30px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5, 0);
    c.add(this.weeklyActionApText);
    c.add(
      this.add
        .text(panelX + 30, panelY + 94, 'AP를 소비해 팀에 즉발 효과를 적용합니다. AP가 남아 있으면 이어서 여러 행동을 선택할 수 있습니다.', {
          fontFamily: FONT_STACK,
          fontSize: '23px',
          color: TEXT_COLOR.dim,
          wordWrap: { width: panelW - 60, useAdvancedWrap: true },
        })
        .setOrigin(0, 0),
    );

    // 액션 카드 — 세로 리스트
    const cardX = panelX + 30;
    const cardW = panelW - 60;
    const cardH = 80;
    const cardGap = 12;
    const cardsStartY = panelY + 136;

    WEEKLY_ACTIONS.forEach((action, i) => {
      const y = cardsStartY + i * (cardH + cardGap);
      const bg = this.add.graphics();
      const drawCard = (pressed: boolean): void => {
        const canUse = (this.state.availableAp ?? 0) >= action.apCost;
        bg.clear();
        if (!canUse) {
          bg.fillStyle(COLOR.btnDisabled, 1);
        } else {
          bg.fillStyle(pressed ? COLOR.btnSecondaryDown : COLOR.btnSecondary, 1);
        }
        bg.fillRoundedRect(cardX, y, cardW, cardH, 12);
      };
      drawCard(false);

      const labelText = this.add.text(cardX + 18, y + 14, action.label, {
        fontFamily: FONT_STACK,
        fontSize: '27px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      });
      const descText = this.add.text(cardX + 18, y + 42, action.desc, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: cardW - 100, useAdvancedWrap: true },
      });
      const costBadge = this.add
        .text(cardX + cardW - 16, y + cardH / 2, `AP -${action.apCost}`, {
          fontFamily: FONT_STACK,
          fontSize: '23px',
          fontStyle: 'bold',
          color: TEXT_COLOR.ok,
        })
        .setOrigin(1, 0.5);

      c.add([bg, labelText, descText, costBadge]);

      const hit = this.add
        .zone(cardX + cardW / 2, y + cardH / 2, cardW, cardH)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => drawCard(true));
      hit.on('pointerout', () => drawCard(false));
      hit.on('pointerup', () => {
        drawCard(false);
        this.handleWeeklyActionChoice(action);
      });
      c.add(hit);
      this.weeklyActionCardViews.push({
        action,
        bg,
        labelText,
        descText,
        costBadge,
        hit,
        rect: new Phaser.Geom.Rectangle(cardX, y, cardW, cardH),
      });
    });

    // 닫기 버튼
    const closeBtnY = panelY + panelH - 60;
    const closeBg = this.add.graphics();
    closeBg.fillStyle(COLOR.btnSecondary, 1);
    closeBg.fillRoundedRect(cardX, closeBtnY, cardW, 44, 12);
    const closeText = this.add
      .text(panelX + panelW / 2, closeBtnY + 22, '닫기', {
        fontFamily: FONT_STACK,
        fontSize: '27px',
        fontStyle: 'bold',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
    const closeHit = this.add
      .zone(panelX + panelW / 2, closeBtnY + 22, cardW, 44)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerup', () => {
      this.closeWeeklyActionModal();
    });
    c.add([closeBg, closeText, closeHit]);

    this.weeklyActionModalContainer = c;
    applyHiDPI(this);
    this.updateWeeklyActionModal();
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
  }

  private closeWeeklyActionModal(): void {
    this.weeklyActionModalContainer?.destroy(true);
    this.weeklyActionModalContainer = null;
    this.weeklyActionApText = null;
    this.weeklyActionCardViews = [];
  }

  private updateWeeklyActionModal(): void {
    if (!this.weeklyActionModalContainer) return;
    const ap = this.state.availableAp ?? 0;
    this.weeklyActionApText?.setText(`행동 포인트 AP: ${ap} / ${AP_CAP}`);
    for (const view of this.weeklyActionCardViews) {
      const canUse = ap >= view.action.apCost;
      view.bg.clear();
      view.bg.fillStyle(canUse ? COLOR.btnSecondary : COLOR.btnDisabled, 1);
      view.bg.fillRoundedRect(view.rect.x, view.rect.y, view.rect.width, view.rect.height, 12);
      view.labelText.setColor(canUse ? TEXT_COLOR.primary : TEXT_COLOR.disabled);
      view.descText.setColor(canUse ? TEXT_COLOR.dim : TEXT_COLOR.disabled);
      view.costBadge.setColor(canUse ? TEXT_COLOR.ok : TEXT_COLOR.disabled);
      if (view.hit.input) view.hit.input.enabled = canUse;
    }
  }

  private handleWeeklyActionChoice(action: WeeklyAction): void {
    const ap = this.state.availableAp ?? 0;
    if (ap < action.apCost) return;
    playSfx(this, SFX.success, 0.5);
    this.state = action.apply({ ...this.state, availableAp: ap - action.apCost });
    this.redraw();
    if ((this.state.availableAp ?? 0) > 0) {
      this.updateWeeklyActionModal();
      return;
    }
    this.closeWeeklyActionModal();
    this.statusText
      .setText('행동 AP를 모두 사용했습니다. 진행을 다시 시작하세요.')
      .setColor(TEXT_COLOR.ok);
  }

  // ────────────────────────── 위기 모먼트 모달 ──────────────────────────

  /** 빨간 헤더의 위기 모달 — 5초 카운트다운 후 defaultApply 자동 발동. */
  private showCrisisModal(crisis: Crisis): void {
    // 위기용 — warning alias(modal과 동일 key이나 의도가 명확).
    playSfx(this, SFX.warning, 0.8);
    const c = this.add.container(0, 0).setDepth(120);
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.8)
      .setOrigin(0, 0)
      .setInteractive();
    c.add(overlay);

    const panelW = 640;
    const panelH = 620;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panelY = Math.max(0, (1280 - panelH) / 2);
    // 빨간 글로우 효과 — 테두리 대용 빨간 패널
    const glowPanel = makePanel(this, panelX - 3, panelY - 3, panelW + 6, panelH + 6, 0x5a1010);
    c.add(glowPanel);
    c.add(makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel));

    // 빨간 헤더 배너
    const headerH = 52;
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0xcc2222, 1);
    headerBg.fillRoundedRect(panelX, panelY, panelW, headerH, 12);
    c.add(headerBg);
    c.add(
      this.add
        .text(panelX + panelW / 2, panelY + headerH / 2, '⚠ 위기 발생!', {
          fontFamily: FONT_STACK,
          fontSize: '30px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5),
    );

    // 카운트다운 텍스트
    const countdownText = this.add
      .text(panelX + panelW - 24, panelY + headerH / 2, '5초', {
        fontFamily: FONT_STACK,
        fontSize: '27px',
        fontStyle: 'bold',
        color: '#ffaaaa',
      })
      .setOrigin(1, 0.5);
    c.add(countdownText);

    // 제목
    c.add(
      this.add
        .text(panelX + panelW / 2, panelY + 72, crisis.title, {
          fontFamily: FONT_STACK,
          fontSize: '33px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5, 0),
    );

    // 설명
    c.add(
      this.add
        .text(panelX + 30, panelY + 116, crisis.description, {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          color: TEXT_COLOR.dim,
          wordWrap: { width: panelW - 60, useAdvancedWrap: true },
          lineSpacing: 4,
        })
        .setOrigin(0, 0),
    );

    // 선택지 버튼
    const choiceX = panelX + 30;
    const choiceW = panelW - 60;
    const choiceH = 76;
    const choiceGap = 12;
    const choicesStartY = panelY + 200;

    crisis.choices.forEach((ch, i) => {
      const y = choicesStartY + i * (choiceH + choiceGap);
      const btnBg = this.add.graphics();
      const drawBtn = (pressed: boolean): void => {
        btnBg.clear();
        btnBg.fillStyle(pressed ? 0x4a1515 : 0x3a1515, 1);
        btnBg.fillRoundedRect(choiceX, y, choiceW, choiceH, 12);
      };
      drawBtn(false);
      const labelText = this.add.text(choiceX + 18, y + 14, ch.label, {
        fontFamily: FONT_STACK,
        fontSize: '27px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      });
      const sumText = this.add.text(choiceX + 18, y + 44, ch.summary, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
      });
      const hit = this.add
        .zone(choiceX + choiceW / 2, y + choiceH / 2, choiceW, choiceH)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => drawBtn(true));
      hit.on('pointerout', () => drawBtn(false));
      hit.on('pointerup', () => {
        drawBtn(false);
        this.applyCrisisChoice(crisis, i, c);
      });
      c.add([btnBg, labelText, sumText, hit]);
    });

    this.crisisModalContainer = c;
    applyHiDPI(this);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });

    // 카운트다운 타이머
    let remaining = Math.floor(crisis.timeoutMs / 1000);
    this.crisisTimerEvent = this.time.addEvent({
      delay: 1000,
      repeat: remaining - 1,
      callback: () => {
        remaining -= 1;
        if (!countdownText.active) return;
        countdownText.setText(`${remaining}초`);
        if (remaining <= 0) {
          // 시간 초과 — defaultApply 발동
          this.applyCrisisDefault(crisis, c);
        }
      },
    });
  }

  private applyCrisisChoice(crisis: Crisis, index: number, container: Phaser.GameObjects.Container): void {
    const choice = crisis.choices[index];
    if (!choice) return;
    this.crisisTimerEvent?.remove();
    this.crisisTimerEvent = null;
    this.state = choice.apply(this.state);
    container.destroy(true);
    this.crisisModalContainer = null;
    playSfx(this, SFX.tap);
    this.redraw();
    this.resumeAfterModal();
  }

  private applyCrisisDefault(crisis: Crisis, container: Phaser.GameObjects.Container): void {
    this.crisisTimerEvent?.remove();
    this.crisisTimerEvent = null;
    this.state = crisis.defaultApply(this.state);
    container.destroy(true);
    this.crisisModalContainer = null;
    this.redraw();
    this.resumeAfterModal();
  }

  // ────────────────────────── 파산 / 폐업 모달 ──────────────────────────

  /** 파산 모달 — 구조조정 or 폐업 선택. */
  private showBankruptcyModal(): void {
    playSfx(this, SFX.warning, 0.9);
    const c = this.add.container(0, 0).setDepth(130);
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.85)
      .setOrigin(0, 0)
      .setInteractive();
    c.add(overlay);

    const panelW = 640;
    const panelH = 480;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panelY = Math.max(0, (1280 - panelH) / 2);
    const glowPanel = makePanel(this, panelX - 3, panelY - 3, panelW + 6, panelH + 6, 0x5a1010);
    c.add(glowPanel);
    c.add(makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel));

    const headerH = 52;
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0xcc2222, 1);
    headerBg.fillRoundedRect(panelX, panelY, panelW, headerH, 12);
    c.add(headerBg);
    c.add(
      this.add
        .text(panelX + panelW / 2, panelY + headerH / 2, '💸 파산 위기!', {
          fontFamily: FONT_STACK,
          fontSize: '30px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5),
    );

    c.add(
      this.add.text(panelX + 30, panelY + 68, '회사가 파산했습니다.\n자금 부족으로 더 이상 운영 불가.', {
        fontFamily: FONT_STACK,
        fontSize: '27px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: panelW - 60, useAdvancedWrap: true },
        lineSpacing: 4,
      }),
    );

    // 구조조정 버튼
    const btnW = panelW - 60;
    const btn1Y = panelY + 180;
    const btn2Y = btn1Y + 100;

    const btn1Bg = this.add.graphics();
    const drawBtn1 = (pressed: boolean): void => {
      btn1Bg.clear();
      btn1Bg.fillStyle(pressed ? 0x3a4020 : 0x2a3010, 1);
      btn1Bg.fillRoundedRect(panelX + 30, btn1Y, btnW, 80, 12);
    };
    drawBtn1(false);
    c.add(btn1Bg);
    c.add(
      this.add.text(panelX + 30 + 18, btn1Y + 14, '구조조정', {
        fontFamily: FONT_STACK, fontSize: '27px', fontStyle: 'bold', color: TEXT_COLOR.primary,
      }),
    );
    c.add(
      this.add.text(panelX + 30 + 18, btn1Y + 44, '직원 절반 해고, 골드 +500 보전', {
        fontFamily: FONT_STACK, fontSize: '21px', color: TEXT_COLOR.dim,
      }),
    );
    const hit1 = this.add
      .zone(panelX + 30 + btnW / 2, btn1Y + 40, btnW, 80)
      .setInteractive({ useHandCursor: true });
    hit1.on('pointerdown', () => drawBtn1(true));
    hit1.on('pointerout', () => drawBtn1(false));
    hit1.on('pointerup', () => {
      drawBtn1(false);
      this.applyRestructuring(c);
    });
    c.add(hit1);

    // 폐업 버튼
    const btn2Bg = this.add.graphics();
    const drawBtn2 = (pressed: boolean): void => {
      btn2Bg.clear();
      btn2Bg.fillStyle(pressed ? 0x5a1010 : 0x3a1515, 1);
      btn2Bg.fillRoundedRect(panelX + 30, btn2Y, btnW, 80, 12);
    };
    drawBtn2(false);
    c.add(btn2Bg);
    c.add(
      this.add.text(panelX + 30 + 18, btn2Y + 14, '폐업', {
        fontFamily: FONT_STACK, fontSize: '27px', fontStyle: 'bold', color: TEXT_COLOR.primary,
      }),
    );
    c.add(
      this.add.text(panelX + 30 + 18, btn2Y + 44, '게임 데이터 초기화 후 시작 화면으로', {
        fontFamily: FONT_STACK, fontSize: '21px', color: TEXT_COLOR.dim,
      }),
    );
    const hit2 = this.add
      .zone(panelX + 30 + btnW / 2, btn2Y + 40, btnW, 80)
      .setInteractive({ useHandCursor: true });
    hit2.on('pointerdown', () => drawBtn2(true));
    hit2.on('pointerout', () => drawBtn2(false));
    hit2.on('pointerup', () => {
      drawBtn2(false);
      clearData();
      this.scene.start(SCENE_KEYS.Boot);
    });
    c.add(hit2);

    this.bankruptcyModalContainer = c;
    applyHiDPI(this);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
  }

  /** 구조조정 적용 — 직원 절반(랜덤) 해고, 골드 +500, bankruptcy streak 초기화. */
  private applyRestructuring(container: Phaser.GameObjects.Container): void {
    playSfx(this, SFX.tap);
    container.destroy(true);
    this.bankruptcyModalContainer = null;

    const emps = [...this.state.employees];
    const keepCount = Math.ceil(emps.length / 2);
    // 랜덤으로 절반만 남기기.
    const shuffled = emps.sort(() => Math.random() - 0.5);
    const kept = shuffled.slice(0, keepCount);
    this.state = {
      ...this.state,
      employees: kept,
      gold: 0,
      // bankruptcy streak 초기화.
      bankruptcy: { lowGoldStreak: 0 },
    };
    this.redraw();
    this.resumeAfterModal();
  }

  /** 명성 폭락 모달 — 경고만, 닫기 가능. */
  private showCollapseModal(): void {
    playSfx(this, SFX.warning, 0.7);
    const c = this.add.container(0, 0).setDepth(125);
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.75)
      .setOrigin(0, 0)
      .setInteractive();
    c.add(overlay);

    const panelW = 600;
    const panelH = 340;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panelY = Math.max(0, (1280 - panelH) / 2);
    c.add(makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel));

    const headerH = 52;
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0xaa4400, 1);
    headerBg.fillRoundedRect(panelX, panelY, panelW, headerH, 12);
    c.add(headerBg);
    c.add(
      this.add
        .text(panelX + panelW / 2, panelY + headerH / 2, '⚠ 명성 폭락 위기', {
          fontFamily: FONT_STACK,
          fontSize: '28px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5),
    );

    c.add(
      this.add.text(panelX + 30, panelY + 74, '회사 명성이 바닥을 쳤습니다.\n매출 보너스가 사라지고 채용이 어려워집니다.\n작품 품질을 높여 명성을 회복하세요.', {
        fontFamily: FONT_STACK,
        fontSize: '25px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: panelW - 60, useAdvancedWrap: true },
        lineSpacing: 4,
      }),
    );

    const closeY = panelY + panelH - 72;
    const closeBg = this.add.graphics();
    closeBg.fillStyle(COLOR.btn, 1);
    closeBg.fillRoundedRect(panelX + 30, closeY, panelW - 60, 48, 12);
    c.add(closeBg);
    c.add(
      this.add.text(panelX + panelW / 2, closeY + 24, '확인', {
        fontFamily: FONT_STACK, fontSize: '26px', fontStyle: 'bold', color: TEXT_COLOR.primary,
      }).setOrigin(0.5),
    );
    const closeHit = this.add
      .zone(panelX + panelW / 2, closeY + 24, panelW - 60, 48)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerup', () => {
      playSfx(this, SFX.tap);
      c.destroy(true);
      this.resumeAfterModal();
    });
    c.add(closeHit);

    applyHiDPI(this);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
  }

  // ────────────────────────── 직원 per-action popup ──────────────────────────

  /**
   * 직원 recap 타일에 interactive zone을 덧씌워 클릭 시 popup 메뉴를 열도록 함.
   * buildAssignmentRecap 이후 / redrawAssignmentRecap 마다 재생성.
   */
  private rebuildEmpTileHits(): void {
    // 기존 zone 정리
    for (const z of this.empTileHits) z.destroy();
    this.empTileHits = [];

    for (const [slot, view] of this.slotSummaryViews) {
      const empId = this.state.assignment[slot];
      if (!empId) continue;
      const zone = this.add
        .zone(
          view.tileX + view.tileW / 2,
          view.tileY + view.tileH / 2,
          view.tileW,
          view.tileH,
        )
        .setInteractive({ useHandCursor: true })
        .setDepth(10);
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      zone.on('pointerup', () => this.showEmpPopup(empId, view.tileX, view.tileY));
      this.empTileHits.push(zone);
    }
  }

  /** 직원 개인 액션 popup. 타일 우측 하단 기준으로 작은 메뉴 표시. */
  private showEmpPopup(empId: string, tileX: number, tileY: number): void {
    // 이미 떠있는 팝업 닫기 — 같은 직원 재클릭 시 토글
    if (this.empPopupContainer) {
      this.empPopupContainer.destroy(true);
      this.empPopupContainer = null;
      return;
    }

    const emp = this.state.employees.find((e) => e.id === empId);
    if (!emp) return;

    const c = this.add.container(0, 0).setDepth(90);
    // 팝업 위치 — 타일 바로 아래 (tileY+tileH+4) 또는 화면 밖이면 위로
    // 5개 액션(야근/휴가/1on1/격려금/인센티브) + 닫기 = 6행 → 높이 316
    const popW = 300;
    const popH = 316;
    let popX = tileX;
    let popY = tileY + 70 + 4;
    // 화면 하단 넘침 방지
    if (popY + popH > 1230) popY = tileY - popH - 4;
    if (popX + popW > 720 - 10) popX = 720 - 10 - popW;

    c.add(makePanel(this, popX, popY, popW, popH, COLOR.panel));
    c.add(
      this.add.text(popX + 14, popY + 12, `${emp.name}`, {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      }),
    );

    const used = emp.weeklyActionUsed ?? false;

    interface EmpAction {
      label: string;
      summary: string;
      apply: () => void;
    }

    const actions: EmpAction[] = [
      {
        label: '야근 명령',
        summary: 'stamina −10, BugDebt −1',
        apply: () => {
          this.state = {
            ...this.state,
            employees: this.state.employees.map((e) =>
              e.id === empId
                ? { ...e, stamina: Math.max(0, e.stamina - 10), weeklyActionUsed: true }
                : e,
            ),
            project: {
              ...this.state.project,
              bugDebt: Math.max(0, this.state.project.bugDebt - 1),
            },
          };
        },
      },
      {
        label: '1일 휴가',
        summary: 'stamina +20, morale +5',
        apply: () => {
          this.state = {
            ...this.state,
            employees: this.state.employees.map((e) =>
              e.id === empId
                ? {
                    ...e,
                    stamina: Math.min(100, e.stamina + 20),
                    morale: Math.min(100, e.morale + 5),
                    weeklyActionUsed: true,
                  }
                : e,
            ),
          };
        },
      },
      {
        label: '1on1 면담',
        summary: 'morale +15, stamina −3, gold −30',
        apply: () => {
          if (this.state.gold < 30) return;
          this.state = {
            ...this.state,
            gold: this.state.gold - 30,
            employees: this.state.employees.map((e) =>
              e.id === empId
                ? {
                    ...e,
                    morale: Math.min(100, e.morale + 15),
                    stamina: Math.max(0, e.stamina - 3),
                    weeklyActionUsed: true,
                  }
                : e,
            ),
          };
        },
      },
      {
        // 소액 격려금 — morale +20
        label: '🎁 격려금 (−50g)',
        summary: 'morale +20',
        apply: () => {
          if (this.state.gold < 50) return;
          this.state = {
            ...this.state,
            gold: this.state.gold - 50,
            employees: this.state.employees.map((e) =>
              e.id === empId
                ? { ...e, morale: Math.min(100, e.morale + 20), weeklyActionUsed: true }
                : e,
            ),
          };
        },
      },
      {
        // 대액 인센티브 — morale +50 + stamina +20
        label: '💰 인센티브 (−200g)',
        summary: 'morale +50, stamina +20',
        apply: () => {
          if (this.state.gold < 200) return;
          this.state = {
            ...this.state,
            gold: this.state.gold - 200,
            employees: this.state.employees.map((e) =>
              e.id === empId
                ? {
                    ...e,
                    morale: Math.min(100, e.morale + 50),
                    stamina: Math.min(100, e.stamina + 20),
                    weeklyActionUsed: true,
                  }
                : e,
            ),
          };
        },
      },
    ];

    const btnW = popW - 28;
    const btnH = 36;
    const btnGap = 6;
    const btnStartY = popY + 38;

    actions.forEach((action, i) => {
      const y = btnStartY + i * (btnH + btnGap);
      // 골드 부족 체크 — 각 액션의 비용별로 판단
      const goldCost = action.label.includes('−30') || action.label.includes('1on1') ? 30
        : action.label.includes('−50') ? 50
        : action.label.includes('−200') ? 200
        : 0;
      const disabled = used || (goldCost > 0 && this.state.gold < goldCost);
      const bg = this.add.graphics();
      bg.fillStyle(disabled ? COLOR.btnDisabled : COLOR.btnSecondary, 1);
      bg.fillRoundedRect(popX + 14, y, btnW, btnH, 8);
      const labelT = this.add.text(popX + 24, y + 8, action.label, {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        fontStyle: 'bold',
        color: disabled ? TEXT_COLOR.disabled : TEXT_COLOR.primary,
      });
      const sumT = this.add.text(popX + popW - 14, y + 10, action.summary, {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        color: disabled ? TEXT_COLOR.disabled : TEXT_COLOR.dim,
      }).setOrigin(1, 0);
      c.add([bg, labelT, sumT]);
      if (!disabled) {
        const hit = this.add
          .zone(popX + 14 + btnW / 2, y + btnH / 2, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
          action.apply();
          this.empPopupContainer?.destroy(true);
          this.empPopupContainer = null;
          this.redraw();
          playSfx(this, SFX.tap);
        });
        c.add(hit);
      }
    });

    // 닫기
    const closeY = btnStartY + actions.length * (btnH + btnGap);
    const closeBg = this.add.graphics();
    closeBg.fillStyle(0x1a1a22, 1);
    closeBg.fillRoundedRect(popX + 14, closeY, btnW, btnH - 4, 8);
    const closeT = this.add
      .text(popX + 14 + btnW / 2, closeY + (btnH - 4) / 2, '닫기', {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
    const closeHit = this.add
      .zone(popX + 14 + btnW / 2, closeY + (btnH - 4) / 2, btnW, btnH - 4)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerup', () => {
      this.empPopupContainer?.destroy(true);
      this.empPopupContainer = null;
    });
    c.add([closeBg, closeT, closeHit]);

    if (used) {
      // 5개 액션 중앙(2.5번째 행)에 오버레이 텍스트
      c.add(
        this.add
          .text(popX + popW / 2, btnStartY + 2 * (btnH + btnGap), '이번 주 이미 사용함', {
            fontFamily: FONT_STACK,
            fontSize: '21px',
            fontStyle: 'bold',
            color: TEXT_COLOR.bad,
          })
          .setOrigin(0.5)
          .setDepth(5),
      );
    }

    this.empPopupContainer = c;
    applyHiDPI(this);
  }

  // ────────────────────────── onboarding ──────────────────────────

  /**
   * 4단계: 재생 컨트롤 안내 힌트.
   * 1× 버튼 위에 말풍선. 5초 후 자동 제거.
   */
  private showPickSpeedHint(): void {
    this.devHintContainer?.destroy(true);
    // 재생 컨트롤 Y=1170, 버튼 높이=64. 1× 버튼 중심 X 계산.
    const ctrlW = 80;
    const ctrlGap = 8;
    const ctrlTotal = ctrlW * 4 + ctrlGap * 3;
    const ctrlStartX = this.cx - ctrlTotal / 2;
    // 1× 버튼은 index 1 (⏸ 다음).
    const speed1CX = ctrlStartX + (ctrlW + ctrlGap) + ctrlW / 2;
    const speed1CY = 1170 + 32;
    this.devHintContainer = showHint(this, {
      targetX: speed1CX,
      targetY: speed1CY,
      arrowDir: 'down',
      text: '1× / 2× / 4× 버튼으로 자동 진행.\n4×가 가장 빠릅니다.',
    });
    // 5초 후 자동 제거.
    this.time.delayedCall(5000, () => {
      this.dismissPickSpeedHint();
    });
  }

  /** pick-speed 힌트 제거 (이미 제거됐으면 no-op). */
  private dismissPickSpeedHint(): void {
    if (this.pickSpeedHintDone) return;
    this.pickSpeedHintDone = true;
    this.devHintContainer?.destroy(true);
    this.devHintContainer = null;
  }

  /**
   * 5단계: 첫 주 경과 후 직원 타일 클릭 안내 힌트.
   * 첫 번째 슬롯 타일 위에 표시. 8초 후 자동 제거.
   */
  private showClickEmployeeHint(): void {
    this.devHintContainer?.destroy(true);
    // 첫 번째 슬롯 타일 좌표 조회 (SLOT_ORDER[0] = 'planning').
    const firstSlot = SLOT_ORDER[0] as (typeof SLOT_ORDER)[number] | undefined;
    const firstView = firstSlot ? this.slotSummaryViews.get(firstSlot) : undefined;
    const tx = firstView ? firstView.tileX + firstView.tileW / 2 : this.cx;
    const ty = firstView ? firstView.tileY : 470;
    this.devHintContainer = showHint(this, {
      targetX: tx,
      targetY: ty,
      arrowDir: 'down',
      text: '사기·체력은 매주 변화.\n직원 타일 클릭 → 야근/휴가/1on1/보너스 가능',
    });
    // 8초 후 자동 제거.
    this.time.delayedCall(8000, () => {
      if (!this.releaseHintShown) {
        this.devHintContainer?.destroy(true);
        this.devHintContainer = null;
      }
    });
  }

  /**
   * 6단계: 출시 가능 도달 후 출시 버튼 안내 힌트.
   * 지금 출시 버튼 위에 표시. 사용자 클릭(handleRelease)으로 제거.
   */
  private showReleaseHint(): void {
    this.devHintContainer?.destroy(true);
    // 출시 버튼 중심: x = cx + 8 + 360/2 = 360 + 8 + 180 = 548, y = 1162 + 36 = 1198.
    const releaseX = this.cx + 8 + 180;
    const releaseY = 1162 + 36;
    this.devHintContainer = showHint(this, {
      targetX: releaseX,
      targetY: releaseY,
      arrowDir: 'down',
      text: '출시할 시간! [지금 출시] 또는\n[1주 더 다듬기]로 BugDebt 감소 가능.',
    });
  }
}
