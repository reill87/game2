import Phaser from 'phaser';
import type { Types } from 'phaser';

import { GAME_WIDTH } from '@/constants';
import { BALANCE } from '@/domain/balance';
import type { ReleaseOutcome, ReviewStars } from '@/domain/result';
import { SOUND_HIRE_CANDIDATE } from '@/domain/seed';
import type { Employee } from '@/domain/types';
import { ICONS } from '@/icons';
import { loadData, saveData } from '@/save';
import { COLOR, FONT_STACK, TEXT_COLOR, TINT } from '@/theme';
import { applyHiDPI } from '@/util/hidpi';
import { makePanel } from '@/util/ui';

import { SCENE_KEYS } from './keys';

const CX = GAME_WIDTH / 2;

/** 출시 결과 화면. 자동 저장(localStorage)되며 [처음으로]는 Boot로 돌아가 골드를 이월한다. */
export class ResultScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.Result;

  private outcome!: ReleaseOutcome;
  private polishCount = 0;
  private savedAt: number | null = null;
  private saveFooterText: Phaser.GameObjects.Text | null = null;

  // mutable office-state — Result 내에서 업그레이드/채용 가능
  private liveGold = 0;
  private officeLevel: 1 | 2 = 1;
  private hiredEmployees: Employee[] = [];

  // office panel widgets
  private officeStatusText: Phaser.GameObjects.Text | null = null;
  private officeGoldText: Phaser.GameObjects.Text | null = null;
  private officeGoldIcon: Phaser.GameObjects.Image | null = null;
  private upgradeBtnBg: Phaser.GameObjects.Graphics | null = null;
  private upgradeBtnText: Phaser.GameObjects.Text | null = null;
  private upgradeBtnRect: Phaser.Geom.Rectangle | null = null;
  private upgradeBtnHit: Phaser.GameObjects.Zone | null = null;
  private hireBtnBg: Phaser.GameObjects.Graphics | null = null;
  private hireBtnText: Phaser.GameObjects.Text | null = null;
  private hireBtnRect: Phaser.Geom.Rectangle | null = null;
  private hireBtnHit: Phaser.GameObjects.Zone | null = null;

  constructor() {
    super({ key: SCENE_KEYS.Result });
  }

  init(data: { outcome: ReleaseOutcome; polishCount?: number }): void {
    this.outcome = data.outcome;
    this.polishCount = data.polishCount ?? 0;
    this.savedAt = null;
    this.liveGold = data.outcome.state.gold;

    const existing = loadData();
    this.officeLevel = existing?.officeLevel ?? 1;
    this.hiredEmployees = existing?.hiredEmployees ? [...existing.hiredEmployees] : [];
    // 업그레이드/채용 위젯은 매 init마다 다시 만들기 위해 null로 비움.
    this.officeStatusText = null;
    this.officeGoldText = null;
    this.officeGoldIcon = null;
    this.upgradeBtnBg = null;
    this.upgradeBtnText = null;
    this.upgradeBtnRect = null;
    this.upgradeBtnHit = null;
    this.hireBtnBg = null;
    this.hireBtnText = null;
    this.hireBtnRect = null;
    this.hireBtnHit = null;
  }

  create(): void {
    this.persistResult();
    this.buildHeader();
    this.buildHeadline();
    this.buildBreakdown();
    this.buildOfficePanel();
    this.buildResetButton();
    this.buildSaveFooter();
    applyHiDPI(this);
  }

  // ────────────────────────── persistence ──────────────────────────
  private persistResult(): void {
    const o = this.outcome;
    const project = o.state.project;
    const saved = saveData({
      gold: this.liveGold,
      productCount: o.state.productIndex + 1,
      officeLevel: this.officeLevel,
      hiredEmployees: this.hiredEmployees,
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

    makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);

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

    const promo = o.promo;
    const promoLabel =
      promo.tier === 'none'
        ? '없음'
        : `${promo.tier === 'small' ? '소' : '중'} (-${promo.cost}g · ×${promo.revenueMul.toFixed(2)})`;

    const baseRows: ReadonlyArray<readonly [string, string, string]> = [
      ['매출', `+${o.revenue} 골드`, TEXT_COLOR.ok],
      ['BugDebt', `${Math.round(project.bugDebt)} / 100`, project.bugDebt >= 70 ? TEXT_COLOR.bad : TEXT_COLOR.primary],
      ...(project.appealEnabled
        ? ([['Appeal', `${Math.round(project.appeal)} / 100`, TEXT_COLOR.primary]] as const)
        : []),
      ['폴리싱', `${this.polishCount}주`, TEXT_COLOR.primary],
      ['연체', overrun > 0 ? `${overrun}주` : '없음', overrun > 0 ? TEXT_COLOR.warn : TEXT_COLOR.dim],
      ...(promo.tier !== 'none'
        ? ([['홍보', promoLabel, TEXT_COLOR.primary]] as const)
        : []),
    ];
    const parts = [
      `기본 ${b.base}`,
      `−버그 ${b.bugPenalty}`,
      `−연체 ${b.overrunPenalty}`,
      `+폴리싱 ${b.polishBonus}`,
    ];
    if (project.appealEnabled) parts.push(`+매력 ${b.appealBonus}`);
    if (b.promoBonus > 0) parts.push(`+홍보 ${b.promoBonus}`);
    const rows: ReadonlyArray<readonly [string, string, string]> = [
      ...baseRows,
      ['점수 분해', parts.join('  '), TEXT_COLOR.dim],
    ];

    const panelX = (GAME_WIDTH - 660) / 2;
    const panelY = 380;
    const panelW = 660;
    const rowH = 46;
    const panelH = rows.length * rowH + 28;

    makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);

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

  // ────────────────────────── office panel ──────────────────────────
  private buildOfficePanel(): void {
    const panelX = (GAME_WIDTH - 660) / 2;
    const panelY = 760;
    const panelW = 660;
    const panelH = 170;

    makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);

    this.add.text(panelX + 20, panelY + 14, '사무실', {
      fontFamily: FONT_STACK,
      fontSize: '13px',
      fontStyle: 'bold',
      color: TEXT_COLOR.dim,
    });

    this.officeStatusText = this.add.text(panelX + 20, panelY + 48, '', {
      fontFamily: FONT_STACK,
      fontSize: '15px',
      color: TEXT_COLOR.primary,
    });

    const goldRowY = panelY + 48;
    this.officeGoldText = this.add
      .text(panelX + panelW - 20, goldRowY, '', {
        fontFamily: FONT_STACK,
        fontSize: '15px',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(1, 0);
    this.officeGoldIcon = this.add
      .image(0, goldRowY + 9, ICONS.coins.key)
      .setDisplaySize(16, 16)
      .setOrigin(1, 0.5)
      .setTint(TINT.warn);

    // 두 액션 버튼: 좌(업그레이드), 우(채용). 절반 너비씩.
    const btnY = panelY + 90;
    const btnH = 60;
    const halfW = (panelW - 60) / 2; // 20 padding 양쪽 + 20 사이 여백

    const upgradeX = panelX + 20;
    this.upgradeBtnRect = new Phaser.Geom.Rectangle(upgradeX, btnY, halfW, btnH);
    this.upgradeBtnBg = this.add.graphics();
    this.upgradeBtnText = this.add
      .text(upgradeX + halfW / 2, btnY + btnH / 2, `사무실 업그레이드 (-${BALANCE.officeUpgradeCost}g)`, {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    this.upgradeBtnHit = this.add
      .zone(upgradeX + halfW / 2, btnY + btnH / 2, halfW, btnH)
      .setInteractive({ useHandCursor: true });
    this.upgradeBtnHit.on('pointerup', () => this.handleUpgrade());

    const hireX = upgradeX + halfW + 20;
    this.hireBtnRect = new Phaser.Geom.Rectangle(hireX, btnY, halfW, btnH);
    this.hireBtnBg = this.add.graphics();
    this.hireBtnText = this.add
      .text(hireX + halfW / 2, btnY + btnH / 2, '사운드 채용', {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    this.hireBtnHit = this.add
      .zone(hireX + halfW / 2, btnY + btnH / 2, halfW, btnH)
      .setInteractive({ useHandCursor: true });
    this.hireBtnHit.on('pointerup', () => this.handleHire());

    this.refreshOfficePanel();
  }

  private refreshOfficePanel(): void {
    if (!this.officeStatusText || !this.officeGoldText) return;
    const cap = BALANCE.officeHireCap[this.officeLevel];
    const totalEmps = 3 + this.hiredEmployees.length;
    this.officeStatusText.setText(`${this.officeLevel}단계 — 고용 ${totalEmps}/${cap}명`);
    this.officeGoldText.setText(`${this.liveGold}g`);
    // 코인 아이콘은 골드 텍스트 좌측, 텍스트 폭이 변하므로 동적으로 위치 보정.
    if (this.officeGoldIcon) {
      const textLeft = this.officeGoldText.x - this.officeGoldText.width;
      this.officeGoldIcon.setX(textLeft - 6);
    }

    const canUpgrade = this.officeLevel === 1 && this.liveGold >= BALANCE.officeUpgradeCost;
    const canHire = this.officeLevel === 2 && totalEmps < BALANCE.officeHireCap[2];

    this.drawSecondaryButton(this.upgradeBtnBg, this.upgradeBtnText, this.upgradeBtnRect, this.upgradeBtnHit, canUpgrade);
    this.drawSecondaryButton(this.hireBtnBg, this.hireBtnText, this.hireBtnRect, this.hireBtnHit, canHire);

    if (this.officeLevel === 2 && this.upgradeBtnText) {
      this.upgradeBtnText.setText('사무실 2단계 (완료)');
    }
    if (canHire === false && this.officeLevel === 2 && totalEmps >= BALANCE.officeHireCap[2] && this.hireBtnText) {
      this.hireBtnText.setText('사운드 채용 (완료)');
    }
  }

  private drawSecondaryButton(
    bg: Phaser.GameObjects.Graphics | null,
    text: Phaser.GameObjects.Text | null,
    rect: Phaser.Geom.Rectangle | null,
    hit: Phaser.GameObjects.Zone | null,
    enabled: boolean,
  ): void {
    if (!bg || !text || !rect || !hit) return;
    bg.clear();
    bg.fillStyle(enabled ? COLOR.btn : COLOR.btnDisabled, 1);
    bg.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
    text.setColor(enabled ? TEXT_COLOR.primary : TEXT_COLOR.disabled);
    if (hit.input) hit.input.enabled = enabled;
  }

  private handleUpgrade(): void {
    if (this.officeLevel !== 1) return;
    if (this.liveGold < BALANCE.officeUpgradeCost) return;
    this.liveGold -= BALANCE.officeUpgradeCost;
    this.officeLevel = 2;
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }

  private handleHire(): void {
    if (this.officeLevel !== 2) return;
    const cap = BALANCE.officeHireCap[2];
    if (3 + this.hiredEmployees.length >= cap) return;
    this.hiredEmployees = [...this.hiredEmployees, SOUND_HIRE_CANDIDATE];
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }

  // ────────────────────────── reset button ──────────────────────────
  private buildResetButton(): void {
    const w = 360;
    const h = 72;
    const x = CX - w / 2;
    const y = 960;
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
    this.saveFooterText = this.add
      .text(CX, 1100, '', {
        fontFamily: FONT_STACK,
        fontSize: '12px',
      })
      .setOrigin(0.5);
    this.refreshSaveFooter();
  }

  private refreshSaveFooter(): void {
    if (!this.saveFooterText) return;
    const text = this.savedAt
      ? `저장됨 — ${this.formatTime(this.savedAt)}`
      : '저장 실패 (localStorage 비활성)';
    this.saveFooterText.setText(text).setColor(this.savedAt ? TEXT_COLOR.dim : TEXT_COLOR.bad);
  }

  private formatTime(ts: number): string {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
}
