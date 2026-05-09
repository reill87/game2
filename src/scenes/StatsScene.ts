/**
 * 누적 통계 화면.
 *  - 입력: 없음(localStorage에서 직접 로드)
 *  - 표시: 출시 누계, 평균 별점, 누적 매출, 최고 매출, 작품 이력 리스트(최근 → 과거)
 *  - 출구: 닫기 → 이전 씬(Result)으로 복귀
 */
import Phaser from 'phaser';

import type { GenreId, ThemeId } from '@/domain/types';
import { calendarFor } from '@/domain/calendar';
import { GENRE_LABEL, THEME_LABEL } from '@/domain/seed';
import { BGM } from '@/bgm';
import { ICONS } from '@/icons';
import { loadData, loadPrestigeCount, DEFAULT_COMPANY_NAME, type SavedResult } from '@/save';
import { playSfx, SFX } from '@/sounds';
import { COLOR, FONT_STACK, TEXT_COLOR, TINT } from '@/theme';
import { applyHiDPI } from '@/util/hidpi';
import { addMuteToggle } from '@/util/muteToggle';
import { makePanel } from '@/util/ui';
import { fitCamera } from '@/util/cameraFit';
import { onResize } from '@/util/viewport';

import { SCENE_KEYS } from './keys';

export class StatsScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.Stats;
  /** 닫기 시 돌아갈 씬 키. Result에서 호출 시 Result로 복귀. */
  private returnTo: string = SCENE_KEYS.Result;
  /** logical 720×1280 고정 좌표. */
  private cx = 360;
  private contentX = 0;

  constructor() {
    super({ key: SCENE_KEYS.Stats });
  }

  init(data: { returnTo?: string }): void {
    this.returnTo = data?.returnTo ?? SCENE_KEYS.Result;
  }

  create(): void {
    fitCamera(this);
    // logical 720×1280 좌표 고정 — viewport 크기 무관.
    this.cx = 360;
    this.contentX = 0;
    const saved = loadData();
    const history: ReadonlyArray<SavedResult> = saved?.history ?? [];
    const prestigeCount = loadPrestigeCount();

    BGM.resume();
    BGM.setMood('calm');
    addMuteToggle(this);
    const companyName = saved?.companyName ?? DEFAULT_COMPANY_NAME;
    this.buildHeader(history.length, companyName, prestigeCount);
    this.buildSummary(history);
    this.buildHistoryList(history);
    this.buildCloseButton();
    applyHiDPI(this);
    onResize(this, () => { this.scene.restart(); });
  }

  // ──────���─────────────────── header ──��───────────────────────
  private buildHeader(count: number, companyName: string, prestigeCount: number): void {
    this.add
      .text(this.cx, 60, `${companyName} 누적 통계`, {
        fontFamily: FONT_STACK,
        fontSize: '36px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);
    // 출시 작품 수 + 프레스티지 회수 (프레스티지 있을 때만 표시).
    const subText = prestigeCount > 0
      ? `${count}개 작품 출시  ·  🏆 프레스티지 ${prestigeCount}회`
      : `${count}개 작품 출시`;
    this.add
      .text(this.cx, 92, subText, {
        fontFamily: FONT_STACK,
        fontSize: '23px',
        color: prestigeCount > 0 ? TEXT_COLOR.warn : TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
  }

  // ────────────────────────── summary panel ──────────────────────────
  private buildSummary(history: ReadonlyArray<SavedResult>): void {
    const panelX = this.contentX + (720 - 660) / 2;
    const panelY = 130;
    const panelW = 660;
    const panelH = 220;

    makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);

    const totalRevenue = history.reduce((s, r) => s + r.revenue, 0);
    const avgStars =
      history.length > 0
        ? history.reduce((s, r) => s + r.stars, 0) / history.length
        : 0;
    const bestRevenue = history.reduce((m, r) => Math.max(m, r.revenue), 0);
    const fiveStarCount = history.filter((r) => r.stars === 5).length;

    // 2×2 그리드 카드.
    const cardW = (panelW - 60) / 2;
    const cardH = 88;
    const cards: ReadonlyArray<readonly [string, string, string]> = [
      ['누적 매출', `${totalRevenue}g`, TEXT_COLOR.ok],
      ['평균 별점', `★ ${avgStars.toFixed(2)}`, TEXT_COLOR.warn],
      ['최고 매출', `${bestRevenue}g`, TEXT_COLOR.ok],
      ['★5 출시', `${fiveStarCount}회`, TEXT_COLOR.warn],
    ];

    cards.forEach(([label, value, color], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = panelX + 20 + col * (cardW + 20);
      const y = panelY + 14 + row * (cardH + 14);
      makePanel(this, x, y, cardW, cardH, COLOR.panelEmpty, false);
      this.add.text(x + 16, y + 14, label, {
        fontFamily: FONT_STACK,
        fontSize: '21px',
        color: TEXT_COLOR.dim,
      });
      this.add.text(x + 16, y + 38, value, {
        fontFamily: FONT_STACK,
        fontSize: '36px',
        fontStyle: 'bold',
        color,
      });
    });
  }

  // ────────────────────────── history list ──────────────────────────
  private buildHistoryList(history: ReadonlyArray<SavedResult>): void {
    const panelX = this.contentX + (720 - 660) / 2;
    const panelY = 380;
    const panelW = 660;
    const panelH = 720;

    makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel);

    this.add.text(panelX + 20, panelY + 14, '출시 이력', {
      fontFamily: FONT_STACK,
      fontSize: '23px',
      fontStyle: 'bold',
      color: TEXT_COLOR.dim,
    });

    if (history.length === 0) {
      this.add
        .text(this.cx, panelY + panelH / 2, '아직 출시 이력이 없습니다.', {
          fontFamily: FONT_STACK,
          fontSize: '24px',
          color: TEXT_COLOR.dim,
        })
        .setOrigin(0.5);
      return;
    }

    // 최신 → 과거 순으로 표시. 상단에서 잘리지 않도록 panel 안에서만 그리되, 많을 경우 cap.
    const reversed = [...history].reverse();
    const rowH = 60;
    const maxRows = Math.floor((panelH - 50) / rowH);
    const rows = reversed.slice(0, maxRows);

    rows.forEach((r, i) => {
      const y = panelY + 44 + i * rowH;
      this.drawRow(panelX + 14, y, panelW - 28, rowH - 6, r, history.length - i);
    });

    if (reversed.length > maxRows) {
      this.add
        .text(this.cx, panelY + panelH - 16, `(이상 ${maxRows}개 표시)`, {
          fontFamily: FONT_STACK,
          fontSize: '20px',
          color: TEXT_COLOR.dim,
        })
        .setOrigin(0.5, 1);
    }
  }

  private drawRow(
    x: number,
    y: number,
    w: number,
    h: number,
    r: SavedResult,
    seq: number,
  ): void {
    makePanel(this, x, y, w, h, COLOR.panelEmpty, false);

    // 좌: 작품 번호 + 장르×테마
    const genre = GENRE_LABEL[r.genre as GenreId]?.name ?? r.genre;
    const theme = THEME_LABEL[r.theme as ThemeId]?.name ?? r.theme;
    // seq는 1-based 출시 순번 — calendarFor에 직접 전달.
    const cal = calendarFor(seq);
    this.add
      .text(x + 14, y + 8, `#${seq}  ${cal.year}년차 ${cal.quarter}`, {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        color: TEXT_COLOR.dim,
      });
    this.add.text(x + 14, y + 24, `${genre} × ${theme}`, {
      fontFamily: FONT_STACK,
      fontSize: '23px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    });
    const overdue = r.weeksElapsed > r.weeksTarget;
    const subParts = [
      `Week ${r.weeksElapsed}/${r.weeksTarget}${overdue ? '(연체)' : ''}`,
      `Bug ${r.bugDebt}`,
      r.polishCount > 0 ? `폴리싱 ${r.polishCount}` : null,
    ].filter((s): s is string => s !== null);
    this.add.text(x + 14, y + 42, subParts.join('  ·  '), {
      fontFamily: FONT_STACK,
      fontSize: '20px',
      color: TEXT_COLOR.dim,
    });

    // 우: 별 + 매출
    const starText = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
    const starColor =
      r.stars >= 4 ? TEXT_COLOR.ok : r.stars === 3 ? TEXT_COLOR.warn : TEXT_COLOR.bad;
    this.add
      .text(x + w - 14, y + 14, starText, {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        color: starColor,
      })
      .setOrigin(1, 0);
    this.add
      .text(x + w - 14, y + 36, `+${r.revenue}g`, {
        fontFamily: FONT_STACK,
        fontSize: '24px',
        fontStyle: 'bold',
        color: TEXT_COLOR.ok,
      })
      .setOrigin(1, 0);
  }

  // ────────────────────────── close button ──────────────────────────
  private buildCloseButton(): void {
    const w = 320;
    const h = 56;
    const x = this.cx - w / 2;
    const y = 1190;
    const rect = new Phaser.Geom.Rectangle(x, y, w, h);
    const bg = this.add.graphics();
    const draw = (pressed: boolean): void => {
      bg.clear();
      bg.fillStyle(pressed ? COLOR.btnSecondaryDown : COLOR.btnSecondary, 1);
      bg.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 12);
    };
    draw(false);

    this.add
      .text(this.cx, y + h / 2, '닫기', {
        fontFamily: FONT_STACK,
        fontSize: '27px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);

    const hit = this.add
      .zone(this.cx, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerup', () => {
      draw(false);
      playSfx(this, SFX.tap);
      this.scene.start(this.returnTo);
    });

    // 컴팩트 헤더 옆 아이콘 — Visual hint that data is from save (top-right).
    const iconX = this.contentX + 720 - 28;
    this.add
      .image(iconX, 60, ICONS.calendar.key)
      .setDisplaySize(18, 18)
      .setOrigin(0.5)
      .setTint(TINT.dim);
  }

}
