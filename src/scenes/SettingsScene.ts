/**
 * 설정 씬 — BGM/SFX 볼륨 조정, 음소거 토글, 회사명 변경, 저장 데이터 초기화.
 *
 * 진입: ResultScene 사옥 패널 헤더의 [⚙ 설정] 버튼.
 * 닫기: returnTo 씬으로 복귀 (기본 ResultScene).
 *
 * 화면 구성 (logical 720×1280):
 *  - 헤더 "설정" + [← 닫기]
 *  - BGM 볼륨 슬라이더 (0~100)
 *  - SFX 볼륨 슬라이더 (0~100)
 *  - BGM 음소거 토글
 *  - 회사명 변경 (DOM input)
 *  - 저장 데이터 정보 (출시 수, 누적 매출, 저장 시각)
 *  - 저장 데이터 초기화 (빨간 버튼 + confirm 모달)
 *  - 게임 정보 (버전)
 */
import Phaser from 'phaser';

import { BGM } from '@/bgm';
import { setSfxVolume, getSfxVolume, playSfx, SFX } from '@/sounds';
import {
  clearData,
  loadData,
  replaceLocalSave,
  saveData,
  saveSettings,
  loadSettings,
  DEFAULT_COMPANY_NAME,
} from '@/save';
import { DEFAULT_POLICY } from '@/domain/seed';
import { EMPTY_RND } from '@/domain/rnd';
import { EMPTY_MARKETS } from '@/domain/markets';
import { EMPTY_ACQUISITIONS } from '@/domain/acquisitions';
import { COLOR, FONT_STACK, TEXT_COLOR } from '@/theme';
import { formatGold, createModal, createButton } from '@/ui';
import {
  fetchOwnNickname,
  getSessionUserId,
  isLoggedIn,
  loadCloudSave,
  pushNow,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '@/cloud/sync';
import { isSupabaseEnabled } from '@/cloud/supabase';
import { applyHiDPI } from '@/util/hidpi';
import { makePanel } from '@/util/ui';
import { fitCamera } from '@/util/cameraFit';
import { onResize } from '@/util/viewport';

import { SCENE_KEYS } from './keys';

/** 슬라이더 핸들 반경(logical px). */
const HANDLE_R = 18;
/** 슬라이더 트랙 너비. */
const TRACK_W = 500;
/** 트랙 높이. */
const TRACK_H = 8;

/** 간단한 수평 슬라이더 뷰. */
interface SliderView {
  trackBg: Phaser.GameObjects.Graphics;
  trackFill: Phaser.GameObjects.Graphics;
  handle: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  trackX: number;
  trackY: number;
  /** 현재 값 0~1. */
  value: number;
}

export class SettingsScene extends Phaser.Scene {
  static readonly KEY = SCENE_KEYS.Settings;

  /** 닫기 시 복귀할 씬 키. */
  private returnTo: string = SCENE_KEYS.Result;

  /** logical 좌표 기준점. */
  private cx = 360;
  private contentX = 0;

  /** 삭제 confirm 모달 컨테이너. */
  private confirmContainer: Phaser.GameObjects.Container | null = null;
  /** 회사명 DOM input. */
  private companyInput: Phaser.GameObjects.DOMElement | null = null;

  private bgmSlider!: SliderView;
  private sfxSlider!: SliderView;
  private muteBtn!: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; rect: Phaser.Geom.Rectangle; hit: Phaser.GameObjects.Zone };

  constructor() {
    super({ key: SCENE_KEYS.Settings });
  }

  init(data: { returnTo?: string }): void {
    this.returnTo = data?.returnTo ?? SCENE_KEYS.Result;
    this.confirmContainer = null;
    this.companyInput = null;
  }

  create(): void {
    fitCamera(this);
    this.cx = 360;
    this.contentX = 0;

    BGM.resume();

    // 어두운 풀스크린 배경
    const bg = this.add.graphics();
    bg.fillStyle(0x0e0e12, 1);
    bg.fillRect(0, 0, 720, 1280);

    this.buildHeader();
    this.buildVolumeSection();
    this.buildMuteToggle();
    this.buildCompanySection();
    this.buildSaveInfoSection();
    this.buildGameInfo();

    applyHiDPI(this);
    onResize(this, () => {
      // DOM input 정리 후 씬 재시작
      this.companyInput?.destroy();
      this.scene.restart({ returnTo: this.returnTo });
    });
  }

  // ────────────────────────── 헤더 ──────────────────────────
  private buildHeader(): void {
    this.add.text(this.cx, 60, '설정', {
      fontFamily: FONT_STACK,
      fontSize: '40px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    }).setOrigin(0.5);

    // 닫기 버튼
    const btnW = 140;
    const btnH = 48;
    const btnX = this.contentX + 14;
    const btnY = 14;
    const closeBg = this.add.graphics();
    closeBg.fillStyle(COLOR.btnSecondary, 1);
    closeBg.fillRoundedRect(btnX, btnY, btnW, btnH, 12);
    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '← 닫기', {
      fontFamily: FONT_STACK,
      fontSize: '24px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    }).setOrigin(0.5);

    const closeHit = this.add
      .zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerup', () => {
      playSfx(this, SFX.tap);
      this.companyInput?.destroy();
      this.scene.start(this.returnTo);
    });
  }

  // ────────────────────────── 볼륨 슬라이더 ──────────────────────────
  private buildVolumeSection(): void {
    const sectionY = 120;
    const settings = loadSettings();

    // 섹션 라벨
    this.add.text(this.cx, sectionY, '볼륨', {
      fontFamily: FONT_STACK,
      fontSize: '28px',
      fontStyle: 'bold',
      color: TEXT_COLOR.warn,
    }).setOrigin(0.5);

    // BGM 슬라이더
    const bgmInitial = settings.bgmVolume; // 0~1
    this.bgmSlider = this.buildSlider(sectionY + 50, 'BGM', bgmInitial, (v) => {
      BGM.setVolume(v);
      this.saveCurrentSettings();
    });

    // SFX 슬라이더
    const sfxInitial = settings.sfxVolume;
    this.sfxSlider = this.buildSlider(sectionY + 130, 'SFX', sfxInitial, (v) => {
      setSfxVolume(v);
      playSfx(this, SFX.tap);
      this.saveCurrentSettings();
    });
  }

  /**
   * 슬라이더 생성. trackY는 트랙 중앙 y.
   * onChange: value(0~1) 전달.
   */
  private buildSlider(
    topY: number,
    labelStr: string,
    initialValue: number,
    onChange: (v: number) => void,
  ): SliderView {
    const trackX = this.contentX + (720 - TRACK_W) / 2;
    const trackY = topY + 36;

    // 라벨 + 퍼센트
    const labelText = this.add.text(trackX, topY, '', {
      fontFamily: FONT_STACK,
      fontSize: '24px',
      color: TEXT_COLOR.dim,
    });
    const updateLabel = (v: number): void => {
      labelText.setText(`${labelStr}  ${Math.round(v * 100)}`);
    };
    updateLabel(initialValue);

    // 트랙 배경
    const trackBg = this.add.graphics();
    trackBg.fillStyle(COLOR.gaugeBg, 1);
    trackBg.fillRoundedRect(trackX, trackY - TRACK_H / 2, TRACK_W, TRACK_H, TRACK_H / 2);

    // 트랙 채움
    const trackFill = this.add.graphics();
    // 핸들
    const handle = this.add.graphics();

    const view: SliderView = {
      trackBg,
      trackFill,
      handle,
      label: labelText,
      zone: this.add.zone(0, 0, 1, 1), // 아래에서 재생성
      trackX,
      trackY,
      value: initialValue,
    };

    const drawSlider = (v: number): void => {
      view.value = v;
      const fillW = Math.max(HANDLE_R, v * TRACK_W);
      trackFill.clear();
      trackFill.fillStyle(COLOR.btn, 1);
      trackFill.fillRoundedRect(trackX, trackY - TRACK_H / 2, fillW, TRACK_H, TRACK_H / 2);

      const hx = trackX + v * TRACK_W;
      handle.clear();
      handle.fillStyle(0xffffff, 1);
      handle.fillCircle(hx, trackY, HANDLE_R);
      handle.fillStyle(COLOR.btn, 1);
      handle.fillCircle(hx, trackY, HANDLE_R - 5);

      updateLabel(v);
    };
    drawSlider(initialValue);

    // 드래그 존 — 트랙 전체 + 핸들 영역 포함 (높이 넉넉히)
    const zoneH = HANDLE_R * 2 + 12;
    const zone = this.add
      .zone(trackX + TRACK_W / 2, trackY, TRACK_W + HANDLE_R * 2, zoneH)
      .setInteractive({ draggable: true, useHandCursor: true });
    view.zone = zone;

    const calcValue = (pointerX: number): number => {
      // fitCamera로 zoom이 적용되므로 camera zoom 반영
      const zoom = this.cameras.main.zoom;
      const rawX = (pointerX - this.cameras.main.x) / zoom - trackX;
      return Math.max(0, Math.min(1, rawX / TRACK_W));
    };

    zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const v = calcValue(ptr.x);
      drawSlider(v);
      onChange(v);
    });
    zone.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown) return;
      const v = calcValue(ptr.x);
      drawSlider(v);
      onChange(v);
    });

    return view;
  }

  // ────────────────────────── 음소거 토글 ──────────────────────────
  private buildMuteToggle(): void {
    const y = 360;
    const btnW = 300;
    const btnH = 52;
    const btnX = this.cx - btnW / 2;

    const bg = this.add.graphics();
    const text = this.add.text(this.cx, y + btnH / 2, '', {
      fontFamily: FONT_STACK,
      fontSize: '26px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    }).setOrigin(0.5);

    const rect = new Phaser.Geom.Rectangle(btnX, y, btnW, btnH);
    this.muteBtn = { bg, text, rect, hit: this.add.zone(this.cx, y + btnH / 2, btnW, btnH).setInteractive({ useHandCursor: true }) };

    const drawMute = (): void => {
      const muted = BGM.isMuted();
      bg.clear();
      bg.fillStyle(muted ? COLOR.matchBad : COLOR.btnSecondary, 1);
      bg.fillRoundedRect(btnX, y, btnW, btnH, 12);
      text.setText(muted ? '🔇 BGM 음소거 해제' : '🔊 BGM 음소거');
    };
    drawMute();

    this.muteBtn.hit.on('pointerup', () => {
      BGM.toggleMute();
      BGM.resume();
      playSfx(this, SFX.toggle);
      drawMute();
    });
  }

  // ────────────────────────── 회사명 변경 ──────────────────────────
  private buildCompanySection(): void {
    const sectionY = 440;
    const saved = loadData();
    const currentName = saved?.companyName ?? DEFAULT_COMPANY_NAME;

    this.add.text(this.cx, sectionY, '회사명', {
      fontFamily: FONT_STACK,
      fontSize: '28px',
      fontStyle: 'bold',
      color: TEXT_COLOR.warn,
    }).setOrigin(0.5);

    // DOM input — Phaser DOM 엘리먼트
    const inputStyle = [
      'width: 460px',
      'height: 52px',
      'padding: 0 16px',
      'border: 2px solid #4a4a62',
      'border-radius: 10px',
      'background: #20202a',
      'color: #f2f2f7',
      'font-size: 22px',
      'font-family: "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
      'outline: none',
      'box-sizing: border-box',
    ].join('; ');

    // fitCamera 기준 logical 좌표 → Phaser DOM은 CSS px 기준이므로 카메라 zoom 반영
    const inputEl = this.add.dom(this.cx, sectionY + 52, 'input', inputStyle);
    const node = inputEl.node as HTMLInputElement;
    node.type = 'text';
    node.value = currentName;
    node.maxLength = 20;
    node.placeholder = DEFAULT_COMPANY_NAME;
    this.companyInput = inputEl;

    // 저장 버튼
    const saveBtnW = 160;
    const saveBtnH = 48;
    const saveBtnX = this.cx - saveBtnW / 2;
    const saveBtnY = sectionY + 52 + 36;

    const saveBg = this.add.graphics();
    saveBg.fillStyle(COLOR.btn, 1);
    saveBg.fillRoundedRect(saveBtnX, saveBtnY, saveBtnW, saveBtnH, 12);
    this.add.text(this.cx, saveBtnY + saveBtnH / 2, '저장', {
      fontFamily: FONT_STACK,
      fontSize: '24px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    }).setOrigin(0.5);

    const saveHit = this.add
      .zone(this.cx, saveBtnY + saveBtnH / 2, saveBtnW, saveBtnH)
      .setInteractive({ useHandCursor: true });

    const feedbackText = this.add.text(this.cx, saveBtnY + saveBtnH + 14, '', {
      fontFamily: FONT_STACK,
      fontSize: '21px',
      color: TEXT_COLOR.ok,
    }).setOrigin(0.5);

    saveHit.on('pointerup', () => {
      const raw = node.value.trim();
      const name = raw.length > 0 ? raw.slice(0, 20) : DEFAULT_COMPANY_NAME;
      // 기존 saveData 유지하며 companyName만 갱신
      const existing = loadData();
      if (existing) {
        saveData({
          gold: existing.gold,
          productCount: existing.productCount,
          officeLevel: existing.officeLevel,
          hiredEmployees: existing.hiredEmployees,
          lastResult: existing.lastResult ?? null,
          reputation: existing.reputation ?? 0,
          policy: existing.policy ?? DEFAULT_POLICY,
          trend: existing.trend ?? null,
          history: existing.history,
          endingsShown: existing.endingsShown,
          employees: existing.employees,
          rnd: existing.rnd ?? EMPTY_RND,
          milestones: existing.milestones,
          facilities: existing.facilities,
          markets: existing.markets ?? EMPTY_MARKETS,
          acquisitions: existing.acquisitions ?? EMPTY_ACQUISITIONS,
          lastAssignment: existing.lastAssignment,
          lastSupport: existing.lastSupport,
          mails: existing.mails,
          bankruptcy: existing.bankruptcy,
          exec: existing.exec,
          economy: existing.economy,
          rivals: existing.rivals,
          lateGame: existing.lateGame,
          companyName: name,
        });
      }
      node.value = name;
      playSfx(this, SFX.success);
      feedbackText.setText('저장됨 ✓');
      this.time.delayedCall(1500, () => feedbackText.setText(''));
    });
  }

  // ────────────────────────── 저장 데이터 정보 ──────────────────────────
  private buildSaveInfoSection(): void {
    const sectionY = 700;
    const saved = loadData();

    this.add.text(this.cx, sectionY, '저장 데이터', {
      fontFamily: FONT_STACK,
      fontSize: '28px',
      fontStyle: 'bold',
      color: TEXT_COLOR.warn,
    }).setOrigin(0.5);

    // 정보 패널
    const panelX = this.contentX + 30;
    const panelW = 660;
    const panelH = 110;
    makePanel(this, panelX, sectionY + 26, panelW, panelH, COLOR.panel);

    if (saved) {
      const totalRevenue = (saved.history ?? []).reduce((s, r) => s + r.revenue, 0);
      const savedAtStr = saved.savedAt
        ? new Date(saved.savedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        : '알 수 없음';

      this.add.text(panelX + 20, sectionY + 38, `출시 작품: ${saved.productCount}개`, {
        fontFamily: FONT_STACK, fontSize: '23px', color: TEXT_COLOR.primary,
      });
      this.add.text(panelX + 20, sectionY + 64, `누적 매출: ${formatGold(totalRevenue)}`, {
        fontFamily: FONT_STACK, fontSize: '23px', color: TEXT_COLOR.primary,
      });
      this.add.text(panelX + 20, sectionY + 90, `마지막 저장: ${savedAtStr}`, {
        fontFamily: FONT_STACK, fontSize: '20px', color: TEXT_COLOR.dim,
      });
    } else {
      this.add.text(panelX + 20, sectionY + 62, '저장 데이터 없음', {
        fontFamily: FONT_STACK, fontSize: '23px', color: TEXT_COLOR.dim,
      });
    }

    // 데이터 초기화 버튼
    const delBtnW = 300;
    const delBtnH = 52;
    const delBtnX = this.cx - delBtnW / 2;
    const delBtnY = sectionY + 26 + panelH + 16;

    const delBg = this.add.graphics();
    delBg.fillStyle(COLOR.matchBad, 1);
    delBg.fillRoundedRect(delBtnX, delBtnY, delBtnW, delBtnH, 12);
    this.add.text(this.cx, delBtnY + delBtnH / 2, '저장 데이터 초기화', {
      fontFamily: FONT_STACK,
      fontSize: '24px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    }).setOrigin(0.5);

    const delHit = this.add
      .zone(this.cx, delBtnY + delBtnH / 2, delBtnW, delBtnH)
      .setInteractive({ useHandCursor: true });
    delHit.on('pointerup', () => {
      playSfx(this, SFX.modal);
      this.showDeleteConfirm();
    });

    // 클라우드 동기화 버튼 — 모달 오픈.
    const cloudBtnY = delBtnY + delBtnH + 16;
    const cloudBg = this.add.graphics();
    cloudBg.fillStyle(COLOR.btn, 1);
    cloudBg.fillRoundedRect(delBtnX, cloudBtnY, delBtnW, delBtnH, 12);
    this.add.text(this.cx, cloudBtnY + delBtnH / 2, '☁ 클라우드 동기화', {
      fontFamily: FONT_STACK,
      fontSize: '24px',
      fontStyle: 'bold',
      color: TEXT_COLOR.primary,
    }).setOrigin(0.5);
    const cloudHit = this.add
      .zone(this.cx, cloudBtnY + delBtnH / 2, delBtnW, delBtnH)
      .setInteractive({ useHandCursor: true });
    cloudHit.on('pointerup', () => {
      playSfx(this, SFX.modal);
      void this.openCloudModal();
    });
  }

  // ────────────────────────── 게임 정보 ──────────────────────────
  private buildGameInfo(): void {
    const y = 1200;
    this.add.text(this.cx, y, 'Game2 — Indie Studio Sim  v0.5', {
      fontFamily: FONT_STACK,
      fontSize: '20px',
      color: TEXT_COLOR.disabled,
    }).setOrigin(0.5);
  }

  // ────────────────────────── 삭제 confirm 모달 ──────────────────────────
  private showDeleteConfirm(): void {
    if (this.confirmContainer) return;

    const c = this.add.container(0, 0).setDepth(100);
    // 반투명 오버레이
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, 720, 1280);
    c.add(overlay);

    const panelW = 580;
    const panelH = 220;
    const panelX = this.cx - panelW / 2;
    const panelY = 500;
    c.add(makePanel(this, panelX, panelY, panelW, panelH, COLOR.panel));

    c.add(this.add.text(this.cx, panelY + 36, '정말 삭제하시겠습니까?', {
      fontFamily: FONT_STACK, fontSize: '28px', fontStyle: 'bold', color: TEXT_COLOR.bad,
    }).setOrigin(0.5));

    c.add(this.add.text(this.cx, panelY + 80, '모든 진행 데이터가 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.', {
      fontFamily: FONT_STACK, fontSize: '22px', color: TEXT_COLOR.dim, align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5));

    const btnY = panelY + 148;
    const halfW = (panelW - 60) / 2;

    // 취소
    const cancelBg = this.add.graphics();
    cancelBg.fillStyle(COLOR.btnSecondary, 1);
    cancelBg.fillRoundedRect(panelX + 20, btnY, halfW, 48, 10);
    c.add(cancelBg);
    c.add(this.add.text(panelX + 20 + halfW / 2, btnY + 24, '취소', {
      fontFamily: FONT_STACK, fontSize: '24px', fontStyle: 'bold', color: TEXT_COLOR.primary,
    }).setOrigin(0.5));
    const cancelHit = this.add
      .zone(panelX + 20 + halfW / 2, btnY + 24, halfW, 48)
      .setInteractive({ useHandCursor: true });
    cancelHit.on('pointerup', () => {
      playSfx(this, SFX.tap);
      c.destroy(true);
      this.confirmContainer = null;
    });
    c.add(cancelHit);

    // 삭제 확인
    const okX = panelX + 20 + halfW + 20;
    const okBg = this.add.graphics();
    okBg.fillStyle(COLOR.matchBad, 1);
    okBg.fillRoundedRect(okX, btnY, halfW, 48, 10);
    c.add(okBg);
    c.add(this.add.text(okX + halfW / 2, btnY + 24, '삭제', {
      fontFamily: FONT_STACK, fontSize: '24px', fontStyle: 'bold', color: TEXT_COLOR.primary,
    }).setOrigin(0.5));
    const okHit = this.add
      .zone(okX + halfW / 2, btnY + 24, halfW, 48)
      .setInteractive({ useHandCursor: true });
    okHit.on('pointerup', () => {
      clearData();
      playSfx(this, SFX.success);
      c.destroy(true);
      this.confirmContainer = null;
      // Boot로 이동해 처음부터 시작
      this.companyInput?.destroy();
      this.scene.start(SCENE_KEYS.Boot);
    });
    c.add(okHit);

    this.confirmContainer = c;
    applyHiDPI(this);
  }

  // ────────────────────────── 볼륨 설정 저장 ──────────────────────────
  private saveCurrentSettings(): void {
    saveSettings({
      bgmVolume: this.bgmSlider?.value ?? BGM.getVolume(),
      sfxVolume: this.sfxSlider?.value ?? getSfxVolume(),
    });
  }

  // ────────────────────────── 클라우드 동기화 모달 ──────────────────────────
  /**
   * Supabase 활성화 시 가입/로그인/sync UI. 미설정 시 안내만.
   * Native HTML input 사용 (Phaser DOM과 동일 패턴).
   */
  private async openCloudModal(): Promise<void> {
    if (!isSupabaseEnabled()) {
      const modal = createModal(this, {
        w: 600, h: 320,
        category: 'office',
        title: '☁ 클라우드 동기화',
        subtitle: '환경변수 미설정 — 로컬만 사용',
        depth: 200,
      });
      modal.layer.add(
        this.add.text(modal.panel.x + 24, modal.panel.y + 110,
          'VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를\n.env에 설정해야 활성화됩니다.\n\n자세한 내용은 docs/supabase-schema.sql 참조.',
          { fontFamily: FONT_STACK, fontSize: '20px', color: TEXT_COLOR.dim, wordWrap: { width: 540 } },
        ),
      );
      return;
    }

    // 세션 조회 → 로그인 상태 분기.
    await getSessionUserId();
    if (isLoggedIn()) {
      void this.openCloudLoggedInModal();
    } else {
      void this.openCloudAuthModal();
    }
  }

  /** 비로그인 상태 — 가입/로그인 폼. */
  private async openCloudAuthModal(): Promise<void> {
    const modal = createModal(this, {
      w: 620, h: 720,
      category: 'office',
      title: '☁ 클라우드 동기화',
      subtitle: '회원가입 또는 로그인 후 자동 백업',
      depth: 200,
    });
    const { layer } = modal;
    const { x: panelX, y: panelY } = modal.panel;

    // Native HTML inputs (Phaser DOM 우회).
    const inputs: HTMLInputElement[] = [];
    const makeInput = (placeholder: string, type: string, topPx: number): HTMLInputElement => {
      const el = document.createElement('input');
      el.type = type;
      el.placeholder = placeholder;
      el.autocomplete = 'off';
      el.style.cssText = [
        'position: fixed',
        'left: 50%',
        `top: ${topPx}px`,
        'transform: translateX(-50%)',
        'width: min(80vw, 360px)',
        'height: 44px',
        'padding: 0 14px',
        'border: 2px solid #4a4a62',
        'border-radius: 12px',
        'background: #20202a',
        'color: #f2f2f7',
        'font-size: 17px',
        'font-family: "Apple SD Gothic Neo","Malgun Gothic",sans-serif',
        'outline: none',
        'box-sizing: border-box',
        'z-index: 9999',
      ].join('; ');
      document.body.appendChild(el);
      inputs.push(el);
      return el;
    };

    // viewport 좌표로 배치 — 화면 중앙 기준.
    const baseTop = window.innerHeight / 2 - 140;
    const emailInput = makeInput('이메일', 'email', baseTop);
    const passwordInput = makeInput('비밀번호 (6자 이상)', 'password', baseTop + 56);
    const nicknameInput = makeInput('닉네임 (가입 시만, 최대 20자)', 'text', baseTop + 112);
    nicknameInput.maxLength = 20;

    const cleanup = (): void => inputs.forEach((el) => el.remove());

    // 상태 텍스트.
    const statusY = panelY + 380;
    const statusText = this.add.text(panelX + 24, statusY, '', {
      fontFamily: FONT_STACK, fontSize: '18px', color: TEXT_COLOR.warn,
      wordWrap: { width: 560 },
    });
    layer.add(statusText);

    // 가입 버튼.
    const signUpBtn = createButton(this, {
      x: panelX + 24, y: panelY + 460, w: 264, h: 50,
      label: '회원가입',
      variant: 'primary',
      onTap: async () => {
        statusText.setText('가입 처리 중...');
        const r = await signUpWithEmail(emailInput.value, passwordInput.value, nicknameInput.value);
        if (r.ok) {
          statusText.setColor(TEXT_COLOR.ok).setText('가입 성공! 잠시 후 동기화...');
          // 가입 직후 로컬 save를 cloud에 push.
          const local = loadData();
          if (local) await pushNow(local);
          this.time.delayedCall(800, () => {
            cleanup();
            modal.close();
            void this.openCloudLoggedInModal();
          });
        } else {
          statusText.setColor(TEXT_COLOR.bad).setText(`실패: ${r.reason}`);
        }
      },
    });
    layer.add([signUpBtn.bg, signUpBtn.text, signUpBtn.hit]);

    // 로그인 버튼.
    const signInBtn = createButton(this, {
      x: panelX + 320, y: panelY + 460, w: 264, h: 50,
      label: '로그인',
      variant: 'secondary',
      onTap: async () => {
        statusText.setText('로그인 처리 중...');
        const r = await signInWithEmail(emailInput.value, passwordInput.value);
        if (r.ok) {
          statusText.setColor(TEXT_COLOR.ok).setText('로그인 성공!');
          this.time.delayedCall(600, () => {
            cleanup();
            modal.close();
            void this.openCloudLoggedInModal();
          });
        } else {
          statusText.setColor(TEXT_COLOR.bad).setText(`실패: ${r.reason}`);
        }
      },
    });
    layer.add([signInBtn.bg, signInBtn.text, signInBtn.hit]);

    // 닫기 시 input 정리.
    modal.onClose = (): void => cleanup();
  }

  /** 로그인 상태 — 닉네임/sync 상태/로그아웃. */
  private async openCloudLoggedInModal(): Promise<void> {
    const nick = (await fetchOwnNickname()) ?? '익명';
    const cloud = await loadCloudSave();
    const local = loadData();

    const cloudUpdated = cloud
      ? new Date(cloud.updatedAt).toLocaleString('ko-KR', {
          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        })
      : '없음';
    const localSavedAt = local?.savedAt
      ? new Date(local.savedAt).toLocaleString('ko-KR', {
          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        })
      : '없음';

    const modal = createModal(this, {
      w: 620, h: 600,
      category: 'office',
      title: '☁ 클라우드 동기화',
      subtitle: `${nick} 님 · 자동 백업 활성`,
      depth: 200,
    });
    const { layer } = modal;
    const { x: panelX, y: panelY } = modal.panel;

    // 상태 정보.
    const infoLines = [
      `로컬 저장: ${localSavedAt}`,
      `클라우드 저장: ${cloudUpdated}`,
      !cloud
        ? '클라우드에 저장 없음 — [지금 업로드]로 생성'
        : cloud && local && (cloud.data.savedAt ?? 0) > local.savedAt
        ? '⚠ 클라우드가 더 최신 — [클라우드 사용]으로 덮어쓰기'
        : '✓ 동기화 됨',
    ];
    layer.add(
      this.add.text(panelX + 24, panelY + 110, infoLines.join('\n\n'), {
        fontFamily: FONT_STACK, fontSize: '20px', color: TEXT_COLOR.primary,
        lineSpacing: 6,
      }),
    );

    const statusText = this.add.text(panelX + 24, panelY + 360, '', {
      fontFamily: FONT_STACK, fontSize: '18px', color: TEXT_COLOR.warn,
    });
    layer.add(statusText);

    // 지금 동기화 (push).
    const pushBtn = createButton(this, {
      x: panelX + 24, y: panelY + 410, w: 264, h: 50,
      label: '↑ 지금 업로드',
      variant: 'primary',
      onTap: async () => {
        if (!local) {
          statusText.setColor(TEXT_COLOR.bad).setText('로컬 저장 없음');
          return;
        }
        statusText.setText('업로드 중...');
        const ok = await pushNow(local);
        statusText.setColor(ok ? TEXT_COLOR.ok : TEXT_COLOR.bad)
          .setText(ok ? '업로드 완료!' : '업로드 실패');
      },
    });
    layer.add([pushBtn.bg, pushBtn.text, pushBtn.hit]);

    // 클라우드 사용 (pull → 로컬 덮어쓰기).
    const pullBtn = createButton(this, {
      x: panelX + 320, y: panelY + 410, w: 264, h: 50,
      label: '↓ 클라우드 사용',
      variant: 'secondary',
      disabled: !cloud,
      onTap: () => {
        if (!cloud) return;
        try {
          if (!replaceLocalSave(cloud.data)) {
            statusText.setColor(TEXT_COLOR.bad).setText('로컬 저장 적용 실패');
            return;
          }
          statusText.setColor(TEXT_COLOR.ok).setText('적용 완료. Boot로 재시작...');
          this.time.delayedCall(1000, () => this.scene.start(SCENE_KEYS.Boot));
        } catch (e) {
          statusText.setColor(TEXT_COLOR.bad).setText(`실패: ${(e as Error).message}`);
        }
      },
    });
    layer.add([pullBtn.bg, pullBtn.text, pullBtn.hit]);

    // 로그아웃.
    const signOutBtn = createButton(this, {
      x: panelX + 24, y: panelY + 480, w: 560, h: 46,
      label: '로그아웃',
      variant: 'ghost',
      onTap: async () => {
        const r = await signOut();
        statusText.setColor(r.ok ? TEXT_COLOR.dim : TEXT_COLOR.bad)
          .setText(r.ok ? '로그아웃 됨' : `실패: ${r.reason}`);
        if (r.ok) {
          this.time.delayedCall(600, () => modal.close());
        }
      },
    });
    layer.add([signOutBtn.bg, signOutBtn.text, signOutBtn.hit]);
  }
}
