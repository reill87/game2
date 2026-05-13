import Phaser from 'phaser';
import type { Types } from 'phaser';

import { TRENDS } from '@/domain/balance';
import { saturationHint } from '@/domain/saturation';
import {
  DEFAULT_POLICY,
  GENRE_ICON,
  GENRE_LABEL,
  newProject,
  THEME_ICON,
  THEME_LABEL,
} from '@/domain/seed';
import {
  GENRE_UNLOCK,
  THEME_UNLOCK,
  isGenreUnlocked,
  isThemeUnlocked,
} from '@/domain/unlocks';
import { EMPTY_RND, type RndState } from '@/domain/rnd';
import { EMPTY_FACILITIES, type FacilityState } from '@/domain/facilities';
import { EMPTY_MARKETS, type MarketState } from '@/domain/markets';
import type { EconomyState } from '@/domain/economy';
import {
  RIVALS,
  forecastRivalPressure,
  forecastRivalReleases,
  type RivalRelease,
  type RivalState,
} from '@/domain/rivals';
import type {
  Assignment,
  CompanyPolicy,
  Employee,
  GenreId,
  ThemeId,
  TrendStatus,
} from '@/domain/types';
import { ICONS } from '@/icons';
import type { SavedResult } from '@/save';
import { BGM } from '@/bgm';
import { playSfx, SFX } from '@/sounds';
import { COLOR, FONT_STACK, TEXT_COLOR, TINT } from '@/theme';
import { formatGold } from '@/ui';
import { addMuteToggle } from '@/util/muteToggle';
import { applyHiDPI } from '@/util/hidpi';
import { fitCamera } from '@/util/cameraFit';
import { onResize } from '@/util/viewport';

import { SCENE_KEYS } from './keys';

const GENRES: ReadonlyArray<GenreId> = ['G1', 'G2', 'G3', 'G4', 'G5'];
const THEMES: ReadonlyArray<ThemeId> = ['T1', 'T2', 'T3', 'T4', 'T5'];

interface CardView<K extends string> {
  bg: Phaser.GameObjects.Graphics;
  rect: Phaser.Geom.Rectangle;
  key: K;
  locked: boolean;
}

/**
 * 두 번째 프로젝트부터 진입. 장르 3종 × 테마 3종을 독립 선택해 newProject로 GameState를 만든 뒤
 * AssignmentScene으로 인계한다.
 */
export class GenreSelectScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.GenreSelect;

  private productIndex = 1;
  private gold = 0;
  private officeLevel: 1 | 2 | 3 = 1;
  private reputation = 0;
  private policy: CompanyPolicy = DEFAULT_POLICY;
  private trend: TrendStatus | null = null;
  private employees: ReadonlyArray<Employee> = [];
  private lastResult: SavedResult | null = null;
  private rnd: RndState = EMPTY_RND;
  private facilities: FacilityState = EMPTY_FACILITIES;
  private markets: MarketState = EMPTY_MARKETS;
  /** 직전 프로젝트 슬롯 배정 — newProject로 전달해 자동 복원. */
  private lastAssignment: Assignment = {};
  /** 직전 프로젝트 support 배정 — newProject로 전달해 자동 복원. */
  private lastSupport: import('@/domain/types').SupportAssignment = {};
  /** 출시 이력 — 시장 포화 힌트 표시에 사용. */
  private history: ReadonlyArray<SavedResult> = [];
  /** 파산 상태 — newProject로 전달. */
  private bankruptcy: import('@/domain/bankruptcy').BankruptcyState | undefined = undefined;
  /** 임원 압박 상태 — newProject로 전달. */
  private exec: import('@/domain/exec').ExecState | undefined = undefined;
  /** 경기 사이클 상태 — newProject로 전달. */
  private economy: EconomyState | undefined = undefined;
  /** 경쟁사 출시 이력 — newProject로 전달. */
  private rivals: RivalState | undefined = undefined;

  private selectedGenre: GenreId | null = null;
  private selectedTheme: ThemeId | null = null;

  private genreCards = new Map<GenreId, CardView<GenreId>>();
  private themeCards = new Map<ThemeId, CardView<ThemeId>>();

  private nextBtnBg!: Phaser.GameObjects.Graphics;
  private nextBtnText!: Phaser.GameObjects.Text;
  private nextBtnRect!: Phaser.Geom.Rectangle;

  private statusText!: Phaser.GameObjects.Text;
  /** 매 create() 시 갱신. */
  private cx = 360;
  private contentX = 0;

  constructor() {
    super({ key: SCENE_KEYS.GenreSelect });
  }

  init(data: {
    productIndex: number;
    gold: number;
    officeLevel?: 1 | 2 | 3;
    reputation?: number;
    policy?: CompanyPolicy;
    trend?: TrendStatus | null;
    employees: ReadonlyArray<Employee>;
    lastResult: SavedResult | null;
    rnd?: RndState;
    facilities?: FacilityState;
    markets?: MarketState;
    lastAssignment?: Assignment;
    lastSupport?: import('@/domain/types').SupportAssignment;
    history?: ReadonlyArray<SavedResult>;
    bankruptcy?: import('@/domain/bankruptcy').BankruptcyState;
    exec?: import('@/domain/exec').ExecState;
    economy?: EconomyState;
    rivals?: RivalState;
  }): void {
    this.productIndex = data.productIndex;
    this.gold = data.gold;
    this.officeLevel = data.officeLevel ?? 1;
    this.reputation = data.reputation ?? 0;
    this.policy = data.policy ?? DEFAULT_POLICY;
    this.trend = data.trend ?? null;
    this.employees = data.employees;
    this.lastResult = data.lastResult;
    this.rnd = data.rnd ?? EMPTY_RND;
    this.facilities = data.facilities ?? EMPTY_FACILITIES;
    this.markets = data.markets ?? EMPTY_MARKETS;
    this.lastAssignment = data.lastAssignment ?? {};
    this.lastSupport = data.lastSupport ?? {};
    this.history = data.history ?? [];
    this.bankruptcy = data.bankruptcy;
    this.exec = data.exec;
    this.economy = data.economy;
    this.rivals = data.rivals;
    this.selectedGenre = null;
    this.selectedTheme = null;
  }

  create(): void {
    fitCamera(this);
    // logical 720×1280 좌표 고정 — viewport 크기 무관.
    this.cx = 360;
    this.contentX = 0;
    BGM.resume();
    BGM.setMood('calm');
    this.buildHeader();
    this.buildGenreRow();
    this.buildThemeRow();
    this.buildStatus();
    this.buildNextButton();
    addMuteToggle(this);
    this.redrawAll();
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
    this.add.text(this.cx, 56, `${this.productIndex + 1}번째 프로젝트 — 장르·테마 선택`, titleStyle).setOrigin(0.5);

    // 코인 아이콘이 가장 왼쪽에 붙도록 골드를 첫 segment에 두고, 그 뒤에 지난 프로젝트.
    const subParts: string[] = [`보유 ${formatGold(this.gold)}`];
    if (this.lastResult) {
      const stars = '★'.repeat(this.lastResult.stars) + '☆'.repeat(5 - this.lastResult.stars);
      subParts.push(`지난 프로젝트 ${stars} (${this.lastResult.reviewScore}점)`);
    }

    const text = this.add
      .text(this.cx, 88, subParts.join('  ·  '), {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
    this.add
      .image(text.x - text.width / 2 - 8, 88, ICONS.coins.key)
      .setDisplaySize(13, 13)
      .setOrigin(1, 0.5)
      .setTint(TINT.warn);

    // 현재 트렌드 표시 — 매출 보정의 핵심 결정 정보
    if (this.trend) {
      const t = TRENDS[this.trend.id];
      this.add
        .text(this.cx, 112, `📈 현재 트렌드 · ${t.name} (남은 ${this.trend.remainingProjects}작)`, {
          fontFamily: FONT_STACK,
          fontSize: '21px',
          fontStyle: 'bold',
          color: TEXT_COLOR.warn,
        })
        .setOrigin(0.5);
      this.add
        .text(this.cx, 128, t.desc, {
          fontFamily: FONT_STACK,
          fontSize: '20px',
          color: TEXT_COLOR.dim,
        })
        .setOrigin(0.5);
    }
  }

  // ────────────────────────── genre row ──────────────────────────
  private buildGenreRow(): void {
    this.add
      .text(this.cx, 140, '장르', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    this.layoutCards<GenreId>(
      GENRES,
      this.genreCards,
      170,
      (id) => GENRE_LABEL[id],
      (id) => ICONS[GENRE_ICON[id]].key,
      (id) => this.handleGenreTap(id),
      (id) => this.trendMulFor('genre', id),
      (id) => isGenreUnlocked(id, this.productIndex),
      (id) => GENRE_UNLOCK[id].minProductCount,
    );
  }

  private buildThemeRow(): void {
    this.add
      .text(this.cx, 440, '테마', {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    this.layoutCards<ThemeId>(
      THEMES,
      this.themeCards,
      470,
      (id) => THEME_LABEL[id],
      (id) => ICONS[THEME_ICON[id]].key,
      (id) => this.handleThemeTap(id),
      (id) => this.trendMulFor('theme', id),
      (id) => isThemeUnlocked(id, this.productIndex),
      (id) => THEME_UNLOCK[id].minProductCount,
    );
  }

  /** 트렌드의 해당 장르/테마 매출 보정 (1.0이면 변화 없음). */
  private trendMulFor(kind: 'genre' | 'theme', id: GenreId | ThemeId): number {
    if (!this.trend) return 1;
    const t = TRENDS[this.trend.id];
    return (
      (kind === 'genre'
        ? t.genreMul[id as GenreId]
        : t.themeMul[id as ThemeId]) ?? 1
    );
  }

  /**
   * 5칸 가로 카드 레이아웃 — cardW 130px, gap 5px, 총 670px (GAME_WIDTH 720 기준 여백 25px×2).
   * 잠긴 카드는 opacity 0.4, 자물쇠 표시, 클릭 무시.
   */
  private layoutCards<K extends string>(
    keys: ReadonlyArray<K>,
    out: Map<K, CardView<K>>,
    topY: number,
    label: (k: K) => { name: string; desc: string },
    iconKey: (k: K) => string,
    onTap: (k: K) => void,
    trendMul?: (k: K) => number,
    isUnlocked?: (k: K) => boolean,
    minCount?: (k: K) => number,
  ): void {
    const cardW = 130;
    const cardH = 230;
    const gap = 5;
    const totalW = cardW * 5 + gap * 4;
    const startX = this.contentX + (720 - totalW) / 2;

    keys.forEach((k, i) => {
      const x = startX + i * (cardW + gap);
      const y = topY;
      const rect = new Phaser.Geom.Rectangle(x, y, cardW, cardH);
      const bg = this.add.graphics();
      const data = label(k);
      const unlocked = isUnlocked ? isUnlocked(k) : true;
      const alpha = unlocked ? 1 : 0.4;

      // 코드 (G1 등) — 좌상단 작게
      this.add
        .text(x + 10, y + 10, k, {
          fontFamily: FONT_STACK,
          fontSize: '18px',
          color: TEXT_COLOR.dim,
        })
        .setOrigin(0, 0)
        .setAlpha(alpha);

      // 트렌드 보정 배지 — 해금 카드만, 우상단
      if (unlocked) {
        const mul = trendMul ? trendMul(k) : 1;
        if (Math.abs(mul - 1) > 0.001) {
          const pct = Math.round((mul - 1) * 100);
          const isPositive = pct > 0;
          this.add
            .text(x + cardW - 8, y + 10, `${isPositive ? '+' : ''}${pct}%`, {
              fontFamily: FONT_STACK,
              fontSize: '18px',
              fontStyle: 'bold',
              color: isPositive ? TEXT_COLOR.ok : TEXT_COLOR.bad,
            })
            .setOrigin(1, 0);
        }
      }

      // 메인 아이콘 — 카드 상단 가운데
      this.add
        .image(x + cardW / 2, y + 56, iconKey(k))
        .setDisplaySize(32, 32)
        .setOrigin(0.5)
        .setTint(unlocked ? TINT.dim : 0x555566)
        .setAlpha(alpha);

      this.add
        .text(x + cardW / 2, y + 108, data.name, {
          fontFamily: FONT_STACK,
          fontSize: '23px',
          fontStyle: 'bold',
          color: unlocked ? TEXT_COLOR.primary : TEXT_COLOR.disabled,
          align: 'center',
          wordWrap: { width: cardW - 12, useAdvancedWrap: true },
        })
        .setOrigin(0.5)
        .setAlpha(alpha);

      if (unlocked) {
        // 해금 카드: desc 표시
        this.add
          .text(x + cardW / 2, y + 168, data.desc, {
            fontFamily: FONT_STACK,
            fontSize: '18px',
            color: TEXT_COLOR.dim,
            align: 'center',
            wordWrap: { width: cardW - 12, useAdvancedWrap: true },
          })
          .setOrigin(0.5);
      } else {
        // 잠긴 카드: 자물쇠 + 해금 조건
        this.add
          .text(x + cardW / 2, y + 158, '🔒', {
            fontSize: '30px',
          })
          .setOrigin(0.5)
          .setAlpha(0.6);

        const req = minCount ? minCount(k) : 0;
        this.add
          .text(x + cardW / 2, y + 190, `${req}판 출시 후 해금`, {
            fontFamily: FONT_STACK,
            fontSize: '17px',
            color: TEXT_COLOR.disabled,
            align: 'center',
            wordWrap: { width: cardW - 12, useAdvancedWrap: true },
          })
          .setOrigin(0.5);
      }

      if (unlocked) {
        // 해금 카드만 상호작용 등록
        const hit = this.add
          .zone(x + cardW / 2, y + cardH / 2, cardW, cardH)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => onTap(k));
      }

      out.set(k, { bg, rect, key: k, locked: !unlocked });
    });
  }

  // ────────────────────────── status + next ──────────────────────────
  private buildStatus(): void {
    this.statusText = this.add
      .text(this.cx, 744, '', {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        color: TEXT_COLOR.dim,
        align: 'center',
        wordWrap: { width: 640, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  private buildNextButton(): void {
    const w = 360;
    const h = 72;
    const x = this.cx - w / 2;
    const y = 828;
    this.nextBtnRect = new Phaser.Geom.Rectangle(x, y, w, h);
    this.nextBtnBg = this.add.graphics();
    this.nextBtnText = this.add
      .text(this.cx, y + h / 2, '다음으로', {
        fontFamily: FONT_STACK,
        fontSize: '30px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);

    const hit = this.add.zone(this.cx, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.handleNext());
  }

  // ────────────────────────── interactions ──────────────────────────
  private handleGenreTap(id: GenreId): void {
    playSfx(this, SFX.tap);
    this.selectedGenre = id;
    this.redrawAll();
  }

  private handleThemeTap(id: ThemeId): void {
    playSfx(this, SFX.tap);
    this.selectedTheme = id;
    this.redrawAll();
  }

  private handleNext(): void {
    if (!this.selectedGenre || !this.selectedTheme) return;
    playSfx(this, SFX.click, 0.55);
    const state = newProject({
      productIndex: this.productIndex,
      genre: this.selectedGenre,
      theme: this.selectedTheme,
      gold: this.gold,
      employees: this.employees,
      appealEnabled: this.productIndex >= 1,
      officeLevel: this.officeLevel,
      reputation: this.reputation,
      policy: this.policy,
      trend: this.trend,
      rnd: this.rnd,
      facilities: this.facilities,
      markets: this.markets,
      assignment: this.lastAssignment,
      support: Object.keys(this.lastSupport).length > 0 ? this.lastSupport : undefined,
      ...(this.bankruptcy ? { bankruptcy: this.bankruptcy } : {}),
      ...(this.exec ? { exec: this.exec } : {}),
      ...(this.economy ? { economy: this.economy } : {}),
      ...(this.rivals ? { rivals: this.rivals } : {}),
    });
    this.scene.start(SCENE_KEYS.Assignment, { state, lastResult: this.lastResult });
  }

  // ────────────────────────── render ──────────────────────────
  private redrawAll(): void {
    this.drawCardSet(this.genreCards, this.selectedGenre);
    this.drawCardSet(this.themeCards, this.selectedTheme);
    this.updateStatus();
    this.drawNextButton();
  }

  private drawCardSet<K extends string>(map: Map<K, CardView<K>>, selected: K | null): void {
    for (const view of map.values()) {
      const sel = view.key === selected;
      const locked = view.locked;
      view.bg.clear();
      // 잠긴 카드: 어두운 배경 + 낮은 불투명도
      view.bg.fillStyle(locked ? COLOR.panelEmpty : (sel ? COLOR.panel : COLOR.panelEmpty), locked ? 0.4 : 1);
      view.bg.lineStyle(sel ? 3 : 1, sel ? COLOR.selected : COLOR.panelStroke, locked ? 0.3 : 1);
      view.bg.fillRoundedRect(view.rect.x, view.rect.y, view.rect.width, view.rect.height, 10);
      view.bg.strokeRoundedRect(view.rect.x, view.rect.y, view.rect.width, view.rect.height, 10);
    }
  }

  private updateStatus(): void {
    if (!this.selectedGenre && !this.selectedTheme) {
      const forecast = forecastRivalReleases(this.productIndex);
      const strongest = [...forecast].sort((a, b) => b.stars - a.stars || b.revenue - a.revenue)[0];
      const competition = strongest
        ? `이번 분기 경쟁작 ${forecast.length}개 · 최대 위협 ${this.rivalReleaseLabel(strongest)}`
        : '이번 분기는 경쟁사 출시가 조용합니다.';
      this.statusText
        .setText(`장르와 테마를 각각 하나씩 선택하세요.\n${competition}`)
        .setColor(TEXT_COLOR.dim);
      return;
    }
    if (this.selectedGenre && this.selectedTheme) {
      const g = GENRE_LABEL[this.selectedGenre];
      const t = THEME_LABEL[this.selectedTheme];
      const hint = saturationHint(this.history, this.selectedGenre, this.selectedTheme);
      const pressure = forecastRivalPressure(this.selectedGenre, this.selectedTheme, this.productIndex, this.rivals);
      const baseText = `선택: ${g.name} × ${t.name}`;
      const competitionBase = pressure.matchedReleases.length > 0
        ? `AI 경쟁 ${pressure.pressure}: ${pressure.matchedReleases.length}개 경쟁작 · 예상 매출 압박 ×${pressure.revenueMul.toFixed(1)}`
        : 'AI 경쟁 낮음: 직접 경쟁작이 적어 안정적인 출시 구간입니다.';
      const competitionText = hint ? `${competitionBase} · 포화 주의` : competitionBase;
      if (hint) {
        this.statusText.setText(`${baseText}\n${competitionText}`).setColor(TEXT_COLOR.warn);
      } else {
        const statusColor = pressure.pressure === '정면승부' || pressure.pressure === '높음'
          ? TEXT_COLOR.warn
          : TEXT_COLOR.ok;
        this.statusText.setText(`${baseText}\n${competitionText}`).setColor(statusColor);
      }
      return;
    }
    this.statusText.setText('아직 한 가지가 선택되지 않았습니다.').setColor(TEXT_COLOR.dim);
  }

  private rivalReleaseLabel(release: RivalRelease): string {
    const rival = RIVALS.find((r) => r.id === release.rivalId);
    const rivalName = rival?.name ?? release.rivalId;
    return `${rivalName} ${GENRE_LABEL[release.genre].name}/${THEME_LABEL[release.theme].name} ★${release.stars}`;
  }

  private drawNextButton(): void {
    const ready = this.selectedGenre !== null && this.selectedTheme !== null;
    const r = this.nextBtnRect;
    this.nextBtnBg.clear();
    this.nextBtnBg.fillStyle(ready ? COLOR.btn : COLOR.btnDisabled, 1);
    this.nextBtnBg.fillRoundedRect(r.x, r.y, r.width, r.height, 14);
    this.nextBtnText.setColor(ready ? TEXT_COLOR.primary : TEXT_COLOR.disabled);
  }
}
