/**
 * 엔딩 씬 — 누적 매출 임계 도달 시 ResultScene에서 분기.
 *
 * ending 종류:
 *  - 'acquisition' (기본): 인수합병 제안 — 누적 30,000g 돌파.
 *  - 'ipo'               : IPO 상장   — 인수합병 거절 후 누적 50,000g 돌파.
 *
 * 출구:
 *  - [통계 보기]    → StatsScene (returnTo=Boot)
 *  - acquisition: [계속 운영하기] → Boot (2회차 진행)
 *  - ipo        : [처음부터 다시]  → Boot (clearData 후 재시작)
 */
import Phaser from 'phaser';

import { BGM } from '@/bgm';
import { ENDING } from '@/domain/balance';
import { clearData, incrementPrestige, loadData, loadPrestigeCount, DEFAULT_COMPANY_NAME } from '@/save';
import { playSfx, SFX } from '@/sounds';
import { COLOR, FONT_STACK, TEXT_COLOR } from '@/theme';
import { applyHiDPI } from '@/util/hidpi';
import { addMuteToggle } from '@/util/muteToggle';
import { makePanel } from '@/util/ui';
import { fitCamera } from '@/util/cameraFit';
import { onResize } from '@/util/viewport';

import { SCENE_KEYS } from './keys';

export class EndingScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.Ending;

  private endingType: 'acquisition' | 'ipo' | 'global-no1' | 'unicorn' = 'acquisition';
  /** logical 720×1280 고정 좌표. */
  private cx = 360;
  private contentX = 0;

  constructor() {
    super({ key: SCENE_KEYS.Ending });
  }

  init(data: { ending?: 'acquisition' | 'ipo' | 'global-no1' | 'unicorn' }): void {
    this.endingType = data?.ending ?? 'acquisition';
  }

  create(): void {
    fitCamera(this);
    // logical 720×1280 좌표 고정 — viewport 크기 무관.
    this.cx = 360;
    this.contentX = 0;
    BGM.resume();
    BGM.setMood('celebrate');
    addMuteToggle(this);

    const saved = loadData();
    const totalRevenue = (saved?.history ?? []).reduce((s, r) => s + r.revenue, 0);
    const productCount = saved?.history?.length ?? saved?.productCount ?? 0;
    const companyName = saved?.companyName ?? DEFAULT_COMPANY_NAME;

    // 어두운 배경 — logical 720×1280 풀 사이즈.
    const bg = this.add.graphics();
    bg.fillStyle(0x0e0e12, 1);
    bg.fillRect(0, 0, 720, 1280);

    if (this.endingType === 'unicorn') {
      this.buildUnicornEnding(totalRevenue, productCount, companyName);
    } else if (this.endingType === 'global-no1') {
      this.buildGlobalNo1Ending(totalRevenue, productCount, companyName);
    } else if (this.endingType === 'ipo') {
      this.buildIpoEnding(totalRevenue, productCount, companyName);
    } else {
      this.buildAcquisitionEnding(totalRevenue, productCount, companyName);
    }

    applyHiDPI(this);
    onResize(this, () => { this.scene.restart(); });
  }

  // ────────────────────────── 인수합병 엔딩 ──────────────────────────
  private buildAcquisitionEnding(totalRevenue: number, productCount: number, companyName: string): void {
    const title = this.add
      .text(this.cx, 220, '인수합병 제안', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color: TEXT_COLOR.warn,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const headline = this.add
      .text(this.cx, 270, `'${companyName}'이 인수되었습니다`, {
        fontFamily: FONT_STACK,
        fontSize: '48px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const sub = this.add
      .text(
        this.cx,
        320,
        '대형 IT 그룹이 사옥과 팀을 통째로 사들였다.\n첫 사무실에서 시작한 작은 회사가 한 번의 사인으로 다른 이름이 된다.',
        {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          color: TEXT_COLOR.dim,
          align: 'center',
          wordWrap: { width: 600 },
        },
      )
      .setOrigin(0.5)
      .setAlpha(0);

    const { panel, rowEls } = this.buildStatsPanel(
      totalRevenue,
      ENDING.acquisitionRevenueThreshold,
      productCount,
    );

    const footer = this.add
      .text(
        this.cx,
        750,
        '이번 출시까지의 모든 결과는 통계로 남는다.\n계속 운영해 두 번째 사이클을 쌓을 수도 있다.',
        {
          fontFamily: FONT_STACK,
          fontSize: '23px',
          color: TEXT_COLOR.dim,
          align: 'center',
          wordWrap: { width: 580 },
        },
      )
      .setOrigin(0.5)
      .setAlpha(0);

    this.makeBtn({
      x: this.cx - 320 / 2 - 88,
      y: 1170,
      w: 200,
      h: 56,
      label: '통계 보기',
      primary: false,
      onTap: () => this.scene.start(SCENE_KEYS.Stats, { returnTo: SCENE_KEYS.Boot }),
    });
    this.makeBtn({
      x: this.cx - 200 / 2 + 124,
      y: 1170,
      w: 320,
      h: 56,
      label: '계속 운영하기',
      primary: true,
      onTap: () => this.scene.start(SCENE_KEYS.Boot),
    });

    this.animateIn([title, headline, sub, panel, ...rowEls, footer]);
  }

  // ────────────────────────── IPO 엔딩 ──────────────────────────
  private buildIpoEnding(totalRevenue: number, productCount: number, companyName: string): void {
    const title = this.add
      .text(this.cx, 220, 'IPO 상장', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color: TEXT_COLOR.ok,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const headline = this.add
      .text(this.cx, 270, `'${companyName}'이 상장되었습니다`, {
        fontFamily: FONT_STACK,
        fontSize: '48px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const sub = this.add
      .text(
        this.cx,
        320,
        '한 번의 매각 제안을 거절하고 더 멀리 왔다.\n오늘, 거래소에 회사 이름이 적힌다.',
        {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          color: TEXT_COLOR.dim,
          align: 'center',
          wordWrap: { width: 600 },
        },
      )
      .setOrigin(0.5)
      .setAlpha(0);

    const { panel, rowEls } = this.buildStatsPanel(
      totalRevenue,
      ENDING.ipoRevenueThreshold,
      productCount,
    );

    const footer = this.add
      .text(
        this.cx,
        750,
        '주식회사가 되어도 회사는 계속 굴러간다.\n자산은 그대로, 다음 마일스톤(글로벌 1위, 유니콘)도 노려볼 수 있다.',
        {
          fontFamily: FONT_STACK,
          fontSize: '23px',
          color: TEXT_COLOR.dim,
          align: 'center',
          wordWrap: { width: 580 },
        },
      )
      .setOrigin(0.5)
      .setAlpha(0);

    // 3 버튼: 통계 / 계속 운영 / 처음부터 (다시)
    const btnGap = 12;
    const btnH = 56;
    const wStats = 160;
    const wContinue = 220;
    const wReset = 200;
    const totalW = wStats + wContinue + wReset + btnGap * 2;
    const startX = this.cx - totalW / 2;

    this.makeBtn({
      x: startX,
      y: 1170,
      w: wStats,
      h: btnH,
      label: '통계',
      primary: false,
      onTap: () => this.scene.start(SCENE_KEYS.Stats, { returnTo: SCENE_KEYS.Boot }),
    });
    this.makeBtn({
      x: startX + wStats + btnGap,
      y: 1170,
      w: wContinue,
      h: btnH,
      label: '계속 운영하기',
      primary: true,
      onTap: () => this.scene.start(SCENE_KEYS.Boot),
    });
    this.makeBtn({
      x: startX + wStats + btnGap + wContinue + btnGap,
      y: 1170,
      w: wReset,
      h: btnH,
      label: '처음부터',
      primary: false,
      onTap: () => this.showResetConfirm(),
    });

    this.animateIn([title, headline, sub, panel, ...rowEls, footer]);
  }

  // ────────────────────────── 글로벌 1위 엔딩 ──────────────────────────
  private buildGlobalNo1Ending(totalRevenue: number, productCount: number, companyName: string): void {
    this.buildContinueEnding({
      titleText: '글로벌 1위',
      titleColor: TEXT_COLOR.warn,
      headline: `${companyName} — 시장 점유율 1위`,
      sub: '국내를 넘어 해외 거점에서 매출이 더 크다.\n경쟁사들이 따라잡으려 자료를 모으고 있다.',
      footer: '회사 가치는 계속 오른다. 다음은 유니콘.',
      threshold: ENDING.globalNo1RevenueThreshold,
      totalRevenue,
      productCount,
    });
  }

  // ────────────────────────── 유니콘 엔딩 (1조원) ──────────────────────────
  private buildUnicornEnding(totalRevenue: number, productCount: number, companyName: string): void {
    const prestigeCount = loadPrestigeCount();
    const title = this.add
      .text(this.cx, 220, '유니콘 등극', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color: TEXT_COLOR.ok,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const headline = this.add
      .text(this.cx, 270, `${companyName} — 시가총액 1조 돌파`, {
        fontFamily: FONT_STACK,
        fontSize: '48px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const sub = this.add
      .text(this.cx, 320, '뉴스에 회사 이름이 매일 오른다.\n과거 분당 셰어오피스 시절을 기억하는 사람도 적어졌다.', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        color: TEXT_COLOR.dim,
        align: 'center',
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const { panel, rowEls } = this.buildStatsPanel(
      totalRevenue,
      ENDING.unicornRevenueThreshold,
      productCount,
    );

    const footer = this.add
      .text(this.cx, 750, '게임 명전. 그래도 회사는 계속 굴러간다.\n프레스티지를 시작하면 영구 보너스를 누적해 새 회차로.', {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        color: TEXT_COLOR.dim,
        align: 'center',
        wordWrap: { width: 580 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // 4 버튼: 통계 / 계속 운영 / 처음부터 / 프레스티지 시작
    const btnGap = 10;
    const btnH = 56;
    const wStats = 130;
    const wContinue = 180;
    const wReset = 150;
    const wPrestige = 210;
    const totalW = wStats + wContinue + wReset + wPrestige + btnGap * 3;
    const startX = this.cx - totalW / 2;
    this.makeBtn({
      x: startX, y: 1100, w: wStats, h: btnH,
      label: '통계', primary: false,
      onTap: () => this.scene.start(SCENE_KEYS.Stats, { returnTo: SCENE_KEYS.Boot }),
    });
    this.makeBtn({
      x: startX + wStats + btnGap, y: 1100, w: wContinue, h: btnH,
      label: '계속 운영', primary: true,
      onTap: () => this.scene.start(SCENE_KEYS.Boot),
    });
    this.makeBtn({
      x: startX + wStats + btnGap + wContinue + btnGap, y: 1100, w: wReset, h: btnH,
      label: '처음부터', primary: false,
      onTap: () => this.showResetConfirm(),
    });
    this.makeBtn({
      x: startX + wStats + btnGap + wContinue + btnGap + wReset + btnGap, y: 1100, w: wPrestige, h: btnH,
      label: `🏆 프레스티지 시작 (${prestigeCount + 1}회)`,
      primary: true,
      onTap: () => this.showPrestigeConfirm(),
    });

    this.animateIn([title, headline, sub, panel, ...rowEls, footer]);
  }

  /**
   * 프레스티지 시작 확인 모달.
   * 확인 시 clearData() + incrementPrestige() 후 Boot 이동.
   */
  private showPrestigeConfirm(): void {
    const nextCount = loadPrestigeCount() + 1;
    const layer = this.add.container(0, 0).setDepth(200);
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.85)
      .setOrigin(0, 0)
      .setInteractive();
    layer.add(overlay);

    const panelW = 540;
    const panelH = 380;
    const panelX = (720 - panelW) / 2;
    const panelY = (1280 - panelH) / 2;
    layer.add(makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel));

    layer.add(
      this.add
        .text(this.cx, panelY + 32, `🏆 프레스티지 ${nextCount}회 시작`, {
          fontFamily: FONT_STACK,
          fontSize: '26px',
          fontStyle: 'bold',
          color: TEXT_COLOR.ok,
          align: 'center',
        })
        .setOrigin(0.5, 0),
    );
    layer.add(
      this.add
        .text(
          this.cx,
          panelY + 90,
          `회사 진행 데이터를 초기화하고\n영구 보너스를 누적해 새 회차를 시작합니다.\n\n` +
          `⬡ 시작 골드 +${nextCount * 500}g\n` +
          `⬡ 전체 매출 ×${(1 + nextCount * 0.05).toFixed(2)}\n` +
          `⬡ 직원 skill +${(nextCount * 0.05).toFixed(2)}\n` +
          `⬡ burn rate ×${Math.max(0.5, 1 - nextCount * 0.05).toFixed(2)}`,
          {
            fontFamily: FONT_STACK,
            fontSize: '18px',
            color: TEXT_COLOR.dim,
            align: 'center',
            wordWrap: { width: panelW - 40 },
          },
        )
        .setOrigin(0.5, 0),
    );

    const cancelW = 200;
    const confirmW = 240;
    const btnH = 56;
    const cancelX = panelX + 30;
    const confirmX = panelX + panelW - 30 - confirmW;
    const btnY = panelY + panelH - 80;

    // 취소
    const cancelBg = this.add.graphics();
    cancelBg.fillStyle(COLOR.btnSecondary, 1);
    cancelBg.fillRoundedRect(cancelX, btnY, cancelW, btnH, 12);
    layer.add(cancelBg);
    layer.add(
      this.add
        .text(cancelX + cancelW / 2, btnY + btnH / 2, '취소', {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5),
    );
    const cancelHit = this.add
      .zone(cancelX + cancelW / 2, btnY + btnH / 2, cancelW, btnH)
      .setInteractive({ useHandCursor: true });
    cancelHit.on('pointerup', () => {
      playSfx(this, SFX.tap);
      layer.destroy();
    });
    layer.add(cancelHit);

    // 확인
    const confirmBg = this.add.graphics();
    confirmBg.fillStyle(COLOR.matchOk, 1);
    confirmBg.fillRoundedRect(confirmX, btnY, confirmW, btnH, 12);
    layer.add(confirmBg);
    layer.add(
      this.add
        .text(confirmX + confirmW / 2, btnY + btnH / 2, '프레스티지 시작', {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5),
    );
    const confirmHit = this.add
      .zone(confirmX + confirmW / 2, btnY + btnH / 2, confirmW, btnH)
      .setInteractive({ useHandCursor: true });
    confirmHit.on('pointerup', () => {
      playSfx(this, SFX.click);
      // 메인 세이브 삭제 후 프레스티지 카운터 증가 → Boot로.
      clearData();
      incrementPrestige();
      this.scene.start(SCENE_KEYS.Boot);
    });
    layer.add(confirmHit);
  }

  /** IPO 이후 엔딩들에서 공유하는 빌더 — 통계 + 계속 운영 + 처음부터 3 버튼. */
  private buildContinueEnding(opts: {
    titleText: string;
    titleColor: string;
    headline: string;
    sub: string;
    footer: string;
    threshold: number;
    totalRevenue: number;
    productCount: number;
  }): void {
    const title = this.add
      .text(this.cx, 220, opts.titleText, {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color: opts.titleColor,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const headline = this.add
      .text(this.cx, 270, opts.headline, {
        fontFamily: FONT_STACK,
        fontSize: '48px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const sub = this.add
      .text(this.cx, 320, opts.sub, {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        color: TEXT_COLOR.dim,
        align: 'center',
        wordWrap: { width: 600 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const { panel, rowEls } = this.buildStatsPanel(
      opts.totalRevenue,
      opts.threshold,
      opts.productCount,
    );

    const footer = this.add
      .text(this.cx, 750, opts.footer, {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        color: TEXT_COLOR.dim,
        align: 'center',
        wordWrap: { width: 580 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // 3 버튼: 통계 / 계속 운영 / 처음부터
    const btnGap = 12;
    const btnH = 56;
    const wStats = 160;
    const wContinue = 220;
    const wReset = 200;
    const totalW = wStats + wContinue + wReset + btnGap * 2;
    const startX = this.cx - totalW / 2;
    this.makeBtn({
      x: startX, y: 1170, w: wStats, h: btnH,
      label: '통계', primary: false,
      onTap: () => this.scene.start(SCENE_KEYS.Stats, { returnTo: SCENE_KEYS.Boot }),
    });
    this.makeBtn({
      x: startX + wStats + btnGap, y: 1170, w: wContinue, h: btnH,
      label: '계속 운영하기', primary: true,
      onTap: () => this.scene.start(SCENE_KEYS.Boot),
    });
    this.makeBtn({
      x: startX + wStats + btnGap + wContinue + btnGap, y: 1170, w: wReset, h: btnH,
      label: '처음부터', primary: false,
      onTap: () => this.showResetConfirm(),
    });

    this.animateIn([title, headline, sub, panel, ...rowEls, footer]);
  }

  // ────────────────────────── 공통 통계 패널 ──────────────────────────
  private buildStatsPanel(
    totalRevenue: number,
    threshold: number,
    productCount: number,
  ): { panel: Phaser.GameObjects.NineSlice; rowEls: Phaser.GameObjects.Text[] } {
    const panelY = 440;
    const panelW = 580;
    const panelH = 260;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panel = makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);
    panel.setAlpha(0);

    const stats: ReadonlyArray<readonly [string, string, string]> = [
      ['누적 매출', `${totalRevenue.toLocaleString()} g`, TEXT_COLOR.ok],
      ['임계 도달', `${threshold.toLocaleString()} g`, TEXT_COLOR.warn],
      ['출시 작품', `${productCount}개`, TEXT_COLOR.primary],
    ];
    const rowH = 70;
    const rowEls: Phaser.GameObjects.Text[] = [];
    stats.forEach(([label, value, color], i) => {
      const y = panelY + 26 + i * rowH;
      const labelEl = this.add
        .text(panelX + 28, y, label, {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          color: TEXT_COLOR.dim,
        })
        .setAlpha(0);
      const valueEl = this.add
        .text(panelX + panelW - 28, y, value, {
          fontFamily: FONT_STACK,
          fontSize: '36px',
          fontStyle: 'bold',
          color,
        })
        .setOrigin(1, 0)
        .setAlpha(0);
      rowEls.push(labelEl, valueEl);
    });

    return { panel, rowEls };
  }

  // ────────────────────────── 등장 애니메이션 ──────────────────────────
  private animateIn(elements: Phaser.GameObjects.GameObject[]): void {
    const delays = [200, 500, 900, 1300];
    elements.forEach((target, i) => {
      // 패널(인덱스 3)까지는 delays 배열 사용, 이후는 rowEl stagger.
      let delay: number;
      if (i < 4) {
        delay = delays[i] ?? 1300;
      } else {
        // rowEls: 2개씩 동시 등장, 250ms 간격.
        delay = 1500 + Math.floor((i - 4) / 2) * 250;
      }
      this.tweens.add({ targets: target, alpha: 1, duration: 400, delay, ease: 'Cubic.easeOut' });
    });

    // 마지막 footer는 rowEls 뒤.
    const lastIdx = elements.length - 1;
    const lastDelay = lastIdx >= 4 ? 1500 + Math.floor((lastIdx - 4) / 2) * 250 : 1300;
    // footer는 이미 위에서 처리됨 — 여기서 override가 필요한 경우 없음.
    void lastDelay;

    // 사운드.
    this.time.delayedCall(400, () => playSfx(this, SFX.success, 0.6));
    this.time.delayedCall(1300, () => playSfx(this, SFX.modal, 0.4));
  }

  // ────────────────────────── 버튼 ──────────────────────────
  private makeBtn(opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    primary: boolean;
    onTap: () => void;
  }): void {
    const rect = new Phaser.Geom.Rectangle(opts.x, opts.y, opts.w, opts.h);
    const bg = this.add.graphics();
    this.add
      .text(opts.x + opts.w / 2, opts.y + opts.h / 2, opts.label, {
        fontFamily: FONT_STACK,
        fontSize: opts.primary ? '18px' : '15px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    const draw = (pressed: boolean): void => {
      const base = opts.primary ? COLOR.btn : COLOR.btnSecondary;
      const down = opts.primary ? COLOR.btnDown : COLOR.btnSecondaryDown;
      bg.clear();
      bg.fillStyle(pressed ? down : base, 1);
      bg.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 14);
    };
    draw(false);
    const hit = this.add
      .zone(opts.x + opts.w / 2, opts.y + opts.h / 2, opts.w, opts.h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerup', () => {
      draw(false);
      playSfx(this, SFX.click);
      opts.onTap();
    });
  }

  /**
   * 처음부터 다시 — 명시적 확인 모달.
   * 누적 데이터(매출·직원·R&D·시설·시장·인수·장비 등) 전부 삭제됨을 경고.
   */
  private showResetConfirm(): void {
    const layer = this.add.container(0, 0).setDepth(200);
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.85)
      .setOrigin(0, 0)
      .setInteractive();
    layer.add(overlay);

    const panelW = 540;
    const panelH = 360;
    const panelX = (720 - panelW) / 2;
    const panelY = (1280 - panelH) / 2;
    layer.add(makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel));

    layer.add(
      this.add
        .text(this.cx, panelY + 32, '⚠ 정말 모든 데이터를 삭제하고\n처음부터 다시 시작하시겠습니까?', {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          fontStyle: 'bold',
          color: TEXT_COLOR.bad,
          align: 'center',
          wordWrap: { width: panelW - 40 },
        })
        .setOrigin(0.5, 0),
    );
    layer.add(
      this.add
        .text(
          this.cx,
          panelY + 130,
          '누적 매출 · 직원 · R&D · 시설 · 시장 · 인수 · 장비 등\n모든 진행 데이터가 영구 삭제됩니다.\n복구할 수 없습니다.',
          {
            fontFamily: FONT_STACK,
            fontSize: '17px',
            color: TEXT_COLOR.dim,
            align: 'center',
            wordWrap: { width: panelW - 40 },
          },
        )
        .setOrigin(0.5, 0),
    );

    // 취소 (보조)
    const cancelBg = this.add.graphics();
    cancelBg.fillStyle(COLOR.btnSecondary, 1);
    const cancelW = 200, btnH = 56, cancelX = panelX + 30, btnY = panelY + panelH - 80;
    cancelBg.fillRoundedRect(cancelX, btnY, cancelW, btnH, 12);
    layer.add(cancelBg);
    layer.add(
      this.add
        .text(cancelX + cancelW / 2, btnY + btnH / 2, '취소', {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5),
    );
    const cancelHit = this.add
      .zone(cancelX + cancelW / 2, btnY + btnH / 2, cancelW, btnH)
      .setInteractive({ useHandCursor: true });
    cancelHit.on('pointerup', () => {
      playSfx(this, SFX.tap);
      layer.destroy();
    });
    layer.add(cancelHit);

    // 확인 (위험)
    const confirmBg = this.add.graphics();
    confirmBg.fillStyle(COLOR.matchBad, 1);
    const confirmW = 240, confirmX = panelX + panelW - 30 - confirmW;
    confirmBg.fillRoundedRect(confirmX, btnY, confirmW, btnH, 12);
    layer.add(confirmBg);
    layer.add(
      this.add
        .text(confirmX + confirmW / 2, btnY + btnH / 2, '모두 삭제', {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5),
    );
    const confirmHit = this.add
      .zone(confirmX + confirmW / 2, btnY + btnH / 2, confirmW, btnH)
      .setInteractive({ useHandCursor: true });
    confirmHit.on('pointerup', () => {
      playSfx(this, SFX.click);
      clearData();
      this.scene.start(SCENE_KEYS.Boot);
    });
    layer.add(confirmHit);
  }
}
