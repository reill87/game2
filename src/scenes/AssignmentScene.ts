import Phaser from 'phaser';
import type { Types } from 'phaser';

import { isMatched, SLOT_ORDER } from '@/domain/match';
import {
  GENRE_LABEL,
  isSupportSlotActive,
  JOB_ICON,
  JOB_LABEL,
  newTutorialGame,
  RANK_SHORT,
  SLOT_ICON,
  SLOT_LABEL,
  THEME_LABEL,
  TRAIT_LABEL,
} from '@/domain/seed';
import type { Rank } from '@/domain/types';
import { isTutorialAssignmentReady, place, placeSupport } from '@/domain/tick';
import type { Employee, GameState, SlotKind } from '@/domain/types';
import { AVATAR_KEY } from '@/avatars';
import { BGM } from '@/bgm';
import { ICONS } from '@/icons';
import type { SavedResult } from '@/save';
import { playSfx, SFX } from '@/sounds';
import { addMuteToggle } from '@/util/muteToggle';
import { COLOR, FONT_STACK, TEXT_COLOR, TINT } from '@/theme';
import { drawConditionFill } from '@/util/condition';
import { applyHiDPI } from '@/util/hidpi';
import { addIconLabel } from '@/util/iconLabel';
import { fitCamera } from '@/util/cameraFit';
import { onResize } from '@/util/viewport';
import { showHint } from '@/util/onboarding';
import type { OnboardingHint } from '@/util/onboarding';

import { SCENE_KEYS } from './keys';

interface EmployeeLayout {
  cols: number;
  cardW: number;
  cardH: number;
  gap: number;
  rowGap: number;
}

/**
 * 직원 카드 레이아웃 선택 — 1~6명 모두 GAME_WIDTH(720)에 맞춤.
 *  - 1~3명: 1행 (큰 카드)
 *  - 4명  : 1행 4열 (좁은 카드)
 *  - 5~6명: 2행 3열
 */
function pickEmployeeLayout(count: number): EmployeeLayout {
  if (count <= 3) return { cols: Math.max(1, count), cardW: 200, cardH: 240, gap: 14, rowGap: 14 };
  if (count === 4) return { cols: 4, cardW: 160, cardH: 240, gap: 12, rowGap: 14 };
  // 5~6명 → 3열 wrap
  return { cols: 3, cardW: 200, cardH: 200, gap: 14, rowGap: 14 };
}

/** 직급별 배지 배경색 — newbie 회색 / junior 파랑 / senior 초록 / lead 노랑. */
function rankBadgeColor(rank: Rank): number {
  switch (rank) {
    case 'newbie':
      return COLOR.btnSecondary;
    case 'junior':
      return COLOR.btn;
    case 'senior':
      return COLOR.matchOk;
    case 'lead':
      return TINT.warn;
  }
}

interface SlotView {
  bg: Phaser.GameObjects.Graphics;
  slotLabel: Phaser.GameObjects.Text;
  empNameText: Phaser.GameObjects.Text;
  matchHint: Phaser.GameObjects.Text;
  rect: Phaser.Geom.Rectangle;
  hit: Phaser.GameObjects.Zone;
  /** support 영역 — 사옥 단계별 활성/비활성. */
  supportBg: Phaser.GameObjects.Graphics;
  supportText: Phaser.GameObjects.Text;
  supportHit: Phaser.GameObjects.Zone;
  supportRect: Phaser.Geom.Rectangle;
}

interface EmployeeView {
  bg: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  jobText: Phaser.GameObjects.Text;
  placedText: Phaser.GameObjects.Text;
  /** 사기 게이지 채움 (배경은 정적, 채움만 redraw). */
  moraleFill: Phaser.GameObjects.Graphics;
  /** 체력 게이지 채움. */
  staminaFill: Phaser.GameObjects.Graphics;
  /** 게이지 위치·크기 (redraw 시 사용). */
  barX: number;
  barW: number;
  moraleBarY: number;
  staminaBarY: number;
  barH: number;
  rect: Phaser.Geom.Rectangle;
  hit: Phaser.GameObjects.Zone;
}

/** 슬롯 4×직원 3 배치 화면. v1 튜토리얼 — QA 슬롯은 비어 있어도 진행 가능. */
export class AssignmentScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.Assignment;

  private state: GameState = newTutorialGame();
  private selectedEmpId: string | null = null;
  private lastResult: SavedResult | null = null;
  /** 온보딩 모드 여부 (productCount=0). */
  private isOnboarding = false;
  /** 현재 표시 중인 힌트 컨테이너. */
  private hintContainer: Phaser.GameObjects.Container | null = null;

  private slotViews = new Map<SlotKind, SlotView>();
  private empViews = new Map<string, EmployeeView>();
  private startBtnBg!: Phaser.GameObjects.Graphics;
  private startBtnText!: Phaser.GameObjects.Text;
  private startBtnRect!: Phaser.Geom.Rectangle;
  private statusText!: Phaser.GameObjects.Text;
  /** 매 create() 시작 시 갱신. build* 메서드가 참조. */
  private cx = 360;
  private contentX = 0;

  constructor() {
    super({ key: SCENE_KEYS.Assignment });
  }

  /** Boot 또는 Result에서 GameState/지난 결과를 인계 받아 다시 시작할 수 있게 한다. */
  init(data?: { state?: GameState; lastResult?: SavedResult; isOnboarding?: boolean }): void {
    if (data?.state) this.state = data.state;
    else this.state = newTutorialGame();
    this.lastResult = data?.lastResult ?? null;
    this.selectedEmpId = null;
    // isOnboarding 명시 전달 없으면 productIndex로 판정.
    this.isOnboarding = data?.isOnboarding ?? (this.state.productIndex === 0);
    this.hintContainer = null;
  }

  create(): void {
    fitCamera(this);
    // logical 720×1280 좌표 사용 — viewport 무관하게 cx=360, contentX=0.
    this.cx = 360;
    this.contentX = 0;
    BGM.resume();
    BGM.setMood('calm');
    this.buildHeader();
    this.buildSlots();
    this.buildEmployees();
    this.buildStartButton();
    this.buildStatus();
    addMuteToggle(this);
    this.redraw();
    // 온보딩 힌트 — 첫 프로젝트에서만 표시.
    if (this.isOnboarding) this.updateOnboardingHint();
    applyHiDPI(this);
    onResize(this, () => { this.scene.restart(); });
  }

  // ────────────────────────── header ──────────────────────────
  private buildHeader(): void {
    const titleStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '36px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    };
    const subStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '24px',
      color: TEXT_COLOR.dim,
      align: 'center',
      wordWrap: { width: 640, useAdvancedWrap: true },
    };

    const idx = this.state.productIndex;
    const order = idx === 0 ? '첫 프로젝트' : `${idx + 1}번째 프로젝트`;
    const genre = GENRE_LABEL[this.state.project.genre].name;
    const theme = THEME_LABEL[this.state.project.theme].name;
    this.add.text(this.cx, 56, `${order} — ${genre} × ${theme}`, titleStyle).setOrigin(0.5);
    this.add
      .text(
        this.cx,
        96,
        '직원을 담당에 배치하세요. 정배치 시 효율 100%, 오배치 시 50% + BugDebt +2/주.',
        subStyle,
      )
      .setOrigin(0.5);
    this.buildCarryoverHint();
  }

  private buildCarryoverHint(): void {
    if (!this.lastResult && this.state.gold === 0) return;
    const parts: string[] = [];
    if (this.state.gold > 0) parts.push(`이월 ${this.state.gold}g`);
    if (this.lastResult) {
      const stars = '★'.repeat(this.lastResult.stars) + '☆'.repeat(5 - this.lastResult.stars);
      parts.push(`지난 프로젝트 ${stars} (${this.lastResult.reviewScore}점)`);
    }
    const text = this.add
      .text(this.cx, 126, parts.join('  ·  '), {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.warn,
      })
      .setOrigin(0.5);
    if (this.state.gold > 0) {
      this.add
        .image(text.x - text.width / 2 - 8, 126, ICONS.coins.key)
        .setDisplaySize(12, 12)
        .setOrigin(1, 0.5)
        .setTint(TINT.warn);
    }
  }

  // ────────────────────────── slots ──────────────────────────
  private buildSlots(): void {
    const tileW = 290;
    const tileH = 180;
    const gapX = 20;
    const gapY = 14;
    const startX = this.contentX + (720 - (tileW * 2 + gapX)) / 2;
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
    // primary 영역: 상단 ~138px, support 영역: 하단 ~38px
    const primaryH = h - 42;
    const supportH = 38;
    const supportY = y + h - supportH;

    const rect = new Phaser.Geom.Rectangle(x, y, w, h);
    const bg = this.add.graphics();

    const { label: slotLabel } = addIconLabel(
      this,
      x + w / 2,
      y + 28,
      ICONS[SLOT_ICON[slot]].key,
      SLOT_LABEL[slot],
      {
        iconSize: 16,
        iconTint: TINT.dim,
        textColor: TEXT_COLOR.dim,
        fontSize: 16,
        bold: true,
        gap: 6,
      },
    );

    const empNameText = this.add
      .text(x + w / 2, y + primaryH / 2 + 6, '비어 있음', {
        fontFamily: FONT_STACK,
        fontSize: '30px',
        color: TEXT_COLOR.disabled,
      })
      .setOrigin(0.5);

    const matchHint = this.add
      .text(x + w / 2, y + primaryH - 20, '', {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        color: TEXT_COLOR.ok,
      })
      .setOrigin(0.5);

    // primary 영역 hit — 타일 상단 primaryH 높이.
    const hit = this.add
      .zone(x + w / 2, y + primaryH / 2, w, primaryH)
      .setRectangleDropZone(w, primaryH)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.onSlotTap(slot, 'primary'));

    // support 영역 — 하단 고정 38px 띠.
    const supportRect = new Phaser.Geom.Rectangle(x, supportY, w, supportH);
    const supportBg = this.add.graphics();
    const supportText = this.add
      .text(x + w / 2, supportY + supportH / 2, '', {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        color: TEXT_COLOR.disabled,
      })
      .setOrigin(0.5);
    const supportHit = this.add
      .zone(x + w / 2, supportY + supportH / 2, w, supportH)
      .setInteractive({ useHandCursor: true });
    supportHit.on('pointerup', () => this.onSlotTap(slot, 'support'));

    return { bg, slotLabel, empNameText, matchHint, rect, hit, supportBg, supportText, supportHit, supportRect };
  }

  // ────────────────────────── employee cards ──────────────────────────
  /** 직원 수에 따라 1행/2행 wrap. 가로 오버플로 방지 + 빈 공간 활용. */
  private buildEmployees(): void {
    const count = this.state.employees.length;
    const layout = pickEmployeeLayout(count);
    const { cols, cardW, cardH, gap, rowGap } = layout;
    const totalW = cardW * cols + gap * (cols - 1);
    const startX = this.contentX + (720 - totalW) / 2;
    const startY = 540;

    this.add
      .text(this.cx, startY - 26, `직원 (${count}명)`, {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    this.state.employees.forEach((emp, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + rowGap);
      this.empViews.set(emp.id, this.makeEmployeeView(emp, x, y, cardW, cardH));
    });

  }

  private makeEmployeeView(emp: Employee, x: number, y: number, w: number, h: number): EmployeeView {
    const rect = new Phaser.Geom.Rectangle(x, y, w, h);
    const bg = this.add.graphics();

    // 직급 배지 — 좌상단 작은 컬러 사각형 + 1글자 약어 (N/J/S/L)
    const badgeW = 22;
    const badgeH = 18;
    const badgeX = x + 8;
    const badgeY = y + 8;
    const badge = this.add.graphics();
    badge.fillStyle(rankBadgeColor(emp.rank), 1);
    badge.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 4);
    this.add
      .text(badgeX + badgeW / 2, badgeY + badgeH / 2, RANK_SHORT[emp.rank], {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);

    const nameText = this.add
      .text(x + w / 2, y + 30, emp.name, {
        fontFamily: FONT_STACK,
        fontSize: '26px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
        align: 'center',
        wordWrap: { width: w - 16, useAdvancedWrap: true },
      })
      .setOrigin(0.5, 0);

    // 직원 아바타 — 이름 아래 중앙. morale 기반 ring tint으로 표정 대용.
    const avatarSize = 60;
    const avatar = this.add
      .image(x + w / 2, y + 56 + avatarSize / 2, AVATAR_KEY[emp.job])
      .setDisplaySize(avatarSize, avatarSize)
      .setOrigin(0.5);
    void avatar;
    const ringColor =
      emp.morale >= 70
        ? TINT.ok
        : emp.morale >= 40
          ? TINT.warn
          : TINT.bad;
    const ring = this.add.graphics();
    ring.lineStyle(2, ringColor, 0.85);
    ring.strokeCircle(x + w / 2, y + 56 + avatarSize / 2, avatarSize / 2 + 2);
    void ring;

    // 스킬 배지 — 1.0 초과분만 우상단에 작게 (예: skill 1.10 → "+10%")
    const skillPct = Math.round((emp.skill - 1) * 100);
    if (skillPct > 0) {
      this.add
        .text(x + w - 12, y + 12, `+${skillPct}%`, {
          fontFamily: FONT_STACK,
          fontSize: '20px',
          fontStyle: 'bold',
          color: TEXT_COLOR.warn,
        })
        .setOrigin(1, 0);
    }

    const { label: jobText } = addIconLabel(
      this,
      x + w / 2,
      y + 130,
      ICONS[JOB_ICON[emp.job]].key,
      JOB_LABEL[emp.job],
      {
        iconSize: 14,
        iconTint: TINT.dim,
        textColor: TEXT_COLOR.dim,
        fontSize: 13,
        gap: 4,
      },
    );

    // 트레이트 라벨 — 직무 라인 바로 아래 작게 (트레이트 있는 직원만)
    if (emp.trait) {
      this.add
        .text(x + w / 2, y + 148, TRAIT_LABEL[emp.trait], {
          fontFamily: FONT_STACK,
          fontSize: '18px',
          color: TEXT_COLOR.warn,
        })
        .setOrigin(0.5);
    }

    // 컨디션 미니바 — 가로 50, 두께 3, 카드 하단 가운데 두 줄.
    const barW = 56;
    const barH = 3;
    const barX = x + w / 2 - barW / 2;
    const moraleBarY = y + h - 38;
    const staminaBarY = y + h - 30;
    const moraleBg = this.add.graphics();
    moraleBg.fillStyle(COLOR.gaugeBg, 1);
    moraleBg.fillRect(barX, moraleBarY, barW, barH);
    const moraleFill = this.add.graphics();
    const staminaBg = this.add.graphics();
    staminaBg.fillStyle(COLOR.gaugeBg, 1);
    staminaBg.fillRect(barX, staminaBarY, barW, barH);
    const staminaFill = this.add.graphics();

    const placedText = this.add
      .text(x + w / 2, y + h - 16, '', {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.ok,
      })
      .setOrigin(0.5);

    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.onEmployeeTap(emp.id));

    return {
      bg,
      nameText,
      jobText,
      placedText,
      moraleFill,
      staminaFill,
      barX,
      barW,
      moraleBarY,
      staminaBarY,
      barH,
      rect,
      hit,
    };
  }

  // ────────────────────────── start button ──────────────────────────
  private buildStartButton(): void {
    const w = 360;
    const h = 72;
    const x = this.cx - w / 2;
    // 720×1280 logical 좌표 — fitCamera가 viewport에 맞춰 줌 인.
    const y = 1180;
    this.startBtnRect = new Phaser.Geom.Rectangle(x, y, w, h);
    this.startBtnBg = this.add.graphics();
    this.startBtnText = this.add
      .text(this.cx, y + h / 2, '개발 시작', {
        fontFamily: FONT_STACK,
        fontSize: '30px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);

    const hit = this.add
      .zone(this.cx, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.onStartButtonDown());
    hit.on('pointerup', () => this.onStartButtonUp());
    hit.on('pointerout', () => this.drawStartButton(false));
  }

  private buildStatus(): void {
    // startBtn 위 ~30px — 720×1280 logical.
    const y = 1148;
    this.statusText = this.add
      .text(this.cx, y, '', {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        color: TEXT_COLOR.dim,
        align: 'center',
        wordWrap: { width: 640, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  // ────────────────────────── interactions ──────────────────────────
  private onEmployeeTap(empId: string): void {
    playSfx(this, SFX.tap);
    this.selectedEmpId = this.selectedEmpId === empId ? null : empId;
    this.redraw();
  }

  private onSlotTap(slot: SlotKind, area: 'primary' | 'support'): void {
    const officeLevel = this.state.officeLevel;
    const supportActive = isSupportSlotActive(officeLevel, slot);

    if (area === 'support' && !supportActive) return; // 비활성 support 영역 무시.

    if (this.selectedEmpId) {
      playSfx(this, SFX.toggle);
      if (area === 'primary') {
        this.state = place(this.state, slot, this.selectedEmpId);
      } else {
        this.state = placeSupport(this.state, slot, this.selectedEmpId);
      }
      this.selectedEmpId = null;
    } else {
      // 선택 없이 탭 — 해당 영역 비우기.
      const occupant = area === 'primary' ? this.state.assignment[slot] : this.state.support?.[slot];
      if (occupant) {
        playSfx(this, SFX.tap);
        if (area === 'primary') {
          this.state = place(this.state, slot, null);
        } else {
          this.state = placeSupport(this.state, slot, null);
        }
      }
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
    playSfx(this, SFX.click, 0.55);
    this.scene.start(SCENE_KEYS.Development, { state: this.state });
  }

  // ────────────────────────── render ──────────────────────────
  private redraw(): void {
    this.drawSlots();
    this.drawEmployees();
    this.drawStartButton(false);
    this.updateStatus();
    // 온보딩 힌트 갱신 — 배치 상태 변화 반영.
    if (this.isOnboarding) this.updateOnboardingHint();
  }

  private drawSlots(): void {
    const empById = new Map(this.state.employees.map((e) => [e.id, e] as const));
    const officeLevel = this.state.officeLevel;

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
          .setText(matched ? '정배치' : '오배치 — 효율 50%')
          .setColor(matched ? TEXT_COLOR.ok : TEXT_COLOR.bad)
          .setVisible(true);
      } else {
        view.empNameText.setText('비어 있음').setColor(TEXT_COLOR.disabled);
        view.matchHint.setVisible(false);
      }

      // support 영역 그리기.
      const supportActive = isSupportSlotActive(officeLevel, slot);
      const sr = view.supportRect;
      view.supportBg.clear();

      if (!supportActive) {
        // 비활성 — 잠금 표시 (어두운 띠).
        view.supportBg.fillStyle(0x1a1a2e, 0.6);
        view.supportBg.fillRoundedRect(sr.x + 2, sr.y + 2, sr.width - 4, sr.height - 4, { tl: 0, tr: 0, bl: 12, br: 12 });
        view.supportText.setText('지원 잠김').setColor(TEXT_COLOR.disabled).setVisible(true);
      } else {
        // 활성 — support 직원 표시.
        const suppId = this.state.support?.[slot];
        const suppEmp = suppId ? empById.get(suppId) : undefined;
        const suppMatched = suppEmp ? isMatched(slot, suppEmp.job) : null;
        const suppFill = suppEmp ? 0x1e3040 : 0x1a2535;
        const suppStroke = this.selectedEmpId && !suppEmp
          ? COLOR.selected
          : suppMatched === true ? COLOR.matchOk : suppMatched === false ? COLOR.matchBad : 0x3a4a5a;
        view.supportBg.fillStyle(suppFill, 1);
        view.supportBg.lineStyle(1, suppStroke, 0.85);
        view.supportBg.fillRoundedRect(sr.x + 2, sr.y + 2, sr.width - 4, sr.height - 4, { tl: 0, tr: 0, bl: 12, br: 12 });
        view.supportBg.strokeRoundedRect(sr.x + 2, sr.y + 2, sr.width - 4, sr.height - 4, { tl: 0, tr: 0, bl: 12, br: 12 });
        const suppLabel = suppEmp
          ? `지원: ${suppEmp.name}${suppMatched ? ' ✓' : ' △'}`
          : '+ 지원 인력';
        view.supportText
          .setText(suppLabel)
          .setColor(suppEmp ? (suppMatched ? TEXT_COLOR.ok : TEXT_COLOR.warn) : TEXT_COLOR.dim)
          .setVisible(true);
      }
    }
  }

  private drawEmployees(): void {
    // primary 배치 추적.
    const placedSlotByEmp = new Map<string, SlotKind>();
    for (const slot of SLOT_ORDER) {
      const id = this.state.assignment[slot];
      if (id) placedSlotByEmp.set(id, slot);
    }
    // support 배치 추적.
    const supportSlotByEmp = new Map<string, SlotKind>();
    for (const slot of SLOT_ORDER) {
      const id = this.state.support?.[slot];
      if (id) supportSlotByEmp.set(id, slot);
    }

    for (const emp of this.state.employees) {
      const view = this.empViews.get(emp.id);
      if (!view) continue;
      const placedSlot = placedSlotByEmp.get(emp.id);
      const supportSlot = supportSlotByEmp.get(emp.id);
      const isPlaced = !!(placedSlot ?? supportSlot);
      const selected = this.selectedEmpId === emp.id;

      view.bg.clear();
      view.bg.fillStyle(isPlaced ? COLOR.panelEmpty : COLOR.panel, 1);
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
      } else if (supportSlot) {
        view.placedText
          .setText(`지원 · ${SLOT_LABEL[supportSlot]}`)
          .setColor(TEXT_COLOR.warn)
          .setVisible(true);
        view.nameText.setColor(TEXT_COLOR.dim);
        view.jobText.setColor(TEXT_COLOR.dim);
      } else {
        view.placedText.setVisible(false);
        view.nameText.setColor(TEXT_COLOR.primary);
        view.jobText.setColor(TEXT_COLOR.dim);
      }

      drawConditionFill(view.moraleFill, view.barX, view.moraleBarY, view.barW, view.barH, emp.morale);
      drawConditionFill(view.staminaFill, view.barX, view.staminaBarY, view.barW, view.barH, emp.stamina);
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
      const empCount = this.state.employees.length;
      const msg =
        empCount === 0
          ? '직원이 없습니다. Result 화면에서 채용해 주세요.'
          : `직원 ${empCount}명 — 최소 ${Math.min(empCount, 3)}슬롯에 배치해야 시작할 수 있습니다.`;
      this.statusText.setText(msg).setColor(TEXT_COLOR.dim);
      return;
    }
    // 미배치 직원 수 — primary + support 모두 비어 있는 직원.
    const placedIds = new Set<string>();
    for (const slot of SLOT_ORDER) {
      const p = this.state.assignment[slot];
      if (p) placedIds.add(p);
      const s = this.state.support?.[slot];
      if (s) placedIds.add(s);
    }
    const idleCount = this.state.employees.filter((e) => !placedIds.has(e.id)).length;

    const mismatches = this.countMismatches();
    if (mismatches > 0) {
      this.statusText
        .setText(`오배치 ${mismatches}건. 시작은 가능하지만 일정·버그 페널티가 누적됩니다.`)
        .setColor(TEXT_COLOR.bad);
    } else if (idleCount > 0) {
      // 정배치 OK + 미배치 직원 있음 → 지원 인력 안내.
      this.statusText
        .setText(
          `미배치 직원 ${idleCount}명 — 직원 카드 → "+ 지원 인력" 영역 클릭으로 배치 가능 (효율 ↑)`,
        )
        .setColor(TEXT_COLOR.warn);
    } else {
      this.statusText
        .setText('정배치 완료. 개발을 시작할 수 있습니다.')
        .setColor(TEXT_COLOR.ok);
    }
  }

  private countMismatches(): number {
    const empById = new Map(this.state.employees.map((e) => [e.id, e] as const));
    let count = 0;
    for (const slot of SLOT_ORDER) {
      const id = this.state.assignment[slot];
      if (id) {
        const emp = empById.get(id);
        if (emp && !isMatched(slot, emp.job)) count += 1;
      }
      const suppId = this.state.support?.[slot];
      if (suppId) {
        const emp = empById.get(suppId);
        if (emp && !isMatched(slot, emp.job)) count += 1;
      }
    }
    return count;
  }

  // ────────────────────────── onboarding ──────────────────────────

  /** primary 슬롯에 배치된 직원 수. */
  private placedPrimaryCount(): number {
    let n = 0;
    for (const slot of SLOT_ORDER) {
      if (this.state.assignment[slot]) n += 1;
    }
    return n;
  }

  /**
   * 현재 배치 상태에 맞는 힌트를 다시 계산해 표시한다.
   * 이전 힌트는 파괴 후 재생성.
   * 온보딩 모드(isOnboarding=true)에서만 호출된다.
   */
  private updateOnboardingHint(): void {
    // 이전 힌트 제거.
    this.hintContainer?.destroy(true);
    this.hintContainer = null;

    if (!this.isOnboarding) return;

    const placed = this.placedPrimaryCount();
    const required = Math.min(this.state.employees.length, 3);
    const allReady = isTutorialAssignmentReady(this.state);

    let hint: OnboardingHint;

    if (allReady) {
      // 3단계: 모두 배치 완료 → 시작 버튼 안내.
      // 시작 버튼 중앙: (360, 1180 + 72/2) = (360, 1216)
      hint = {
        targetX: 360,
        targetY: 1216,
        arrowDir: 'down',
        text: '[개발 시작]을 눌러 진행하세요!',
      };
    } else if (placed === 0) {
      // 1단계: 아무도 배치 안 됨 → 첫 직원 카드 가리킴.
      // 직원 카드 첫 번째 중심(3명 기준): startX=46, cardW=200 → center x=146, y=540+120=660
      const count = this.state.employees.length;
      const layout = count <= 3
        ? { cols: Math.max(1, count), cardW: 200, gap: 14 }
        : count === 4
          ? { cols: 4, cardW: 160, gap: 12 }
          : { cols: 3, cardW: 200, gap: 14 };
      const totalW = layout.cardW * layout.cols + layout.gap * (layout.cols - 1);
      const startX = (720 - totalW) / 2;
      const cardCX = startX + layout.cardW / 2;
      const cardCY = 540 + (count <= 3 ? 120 : 100);
      hint = {
        targetX: cardCX,
        targetY: cardCY - 60,
        arrowDir: 'down',
        text: '직원을 슬롯에 배치하세요!\n카드 클릭 → 슬롯 클릭',
      };
    } else if (placed < required) {
      // 2단계: 일부 배치 → 미배치 직원 안내.
      // 두 번째 미배치 직원 카드를 가리킴 (첫 번째는 이미 배치됨 가정).
      const count = this.state.employees.length;
      const layout = count <= 3
        ? { cols: Math.max(1, count), cardW: 200, cardH: 240, gap: 14 }
        : count === 4
          ? { cols: 4, cardW: 160, cardH: 240, gap: 12 }
          : { cols: 3, cardW: 200, cardH: 200, gap: 14 };
      const totalW = layout.cardW * layout.cols + layout.gap * (layout.cols - 1);
      const startX = (720 - totalW) / 2;
      // 미배치 직원 중 첫 번째 인덱스 찾기.
      const placedIds = new Set<string>(
        SLOT_ORDER.map((s) => this.state.assignment[s]).filter((id): id is string => !!id),
      );
      const unplacedIdx = this.state.employees.findIndex((e) => !placedIds.has(e.id));
      const idx = unplacedIdx >= 0 ? unplacedIdx : 1;
      const col = idx % layout.cols;
      const row = Math.floor(idx / layout.cols);
      const cardCX = startX + col * (layout.cardW + layout.gap) + layout.cardW / 2;
      const cardCY = 540 + row * (layout.cardH + 14) + layout.cardH / 2;
      hint = {
        targetX: cardCX,
        targetY: cardCY - layout.cardH / 2 + 20,
        arrowDir: 'down',
        text: '남은 직원도 배치하세요.\n정배치 효율 100%, 오배치 50%.',
      };
    } else {
      // 배치는 됐지만 isTutorialAssignmentReady가 false인 경우 — 힌트 없음.
      return;
    }

    this.hintContainer = showHint(this, hint);
  }
}
