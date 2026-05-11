import Phaser from 'phaser';
import type { Types } from 'phaser';

import { BALANCE, ENDING, inflationMultiplier } from '@/domain/balance';
import { getExecPressure } from '@/domain/exec';
import { computeSaturationMultiplier } from '@/domain/saturation';
import type { ReleaseOutcome, ReviewStars } from '@/domain/result';
import { RIVALS } from '@/domain/rivals';
import {
  DEFAULT_POLICY,
  JOB_LABEL,
  OFFICE_STAGE_LABEL,
  pickHireCandidates,
  pickReferralCandidate,
  RANK_LABEL,
  TRAIT_LABEL,
  type HireCandidate,
} from '@/domain/seed';
import {
  avgMorale,
  REFERRAL_AVG_MORALE_THRESHOLD,
  REFERRAL_PROBABILITY,
} from '@/domain/retention';
import { PERK } from '@/domain/balance';
import {
  EMPTY_RND,
  getRndTier,
  isRndAvailable,
  isRndPurchased,
  RND_ITEMS,
  RND_RESEARCH_WEEKS,
  type RndState,
} from '@/domain/rnd';
import {
  ECONOMY_PHASE_LABEL,
  EMPTY_ECONOMY,
  getEconomyPhase,
  getEconomyRevenueMul,
} from '@/domain/economy';
import type { EconomyState } from '@/domain/economy';
import {
  EMPTY_MARKETS,
  MARKETS,
  enterMarket,
  isMarketAvailable,
  isMarketEntered,
  type MarketState,
} from '@/domain/markets';
import {
  ACQUISITIONS,
  EMPTY_ACQUISITIONS,
  completeAcquisition,
  generateAcquiredEmployees,
  isAcquisitionAvailable,
  isAcquisitionCompleted,
  type AcquisitionState,
} from '@/domain/acquisitions';
import {
  EMPTY_FACILITIES,
  FACILITIES,
  buildFacility,
  isFacilityBuilt,
  isFacilityAvailable,
  type FacilityState,
} from '@/domain/facilities';
import {
  EQUIPMENT_TIERS,
  SLOT_LABEL,
  type EmployeeEquipment,
  type EquipmentSlot,
} from '@/domain/equipment';
import type { CompanyPolicy, Employee, OfficeLevel, Track } from '@/domain/types';
import { ICONS } from '@/icons';
import { BGM } from '@/bgm';
import { OFFICE_ILLUSTRATION } from '@/illustrations';
import { HISTORY_CAP, loadData, saveData, clearData, DEFAULT_COMPANY_NAME, type SavedResult } from '@/save';
import {
  MAIL_TEMPLATES,
  createMailMessage,
  markMailRead,
  pickRandomMail,
  trimMails,
  type MailMessage,
} from '@/domain/mail';
import { NPCS } from '@/domain/npcs';
import { detectNewMilestones, type Milestone, type MilestoneId } from '@/domain/milestones';
import { playSfx, SFX } from '@/sounds';
import { COLOR, FONT_STACK, TEXT_COLOR, TINT } from '@/theme';
import { formatGold, createModal, createButton } from '@/ui';
import { TYPE } from '@/theme';
import { applyHiDPI } from '@/util/hidpi';
import { addMuteToggle } from '@/util/muteToggle';
import { makePanel } from '@/util/ui';
import { fitCamera } from '@/util/cameraFit';
import { onResize } from '@/util/viewport';

import { buildYearEndReport, calendarFor, type YearEndReport } from '@/domain/calendar';

import { SCENE_KEYS } from './keys';

/** 출시 결과 화면. 자동 저장(localStorage)되며 [처음으로]는 Boot로 돌아가 골드를 이월한다. */
export class ResultScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.Result;

  private outcome!: ReleaseOutcome;
  private polishCount = 0;
  private savedAt: number | null = null;
  private saveFooterText: Phaser.GameObjects.Text | null = null;

  // mutable office-state — Result 내에서 업그레이드/채용/정책 변경 가능
  private liveGold = 0;
  private officeLevel: OfficeLevel = 1;
  private hiredEmployees: Employee[] = [];
  /** 전체 직원 풀(튜토리얼 3 + 채용). track 등 변경분 보존용. */
  private liveEmployees: ReadonlyArray<Employee> = [];
  private livePolicy: CompanyPolicy = DEFAULT_POLICY;
  /** R&D 영구 업그레이드 상태. */
  private liveRnd: RndState = EMPTY_RND;
  /** 경기 사이클 상태 — outcome에서 이어받아 저장에 반영. */
  private liveEconomy: EconomyState = EMPTY_ECONOMY;
  /** 회사 시설 상태. */
  private liveFacilities: FacilityState = EMPTY_FACILITIES;
  /** 글로벌 시장 진출 상태. */
  private liveMarkets: MarketState = EMPTY_MARKETS;
  /** 자회사 인수 상태. */
  private liveAcquisitions: AcquisitionState = EMPTY_ACQUISITIONS;
  /** 출시 이력 — 매 init마다 새 entry 한 건 append 후 cap. */
  private history: ReadonlyArray<SavedResult> = [];
  /** 이미 본 엔딩 목록 — 'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq'. */
  private liveEndingsShown: ReadonlyArray<'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq'> = [];
  /** 누적 달성 마일스톤 ID. */
  private liveMilestones: ReadonlyArray<MilestoneId> = [];
  /** 연말 결산 달성 시 reputation 보너스 — persistResult에서 합산. */
  private yearEndReputationBonus = 0;
  /** 수신 메일 목록 — 최대 30개 보관. */
  private liveMails: ReadonlyArray<MailMessage> = [];

  // office panel widgets
  private officeStatusText: Phaser.GameObjects.Text | null = null;
  private officeGoldText: Phaser.GameObjects.Text | null = null;
  private officeGoldIcon: Phaser.GameObjects.Image | null = null;
  private officeIllustration: Phaser.GameObjects.Image | null = null;
  private upgradeBtnBg: Phaser.GameObjects.Graphics | null = null;
  private upgradeBtnText: Phaser.GameObjects.Text | null = null;
  private upgradeBtnRect: Phaser.Geom.Rectangle | null = null;
  private upgradeBtnHit: Phaser.GameObjects.Zone | null = null;
  private hireBtnBg: Phaser.GameObjects.Graphics | null = null;
  private hireBtnText: Phaser.GameObjects.Text | null = null;
  private hireBtnRect: Phaser.Geom.Rectangle | null = null;
  private hireBtnHit: Phaser.GameObjects.Zone | null = null;
  private rndBtnBg: Phaser.GameObjects.Graphics | null = null;
  private rndBtnText: Phaser.GameObjects.Text | null = null;
  private rndBtnRect: Phaser.Geom.Rectangle | null = null;
  private rndBtnHit: Phaser.GameObjects.Zone | null = null;
  private equipBtnBg: Phaser.GameObjects.Graphics | null = null;
  private equipBtnText: Phaser.GameObjects.Text | null = null;
  private equipBtnRect: Phaser.Geom.Rectangle | null = null;
  private equipBtnHit: Phaser.GameObjects.Zone | null = null;
  private facilBtnBg: Phaser.GameObjects.Graphics | null = null;
  private facilBtnText: Phaser.GameObjects.Text | null = null;
  private facilBtnRect: Phaser.Geom.Rectangle | null = null;
  private facilBtnHit: Phaser.GameObjects.Zone | null = null;
  private marketBtnBg: Phaser.GameObjects.Graphics | null = null;
  private marketBtnText: Phaser.GameObjects.Text | null = null;
  private marketBtnRect: Phaser.Geom.Rectangle | null = null;
  private marketBtnHit: Phaser.GameObjects.Zone | null = null;
  private acqBtnBg: Phaser.GameObjects.Graphics | null = null;
  private acqBtnText: Phaser.GameObjects.Text | null = null;
  private acqBtnRect: Phaser.Geom.Rectangle | null = null;
  private acqBtnHit: Phaser.GameObjects.Zone | null = null;
  private mailBtnBg: Phaser.GameObjects.Graphics | null = null;
  private mailBtnText: Phaser.GameObjects.Text | null = null;
  private mailBtnRect: Phaser.Geom.Rectangle | null = null;
  private mailBtnHit: Phaser.GameObjects.Zone | null = null;
  /** 매 create() 시 갱신. */
  private cx = 360;
  private contentX = 0;

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
    this.livePolicy = existing?.policy ?? DEFAULT_POLICY;
    // outcome.state.rnd가 dev cycle 중 advanceWeek로 decrement된 최신 progress를 가짐.
    // 옛 save를 그대로 쓰면 R&D 진행이 ResultScene에서 안 보이는 버그.
    this.liveRnd = data.outcome.state.rnd ?? existing?.rnd ?? EMPTY_RND;
    // stale rnd progress 정리 — 옛 id 또는 weeksRemaining=0인 inProgress 제거.
    {
      const p = this.liveRnd.progress;
      if (p && (!p.inProgress || p.weeksRemaining <= 0 || !RND_ITEMS.some((r) => r.id === p.inProgress))) {
        this.liveRnd = { ...this.liveRnd, progress: { inProgress: null, weeksRemaining: 0 } };
      }
    }
    // economy: outcome.state가 shipProject에서 tickEconomy 적용된 최신 값.
    this.liveEconomy = data.outcome.state.economy ?? EMPTY_ECONOMY;
    this.liveFacilities = existing?.facilities ?? EMPTY_FACILITIES;
    this.liveMarkets = existing?.markets ?? EMPTY_MARKETS;
    this.liveAcquisitions = existing?.acquisitions ?? EMPTY_ACQUISITIONS;
    // endingsShown 로드 — save.ts의 sanitizeEndingsShown이 endingShown(deprecated) 마이그레이션을
    // 이미 처리하므로 여기서는 endingsShown만 보면 된다.
    type EndingId = 'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq';
    const initialEndingsShown: ReadonlyArray<EndingId> =
      existing?.endingsShown ?? [];
    this.liveEndingsShown = initialEndingsShown;
    this.liveMilestones = existing?.milestones ?? [];
    this.yearEndReputationBonus = 0;
    // 메일 로드.
    this.liveMails = existing?.mails ?? [];
    // shipProject가 반환한 outcome.state.employees가 가장 최신 직원 상태(skill·rank 포함).
    this.liveEmployees = data.outcome.state.employees;
    // 이번 outcome을 history에 한 번 append. 매 init당 한 번만 실행.
    const newEntry = this.buildSavedResult();
    const prevHistory = existing?.history ?? [];
    this.history = [...prevHistory, newEntry].slice(-HISTORY_CAP);
    // 시장 포화 — 출시 전 이력 기준으로 매출 보정. liveGold에서 포화 차감분 제거.
    if (data.outcome.state.productIndex > 0) {
      const { genre, theme } = data.outcome.state.project;
      const satMul = computeSaturationMultiplier(prevHistory, genre, theme);
      if (satMul < 1) {
        // outcome.revenue는 포화 미적용 — 차이만큼 liveGold에서 차감.
        const originalRevenue = data.outcome.revenue;
        const adjustedRevenue = Math.round(originalRevenue * satMul);
        this.liveGold -= originalRevenue - adjustedRevenue;
      }
    }
    // 업그레이드/채용 위젯은 매 init마다 다시 만들기 위해 null로 비움.
    this.officeStatusText = null;
    this.officeGoldText = null;
    this.officeGoldIcon = null;
    this.officeIllustration = null;
    this.upgradeBtnBg = null;
    this.upgradeBtnText = null;
    this.upgradeBtnRect = null;
    this.upgradeBtnHit = null;
    this.hireBtnBg = null;
    this.hireBtnText = null;
    this.hireBtnRect = null;
    this.hireBtnHit = null;
    this.rndBtnBg = null;
    this.rndBtnText = null;
    this.rndBtnRect = null;
    this.rndBtnHit = null;
    this.equipBtnBg = null;
    this.equipBtnText = null;
    this.equipBtnRect = null;
    this.equipBtnHit = null;
    this.facilBtnBg = null;
    this.facilBtnText = null;
    this.facilBtnRect = null;
    this.facilBtnHit = null;
    this.marketBtnBg = null;
    this.marketBtnText = null;
    this.marketBtnRect = null;
    this.marketBtnHit = null;
    this.acqBtnBg = null;
    this.acqBtnText = null;
    this.acqBtnRect = null;
    this.acqBtnHit = null;
    this.mailBtnBg = null;
    this.mailBtnText = null;
    this.mailBtnRect = null;
    this.mailBtnHit = null;
  }

  create(): void {
    fitCamera(this);
    // logical 720×1280 좌표 고정 — viewport 크기 무관.
    this.cx = 360;
    this.contentX = 0;
    BGM.resume();
    BGM.setMood('celebrate');
    addMuteToggle(this);
    this.addSettingsButton();
    this.persistResult();
    // 엔딩 분기 — 가장 높은 미달성 임계 우선.
    const totalRevenue = this.history.reduce((s, r) => s + r.revenue, 0);
    const shownSet = new Set(this.liveEndingsShown);
    type EndingTier = 'acquisition' | 'ipo' | 'global-no1' | 'unicorn' | 'global-hq';

    // global-hq는 매출이 아닌 사옥 L6 도달 트리거 (도전 과제형).
    if (this.officeLevel >= 6 && !shownSet.has('global-hq')) {
      this.liveEndingsShown = [...this.liveEndingsShown, 'global-hq'];
      this.persistResult();
      this.scene.start(SCENE_KEYS.Ending, { ending: 'global-hq' });
      return;
    }

    const endingChecks: ReadonlyArray<{ id: EndingTier; threshold: number }> = [
      { id: 'unicorn',     threshold: ENDING.unicornRevenueThreshold },
      { id: 'global-no1',  threshold: ENDING.globalNo1RevenueThreshold },
      { id: 'ipo',         threshold: ENDING.ipoRevenueThreshold },
      { id: 'acquisition', threshold: ENDING.acquisitionRevenueThreshold },
    ];
    for (const check of endingChecks) {
      if (!shownSet.has(check.id) && totalRevenue >= check.threshold) {
        this.liveEndingsShown = [...this.liveEndingsShown, check.id];
        this.persistResult();
        this.scene.start(SCENE_KEYS.Ending, { ending: check.id });
        return;
      }
    }
    // 연말 결산 — productCount가 4의 배수일 때 평가.
    const productCount = this.outcome.state.productIndex + 1;
    const report = buildYearEndReport(productCount, this.history);
    if (report) {
      if (report.achieved) {
        this.liveGold += report.goldBonus;
        this.yearEndReputationBonus = report.reputationBonus;
      }
      this.persistResult();
      this.time.delayedCall(2600, () => this.showYearEndModal(report));
    }
    // 마일스톤 감지 — 연말 결산 처리 후.
    const newMilestones = detectNewMilestones({
      prevMilestones: this.liveMilestones,
      state: this.outcome.state,
      totalRevenue,
      history: this.history,
      hiredEmployeeCount: this.hiredEmployees.length,
      rndPurchasedCount: this.liveRnd.purchased.length,
    });
    if (newMilestones.length > 0) {
      const repBonus = newMilestones.reduce((s, m) => s + m.reputationBonus, 0);
      this.yearEndReputationBonus += repBonus;
      this.liveMilestones = [...this.liveMilestones, ...newMilestones.map((m) => m.id)];
      this.persistResult();
      this.queueMilestoneToasts(newMilestones);
    }
    // 메일 트리거 — 출시마다 1~2개 새 메일 수신.
    this.triggerNewMails();
    // 직급 트랙 분기 — junior→senior 진급 직원 중 track 미선택자 모달 큐.
    this.queueTrackChoiceModalsIfNeeded();
    // 임원 압박 체크 — 출시 후 exec state 기준.
    this.checkExecPressure();
    // 경기 사이클 변화 — 새 사이클 시작 시 토스트.
    if (this.outcome.economy.cycleChanged) {
      this.time.delayedCall(2500, () => this.showEconomyToast());
    }
    // 출시 등장 사운드 — 첫 별 등장 직전 살짝 늦춰 재생.
    this.time.delayedCall(220, () => playSfx(this, SFX.success, 0.55));
    this.buildHeader();
    this.buildHeadline();
    this.buildBreakdown();
    this.buildOfficePanel();
    this.buildResetButton();
    this.buildSaveFooter();
    applyHiDPI(this);
    onResize(this, () => { this.scene.restart(); });
  }

  // ────────────────────────── persistence ──────────────────────────
  private buildSavedResult(): SavedResult {
    const o = this.outcome;
    const project = o.state.project;
    return {
      genre: project.genre,
      theme: project.theme,
      weeksElapsed: project.weeksElapsed,
      weeksTarget: project.weeksTarget,
      bugDebt: Math.round(project.bugDebt),
      reviewScore: o.reviewScore,
      stars: o.stars,
      revenue: o.revenue,
      polishCount: this.polishCount,
      releasedAt: Date.now(),
    };
  }

  private persistResult(): void {
    const o = this.outcome;
    const saved = saveData({
      gold: this.liveGold,
      productCount: o.state.productIndex + 1,
      officeLevel: this.officeLevel,
      hiredEmployees: this.hiredEmployees,
      reputation: o.reputation.total + this.yearEndReputationBonus,
      policy: this.livePolicy,
      trend: o.state.trend,
      lastResult: this.history[this.history.length - 1] ?? null,
      history: this.history,
      endingsShown: this.liveEndingsShown,
      employees: this.liveEmployees,
      rnd: this.liveRnd,
      milestones: this.liveMilestones,
      facilities: this.liveFacilities,
      markets: this.liveMarkets,
      acquisitions: this.liveAcquisitions,
      lastAssignment: o.state.assignment,
      ...(o.state.support ? { lastSupport: o.state.support } : {}),
      mails: this.liveMails,
      ...(o.state.bankruptcy ? { bankruptcy: o.state.bankruptcy } : {}),
      ...(o.state.exec ? { exec: o.state.exec } : {}),
      economy: this.liveEconomy,
      ...(o.state.rivals ? { rivals: o.state.rivals } : {}),
    });
    this.savedAt = saved?.savedAt ?? null;
  }

  // ────────────────────────── 설정 버튼 ──────────────────────────
  /** 화면 우상단 뮤트 버튼 옆에 ⚙ 설정 버튼 추가. */
  private addSettingsButton(): void {
    const btnW = 88;
    const btnH = 36;
    const x = this.contentX + 720 - 14 - btnW;
    const y = 14;
    const bg = this.add.graphics();
    bg.fillStyle(COLOR.btnSecondary, 0.85);
    bg.fillRoundedRect(x, y, btnW, btnH, 10);
    this.add.text(x + btnW / 2, y + btnH / 2, '⚙ 설정', {
      fontFamily: FONT_STACK,
      fontSize: '22px',
      color: TEXT_COLOR.dim,
    }).setOrigin(0.5);
    const hit = this.add
      .zone(x + btnW / 2, y + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      playSfx(this, SFX.tap);
      this.scene.start(SCENE_KEYS.Settings, { returnTo: SCENE_KEYS.Result });
    });
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
      fontSize: '23px',
      color: TEXT_COLOR.dim,
    };

    this.add.text(this.cx, 60, '출시 완료', titleStyle).setOrigin(0.5);

    const { project } = this.outcome.state;
    const overdue = project.weeksElapsed > project.weeksTarget;
    // 막 출시한 작품 포함 분기 산출 (productIndex + 1).
    const cal = calendarFor(this.outcome.state.productIndex + 1);
    const sub = `${project.genre} × ${project.theme} · Week ${project.weeksElapsed} / ${project.weeksTarget}${overdue ? ' (연체)' : ''} · ${cal.year}년차 ${cal.quarter}`;
    this.add.text(this.cx, 92, sub, subStyle).setOrigin(0.5);
  }

  // ────────────────────────── headline panel ──────────────────────────
  private buildHeadline(): void {
    const panelX = this.contentX + (720 - 660) / 2;
    const panelY = 130;
    const panelW = 660;
    const panelH = 220;

    makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);

    const stars = this.outcome.stars;
    this.drawStarRow(this.cx, panelY + 56, stars);

    this.add
      .text(this.cx, panelY + 110, this.outcome.headline, {
        fontFamily: FONT_STACK,
        fontSize: '29px',
        color: TEXT_COLOR.primary,
        align: 'center',
        wordWrap: { width: panelW - 48, useAdvancedWrap: true },
      })
      .setOrigin(0.5);

    this.add
      .text(this.cx, panelY + 160, `리뷰 점수 ${this.outcome.reviewScore} / 100`, {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
  }

  /** filled 별의 tier별 tint (number form). */
  private starTierTint(stars: ReviewStars): number {
    if (stars >= 4) return TINT.ok;
    if (stars === 3) return TINT.warn;
    return TINT.bad;
  }

  /** 5 별 가로 행 — index < stars 면 filled, 아니면 outline. 좌→우로 stagger 등장. */
  private drawStarRow(centerX: number, centerY: number, stars: ReviewStars): void {
    const size = 36;
    const gap = 6;
    const totalW = size * 5 + gap * 4;
    const startX = centerX - totalW / 2;
    const filledTint = this.starTierTint(stars);
    for (let i = 0; i < 5; i++) {
      const filled = i < stars;
      const key = filled ? ICONS.star.key : ICONS.starOutline.key;
      const star = this.add
        .image(startX + i * (size + gap) + size / 2, centerY, key)
        .setDisplaySize(size, size)
        .setOrigin(0.5)
        .setTint(filled ? filledTint : TINT.dim);
      // stagger 등장: scale 0→1.2→1 (Back.easeOut), 각 별 120ms 시차.
      const targetX = star.scaleX;
      const targetY = star.scaleY;
      star.setScale(0);
      this.tweens.add({
        targets: star,
        scaleX: targetX,
        scaleY: targetY,
        duration: 400,
        delay: i * 120,
        ease: 'Back.easeOut',
      });
    }
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

    const repMul = o.reputation.multiplier;
    const repValue =
      repMul > 1.001
        ? `+${o.reputation.gain} (총 ${o.reputation.total} · 매출 ×${repMul.toFixed(2)})`
        : `+${o.reputation.gain} (총 ${o.reputation.total})`;

    const trendRow: ReadonlyArray<readonly [string, string, string]> =
      o.trend && Math.abs(o.trend.multiplier - 1) > 0.001
        ? ([
            [
              '트렌드',
              `${o.trend.name} (매출 ×${o.trend.multiplier.toFixed(2)})`,
              o.trend.multiplier > 1 ? TEXT_COLOR.ok : TEXT_COLOR.bad,
            ],
          ] as const)
        : ([] as ReadonlyArray<readonly [string, string, string]>);

    // 경기 row — 항상 표시.
    const ecoMulVal = o.economy.revenueMul;
    const ecoRowColor = ecoMulVal > 1.001 ? TEXT_COLOR.ok : ecoMulVal < 0.999 ? TEXT_COLOR.bad : TEXT_COLOR.dim;
    const ecoRow: ReadonlyArray<readonly [string, string, string]> = [
      ['경기', `${o.economy.phase} (지표 ${o.economy.index} · 매출 ×${ecoMulVal.toFixed(1)})`, ecoRowColor],
    ];

    // 시장 경쟁 row — 라이벌 매치 시 표시.
    const ms = o.marketShare;
    const rivalMap = new Map(RIVALS.map((r) => [r.id, r] as const));
    const marketShareRows: ReadonlyArray<readonly [string, string, string]> =
      ms.matchedReleases.length > 0
        ? [
            [
              '시장 경쟁',
              `라이벌 ${ms.matchedReleases.length}개 경쟁 · 매출 ×${ms.revenueMul.toFixed(1)}`,
              ms.revenueMul < 1 ? TEXT_COLOR.bad : TEXT_COLOR.dim,
            ],
            ...ms.matchedReleases
              .filter((r) => r.stars > o.stars)
              .map((r) => {
                const name = rivalMap.get(r.rivalId)?.name ?? r.rivalId;
                return [
                  '  경쟁사 우위',
                  `${name} ★${r.stars} 출시 — 명성 −5`,
                  TEXT_COLOR.bad,
                ] as const;
              }),
          ]
        : [];

    const baseRows: ReadonlyArray<readonly [string, string, string]> = [
      ['매출', `+${o.revenue} 골드`, TEXT_COLOR.ok],
      ['명성', repValue, TEXT_COLOR.warn],
      ...marketShareRows,
      ...trendRow,
      ...ecoRow,
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

    const panelX = this.contentX + (720 - 660) / 2;
    const panelY = 380;
    const panelW = 660;
    const rowH = 46;
    const panelH = rows.length * rowH + 28;

    makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);

    const labelStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '24px',
      color: TEXT_COLOR.dim,
    };

    let revenueValueText: Phaser.GameObjects.Text | null = null;
    rows.forEach(([label, value, color], i) => {
      const y = panelY + 14 + i * rowH + rowH / 2;
      this.add.text(panelX + 20, y, label, labelStyle).setOrigin(0, 0.5);
      const initial = label === '매출' ? '+0 골드' : value;
      // 점수 분해 row는 값이 길어 라벨 위로 넘치므로 작은 폰트로.
      const valueFontSize = label === '점수 분해' ? '17px' : '26px';
      const valueText = this.add
        .text(panelX + panelW - 20, y, initial, {
          fontFamily: FONT_STACK,
          fontSize: valueFontSize,
          color,
        })
        .setOrigin(1, 0.5);
      if (label === '매출') revenueValueText = valueText;
    });

    // 매출 카운트업 — 0에서 outcome.revenue까지 1500ms.
    if (revenueValueText) {
      const counter = { v: 0 };
      const target: number = o.revenue;
      const ref: Phaser.GameObjects.Text = revenueValueText;
      this.tweens.add({
        targets: counter,
        v: target,
        duration: 1500,
        delay: 250,
        ease: 'Cubic.easeOut',
        onUpdate: () => ref.setText(`+${Math.round(counter.v)} 골드`),
        onComplete: () => ref.setText(`+${target} 골드`),
      });
    }
  }

  // ────────────────────────── office panel ──────────────────────────
  private buildOfficePanel(): void {
    const panelX = this.contentX + (720 - 660) / 2;
    const panelY = 800;
    const panelW = 660;
    // 일러스트 100h + 정보 row + 버튼 2개 + R&D(52h) + 정책 row(52h) + 4버튼 row(52h) + 메일 row(52h+8gap).
    const panelH = 420;

    makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);

    // 사옥 단계 일러스트 — 컴팩트 배너(630×100, 6.3:1).
    // 업그레이드 시 크로스페이드 + 줌 인.
    const illustW = 630;
    const illustH = 100;
    const illustX = panelX + panelW / 2;
    const illustY = panelY + 14 + illustH / 2;
    this.officeIllustration = this.add
      .image(illustX, illustY, OFFICE_ILLUSTRATION[this.officeLevel] ?? OFFICE_ILLUSTRATION[1])
      .setDisplaySize(illustW, illustH)
      .setOrigin(0.5);

    // 라벨 칩 — 일러스트 위 좌상단. 가독성 위해 어두운 배경 위에 노출.
    const chipPadX = 8;
    const chipY = panelY + 22;
    const chipText = this.add
      .text(panelX + 24 + chipPadX, chipY, '사무실', {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        fontStyle: 'bold',
        color: TEXT_COLOR.warn,
      })
      .setOrigin(0, 0);
    const chipBg = this.add.graphics();
    chipBg.fillStyle(0x000000, 0.55);
    chipBg.fillRoundedRect(panelX + 24, chipY - 4, chipText.width + chipPadX * 2, chipText.height + 6, 6);
    chipText.setDepth(chipBg.depth + 1);

    // 상태(단계 + 인원수)는 일러스트 아래 좌측, 골드는 우측.
    const infoRowY = panelY + 14 + illustH + 10;
    this.officeStatusText = this.add.text(panelX + 20, infoRowY, '', {
      fontFamily: FONT_STACK,
      fontSize: '26px',
      color: TEXT_COLOR.primary,
    });

    this.officeGoldText = this.add
      .text(panelX + panelW - 20, infoRowY, '', {
        fontFamily: FONT_STACK,
        fontSize: '26px',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(1, 0);
    this.officeGoldIcon = this.add
      .image(0, infoRowY + 9, ICONS.coins.key)
      .setDisplaySize(16, 16)
      .setOrigin(1, 0.5)
      .setTint(TINT.warn);

    // 두 액션 버튼: 좌(업그레이드), 우(채용). 절반 너비씩.
    const btnY = infoRowY + 28;
    const btnH = 48;
    const halfW = (panelW - 60) / 2; // 20 padding 양쪽 + 20 사이 여백

    const upgradeX = panelX + 20;
    this.upgradeBtnRect = new Phaser.Geom.Rectangle(upgradeX, btnY, halfW, btnH);
    this.upgradeBtnBg = this.add.graphics();
    this.upgradeBtnText = this.add
      .text(upgradeX + halfW / 2, btnY + btnH / 2, '', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
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
      .text(hireX + halfW / 2, btnY + btnH / 2, '채용 (면접)', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    this.hireBtnHit = this.add
      .zone(hireX + halfW / 2, btnY + btnH / 2, halfW, btnH)
      .setInteractive({ useHandCursor: true });
    this.hireBtnHit.on('pointerup', () => this.handleHire());

    // R&D 버튼 — 업그레이드/채용 row와 정책 row 사이.
    // h: 40 → 52 — zoom 0.5 모바일에서 ~26px 물리 크기 확보.
    const rndBtnY = btnY + btnH + 8;
    const rndBtnH = 52;
    const rndBtnW = panelW - 40;
    this.rndBtnRect = new Phaser.Geom.Rectangle(panelX + 20, rndBtnY, rndBtnW, rndBtnH);
    this.rndBtnBg = this.add.graphics();
    this.rndBtnText = this.add
      .text(panelX + 20 + rndBtnW / 2, rndBtnY + rndBtnH / 2, 'R&D 연구소', {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    this.rndBtnHit = this.add
      .zone(panelX + 20 + rndBtnW / 2, rndBtnY + rndBtnH / 2, rndBtnW, rndBtnH)
      .setInteractive({ useHandCursor: true });
    this.rndBtnHit.on('pointerup', () => {
      playSfx(this, SFX.modal, 0.45);
      this.openRndModal();
    });

    // 정책 토글 row — 재택 + 4개 복지 buy. R&D 버튼 아래.
    // h: 40 → 52 (R&D 버튼과 동일하게 터치 타겟 확대).
    this.buildPolicyRow(panelX + 20, rndBtnY + rndBtnH + 8, panelW - 40, 52);

    // 5개 보조 버튼(장비/시설/시장/인수/메일)을 1 row에 컴팩트 배치.
    // h: 52 (터치 타겟). 5등분 narrow but 라벨이 짧음.
    const extraBtnY = rndBtnY + rndBtnH + 8 + 52 + 8;
    const extraBtnH = 52;
    const extraGap = 6;
    const extraW = (panelW - 40 - extraGap * 4) / 5;
    const baseX = panelX + 20;

    // 장비
    const equipX = baseX;
    this.equipBtnRect = new Phaser.Geom.Rectangle(equipX, extraBtnY, extraW, extraBtnH);
    this.equipBtnBg = this.add.graphics();
    this.equipBtnText = this.add
      .text(equipX + extraW / 2, extraBtnY + extraBtnH / 2, '장비', {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    this.equipBtnHit = this.add
      .zone(equipX + extraW / 2, extraBtnY + extraBtnH / 2, extraW, extraBtnH)
      .setInteractive({ useHandCursor: true });
    this.equipBtnHit.on('pointerup', () => {
      playSfx(this, SFX.modal, 0.45);
      this.openEquipmentModal(null);
    });

    // 시설
    const facilX = baseX + (extraW + extraGap);
    this.facilBtnRect = new Phaser.Geom.Rectangle(facilX, extraBtnY, extraW, extraBtnH);
    this.facilBtnBg = this.add.graphics();
    this.facilBtnText = this.add
      .text(facilX + extraW / 2, extraBtnY + extraBtnH / 2, '시설', {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    this.facilBtnHit = this.add
      .zone(facilX + extraW / 2, extraBtnY + extraBtnH / 2, extraW, extraBtnH)
      .setInteractive({ useHandCursor: true });
    this.facilBtnHit.on('pointerup', () => {
      playSfx(this, SFX.modal, 0.45);
      this.openFacilitiesModal();
    });

    // 시장
    const marketX = baseX + (extraW + extraGap) * 2;
    this.marketBtnRect = new Phaser.Geom.Rectangle(marketX, extraBtnY, extraW, extraBtnH);
    this.marketBtnBg = this.add.graphics();
    this.marketBtnText = this.add
      .text(marketX + extraW / 2, extraBtnY + extraBtnH / 2, '시장', {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    this.marketBtnHit = this.add
      .zone(marketX + extraW / 2, extraBtnY + extraBtnH / 2, extraW, extraBtnH)
      .setInteractive({ useHandCursor: true });
    this.marketBtnHit.on('pointerup', () => {
      playSfx(this, SFX.modal, 0.45);
      this.openMarketsModal();
    });

    // 자회사
    const acqX = baseX + (extraW + extraGap) * 3;
    this.acqBtnRect = new Phaser.Geom.Rectangle(acqX, extraBtnY, extraW, extraBtnH);
    this.acqBtnBg = this.add.graphics();
    this.acqBtnText = this.add
      .text(acqX + extraW / 2, extraBtnY + extraBtnH / 2, '인수', {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    this.acqBtnHit = this.add
      .zone(acqX + extraW / 2, extraBtnY + extraBtnH / 2, extraW, extraBtnH)
      .setInteractive({ useHandCursor: true });
    this.acqBtnHit.on('pointerup', () => {
      playSfx(this, SFX.modal, 0.45);
      this.openAcquisitionsModal();
    });

    // 메일 — 5번째 보조 버튼 (장비/시설/시장/인수와 같은 row).
    const mailX = baseX + (extraW + extraGap) * 4;
    this.mailBtnRect = new Phaser.Geom.Rectangle(mailX, extraBtnY, extraW, extraBtnH);
    this.mailBtnBg = this.add.graphics();
    this.mailBtnText = this.add
      .text(mailX + extraW / 2, extraBtnY + extraBtnH / 2, '📬 메일', {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    this.mailBtnHit = this.add
      .zone(mailX + extraW / 2, extraBtnY + extraBtnH / 2, extraW, extraBtnH)
      .setInteractive({ useHandCursor: true });
    this.mailBtnHit.on('pointerup', () => {
      playSfx(this, SFX.modal, 0.45);
      this.openMailInboxModal();
    });

    this.refreshOfficePanel();
  }

  private policyButtons: Array<{
    id: 'remote' | 'shuttle' | 'teamHoodie' | 'espresso' | 'cafeteria';
    bg: Phaser.GameObjects.Graphics;
    text: Phaser.GameObjects.Text;
    rect: Phaser.Geom.Rectangle;
    hit: Phaser.GameObjects.Zone;
  }> = [];

  private buildPolicyRow(x: number, y: number, totalW: number, h: number): void {
    this.policyButtons = [];
    const ids: Array<'remote' | 'shuttle' | 'teamHoodie' | 'espresso' | 'cafeteria'> = [
      'remote',
      'shuttle',
      'teamHoodie',
      'espresso',
      'cafeteria',
    ];
    const gap = 6;
    const btnW = (totalW - gap * (ids.length - 1)) / ids.length;

    ids.forEach((id, i) => {
      const bx = x + i * (btnW + gap);
      const rect = new Phaser.Geom.Rectangle(bx, y, btnW, h);
      const bg = this.add.graphics();
      const text = this.add
        .text(bx + btnW / 2, y + h / 2, '', {
          fontFamily: FONT_STACK,
          fontSize: '20px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
          align: 'center',
          wordWrap: { width: btnW - 8, useAdvancedWrap: true },
        })
        .setOrigin(0.5);
      const hit = this.add
        .zone(bx + btnW / 2, y + h / 2, btnW, h)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.handlePolicyTap(id));
      this.policyButtons.push({ id, bg, text, rect, hit });
    });
  }

  private handlePolicyTap(id: 'remote' | 'shuttle' | 'teamHoodie' | 'espresso' | 'cafeteria'): void {
    if (id === 'remote') {
      playSfx(this, SFX.toggle);
      this.livePolicy = {
        ...this.livePolicy,
        commute: this.livePolicy.commute === 'office' ? 'remote' : 'office',
      };
    } else {
      // 이미 보유한 복지면 무시. 골드 부족하면 무시.
      if (this.livePolicy.perks[id]) return;
      const price = PERK[id].price;
      if (this.liveGold < price) return;
      this.liveGold -= price;
      playSfx(this, SFX.success);
      this.livePolicy = {
        ...this.livePolicy,
        perks: { ...this.livePolicy.perks, [id]: true },
      };
    }
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }

  private refreshOfficePanel(): void {
    if (!this.officeStatusText || !this.officeGoldText) return;
    const cap = BALANCE.officeHireCap[this.officeLevel] ?? 3;
    // liveEmployees는 튜토리얼 + 채용 + 이탈을 모두 반영한 실제 인원.
    const totalEmps = this.liveEmployees.length;
    const companyName = loadData()?.companyName ?? DEFAULT_COMPANY_NAME;
    this.officeStatusText.setText(`${companyName} — ${OFFICE_STAGE_LABEL[this.officeLevel] ?? '?'} — 고용 ${totalEmps}/${cap}명`);
    this.officeGoldText.setText(formatGold(this.liveGold));
    // 코인 아이콘은 골드 텍스트 좌측, 텍스트 폭이 변하므로 동적으로 위치 보정.
    if (this.officeGoldIcon) {
      const textLeft = this.officeGoldText.x - this.officeGoldText.width;
      this.officeGoldIcon.setX(textLeft - 6);
    }

    // 업그레이드 버튼 상태·라벨 결정 — 데이터 기반(BALANCE.officeUpgradeCostBy + OFFICE_STAGE_LABEL).
    let upgradeBtnLabel: string;
    let canUpgrade: boolean;
    const nextLevel = (this.officeLevel + 1) as OfficeLevel;
    const nextCost = (BALANCE.officeUpgradeCostBy as Record<number, number | undefined>)[nextLevel];
    const nextLabel = OFFICE_STAGE_LABEL[nextLevel];
    if (nextCost !== undefined && nextLabel) {
      canUpgrade = this.liveGold >= nextCost;
      upgradeBtnLabel = canUpgrade
        ? `${nextLabel}로 (-${nextCost}g)`
        : `${nextLabel} (${this.liveGold}/${nextCost}g)`;
    } else {
      canUpgrade = false;
      upgradeBtnLabel = '사옥 최대 단계 ✓';
    }
    if (this.upgradeBtnText) this.upgradeBtnText.setText(upgradeBtnLabel);

    // 채용 버튼 상태 — officeLevel >= 2에서 가능.
    const canHire = this.officeLevel >= 2 && totalEmps < cap;

    this.drawSecondaryButton(this.upgradeBtnBg, this.upgradeBtnText, this.upgradeBtnRect, this.upgradeBtnHit, canUpgrade);
    this.drawSecondaryButton(this.hireBtnBg, this.hireBtnText, this.hireBtnRect, this.hireBtnHit, canHire);

    if (this.hireBtnText) {
      if (this.officeLevel < 2) {
        this.hireBtnText.setText('채용 (사옥 2단계 필요)');
      } else if (totalEmps >= cap) {
        this.hireBtnText.setText(`채용 (정원 ${cap}/${cap})`);
      } else {
        this.hireBtnText.setText(`채용 (면접) ${totalEmps}/${cap}`);
      }
    }

    // R&D 버튼 — 항상 활성. 구매 개수 + 진행 상황 표시.
    const rndCount = this.liveRnd.purchased.length;
    const rndTotal = RND_ITEMS.length;
    if (this.rndBtnText) {
      const rndProg = this.liveRnd.progress;
      let rndBtnLabel = `R&D 연구소 (${rndCount}/${rndTotal})`;
      if (rndProg && rndProg.inProgress !== null) {
        const progItem = RND_ITEMS.find((r) => r.id === rndProg.inProgress);
        const shortName = progItem ? progItem.name : '연구';
        rndBtnLabel = `R&D ${rndCount}/${rndTotal} (연구중: ${shortName} ${rndProg.weeksRemaining}주)`;
      }
      this.rndBtnText.setText(rndBtnLabel);
    }
    this.drawSecondaryButton(this.rndBtnBg, this.rndBtnText, this.rndBtnRect, this.rndBtnHit, true);

    // 장비/시설 버튼 — 항상 활성.
    const builtCount = this.liveFacilities.built.length;
    const facilTotal = FACILITIES.length;
    if (this.facilBtnText) {
      this.facilBtnText.setText(`시설 ${builtCount}/${facilTotal}`);
    }
    this.drawSecondaryButton(this.equipBtnBg, this.equipBtnText, this.equipBtnRect, this.equipBtnHit, true);
    this.drawSecondaryButton(this.facilBtnBg, this.facilBtnText, this.facilBtnRect, this.facilBtnHit, true);

    // 시장 버튼 — 항상 활성. 진출 개수 표시.
    const marketCount = this.liveMarkets.entered.length;
    const marketTotal = MARKETS.length;
    if (this.marketBtnText) {
      this.marketBtnText.setText(`시장 ${marketCount}/${marketTotal}`);
    }
    this.drawSecondaryButton(this.marketBtnBg, this.marketBtnText, this.marketBtnRect, this.marketBtnHit, true);

    // 자회사 인수 버튼 — 완료 개수 표시.
    const acqCount = this.liveAcquisitions.completed.length;
    const acqTotal = ACQUISITIONS.length;
    if (this.acqBtnText) {
      this.acqBtnText.setText(`인수 ${acqCount}/${acqTotal}`);
    }
    this.drawSecondaryButton(this.acqBtnBg, this.acqBtnText, this.acqBtnRect, this.acqBtnHit, true);

    // 메일 버튼 — 안 읽은 메일 수 표시.
    const unreadCount = this.liveMails.filter((m) => !m.read).length;
    const totalMailCount = this.liveMails.length;
    if (this.mailBtnText) {
      const mailLabel = unreadCount > 0
        ? `📬 메일함 (안 읽음 ${unreadCount})`
        : `📬 메일함 (${totalMailCount}건)`;
      this.mailBtnText.setText(mailLabel);
    }
    this.drawSecondaryButton(this.mailBtnBg, this.mailBtnText, this.mailBtnRect, this.mailBtnHit, true);

    // 정책 토글 row 색·텍스트 갱신.
    for (const btn of this.policyButtons) {
      let active = false;
      let label = '';
      let affordable = true;
      if (btn.id === 'remote') {
        active = this.livePolicy.commute === 'remote';
        label = active ? '재택 ON' : '출근';
      } else {
        active = this.livePolicy.perks[btn.id];
        const price = PERK[btn.id].price;
        const perkLabel = PERK[btn.id].label;
        affordable = active || this.liveGold >= price;
        label = active ? `${perkLabel}\n(완료)` : `${perkLabel}\n-${price}g`;
      }
      const fill = !affordable
        ? COLOR.btnDisabled
        : active
          ? COLOR.btn
          : COLOR.btnSecondary;
      btn.bg.clear();
      btn.bg.fillStyle(fill, 1);
      btn.bg.fillRoundedRect(btn.rect.x, btn.rect.y, btn.rect.width, btn.rect.height, 10);
      btn.text.setText(label).setColor(affordable ? TEXT_COLOR.primary : TEXT_COLOR.disabled);
      if (btn.hit.input) btn.hit.input.enabled = affordable && !active;
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
    // 데이터 기반 — 다음 단계 cost·illustration이 정의되어 있을 때만 진행.
    const nextLevel = (this.officeLevel + 1) as OfficeLevel;
    const cost = (BALANCE.officeUpgradeCostBy as Record<number, number | undefined>)[nextLevel];
    const nextIllust = OFFICE_ILLUSTRATION[nextLevel];
    if (cost === undefined || !nextIllust) return; // 최대 단계.
    if (this.liveGold < cost) return;
    this.liveGold -= cost;
    this.officeLevel = nextLevel;
    this.crossfadeIllustration(nextIllust);
    this.persistResult();
    playSfx(this, SFX.success, 0.5);
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }

  private handleHire(): void {
    if (this.officeLevel < 2) return;
    const cap = BALANCE.officeHireCap[this.officeLevel] ?? 3;
    if (this.liveEmployees.length >= cap) return;
    playSfx(this, SFX.modal, 0.45);
    this.openInterviewModal();
  }

  // ────────────────────────── track choice modal ──────────────────────────
  /** 새로 senior로 진급한 직원 중 track 미선택자에 대해 차례로 모달 표시. */
  private queueTrackChoiceModalsIfNeeded(): void {
    const pending = this.liveEmployees.filter(
      (e) => e.rank === 'senior' && e.track === undefined,
    );
    if (pending.length === 0) return;
    // 첫 결과 등장 후 살짝 늦춰 모달 등장 — 결과 발표 분위기 보존.
    this.time.delayedCall(2200, () => this.showNextTrackModal([...pending]));
  }

  private showNextTrackModal(queue: Employee[]): void {
    const target = queue.shift();
    if (!target) return;
    playSfx(this, SFX.modal, 0.45);

    const layer = this.add.container(0, 0).setDepth(160);
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.7)
      .setOrigin(0, 0)
      .setInteractive();
    layer.add(overlay);

    const panelW = 580;
    const panelH = 460;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panelY = Math.max(0, (1280 - panelH) / 2);
    const panel = makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);
    layer.add(panel);

    layer.add(
      this.add.text(panelX + 24, panelY + 18, '진급 분기', {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        fontStyle: 'bold',
        color: TEXT_COLOR.warn,
      }),
    );
    layer.add(
      this.add.text(panelX + 24, panelY + 42, `${target.name} 시니어 진급`, {
        fontFamily: FONT_STACK,
        fontSize: '30px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      }),
    );
    layer.add(
      this.add.text(panelX + 24, panelY + 78, '커리어 트랙을 선택해 주세요. 이후 변경 불가.', {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: panelW - 48 },
      }),
    );

    const cardY = panelY + 116;
    const cardW = (panelW - 48 - 14) / 2;
    const cardH = 280;

    this.buildTrackCard(
      layer,
      panelX + 24,
      cardY,
      cardW,
      cardH,
      'manager',
      '관리 트랙',
      '팀이 조용히 굴러간다',
      ['개인 효율 ×0.95 (살짝 ↓)', '팀 보너스 발현 (lead 도달 전부터 +0.5단위)', '안정적 성장'],
      () => this.applyTrackChoice(target, 'manager', queue, layer),
    );
    this.buildTrackCard(
      layer,
      panelX + 24 + cardW + 14,
      cardY,
      cardW,
      cardH,
      'ic',
      '실무 트랙',
      '키보드 화력으로 밀어붙임',
      ['개인 효율 ×1.15 (↑)', '팀 보너스 없음', '단독 화력형 성장'],
      () => this.applyTrackChoice(target, 'ic', queue, layer),
    );
  }

  private buildTrackCard(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    track: Track,
    title: string,
    subtitle: string,
    bullets: ReadonlyArray<string>,
    onPick: () => void,
  ): void {
    layer.add(makePanel(this, x, y, w, h, COLOR.panelEmpty, false));
    layer.add(
      this.add.text(x + 14, y + 14, title, {
        fontFamily: FONT_STACK,
        fontSize: '29px',
        fontStyle: 'bold',
        color: track === 'manager' ? TEXT_COLOR.warn : TEXT_COLOR.ok,
      }),
    );
    layer.add(
      this.add.text(x + 14, y + 38, subtitle, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: w - 28 },
      }),
    );
    bullets.forEach((b, i) => {
      layer.add(
        this.add.text(x + 14, y + 70 + i * 32, `· ${b}`, {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          color: TEXT_COLOR.primary,
          wordWrap: { width: w - 28 },
        }),
      );
    });

    // 선택 버튼.
    const btnY = y + h - 50;
    const btnX = x + 14;
    const btnW = w - 28;
    const btnH = 40;
    const btnBg = this.add.graphics();
    btnBg.fillStyle(COLOR.btn, 1);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    layer.add(btnBg);
    layer.add(
      this.add
        .text(btnX + btnW / 2, btnY + btnH / 2, '선택', {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5),
    );
    const hit = this.add
      .zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    layer.add(hit);
    hit.on('pointerup', () => {
      // 진급 트랙 선택 — promote alias 사용.
      playSfx(this, SFX.promote);
      onPick();
    });
  }

  private applyTrackChoice(
    target: Employee,
    track: Track,
    remaining: Employee[],
    layer: Phaser.GameObjects.Container,
  ): void {
    this.liveEmployees = this.liveEmployees.map((e) =>
      e.id === target.id ? { ...e, track } : e,
    );
    // 채용으로 추가된 직원이라면 hiredEmployees에도 동기화.
    this.hiredEmployees = this.hiredEmployees.map((e) =>
      e.id === target.id ? { ...e, track } : e,
    );
    this.persistResult();
    layer.destroy();
    // 다음 모달 (있다면).
    if (remaining.length > 0) this.showNextTrackModal(remaining);
  }

  // ────────────────────────── interview modal ──────────────────────────
  private openInterviewModal(): void {
    // 추천 후보 등장 조건 — 평균 morale 임계 도달 + 확률.
    const fakeState = { employees: this.liveEmployees } as { employees: ReadonlyArray<Employee> };
    const morale = avgMorale(fakeState as unknown as import('@/domain/types').GameState);
    const isReferral =
      morale >= REFERRAL_AVG_MORALE_THRESHOLD && Math.random() < REFERRAL_PROBABILITY;
    // 추천 1명 + 일반 2명 vs 일반 3명. 추천 등장 시 가장 morale 높은 직원 이름을 추천인으로.
    let candidates: ReadonlyArray<HireCandidate>;
    if (isReferral) {
      const topMorale = [...this.liveEmployees].sort((a, b) => b.morale - a.morale)[0];
      const referrerName = topMorale?.name;
      candidates = [pickReferralCandidate(referrerName), ...pickHireCandidates(2)];
    } else {
      candidates = pickHireCandidates(3);
    }
    const panelW = 600;
    const panelH = 720;
    const modal = createModal(this, {
      w: panelW,
      h: panelH,
      y: 200,
      category: 'hire',
      title: '면접',
      subtitle: '후보 3명 중 한 명을 채용',
      depth: 150,
    });
    const { layer } = modal;
    const { x: panelX, y: panelY } = modal.panel;

    // 카드들.
    const cardX = panelX + 24;
    const cardW = panelW - 48;
    const cardH = 168;
    const cardGap = 14;
    const cardsY0 = panelY + 90;
    // 채용 비용 할인 배수 — UI 표시용.
    let hireCostMul = 1.0;
    if (isRndPurchased(this.liveRnd, 'employer-branding'))    hireCostMul = Math.min(hireCostMul, 0.7);
    if (isRndPurchased(this.liveRnd, 'remote-collaboration')) hireCostMul = Math.min(hireCostMul, 0.5);
    if (isRndPurchased(this.liveRnd, 'global-hr-network'))    hireCostMul = Math.min(hireCostMul, 0.4);
    // 인플레이션 — UI 표시에도 반영.
    const hirePcInflation = inflationMultiplier(this.outcome.state.productIndex + 1);
    candidates.forEach((c, i) => {
      const cy = cardsY0 + i * (cardH + cardGap);
      const baseEff = hireCostMul < 1.0 ? Math.round(c.hireCost * hireCostMul) : c.hireCost;
      const effCost = Math.round(baseEff * hirePcInflation);
      this.buildCandidateCard(layer, cardX, cy, cardW, cardH, c, effCost, () => {
        modal.close();
        this.applyHire(c);
      });
    });

    // 나중에(취소) 버튼.
    const cancelBtn = createButton(this, {
      x: panelX + 24,
      y: panelY + panelH - 60,
      w: panelW - 48,
      h: 44,
      label: '나중에',
      variant: 'secondary',
      size: 'md',
      onTap: () => {
        playSfx(this, SFX.tap);
        modal.close();
      },
    });
    layer.add(cancelBtn.bg);
    layer.add(cancelBtn.text);
    layer.add(cancelBtn.hit);
  }

  private buildCandidateCard(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    c: HireCandidate,
    effectiveCost: number,
    onHire: () => void,
  ): void {
    const affordable = this.liveGold >= effectiveCost;
    const card = makePanel(this, x, y, w, h, COLOR.panelEmpty, false);
    layer.add(card);

    // 직군 라벨 + 이름
    layer.add(
      this.add.text(x + 16, y + 14, JOB_LABEL[c.job], {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        fontStyle: 'bold',
        color: TEXT_COLOR.warn,
      }),
    );
    layer.add(
      this.add.text(x + 16, y + 32, c.name, {
        fontFamily: FONT_STACK,
        fontSize: '29px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      }),
    );

    // 우상단 rank + 비용
    layer.add(
      this.add
        .text(x + w - 16, y + 14, RANK_LABEL[c.rank], {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          color: TEXT_COLOR.dim,
        })
        .setOrigin(1, 0),
    );
    layer.add(
      this.add
        .text(x + w - 16, y + 30, effectiveCost < c.hireCost ? `-${effectiveCost}g (할인)` : `-${effectiveCost}g`, {
          fontFamily: FONT_STACK,
          fontSize: '26px',
          fontStyle: 'bold',
          color: affordable ? TEXT_COLOR.ok : TEXT_COLOR.bad,
        })
        .setOrigin(1, 0),
    );

    // 한 줄 소개
    layer.add(
      this.add.text(x + 16, y + 60, c.tagline, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: w - 32 },
      }),
    );

    // 스킬·이력·성장률·트레이트 라인. 성장률은 평균(1.0) 대비 표시.
    const growthPct = Math.round(((c.growthRate ?? 1.0) - 1.0) * 100);
    const growthStr =
      growthPct === 0 ? '성장 ±0%' : growthPct > 0 ? `성장 +${growthPct}%` : `성장 ${growthPct}%`;
    const stats = [
      `스킬 ${(c.skill * 100).toFixed(0)}%`,
      `출시 ${c.shippedProjects}회`,
      growthStr,
      c.trait ? `· ${TRAIT_LABEL[c.trait]}` : null,
    ].filter((s): s is string => s !== null);
    layer.add(
      this.add.text(x + 16, y + 88, stats.join('  ·  '), {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        color: TEXT_COLOR.primary,
      }),
    );

    // 채용 버튼
    const btnY = y + h - 50;
    const btnX = x + 16;
    const btnW = w - 32;
    const btnH = 40;
    const btnRect = new Phaser.Geom.Rectangle(btnX, btnY, btnW, btnH);
    const btnBg = this.add.graphics();
    btnBg.fillStyle(affordable ? COLOR.btn : COLOR.btnDisabled, 1);
    btnBg.fillRoundedRect(btnRect.x, btnRect.y, btnRect.width, btnRect.height, 10);
    layer.add(btnBg);
    layer.add(
      this.add
        .text(btnX + btnW / 2, btnY + btnH / 2, affordable ? '이 후보 채용' : '골드 부족', {
          fontFamily: FONT_STACK,
          fontSize: '23px',
          fontStyle: 'bold',
          color: affordable ? TEXT_COLOR.primary : TEXT_COLOR.disabled,
        })
        .setOrigin(0.5),
    );
    if (affordable) {
      const hit = this.add
        .zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      layer.add(hit);
      hit.on('pointerup', () => {
        // 직원 채용 — buy alias 사용.
        playSfx(this, SFX.buy);
        onHire();
      });
    }
  }

  private applyHire(c: HireCandidate): void {
    if (this.officeLevel < 2) return;
    // 채용 비용 할인 — employer-branding(0.7) / remote-collaboration(0.5) / global-hr-network(0.4)
    // 가장 큰 할인(가장 작은 배수) 적용.
    let costMul = 1.0;
    if (isRndPurchased(this.liveRnd, 'employer-branding'))    costMul = Math.min(costMul, 0.7);
    if (isRndPurchased(this.liveRnd, 'remote-collaboration')) costMul = Math.min(costMul, 0.5);
    if (isRndPurchased(this.liveRnd, 'global-hr-network'))    costMul = Math.min(costMul, 0.4);
    // 인플레이션 적용 — 5년차마다 채용 비용 ×1.2.
    const productCount = this.outcome.state.productIndex + 1;
    const inflation = inflationMultiplier(productCount);
    const baseEffCost = costMul < 1.0 ? Math.round(c.hireCost * costMul) : c.hireCost;
    const effCost = Math.round(baseEffCost * inflation);
    if (this.liveGold < effCost) return;
    const cap = BALANCE.officeHireCap[this.officeLevel] ?? 3;
    if (this.liveEmployees.length >= cap) return;
    this.liveGold -= effCost;
    // HireCandidate에서 Employee 전용 필드만 추려 저장(보관 시 hireCost/tagline 제외).
    const { tagline: _t, hireCost: _c, ...baseEmp } = c;
    void _t;
    void _c;
    // R&D: 글로벌 채용 네트워크 — 후보 growthRate +0.2.
    const emp = isRndPurchased(this.liveRnd, 'global-hr-network')
      ? { ...baseEmp, growthRate: (baseEmp.growthRate ?? 1.0) + 0.2 }
      : baseEmp;
    this.hiredEmployees = [...this.hiredEmployees, emp];
    this.liveEmployees = [...this.liveEmployees, emp];
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }

  // ────────────────────────── R&D modal ──────────────────────────
  /** R&D 모달 — 현재 활성 tier(reopens마다 리셋). */
  private rndActiveTier: 1 | 2 | 3 | 4 | 5 = 1;

  // 옛 addModalCloseX 헬퍼는 createModal로 대체되어 제거됨.

  private openRndModal(): void {
    this.rndActiveTier = 1;
    this.renderRndModal();
  }

  private renderRndModal(): void {
    const productCount = this.outcome.state.productIndex + 1;
    // 기존 layer 제거 (탭 전환 시 재생성).
    this.children.list
      .filter((c) => (c as Phaser.GameObjects.Container).getData?.('rndModal'))
      .forEach((c) => c.destroy());

    // 활성 tier의 아이템만 필터링.
    const tier = this.rndActiveTier;
    const items = RND_ITEMS.filter((it) => getRndTier(it.id) === tier);

    const cardH = 132;
    const cardGap = 10;
    const headerH = 130;
    const footerH = 60;
    const panelW = 600;
    const panelH = headerH + items.length * (cardH + cardGap) - cardGap + footerH + 16;

    const modal = createModal(this, {
      w: panelW,
      h: panelH,
      category: 'rnd',
      title: 'R&D 연구소',
      subtitle: '영구 업그레이드 — 한 번 구매하면 모든 프로젝트에 적용',
      depth: 150,
      // 탭 전환 재생성 시 slide-up이 매번 재생되면 거슬려서 첫 진입 외엔 끄고 싶지만,
      // 단순화 위해 tier 1 진입 시에만 애니메이트.
      animate: tier === 1,
    });
    const { layer } = modal;
    const { x: panelX, y: panelY } = modal.panel;
    layer.setData('rndModal', true);

    // Tier 탭.
    const tabY = panelY + 76;
    const tabH = 40;
    // 5탭(T1~T5) — 너비 자동 분할.
    const tabCount = 5;
    const tabW = (panelW - 48 - (tabCount - 1) * 8) / tabCount;
    const tierLabels: Array<{ tier: 1 | 2 | 3 | 4 | 5; label: string; count: number }> = [
      { tier: 1, label: 'T1', count: RND_ITEMS.filter((i) => getRndTier(i.id) === 1).length },
      { tier: 2, label: 'T2', count: RND_ITEMS.filter((i) => getRndTier(i.id) === 2).length },
      { tier: 3, label: 'T3', count: RND_ITEMS.filter((i) => getRndTier(i.id) === 3).length },
      { tier: 4, label: 'T4', count: RND_ITEMS.filter((i) => getRndTier(i.id) === 4).length },
      { tier: 5, label: 'T5', count: RND_ITEMS.filter((i) => getRndTier(i.id) === 5).length },
    ];
    tierLabels.forEach((t, i) => {
      const tx = panelX + 24 + i * (tabW + 8);
      const isActive = t.tier === tier;
      const tabBg = this.add.graphics();
      tabBg.fillStyle(isActive ? COLOR.btn : COLOR.btnSecondary, 1);
      tabBg.fillRoundedRect(tx, tabY, tabW, tabH, 10);
      layer.add(tabBg);
      const purchasedInTier = RND_ITEMS.filter(
        (it) => getRndTier(it.id) === t.tier && this.liveRnd.purchased.includes(it.id),
      ).length;
      layer.add(
        this.add
          .text(tx + tabW / 2, tabY + tabH / 2, `${t.label} ${purchasedInTier}/${t.count}`, {
            fontFamily: FONT_STACK,
            fontSize: '17px',
            fontStyle: 'bold',
            color: isActive ? TEXT_COLOR.primary : TEXT_COLOR.dim,
          })
          .setOrigin(0.5),
      );
      const tabHit = this.add
        .zone(tx + tabW / 2, tabY + tabH / 2, tabW, tabH)
        .setInteractive({ useHandCursor: true });
      tabHit.on('pointerup', () => {
        if (this.rndActiveTier === t.tier) return;
        playSfx(this, SFX.tap);
        this.rndActiveTier = t.tier;
        this.renderRndModal();
      });
      layer.add(tabHit);
    });

    // 카드들.
    const cardsY0 = panelY + headerH;
    const cardX = panelX + 20;
    const cardW = panelW - 40;
    items.forEach((item, i) => {
      const cy = cardsY0 + i * (cardH + cardGap);
      this.buildRndCard(layer, cardX, cy, cardW, cardH, item, productCount, () => {
        modal.close();
        this.applyRndPurchase(item.id);
      });
    });

    // 하단 닫기 버튼 (footer) — createButton.
    const closeY = panelY + panelH - footerH + 8;
    const closeBtn = createButton(this, {
      x: panelX + 24,
      y: closeY,
      w: panelW - 48,
      h: 40,
      label: '닫기',
      variant: 'secondary',
      size: 'md',
      onTap: () => {
        playSfx(this, SFX.tap);
        modal.close();
      },
    });
    layer.add(closeBtn.bg);
    layer.add(closeBtn.text);
    layer.add(closeBtn.hit);
  }

  private buildRndCard(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    item: (typeof RND_ITEMS)[number],
    productCount: number,
    onBuy: () => void,
  ): void {
    const purchased = isRndPurchased(this.liveRnd, item.id);
    const available = isRndAvailable(this.liveRnd, item, productCount, this.officeLevel);
    const affordable = this.liveGold >= item.cost;
    // 연구 진행 상태 확인.
    // stale progress 방어: weeksRemaining<=0이거나 inProgress가 RND_ITEMS에 없으면 무효.
    const rawProg = this.liveRnd.progress;
    const validProg =
      rawProg && rawProg.inProgress && rawProg.weeksRemaining > 0 &&
      RND_ITEMS.some((r) => r.id === rawProg.inProgress)
        ? rawProg
        : undefined;
    const prog = validProg;
    const isThisInProgress = prog?.inProgress === item.id;
    const otherInProgress = !!prog && prog.inProgress !== item.id;

    layer.add(makePanel(this, x, y, w, h, COLOR.panelEmpty, false));

    // 티어 배지 — 좌상단 작은 T1/T2/T3 칩.
    const tier = getRndTier(item.id);
    const tierLabel = `T${tier}`;
    const tierColor =
      tier === 5 ? '#d946ef' :
      tier === 4 ? '#ff5722' :
      tier === 3 ? TEXT_COLOR.ok :
      tier === 2 ? TEXT_COLOR.warn :
      TEXT_COLOR.primary;
    layer.add(
      this.add.text(x + 8, y + 8, tierLabel, {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        fontStyle: 'bold',
        color: tierColor,
      }),
    );

    // 이름 — 티어 배지 너비만큼 오른쪽으로 밀기.
    layer.add(
      this.add.text(x + 32, y + 12, item.name, {
        fontFamily: FONT_STACK,
        fontSize: '26px',
        fontStyle: 'bold',
        color: purchased ? TEXT_COLOR.dim : TEXT_COLOR.primary,
      }),
    );

    // 효과 라벨 (우상단)
    layer.add(
      this.add
        .text(x + w - 16, y + 12, item.effectLabel, {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          color: TEXT_COLOR.ok,
        })
        .setOrigin(1, 0),
    );

    // 설명
    layer.add(
      this.add.text(x + 16, y + 34, item.desc, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: w - 32 },
      }),
    );

    // 구매 버튼 영역
    const btnY = y + h - 38;
    const btnX = x + 16;
    const btnW = w - 32;
    const btnH = 30;

    if (purchased) {
      // 구매 완료.
      const doneBg = this.add.graphics();
      doneBg.fillStyle(COLOR.btnDisabled, 1);
      doneBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(doneBg);
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, '✓ 구매 완료', {
            fontFamily: FONT_STACK,
            fontSize: '21px',
            color: TEXT_COLOR.disabled,
          })
          .setOrigin(0.5),
      );
    } else if (isThisInProgress) {
      // 연구 진행 중 — 진행 상황 표시.
      const weeks = RND_RESEARCH_WEEKS[item.id];
      const remaining = prog?.weeksRemaining ?? 0;
      const elapsed = weeks - remaining;
      const inProgBg = this.add.graphics();
      inProgBg.fillStyle(0x1a2a3a, 1);
      inProgBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(inProgBg);
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, `⏳ 연구 중 (${elapsed}/${weeks}주 완료)`, {
            fontFamily: FONT_STACK,
            fontSize: '21px',
            fontStyle: 'bold',
            color: TEXT_COLOR.warn,
          })
          .setOrigin(0.5),
      );
    } else if (!available) {
      // 잠금 — 선행 R&D 또는 productCount 조건 미충족.
      const lockBg = this.add.graphics();
      lockBg.fillStyle(COLOR.btnDisabled, 1);
      lockBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(lockBg);
      const lockParts: string[] = [];
      if (item.minProductCount !== undefined && productCount < item.minProductCount) {
        lockParts.push(`${item.minProductCount}번째 출시 후 해금`);
      }
      if (item.minOfficeLevel !== undefined && this.officeLevel < item.minOfficeLevel) {
        lockParts.push(`사옥 ${item.minOfficeLevel}단계 필요`);
      }
      if (item.requires) {
        const missing = item.requires.filter((r) => !isRndPurchased(this.liveRnd, r));
        if (missing.length > 0) lockParts.push(`선행: ${missing.join(', ')}`);
      }
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, `🔒 ${lockParts.join(' / ')}`, {
            fontFamily: FONT_STACK,
            fontSize: '20px',
            color: TEXT_COLOR.disabled,
          })
          .setOrigin(0.5),
      );
    } else if (otherInProgress) {
      // 다른 R&D 연구 중 — 비활성.
      const busyBg = this.add.graphics();
      busyBg.fillStyle(COLOR.btnDisabled, 1);
      busyBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(busyBg);
      const progId = prog?.inProgress;
      const progItem = progId ? RND_ITEMS.find((r) => r.id === progId) : null;
      const progName = progItem ? progItem.name : '연구';
      const progRemaining = prog?.weeksRemaining ?? 0;
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, `⏳ ${progName} 연구 중 (${progRemaining}주 남음)`, {
            fontFamily: FONT_STACK,
            fontSize: '20px',
            color: TEXT_COLOR.disabled,
          })
          .setOrigin(0.5),
      );
    } else {
      // 구매 가능 또는 골드 부족.
      const canBuy = affordable;
      const buyBg = this.add.graphics();
      buyBg.fillStyle(canBuy ? COLOR.btn : COLOR.btnDisabled, 1);
      buyBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(buyBg);
      const totalWeeks = RND_RESEARCH_WEEKS[item.id];
      const buyLabel = canBuy ? `연구 시작 (−${item.cost}g · ${totalWeeks}주)` : `골드 부족 (필요 ${item.cost}g)`;
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, buyLabel, {
            fontFamily: FONT_STACK,
            fontSize: '21px',
            fontStyle: 'bold',
            color: canBuy ? TEXT_COLOR.primary : TEXT_COLOR.bad,
          })
          .setOrigin(0.5),
      );
      if (canBuy) {
        const hit = this.add
          .zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        layer.add(hit);
        hit.on('pointerup', () => {
          // R&D 연구 시작.
          playSfx(this, SFX.buy);
          onBuy();
        });
      }
    }
  }

  private applyRndPurchase(id: (typeof RND_ITEMS)[number]['id']): void {
    const item = RND_ITEMS.find((r) => r.id === id);
    if (!item) return;
    if (isRndPurchased(this.liveRnd, id)) return;
    // 이미 다른 R&D 연구 중이면 시작 불가.
    const prog = this.liveRnd.progress;
    if (prog && prog.inProgress !== null) return;
    if (this.liveGold < item.cost) return;
    this.liveGold -= item.cost;
    // 즉시 구매 대신 연구 시작 — advanceWeek���서 매��� 카운트다운.
    let weeks = RND_RESEARCH_WEEKS[id];
    // 시설: 이노베이션 랩 — 모든 R&D 연구 시간 −2주(최소 1주).
    if (isFacilityBuilt(this.liveFacilities, 'innovation-lab')) {
      weeks = Math.max(1, weeks - 2);
    }
    this.liveRnd = {
      ...this.liveRnd,
      progress: { inProgress: id, weeksRemaining: weeks },
    };
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }

  // ────────────────────────── 장비 modal ──────────────────────────
  /**
   * 장비 관리 모달.
   * @param focusEmpId 처음부터 특정 직원을 선택한 상태로 열 때 사용 (null이면 첫 직원).
   */
  private openEquipmentModal(focusEmpId: string | null): void {
    // 선택 직원 인덱스.
    const emps = [...this.liveEmployees];
    let selectedIdx = focusEmpId
      ? Math.max(0, emps.findIndex((e) => e.id === focusEmpId))
      : 0;

    const tabCols = 6;
    const tabH = 36;
    const tabGap = 6;
    const tabRowGap = 6;
    const tabRows = Math.max(1, Math.ceil(emps.length / tabCols));
    const tabsBlockH = tabRows * tabH + (tabRows - 1) * tabRowGap;

    const slotCardH = 64;
    const slotGap = 8;
    const slotsH = 4 * slotCardH + 3 * slotGap;
    const panelW = 620;
    const panelH = Math.min(1240, 80 + tabsBlockH + 8 + 16 + slotsH + 16 + 48 + 16);

    const modal = createModal(this, {
      w: panelW,
      h: panelH,
      y: 60,
      category: 'hire',
      title: '장비 관리',
      subtitle: '직원별 개인 장비 (4슬롯) — 업그레이드 시 효율·컨디션 ↑',
      depth: 150,
    });
    const { layer } = modal;
    const { x: panelX, y: panelY } = modal.panel;

    // 직원 탭 grid — 6열 wrap. 24명까지 4행.
    const tabsY = panelY + 76;
    const tabW = (panelW - 48 - tabGap * (tabCols - 1)) / tabCols;
    const empTabs: Array<{
      bg: Phaser.GameObjects.Graphics;
      text: Phaser.GameObjects.Text;
    }> = [];
    const slotsContainerY = tabsY + tabsBlockH + 16;
    const slotsContainer = this.add.container(panelX + 24, slotsContainerY);
    layer.add(slotsContainer);

    const rebuildSlots = (empIdx: number): void => {
      slotsContainer.removeAll(true);
      const emp = emps[empIdx];
      if (!emp) return;
      const currentEq: EmployeeEquipment = emp.equipment ?? {};
      const slots: EquipmentSlot[] = ['desk', 'chair', 'monitor', 'laptop'];
      slots.forEach((slot, si) => {
        const sy = si * (slotCardH + slotGap);
        const cardW = panelW - 48;
        // 슬롯 카드 배경.
        const cardBg = this.add.graphics();
        cardBg.fillStyle(COLOR.panelEmpty, 1);
        cardBg.fillRoundedRect(0, sy, cardW, slotCardH, 8);
        slotsContainer.add(cardBg);

        const currentTier = currentEq[slot] ?? 0;
        const slotName = SLOT_LABEL[slot];

        // 슬롯 이름.
        slotsContainer.add(
          this.add.text(12, sy + 10, slotName, {
            fontFamily: FONT_STACK,
            fontSize: '22px',
            fontStyle: 'bold',
            color: TEXT_COLOR.warn,
          }),
        );

        // 현재 tier 표시.
        const tierLabel = currentTier > 0
          ? `Tier ${currentTier} — ${EQUIPMENT_TIERS[currentTier - 1]?.name ?? ''}`
          : '미장착';
        slotsContainer.add(
          this.add.text(12, sy + 32, tierLabel, {
            fontFamily: FONT_STACK,
            fontSize: '20px',
            color: currentTier > 0 ? TEXT_COLOR.ok : TEXT_COLOR.dim,
          }),
        );

        // 다음 tier 구매 버튼.
        const nextTier = currentTier + 1;
        if (nextTier <= 5) {
          const nextDef = EQUIPMENT_TIERS[nextTier - 1];
          if (nextDef) {
            const canAfford = this.liveGold >= nextDef.cost;
            const btnW = 200;
            const btnH = 34;
            const btnX = cardW - btnW - 12;
            const btnY2 = sy + (slotCardH - btnH) / 2;
            const btnBg = this.add.graphics();
            btnBg.fillStyle(canAfford ? COLOR.btn : COLOR.btnDisabled, 1);
            btnBg.fillRoundedRect(btnX, btnY2, btnW, btnH, 8);
            slotsContainer.add(btnBg);
            const btnLabel = `Tier ${nextTier} ${nextDef.name} (−${nextDef.cost}g)`;
            const btnTxt = this.add
              .text(btnX + btnW / 2, btnY2 + btnH / 2, btnLabel, {
                fontFamily: FONT_STACK,
                fontSize: '18px',
                fontStyle: 'bold',
                color: canAfford ? TEXT_COLOR.primary : TEXT_COLOR.bad,
              })
              .setOrigin(0.5);
            slotsContainer.add(btnTxt);
            if (canAfford) {
              const hit = this.add
                .zone(btnX + btnW / 2, btnY2 + btnH / 2, btnW, btnH)
                .setInteractive({ useHandCursor: true });
              slotsContainer.add(hit);
              hit.on('pointerup', () => {
                // 장비 구매 — buy alias 사용.
                playSfx(this, SFX.buy);
                this.applyEquipmentPurchase(empIdx, slot, nextTier, nextDef.cost);
                // 레이어 재구성 (모달 재오픈).
                layer.destroy();
                this.openEquipmentModal(this.liveEmployees[empIdx]?.id ?? null);
              });
            }
          }
        } else {
          // 최고 tier 도달.
          slotsContainer.add(
            this.add
              .text(cardW - 12, sy + slotCardH / 2, '★ 최고 tier', {
                fontFamily: FONT_STACK,
                fontSize: '20px',
                fontStyle: 'bold',
                color: TEXT_COLOR.ok,
              })
              .setOrigin(1, 0.5),
          );
        }
      });
    };

    const rebuildTabs = (): void => {
      empTabs.forEach((t) => { t.bg.destroy(); t.text.destroy(); });
      empTabs.length = 0;
      emps.forEach((emp, i) => {
        const row = Math.floor(i / tabCols);
        const col = i % tabCols;
        const tx = panelX + 24 + col * (tabW + tabGap);
        const ty = tabsY + row * (tabH + tabRowGap);
        const isSelected = i === selectedIdx;
        const bg = this.add.graphics();
        bg.fillStyle(isSelected ? COLOR.btn : COLOR.btnSecondary, 1);
        bg.fillRoundedRect(tx, ty, tabW, tabH, 8);
        layer.add(bg);
        const txt = this.add
          .text(tx + tabW / 2, ty + tabH / 2, emp.name.slice(0, 4), {
            fontFamily: FONT_STACK,
            fontSize: '17px',
            fontStyle: isSelected ? 'bold' : 'normal',
            color: TEXT_COLOR.primary,
          })
          .setOrigin(0.5);
        layer.add(txt);
        const hit = this.add
          .zone(tx + tabW / 2, ty + tabH / 2, tabW, tabH)
          .setInteractive({ useHandCursor: true });
        layer.add(hit);
        hit.on('pointerup', () => {
          if (selectedIdx !== i) {
            selectedIdx = i;
            rebuildTabs();
            rebuildSlots(selectedIdx);
          }
        });
        empTabs.push({ bg, text: txt });
      });
    };

    rebuildTabs();
    rebuildSlots(selectedIdx);

    // 닫기 버튼.
    const closeBtn = createButton(this, {
      x: panelX + 24,
      y: panelY + panelH - 56,
      w: panelW - 48,
      h: 40,
      label: '닫기',
      variant: 'secondary',
      size: 'md',
      onTap: () => {
        playSfx(this, SFX.tap);
        modal.close();
      },
    });
    layer.add(closeBtn.bg);
    layer.add(closeBtn.text);
    layer.add(closeBtn.hit);
  }

  private applyEquipmentPurchase(
    empIdx: number,
    slot: EquipmentSlot,
    tier: number,
    cost: number,
  ): void {
    const emp = this.liveEmployees[empIdx];
    if (!emp) return;
    if (this.liveGold < cost) return;
    this.liveGold -= cost;
    const newEq: EmployeeEquipment = { ...(emp.equipment ?? {}), [slot]: tier };
    const updated = { ...emp, equipment: newEq };
    this.liveEmployees = this.liveEmployees.map((e, i) => (i === empIdx ? updated : e));
    // hiredEmployees에도 동기화.
    this.hiredEmployees = this.hiredEmployees.map((e) => (e.id === emp.id ? updated : e));
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }

  // ────────────────────────── 시설 modal ──────────────────────────
  private openFacilitiesModal(): void {
    const cardH = 124;
    const cardGap = 10;
    const headerH = 80;
    const footerH = 60;
    const panelW = 600;
    const panelH = headerH + FACILITIES.length * (cardH + cardGap) - cardGap + footerH + 16;

    const modal = createModal(this, {
      w: panelW,
      h: panelH,
      category: 'facility',
      title: '회사 시설',
      subtitle: '한 번 건설하면 모든 프로젝트에 영구 적용',
      depth: 150,
    });
    const { layer } = modal;
    const { x: panelX, y: panelY } = modal.panel;

    const cardsY0 = panelY + headerH;
    const cardX = panelX + 20;
    const cardW = panelW - 40;
    FACILITIES.forEach((item, i) => {
      const cy = cardsY0 + i * (cardH + cardGap);
      this.buildFacilityCard(layer, cardX, cy, cardW, cardH, item, () => {
        modal.close();
        this.applyFacilityBuild(item.id);
      });
    });
  }

  private buildFacilityCard(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    item: (typeof FACILITIES)[number],
    onBuild: () => void,
  ): void {
    const built = isFacilityBuilt(this.liveFacilities, item.id);
    const available = isFacilityAvailable(this.liveFacilities, item, this.officeLevel);
    const affordable = this.liveGold >= item.cost;

    layer.add(makePanel(this, x, y, w, h, COLOR.panelEmpty, false));

    // 이름.
    layer.add(
      this.add.text(x + 16, y + 12, item.name, {
        fontFamily: FONT_STACK,
        fontSize: '26px',
        fontStyle: 'bold',
        color: built ? TEXT_COLOR.dim : TEXT_COLOR.primary,
      }),
    );

    // 효과 라벨 (우상단).
    layer.add(
      this.add
        .text(x + w - 16, y + 12, item.effectLabel, {
          fontFamily: FONT_STACK,
          fontSize: '20px',
          color: TEXT_COLOR.ok,
        })
        .setOrigin(1, 0),
    );

    // 설명.
    layer.add(
      this.add.text(x + 16, y + 34, item.desc, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: w - 32 },
      }),
    );

    // 구매 버튼.
    const btnY = y + h - 36;
    const btnX = x + 16;
    const btnW = w - 32;
    const btnH = 28;

    if (built) {
      // 건설 완료.
      const doneBg = this.add.graphics();
      doneBg.fillStyle(COLOR.btnDisabled, 1);
      doneBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(doneBg);
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, '✓ 건설 완료', {
            fontFamily: FONT_STACK,
            fontSize: '20px',
            color: TEXT_COLOR.disabled,
          })
          .setOrigin(0.5),
      );
    } else if (!available) {
      // 잠금 — 사옥 단계 또는 의존 시설 조건 미충족.
      const lockBg = this.add.graphics();
      lockBg.fillStyle(COLOR.btnDisabled, 1);
      lockBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(lockBg);
      const lockParts: string[] = [];
      if (item.minOfficeLevel !== undefined && this.officeLevel < item.minOfficeLevel) {
        lockParts.push(`사옥 ${item.minOfficeLevel}단계 필요`);
      }
      if (item.requires) {
        const missing = item.requires.filter((r) => !isFacilityBuilt(this.liveFacilities, r));
        if (missing.length > 0) {
          const names = missing.map((r) => FACILITIES.find((f) => f.id === r)?.name ?? r);
          lockParts.push(`선행: ${names.join(', ')}`);
        }
      }
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, `잠금 — ${lockParts.join(' / ')}`, {
            fontFamily: FONT_STACK,
            fontSize: '19px',
            color: TEXT_COLOR.disabled,
          })
          .setOrigin(0.5),
      );
    } else {
      // 구매 가능 또는 골드 부족.
      const buildBg = this.add.graphics();
      buildBg.fillStyle(affordable ? COLOR.btn : COLOR.btnDisabled, 1);
      buildBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(buildBg);
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2,
            affordable ? `건설 (−${item.cost}g)` : `골드 부족 (필요 ${item.cost}g)`, {
              fontFamily: FONT_STACK,
              fontSize: '20px',
              fontStyle: 'bold',
              color: affordable ? TEXT_COLOR.primary : TEXT_COLOR.bad,
            })
          .setOrigin(0.5),
      );
      if (affordable) {
        const hit = this.add
          .zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        layer.add(hit);
        hit.on('pointerup', () => {
          // 시설 건설 구매 — buy alias 사용.
          playSfx(this, SFX.buy);
          onBuild();
        });
      }
    }
  }

  private applyFacilityBuild(id: (typeof FACILITIES)[number]['id']): void {
    const item = FACILITIES.find((f) => f.id === id);
    if (!item) return;
    if (isFacilityBuilt(this.liveFacilities, id)) return;
    if (this.liveGold < item.cost) return;
    this.liveGold -= item.cost;
    this.liveFacilities = buildFacility(this.liveFacilities, id);
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
    // 시설 모달 재오픈 — 최신 상태 반영.
    this.openFacilitiesModal();
  }

  /** 일러스트를 새 텍스처로 교체하면서 알파 페이드 + 약한 줌 인. */
  private crossfadeIllustration(nextKey: string): void {
    const img = this.officeIllustration;
    if (!img) return;
    this.tweens.add({
      targets: img,
      alpha: 0,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        img.setTexture(nextKey);
        img.setScale(img.scaleX * 0.92, img.scaleY * 0.92);
        this.tweens.add({
          targets: img,
          alpha: 1,
          scaleX: img.scaleX / 0.92,
          scaleY: img.scaleY / 0.92,
          duration: 320,
          ease: 'Back.easeOut',
        });
      },
    });
  }

  // ────────────────────────── reset button ──────────────────────────
  private buildResetButton(): void {
    // logical 1280 기준 고정 좌표.
    const y = 1170;
    const h = 60;
    // [통계] (보조) + [다음 프로젝트로] (Primary) 좌우 배치.
    const gap = 16;
    const statsW = 160;
    const nextW = 360;
    const totalW = statsW + nextW + gap;
    const startX = this.cx - totalW / 2;

    const statsX = startX;
    this.makeBottomButton({
      x: statsX,
      y,
      w: statsW,
      h,
      label: '통계',
      primary: false,
      onTap: () => {
        playSfx(this, SFX.tap);
        this.scene.start(SCENE_KEYS.Stats, { returnTo: SCENE_KEYS.Result });
      },
    });

    const nextX = startX + statsW + gap;
    this.makeBottomButton({
      x: nextX,
      y,
      w: nextW,
      h,
      label: '다음 프로젝트로',
      primary: true,
      onTap: () => {
        playSfx(this, SFX.click);
        // Boot로 돌아가 저장된 골드를 이월하여 새 프로젝트 시작.
        this.scene.start(SCENE_KEYS.Boot);
      },
    });
  }

  private makeBottomButton(opts: {
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
      opts.onTap();
    });
  }

  // ────────────────────────── year-end modal ──────────────────────────
  /** 연말 결산 모달 — 4분기 매출 합계 및 목표 달성 여부 표시. */
  showYearEndModal(report: YearEndReport): void {
    playSfx(this, SFX.modal, 0.5);

    const layer = this.add.container(0, 0).setDepth(170);

    // 어두운 오버레이 — logical 720×1280 풀 사이즈.
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.75)
      .setOrigin(0, 0)
      .setInteractive();
    layer.add(overlay);

    // 패널 크기 계산 — 헤더 + 4 행 + 합계 행 + 보너스 행(선택) + 버튼.
    const bonusRowH = report.achieved ? 56 : 0;
    const panelW = 560;
    const panelH = 80 + 4 * 48 + 52 + bonusRowH + 72;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panelY = Math.max(20, (1280 - panelH) / 2);
    const panel = makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);
    layer.add(panel);

    // 헤더 칩.
    layer.add(
      this.add.text(panelX + 24, panelY + 18, '연말 결산', {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        fontStyle: 'bold',
        color: TEXT_COLOR.warn,
      }),
    );
    layer.add(
      this.add.text(panelX + 24, panelY + 40, `${report.year}년차 결산`, {
        fontFamily: FONT_STACK,
        fontSize: '30px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      }),
    );

    // 4분기 매출 행.
    const quarterLabels: ReadonlyArray<[string, number]> = [
      ['Q1 매출', report.q1Revenue],
      ['Q2 매출', report.q2Revenue],
      ['Q3 매출', report.q3Revenue],
      ['Q4 매출', report.q4Revenue],
    ];
    const rowsY0 = panelY + 80;
    quarterLabels.forEach(([label, rev], i) => {
      const y = rowsY0 + i * 48 + 24;
      layer.add(
        this.add.text(panelX + 28, y, label, {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          color: TEXT_COLOR.dim,
        }).setOrigin(0, 0.5),
      );
      layer.add(
        this.add.text(panelX + panelW - 28, y, `+${rev}g`, {
          fontFamily: FONT_STACK,
          fontSize: '26px',
          fontStyle: 'bold',
          color: TEXT_COLOR.ok,
        }).setOrigin(1, 0.5),
      );
    });

    // 합계 행.
    const totalY = rowsY0 + 4 * 48 + 24;
    const targetColor = report.achieved ? TEXT_COLOR.ok : TEXT_COLOR.bad;
    layer.add(
      this.add.text(panelX + 28, totalY, `합계 (목표 ${report.target}g)`, {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      }).setOrigin(0, 0.5),
    );
    layer.add(
      this.add.text(panelX + panelW - 28, totalY, `${report.totalRevenue}g`, {
        fontFamily: FONT_STACK,
        fontSize: '29px',
        fontStyle: 'bold',
        color: targetColor,
      }).setOrigin(1, 0.5),
    );
    // 달성/미달 라벨.
    layer.add(
      this.add.text(panelX + panelW / 2, totalY + 24, report.achieved ? '✓ 목표 달성!' : '✗ 목표 미달', {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        fontStyle: 'bold',
        color: targetColor,
      }).setOrigin(0.5, 0),
    );

    // 보너스 행 (달성 시).
    if (report.achieved) {
      const bonusY = totalY + 52;
      layer.add(
        this.add.text(panelX + panelW / 2, bonusY, `보너스: 골드 +${report.goldBonus}  ·  명성 +${report.reputationBonus}`, {
          fontFamily: FONT_STACK,
          fontSize: '26px',
          fontStyle: 'bold',
          color: TEXT_COLOR.warn,
        }).setOrigin(0.5, 0),
      );
    }

    // 닫기 버튼.
    const closeBtnY = panelY + panelH - 60;
    const closeBg = this.add.graphics();
    closeBg.fillStyle(COLOR.btn, 1);
    closeBg.fillRoundedRect(panelX + 24, closeBtnY, panelW - 48, 44, 12);
    layer.add(closeBg);
    layer.add(
      this.add
        .text(panelX + panelW / 2, closeBtnY + 22, '확인', {
          fontFamily: FONT_STACK,
          fontSize: '26px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5),
    );
    const closeHit = this.add
      .zone(panelX + panelW / 2, closeBtnY + 22, panelW - 48, 44)
      .setInteractive({ useHandCursor: true });
    layer.add(closeHit);
    closeHit.on('pointerup', () => {
      playSfx(this, SFX.tap);
      layer.destroy();
    });
  }

  // ────────────────────────── 마일스톤 토스트 ──────────────────────────
  /**
   * 마일스톤 토스트 큐 — 1초(1000ms) stagger로 우상단에 순서대로 슬라이드 인.
   * 여러 개일 때 위아래로 스택.
   */
  private queueMilestoneToasts(milestones: ReadonlyArray<Milestone>): void {
    milestones.forEach((ms, i) => {
      this.time.delayedCall(1000 + i * 1000, () => this.showMilestoneToast(ms, i));
    });
  }

  /**
   * 토스트 카드 1장 — 우상단에서 슬라이드 인 → 4초 정지 → 슬라이드 아웃.
   * @param ms 표시할 마일스톤.
   * @param stackIndex 위에서 몇 번째 카드인지 (y 위치 결정).
   */
  private showMilestoneToast(ms: Milestone, stackIndex: number): void {
    const toastW = 280;
    const toastH = 80;
    const toastX = this.contentX + 720 - toastW - 12; // 우측 여백 12
    const toastY = 130 + stackIndex * 90;
    const offscreenX = this.contentX + 720 + toastW; // 화면 밖 시작 위치

    const container = this.add.container(offscreenX, toastY).setDepth(200);

    // 배경 패널.
    const bg = this.add.graphics();
    bg.fillStyle(COLOR.panel, 1);
    bg.fillRoundedRect(0, 0, toastW, toastH, 12);
    bg.lineStyle(1.5, COLOR.panelStroke, 1);
    bg.strokeRoundedRect(0, 0, toastW, toastH, 12);
    container.add(bg);

    // 헤더 칩.
    container.add(
      this.add.text(12, 10, '🏆 마일스톤', {
        fontFamily: FONT_STACK,
        fontSize: '18px',
        fontStyle: 'bold',
        color: TEXT_COLOR.warn,
      }),
    );

    // 제목.
    container.add(
      this.add.text(12, 26, ms.title, {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      }),
    );

    // 설명.
    container.add(
      this.add.text(12, 46, ms.desc, {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: toastW - 24 },
      }),
    );

    // 명성 보너스 (있을 때만).
    if (ms.reputationBonus > 0) {
      container.add(
        this.add
          .text(toastW - 10, 48, `+${ms.reputationBonus} 명성`, {
            fontFamily: FONT_STACK,
            fontSize: '20px',
            fontStyle: 'bold',
            color: TEXT_COLOR.ok,
          })
          .setOrigin(1, 0),
      );
    }

    // 슬라이드 인.
    this.tweens.add({
      targets: container,
      x: toastX,
      duration: 320,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 4초 후 슬라이드 아웃.
        this.time.delayedCall(4000, () => {
          this.tweens.add({
            targets: container,
            x: offscreenX,
            duration: 260,
            ease: 'Cubic.easeIn',
            onComplete: () => container.destroy(),
          });
        });
      },
    });
  }

  /** 경기 사이클 변화 토스트 — 새 사이클 시작 시 우상단에 표시. */
  private showEconomyToast(): void {
    const eco = this.outcome.economy;
    const newPhase = getEconomyPhase(this.liveEconomy.index);
    const newLabel = ECONOMY_PHASE_LABEL[newPhase];
    const newRevMul = getEconomyRevenueMul(newPhase);
    const mulStr = newRevMul > 1.001 ? `×${newRevMul.toFixed(1)}` : newRevMul < 0.999 ? `×${newRevMul.toFixed(1)}` : '×1.0';
    const emoji = newPhase === 'boom' ? '📈' : newPhase === 'recession' ? '📉' : '📊';
    const label = `${emoji} 경기 ${newLabel} 진입`;
    const detail = `지표 ${eco.prevIndex}→${this.liveEconomy.index} · 매출 ${mulStr}`;

    const toastW = 300;
    const toastH = 72;
    const toastX = this.contentX + 720 - toastW - 12;
    const toastY = 130;
    const offscreenX = this.contentX + 720 + toastW;

    const container = this.add.container(offscreenX, toastY).setDepth(200);

    const bg = this.add.graphics();
    const bgColor = newPhase === 'boom' ? 0x1a3a1a : newPhase === 'recession' ? 0x3a1a1a : COLOR.panel;
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(0, 0, toastW, toastH, 12);
    bg.lineStyle(1.5, COLOR.panelStroke, 1);
    bg.strokeRoundedRect(0, 0, toastW, toastH, 12);
    container.add(bg);

    container.add(
      this.add.text(12, 10, label, {
        fontFamily: FONT_STACK,
        fontSize: '22px',
        fontStyle: 'bold',
        color: newPhase === 'boom' ? TEXT_COLOR.ok : newPhase === 'recession' ? TEXT_COLOR.bad : TEXT_COLOR.primary,
      }),
    );
    container.add(
      this.add.text(12, 38, detail, {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        color: TEXT_COLOR.dim,
      }),
    );

    this.tweens.add({
      targets: container,
      x: toastX,
      duration: 320,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(4000, () => {
          this.tweens.add({
            targets: container,
            x: offscreenX,
            duration: 260,
            ease: 'Cubic.easeIn',
            onComplete: () => container.destroy(),
          });
        });
      },
    });
  }

  // ────────────────────────── save footer ──────────────────────────
  private buildSaveFooter(): void {
    // logical 1280 기준 고정 좌표 — reset btn 아래 슬쩍.
    this.saveFooterText = this.add
      .text(this.cx, 1256, '', {
        fontFamily: FONT_STACK,
        fontSize: '21px',
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

  // ────────────────────────── 글로벌 시장 modal ──────────────────────────
  private openMarketsModal(): void {
    const productCount = this.outcome.state.productIndex + 1;
    const reputation = this.outcome.reputation.total + this.yearEndReputationBonus;

    const cardH = 144;
    const cardGap = 10;
    const headerH = 80;
    const footerH = 60;
    const panelW = 600;
    const panelH = headerH + MARKETS.length * (cardH + cardGap) - cardGap + footerH + 16;

    const modal = createModal(this, {
      w: panelW,
      h: panelH,
      category: 'market',
      title: '글로벌 시장 진출',
      subtitle: '진출한 시장만큼 매출 곱연산 — 영구 적용',
      depth: 150,
    });
    const { layer } = modal;
    const { x: panelX, y: panelY } = modal.panel;

    // 카드들.
    const cardsY0 = panelY + headerH;
    const cardX = panelX + 20;
    const cardW = panelW - 40;
    MARKETS.forEach((m, i) => {
      const cy = cardsY0 + i * (cardH + cardGap);
      this.buildMarketCard(layer, cardX, cy, cardW, cardH, m, productCount, reputation, () => {
        modal.close();
        this.applyMarketEntry(m.id);
      });
    });
  }

  private buildMarketCard(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    m: (typeof MARKETS)[number],
    productCount: number,
    reputation: number,
    onEnter: () => void,
  ): void {
    const entered = isMarketEntered(this.liveMarkets, m.id);
    const available = isMarketAvailable(this.liveMarkets, m, productCount, reputation);
    const affordable = this.liveGold >= m.cost;

    layer.add(makePanel(this, x, y, w, h, COLOR.panelEmpty, false));

    // 시장 이름.
    layer.add(
      this.add.text(x + 16, y + 12, m.name, {
        fontFamily: FONT_STACK,
        fontSize: '26px',
        fontStyle: 'bold',
        color: entered ? TEXT_COLOR.dim : TEXT_COLOR.primary,
      }),
    );

    // 매출 배수 (우상단).
    layer.add(
      this.add
        .text(x + w - 16, y + 12, `매출 ×${m.revenueMul.toFixed(2)}`, {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          color: TEXT_COLOR.ok,
        })
        .setOrigin(1, 0),
    );

    // 설명.
    layer.add(
      this.add.text(x + 16, y + 36, m.desc, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: w - 32 },
      }),
    );

    // 진입 버튼 영역.
    const btnY = y + h - 38;
    const btnX = x + 16;
    const btnW = w - 32;
    const btnH = 30;

    if (entered) {
      // 진출 완료.
      const doneBg = this.add.graphics();
      doneBg.fillStyle(COLOR.btnDisabled, 1);
      doneBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(doneBg);
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, '✓ 진출 완료', {
            fontFamily: FONT_STACK,
            fontSize: '21px',
            color: TEXT_COLOR.disabled,
          })
          .setOrigin(0.5),
      );
    } else if (!available) {
      // 잠금 — 조건 미충족.
      const lockBg = this.add.graphics();
      lockBg.fillStyle(COLOR.btnDisabled, 1);
      lockBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(lockBg);
      const lockParts: string[] = [];
      if (m.minProductCount !== undefined && productCount < m.minProductCount) {
        lockParts.push(`${m.minProductCount}번째 출시 후`);
      }
      if (m.minReputation !== undefined && reputation < m.minReputation) {
        lockParts.push(`명성 ${m.minReputation} 필요 (현재 ${Math.round(reputation)})`);
      }
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, `🔒 ${lockParts.join(' / ')}`, {
            fontFamily: FONT_STACK,
            fontSize: '20px',
            color: TEXT_COLOR.disabled,
          })
          .setOrigin(0.5),
      );
    } else {
      // 진출 가능 또는 골드 부족.
      const canEnter = affordable;
      const enterBg = this.add.graphics();
      enterBg.fillStyle(canEnter ? COLOR.btn : COLOR.btnDisabled, 1);
      enterBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(enterBg);
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, canEnter ? `진출 (−${m.cost}g)` : `골드 부족 (필요 ${m.cost}g)`, {
            fontFamily: FONT_STACK,
            fontSize: '21px',
            fontStyle: 'bold',
            color: canEnter ? TEXT_COLOR.primary : TEXT_COLOR.bad,
          })
          .setOrigin(0.5),
      );
      if (canEnter) {
        const hit = this.add
          .zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        layer.add(hit);
        hit.on('pointerup', () => {
          // 글로벌 시장 진출 구매 — buy alias 사용.
          playSfx(this, SFX.buy);
          onEnter();
        });
      }
    }
  }

  private applyMarketEntry(id: (typeof MARKETS)[number]['id']): void {
    const m = MARKETS.find((x) => x.id === id);
    if (!m) return;
    if (isMarketEntered(this.liveMarkets, id)) return;
    if (this.liveGold < m.cost) return;
    this.liveGold -= m.cost;
    this.liveMarkets = enterMarket(this.liveMarkets, id);
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }

  // ────────────────────────── 자회사 인수 modal ──────────────────────────
  private openAcquisitionsModal(): void {
    const totalRevenue = this.history.reduce((s, r) => s + r.revenue, 0);

    const cardH = 154;
    const cardGap = 10;
    const headerH = 80;
    const footerH = 60;
    const panelW = 600;
    const panelH = headerH + ACQUISITIONS.length * (cardH + cardGap) - cardGap + footerH + 16;

    const modal = createModal(this, {
      w: panelW,
      h: panelH,
      category: 'acquisition',
      title: '자회사 인수',
      subtitle: '골드 싱크 + 고스킬 직원 영입 + 명성 부스트',
      depth: 150,
    });
    const { layer } = modal;
    const { x: panelX, y: panelY } = modal.panel;

    const cardsY0 = panelY + headerH;
    const cardX = panelX + 20;
    const cardW = panelW - 40;
    ACQUISITIONS.forEach((acq, i) => {
      const cy = cardsY0 + i * (cardH + cardGap);
      this.buildAcquisitionCard(layer, cardX, cy, cardW, cardH, acq, totalRevenue, () => {
        modal.close();
        this.applyAcquisition(acq.id);
      });
    });
  }

  private buildAcquisitionCard(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    acq: (typeof ACQUISITIONS)[number],
    totalRevenue: number,
    onBuy: () => void,
  ): void {
    const completed = isAcquisitionCompleted(this.liveAcquisitions, acq.id);
    const available = isAcquisitionAvailable(this.liveAcquisitions, acq, totalRevenue);
    const affordable = this.liveGold >= acq.cost;

    layer.add(makePanel(this, x, y, w, h, COLOR.panelEmpty, false));

    // 인수 대상 이름.
    layer.add(
      this.add.text(x + 16, y + 12, acq.name, {
        fontFamily: FONT_STACK,
        fontSize: '26px',
        fontStyle: 'bold',
        color: completed ? TEXT_COLOR.dim : TEXT_COLOR.primary,
      }),
    );

    // 우상단 — 직원 수 + 명성.
    layer.add(
      this.add
        .text(x + w - 16, y + 12, `직원 +${acq.empCount}명  명성 +${acq.reputationGain}`, {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          color: TEXT_COLOR.ok,
        })
        .setOrigin(1, 0),
    );

    // 설명.
    layer.add(
      this.add.text(x + 16, y + 36, acq.desc, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
        wordWrap: { width: w - 32 },
      }),
    );

    // 구매 버튼 영역.
    const btnY = y + h - 38;
    const btnX = x + 16;
    const btnW = w - 32;
    const btnH = 30;

    if (completed) {
      // 인수 완료.
      const doneBg = this.add.graphics();
      doneBg.fillStyle(COLOR.btnDisabled, 1);
      doneBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(doneBg);
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, '✓ 인수 완료', {
            fontFamily: FONT_STACK,
            fontSize: '21px',
            color: TEXT_COLOR.disabled,
          })
          .setOrigin(0.5),
      );
    } else if (!available) {
      // 잠금 — 누적 매출 미충족.
      const lockBg = this.add.graphics();
      lockBg.fillStyle(COLOR.btnDisabled, 1);
      lockBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(lockBg);
      layer.add(
        this.add
          .text(btnX + btnW / 2, btnY + btnH / 2, `🔒 누적 매출 ${acq.minTotalRevenue.toLocaleString()} 필요`, {
            fontFamily: FONT_STACK,
            fontSize: '20px',
            color: TEXT_COLOR.disabled,
          })
          .setOrigin(0.5),
      );
    } else {
      // 구매 가능 또는 골드 부족.
      const canBuy = affordable;
      const buyBg = this.add.graphics();
      buyBg.fillStyle(canBuy ? COLOR.btn : COLOR.btnDisabled, 1);
      buyBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      layer.add(buyBg);
      layer.add(
        this.add
          .text(
            btnX + btnW / 2,
            btnY + btnH / 2,
            canBuy ? `인수 (−${acq.cost.toLocaleString()}g)` : `골드 부족 (필요 ${acq.cost.toLocaleString()}g)`,
            {
              fontFamily: FONT_STACK,
              fontSize: '21px',
              fontStyle: 'bold',
              color: canBuy ? TEXT_COLOR.primary : TEXT_COLOR.bad,
            },
          )
          .setOrigin(0.5),
      );
      if (canBuy) {
        const hit = this.add
          .zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        layer.add(hit);
        hit.on('pointerup', () => {
          // 자회사 인수 구매 — buy alias 사용.
          playSfx(this, SFX.buy);
          onBuy();
        });
      }
    }
  }

  private applyAcquisition(id: (typeof ACQUISITIONS)[number]['id']): void {
    const acq = ACQUISITIONS.find((a) => a.id === id);
    if (!acq) return;
    const totalRevenue = this.history.reduce((s, r) => s + r.revenue, 0);
    if (!isAcquisitionAvailable(this.liveAcquisitions, acq, totalRevenue)) return;
    if (this.liveGold < acq.cost) return;
    this.liveGold -= acq.cost;
    // 인수로 생성된 직원 — cap 초과해도 강제 영입 (인수는 특별).
    const newEmps = generateAcquiredEmployees(acq);
    this.hiredEmployees = [...this.hiredEmployees, ...newEmps];
    this.liveEmployees = [...this.liveEmployees, ...newEmps];
    // yearEndReputationBonus에 쌓아 persistResult 합산.
    this.yearEndReputationBonus += acq.reputationGain;
    this.liveAcquisitions = completeAcquisition(this.liveAcquisitions, acq.id);
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }

  // ────────────────────────── 메일 시스템 ──────────────────────────

  /**
   * 출시 진입 시 새 메일 1~2개 랜덤 수신.
   * GameState를 직접 받지 않고 outcome.state를 활용한다.
   */
  private triggerNewMails(): void {
    const state = this.outcome.state;
    // 최근 메일 id 목록 (중복 방지).
    const recentIds = this.liveMails.slice(-8).map((m) => m.id);
    const count = Math.random() < 0.5 ? 1 : 2;
    const newMails: MailMessage[] = [];
    for (let i = 0; i < count; i++) {
      const tpl = pickRandomMail(state, [...recentIds, ...newMails.map((m) => m.id)]);
      if (!tpl) break;
      newMails.push(createMailMessage(tpl, Date.now() + i));
    }
    if (newMails.length === 0) return;
    this.liveMails = trimMails([...this.liveMails, ...newMails]);
    this.persistResult();
    // 새 메일 토스트 알림.
    this.time.delayedCall(1800, () => this.showMailToast(newMails.length));
  }

  /** 새 메일 도착 토스트 — 3초 후 사라짐. */
  private showMailToast(count: number): void {
    const toastW = 300;
    const toastH = 60;
    const toastX = this.contentX + (720 - toastW) / 2;
    const toastY = 70;

    const container = this.add.container(toastX, toastY - 80).setDepth(210);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a2a3a, 0.95);
    bg.fillRoundedRect(0, 0, toastW, toastH, 12);
    bg.lineStyle(1.5, 0x3a5a7a, 1);
    bg.strokeRoundedRect(0, 0, toastW, toastH, 12);
    container.add(bg);

    container.add(
      this.add
        .text(toastW / 2, toastH / 2, `📬 새 메일 ${count}건 도착`, {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
        })
        .setOrigin(0.5),
    );

    // 슬라이드 인.
    this.tweens.add({
      targets: container,
      y: toastY,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 3초 후 페이드 아웃.
        this.time.delayedCall(3000, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            y: toastY - 30,
            duration: 260,
            ease: 'Cubic.easeIn',
            onComplete: () => container.destroy(),
          });
        });
      },
    });
  }

  // ────────────────────────── 메일 인박스 모달 ──────────────────────────

  /** 메일 인박스 모달 열기. */
  private openMailInboxModal(): void {
    // 최근 메일부터 최대 10개 표시.
    const sorted = [...this.liveMails].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 10);
    const unreadCount = this.liveMails.filter((m) => !m.read).length;

    const rowH = 76;
    const rowGap = 6;
    const headerH = 90;
    const footerH = 60;
    const panelW = 620;
    const listH = sorted.length > 0 ? sorted.length * (rowH + rowGap) - rowGap : 60;
    const panelH = Math.min(1160, headerH + listH + footerH + 16);

    const modal = createModal(this, {
      w: panelW,
      h: panelH,
      y: 60,
      category: 'mail',
      title: '📬 메일함',
      subtitle: unreadCount > 0 ? `안 읽은 메일 ${unreadCount}건` : '모두 읽음',
      depth: 150,
    });
    const { layer } = modal;
    const { x: panelX, y: panelY } = modal.panel;

    // 메일 리스트.
    if (sorted.length === 0) {
      layer.add(
        this.add
          .text(panelX + panelW / 2, panelY + headerH + 30, '수신된 메일이 없습니다.', {
            ...TYPE.lead,
            color: TEXT_COLOR.dim,
          })
          .setOrigin(0.5),
      );
    } else {
      sorted.forEach((mail, i) => {
        const rowY = panelY + headerH + i * (rowH + rowGap);
        this.buildMailRow(layer, panelX + 16, rowY, panelW - 32, rowH, mail, () => {
          modal.close();
          this.openMailDetailModal(mail);
        });
      });
    }

    // 하단 닫기 버튼.
    const closeY = panelY + panelH - footerH + 8;
    const closeBtn = createButton(this, {
      x: panelX + 24,
      y: closeY,
      w: panelW - 48,
      h: 40,
      label: '닫기',
      variant: 'secondary',
      size: 'md',
      onTap: () => {
        playSfx(this, SFX.tap);
        modal.close();
      },
    });
    layer.add(closeBtn.bg);
    layer.add(closeBtn.text);
    layer.add(closeBtn.hit);
  }

  /** 메일 한 row 렌더링. */
  private buildMailRow(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    mail: MailMessage,
    onTap: () => void,
  ): void {
    const npc = NPCS.find((n) => n.id === mail.fromNpcId);
    const npcName = npc?.name ?? mail.fromNpcId;

    // 배경.
    const rowBg = this.add.graphics();
    rowBg.fillStyle(mail.read ? COLOR.panelEmpty : 0x1a2d4a, 1);
    rowBg.fillRoundedRect(x, y, w, h, 8);
    layer.add(rowBg);

    // 안 읽음 표시 — 좌측 빨간 도트.
    if (!mail.read) {
      const dot = this.add.graphics();
      dot.fillStyle(0xff4444, 1);
      dot.fillCircle(x + 10, y + h / 2, 5);
      layer.add(dot);
    }

    const textX = x + (mail.read ? 16 : 22);

    // NPC 이름 + 제목.
    layer.add(
      this.add.text(textX, y + 10, npcName, {
        fontFamily: FONT_STACK,
        fontSize: '19px',
        fontStyle: 'bold',
        color: TEXT_COLOR.warn,
      }),
    );
    layer.add(
      this.add.text(textX, y + 28, mail.subject, {
        fontFamily: FONT_STACK,
        fontSize: '22px',
        color: mail.read ? TEXT_COLOR.dim : TEXT_COLOR.primary,
        wordWrap: { width: w - 110 },
      }),
    );

    // 시간 (우측).
    const d = new Date(mail.receivedAt);
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    layer.add(
      this.add
        .text(x + w - 8, y + 10, timeStr, {
          fontFamily: FONT_STACK,
          fontSize: '20px',
          color: TEXT_COLOR.dim,
        })
        .setOrigin(1, 0),
    );

    // 선택지 있음 표시.
    if (mail.choices && mail.choices.length > 0) {
      layer.add(
        this.add
          .text(x + w - 8, y + 30, '[ 선택 ]', {
            fontFamily: FONT_STACK,
            fontSize: '18px',
            color: TEXT_COLOR.ok,
          })
          .setOrigin(1, 0),
      );
    }

    // 터치 히트.
    const hit = this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    layer.add(hit);
    hit.on('pointerup', () => {
      playSfx(this, SFX.tap);
      onTap();
    });
  }

  /** 메일 상세 모달. */
  private openMailDetailModal(mail: MailMessage): void {
    // 읽음 처리.
    this.liveMails = markMailRead(this.liveMails, mail.id);
    this.persistResult();
    this.refreshOfficePanel();

    const npc = NPCS.find((n) => n.id === mail.fromNpcId);
    const npcName = npc?.name ?? mail.fromNpcId;
    const npcRole = npc?.role ?? '';

    // 디자인 시스템 모달 — Phase 2 컴포넌트(createModal) 사용 시범.
    const choiceH = mail.choices ? mail.choices.length * 68 + 16 : 0;
    const panelW = 600;
    const panelH = Math.min(1100, 180 + choiceH + 60);

    const modal = createModal(this, {
      w: panelW,
      h: panelH,
      category: 'mail',
      title: `${npcName} — ${npcRole}`,
      subtitle: mail.subject,
      depth: 155,
      onClose: () => this.openMailInboxModal(),
    });

    const { layer } = modal;
    const { x: panelX } = modal.panel;
    const { y: panelY } = modal.panel;

    // 본문 — subtitle 아래.
    layer.add(
      this.add.text(panelX + 24, panelY + 96, mail.body, {
        ...TYPE.lead,
        color: TEXT_COLOR.dim,
        wordWrap: { width: panelW - 48 },
      }),
    );

    // 선택지 버튼들 — createButton 사용 (primary variant + 부제 텍스트).
    const choicesY = panelY + 168;
    if (mail.choices && mail.choices.length > 0) {
      mail.choices.forEach((choice, i) => {
        const btnY = choicesY + i * 68;
        const btnH = 58;
        const btn = createButton(this, {
          x: panelX + 24,
          y: btnY,
          w: panelW - 48,
          h: btnH,
          label: choice.label,
          variant: 'primary',
          size: 'md',
          onTap: () => {
            playSfx(this, SFX.success);
            this.applyMailChoice(mail, choice.apply);
            // onClose 발화 막고 즉시 close.
            modal.onClose = undefined;
            modal.close();
          },
        });
        // 라벨 좌측 정렬 + 부제 노출 위해 text 위치 조정.
        btn.text.setOrigin(0, 0.5).setX(panelX + 24 + 12).setY(btnY + 18);
        layer.add(btn.bg);
        layer.add(btn.text);
        layer.add(btn.hit);
        // 부제 — choice.summary.
        layer.add(
          this.add.text(panelX + 24 + 12, btnY + 36, choice.summary, {
            ...TYPE.meta,
            color: TEXT_COLOR.primary,
            wordWrap: { width: panelW - 72 },
          }).setAlpha(0.85),
        );
      });
    }
  }

  /**
   * 메일 선택지 apply 실행.
   * outcome.state는 읽기 전용이므로 gold·reputation·morale 등은 live 필드에 반영한다.
   */
  private applyMailChoice(
    mail: MailMessage,
    applyFn: (state: import('@/domain/types').GameState) => import('@/domain/types').GameState,
  ): void {
    // 현재 live 상태를 GameState 형태로 조합.
    const fakeState: import('@/domain/types').GameState = {
      ...this.outcome.state,
      gold: this.liveGold,
      reputation: this.outcome.reputation.total + this.yearEndReputationBonus,
      employees: [...this.liveEmployees],
    };
    const next = applyFn(fakeState);
    // 변경 사항을 live 필드에 반영.
    this.liveGold = next.gold;
    // reputation 변화분을 yearEndReputationBonus에 누적.
    const repDelta = next.reputation - fakeState.reputation;
    this.yearEndReputationBonus += repDelta;
    this.liveEmployees = next.employees;
    // hiredEmployees에도 동기화 (morale/stamina/skill 변경 반영).
    this.hiredEmployees = this.hiredEmployees.map((he) => {
      const updated = next.employees.find((e) => e.id === he.id);
      return updated ?? he;
    });
    // 메일에서 project(bugDebt 등)가 변경됐을 경우 outcome.state는 readonly이므로
    // bugDebt 변경은 outcome.state.project를 직접 수정 (mutable 필드).
    if (next.project.bugDebt !== fakeState.project.bugDebt) {
      this.outcome.state.project.bugDebt = next.project.bugDebt;
    }
    // 메일 읽음 + 선택지 사용 표시를 위해 choices 제거.
    this.liveMails = this.liveMails.map((m) =>
      m.id === mail.id ? { ...m, read: true, choices: undefined } : m,
    );
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }

  // ────────────────────────── 임원 압박 체크 ──────────────────────────

  /** 출시 후 exec pressure 수준에 따라 토스트 / 모달 표시. */
  private checkExecPressure(): void {
    const execState = this.outcome.state.exec;
    const level = getExecPressure(execState);
    const streak = execState?.poorPerformanceStreak ?? 0;
    if (level === 'fatal') {
      // CEO 교체 — 모달 표시 후 구조조정 / 폐업 선택.
      this.time.delayedCall(1200, () => this.showExecFatalModal(streak));
    } else if (level === 'warning') {
      // 이사회 경고 — 토스트로 표시.
      this.time.delayedCall(2000, () => this.showExecWarningToast(streak));
    }
  }

  /** 이사회 경고 토스트 (yellow) — 4초 표시. */
  private showExecWarningToast(streak: number): void {
    const toastW = 500;
    const toastH = 72;
    const toastX = this.contentX + (720 - toastW) / 2;
    const toastY = 140;

    const container = this.add.container(toastX, toastY - 90).setDepth(220);

    const bg = this.add.graphics();
    bg.fillStyle(0x3a2a00, 0.97);
    bg.fillRoundedRect(0, 0, toastW, toastH, 12);
    bg.lineStyle(2, 0xcc9900, 1);
    bg.strokeRoundedRect(0, 0, toastW, toastH, 12);
    container.add(bg);
    container.add(
      this.add
        .text(toastW / 2, toastH / 2, `⚠ 이사회 경고: 최근 ${streak}작품 부진`, {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#ffcc44',
        })
        .setOrigin(0.5),
    );

    this.tweens.add({
      targets: container,
      y: toastY,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(4000, () => {
          this.tweens.add({
            targets: container, alpha: 0, y: toastY - 30, duration: 260,
            ease: 'Cubic.easeIn', onComplete: () => container.destroy(),
          });
        });
      },
    });
  }

  /** CEO 교체 모달 — [구조조정 / 폐업] 선택. */
  private showExecFatalModal(streak: number): void {
    playSfx(this, SFX.warning, 0.9);
    const layer = this.add.container(0, 0).setDepth(200);
    const overlay = this.add
      .rectangle(0, 0, 720, 1280, 0x000000, 0.85)
      .setOrigin(0, 0)
      .setInteractive();
    layer.add(overlay);

    const panelW = 640;
    const panelH = 500;
    const panelX = this.contentX + (720 - panelW) / 2;
    const panelY = Math.max(0, (1280 - panelH) / 2);
    const glowPanel = makePanel(this, panelX - 3, panelY - 3, panelW + 6, panelH + 6, 0x5a1010);
    layer.add(glowPanel);
    layer.add(makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel));

    const headerH = 52;
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0xcc2222, 1);
    headerBg.fillRoundedRect(panelX, panelY, panelW, headerH, 12);
    layer.add(headerBg);
    layer.add(
      this.add
        .text(panelX + panelW / 2, panelY + headerH / 2, '👔 CEO 교체', {
          fontFamily: FONT_STACK, fontSize: '30px', fontStyle: 'bold', color: '#ffffff',
        })
        .setOrigin(0.5),
    );

    layer.add(
      this.add.text(panelX + 30, panelY + 68,
        `이사회 결의: ${streak}작품 연속 부진으로 CEO 자리에서 물러나게 됩니다.\n\n어떻게 하시겠습니까?`, {
          fontFamily: FONT_STACK,
          fontSize: '26px',
          color: TEXT_COLOR.dim,
          wordWrap: { width: panelW - 60, useAdvancedWrap: true },
          lineSpacing: 4,
        }),
    );

    const btnW = panelW - 60;
    const btn1Y = panelY + 210;
    const btn2Y = btn1Y + 104;

    // 구조조정 버튼
    const btn1Bg = this.add.graphics();
    const drawBtn1 = (p: boolean): void => {
      btn1Bg.clear();
      btn1Bg.fillStyle(p ? 0x3a4020 : 0x2a3010, 1);
      btn1Bg.fillRoundedRect(panelX + 30, btn1Y, btnW, 84, 12);
    };
    drawBtn1(false);
    layer.add(btn1Bg);
    layer.add(this.add.text(panelX + 48, btn1Y + 14, '구조조정', {
      fontFamily: FONT_STACK, fontSize: '27px', fontStyle: 'bold', color: TEXT_COLOR.primary,
    }));
    layer.add(this.add.text(panelX + 48, btn1Y + 46, '직원 절반 해고, 골드 +500. 경영권 유지.', {
      fontFamily: FONT_STACK, fontSize: '21px', color: TEXT_COLOR.dim,
    }));
    const hit1 = this.add
      .zone(panelX + 30 + btnW / 2, btn1Y + 42, btnW, 84)
      .setInteractive({ useHandCursor: true });
    hit1.on('pointerdown', () => drawBtn1(true));
    hit1.on('pointerout', () => drawBtn1(false));
    hit1.on('pointerup', () => {
      drawBtn1(false);
      layer.destroy();
      this.applyExecRestructuring();
    });
    layer.add(hit1);

    // 폐업 버튼
    const btn2Bg = this.add.graphics();
    const drawBtn2 = (p: boolean): void => {
      btn2Bg.clear();
      btn2Bg.fillStyle(p ? 0x5a1010 : 0x3a1515, 1);
      btn2Bg.fillRoundedRect(panelX + 30, btn2Y, btnW, 84, 12);
    };
    drawBtn2(false);
    layer.add(btn2Bg);
    layer.add(this.add.text(panelX + 48, btn2Y + 14, '폐업', {
      fontFamily: FONT_STACK, fontSize: '27px', fontStyle: 'bold', color: TEXT_COLOR.primary,
    }));
    layer.add(this.add.text(panelX + 48, btn2Y + 46, '게임 데이터 초기화 후 시작 화면으로', {
      fontFamily: FONT_STACK, fontSize: '21px', color: TEXT_COLOR.dim,
    }));
    const hit2 = this.add
      .zone(panelX + 30 + btnW / 2, btn2Y + 42, btnW, 84)
      .setInteractive({ useHandCursor: true });
    hit2.on('pointerdown', () => drawBtn2(true));
    hit2.on('pointerout', () => drawBtn2(false));
    hit2.on('pointerup', () => {
      drawBtn2(false);
      clearData();
      this.scene.start(SCENE_KEYS.Boot);
    });
    layer.add(hit2);

    applyHiDPI(this);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 180, ease: 'Cubic.easeOut' });
  }

  /** CEO 교체 후 구조조정 적용 — 직원 절반 해고, 골드 +500. */
  private applyExecRestructuring(): void {
    playSfx(this, SFX.tap);
    const emps = [...this.liveEmployees];
    const keepCount = Math.ceil(emps.length / 2);
    const shuffled = emps.sort(() => Math.random() - 0.5);
    const kept = shuffled.slice(0, keepCount);
    this.liveEmployees = kept;
    this.hiredEmployees = this.hiredEmployees.filter((e) =>
      kept.some((k) => k.id === e.id),
    );
    this.liveGold += 500;
    this.persistResult();
    this.refreshOfficePanel();
    this.refreshSaveFooter();
  }
}

// MAIL_TEMPLATES 사용 확인 (tree-shaking 방지).
void MAIL_TEMPLATES;
