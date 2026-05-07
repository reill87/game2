import Phaser from 'phaser';
import type { Types } from 'phaser';

import { GAME_WIDTH } from '@/constants';
import { GENRE_LABEL, newProject, THEME_LABEL } from '@/domain/seed';
import type { Employee, GenreId, ThemeId } from '@/domain/types';
import { ICONS } from '@/icons';
import type { SavedResult } from '@/save';
import { COLOR, FONT_STACK, TEXT_COLOR, TINT } from '@/theme';
import { applyHiDPI } from '@/util/hidpi';

import { SCENE_KEYS } from './keys';

const CX = GAME_WIDTH / 2;

const GENRES: ReadonlyArray<GenreId> = ['G1', 'G2', 'G3'];
const THEMES: ReadonlyArray<ThemeId> = ['T1', 'T2', 'T3'];

interface CardView<K extends string> {
  bg: Phaser.GameObjects.Graphics;
  rect: Phaser.Geom.Rectangle;
  key: K;
}

/**
 * 두 번째 작품부터 진입. 장르 3종 × 테마 3종을 독립 선택해 newProject로 GameState를 만든 뒤
 * AssignmentScene으로 인계한다.
 */
export class GenreSelectScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.GenreSelect;

  private productIndex = 1;
  private gold = 0;
  private employees: ReadonlyArray<Employee> = [];
  private lastResult: SavedResult | null = null;

  private selectedGenre: GenreId | null = null;
  private selectedTheme: ThemeId | null = null;

  private genreCards = new Map<GenreId, CardView<GenreId>>();
  private themeCards = new Map<ThemeId, CardView<ThemeId>>();

  private nextBtnBg!: Phaser.GameObjects.Graphics;
  private nextBtnText!: Phaser.GameObjects.Text;
  private nextBtnRect!: Phaser.Geom.Rectangle;

  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEYS.GenreSelect });
  }

  init(data: {
    productIndex: number;
    gold: number;
    employees: ReadonlyArray<Employee>;
    lastResult: SavedResult | null;
  }): void {
    this.productIndex = data.productIndex;
    this.gold = data.gold;
    this.employees = data.employees;
    this.lastResult = data.lastResult;
    this.selectedGenre = null;
    this.selectedTheme = null;
  }

  create(): void {
    this.buildHeader();
    this.buildGenreRow();
    this.buildThemeRow();
    this.buildStatus();
    this.buildNextButton();
    this.redrawAll();
    applyHiDPI(this);
  }

  // ────────────────────────── header ──────────────────────────
  private buildHeader(): void {
    const titleStyle: Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_STACK,
      fontSize: '24px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    };
    this.add.text(CX, 56, `${this.productIndex + 1}번째 작품 — 장르·테마 선택`, titleStyle).setOrigin(0.5);

    // 코인 아이콘이 가장 왼쪽에 붙도록 골드를 첫 segment에 두고, 그 뒤에 지난 작품.
    const subParts: string[] = [`보유 ${this.gold}g`];
    if (this.lastResult) {
      const stars = '★'.repeat(this.lastResult.stars) + '☆'.repeat(5 - this.lastResult.stars);
      subParts.push(`지난 작품 ${stars} (${this.lastResult.reviewScore}점)`);
    }

    const text = this.add
      .text(CX, 92, subParts.join('  ·  '), {
        fontFamily: FONT_STACK,
        fontSize: '13px',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);
    this.add
      .image(text.x - text.width / 2 - 8, 92, ICONS.coins.key)
      .setDisplaySize(13, 13)
      .setOrigin(1, 0.5)
      .setTint(TINT.warn);
  }

  // ────────────────────────── genre row ──────────────────────────
  private buildGenreRow(): void {
    this.add
      .text(CX, 140, '장르', {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        fontStyle: 'bold',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    this.layoutCards<GenreId>(GENRES, this.genreCards, 170, (id) => GENRE_LABEL[id], (id) =>
      this.handleGenreTap(id),
    );
  }

  private buildThemeRow(): void {
    this.add
      .text(CX, 470, '테마', {
        fontFamily: FONT_STACK,
        fontSize: '14px',
        fontStyle: 'bold',
        color: TEXT_COLOR.dim,
      })
      .setOrigin(0.5);

    this.layoutCards<ThemeId>(THEMES, this.themeCards, 500, (id) => THEME_LABEL[id], (id) =>
      this.handleThemeTap(id),
    );
  }

  private layoutCards<K extends string>(
    keys: ReadonlyArray<K>,
    out: Map<K, CardView<K>>,
    topY: number,
    label: (k: K) => { name: string; desc: string },
    onTap: (k: K) => void,
  ): void {
    const cardW = 200;
    const cardH = 250;
    const gap = 14;
    const totalW = cardW * 3 + gap * 2;
    const startX = (GAME_WIDTH - totalW) / 2;

    keys.forEach((k, i) => {
      const x = startX + i * (cardW + gap);
      const y = topY;
      const rect = new Phaser.Geom.Rectangle(x, y, cardW, cardH);
      const bg = this.add.graphics();
      const data = label(k);

      this.add
        .text(x + cardW / 2, y + 36, k, {
          fontFamily: FONT_STACK,
          fontSize: '12px',
          color: TEXT_COLOR.dim,
        })
        .setOrigin(0.5);

      this.add
        .text(x + cardW / 2, y + 90, data.name, {
          fontFamily: FONT_STACK,
          fontSize: '17px',
          fontStyle: 'bold',
          color: TEXT_COLOR.primary,
          align: 'center',
          wordWrap: { width: cardW - 20, useAdvancedWrap: true },
        })
        .setOrigin(0.5);

      this.add
        .text(x + cardW / 2, y + 170, data.desc, {
          fontFamily: FONT_STACK,
          fontSize: '12px',
          color: TEXT_COLOR.dim,
          align: 'center',
          wordWrap: { width: cardW - 20, useAdvancedWrap: true },
        })
        .setOrigin(0.5);

      const hit = this.add
        .zone(x + cardW / 2, y + cardH / 2, cardW, cardH)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => onTap(k));

      out.set(k, { bg, rect, key: k });
    });
  }

  // ────────────────────────── status + next ──────────────────────────
  private buildStatus(): void {
    this.statusText = this.add
      .text(CX, 800, '', {
        fontFamily: FONT_STACK,
        fontSize: '13px',
        color: TEXT_COLOR.dim,
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80, useAdvancedWrap: true },
      })
      .setOrigin(0.5);
  }

  private buildNextButton(): void {
    const w = 360;
    const h = 72;
    const x = CX - w / 2;
    const y = 1140;
    this.nextBtnRect = new Phaser.Geom.Rectangle(x, y, w, h);
    this.nextBtnBg = this.add.graphics();
    this.nextBtnText = this.add
      .text(CX, y + h / 2, '다음으로', {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        fontStyle: 'bold',
        color: TEXT_COLOR.primary,
      })
      .setOrigin(0.5);

    const hit = this.add.zone(CX, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.handleNext());
  }

  // ────────────────────────── interactions ──────────────────────────
  private handleGenreTap(id: GenreId): void {
    this.selectedGenre = id;
    this.redrawAll();
  }

  private handleThemeTap(id: ThemeId): void {
    this.selectedTheme = id;
    this.redrawAll();
  }

  private handleNext(): void {
    if (!this.selectedGenre || !this.selectedTheme) return;
    const state = newProject({
      productIndex: this.productIndex,
      genre: this.selectedGenre,
      theme: this.selectedTheme,
      gold: this.gold,
      employees: this.employees,
      appealEnabled: this.productIndex >= 1,
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
      view.bg.clear();
      view.bg.fillStyle(sel ? COLOR.panel : COLOR.panelEmpty, 1);
      view.bg.lineStyle(sel ? 3 : 1, sel ? COLOR.selected : COLOR.panelStroke, 1);
      view.bg.fillRoundedRect(view.rect.x, view.rect.y, view.rect.width, view.rect.height, 14);
      view.bg.strokeRoundedRect(view.rect.x, view.rect.y, view.rect.width, view.rect.height, 14);
    }
  }

  private updateStatus(): void {
    if (!this.selectedGenre && !this.selectedTheme) {
      this.statusText.setText('장르와 테마를 각각 하나씩 선택하세요.').setColor(TEXT_COLOR.dim);
      return;
    }
    if (this.selectedGenre && this.selectedTheme) {
      const g = GENRE_LABEL[this.selectedGenre];
      const t = THEME_LABEL[this.selectedTheme];
      this.statusText
        .setText(`선택: ${g.name} × ${t.name}`)
        .setColor(TEXT_COLOR.ok);
      return;
    }
    this.statusText.setText('아직 한 가지가 선택되지 않았습니다.').setColor(TEXT_COLOR.dim);
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
