import Phaser from 'phaser';
import { DEFAULT_POLICY, newTutorialGame, pickRandomTrend, TUTORIAL_EMPLOYEES } from '@/domain/seed';
import { EMPTY_RND, type RndState } from '@/domain/rnd';
import { EMPTY_FACILITIES, type FacilityState } from '@/domain/facilities';
import { EMPTY_MARKETS, type MarketState } from '@/domain/markets';
import { EMPTY_ACQUISITIONS, type AcquisitionState } from '@/domain/acquisitions';
import { computePrestigeBonus } from '@/domain/prestige';
import type { CompanyPolicy, Employee, GameState, OfficeLevel, TrendStatus } from '@/domain/types';
import type { BankruptcyState } from '@/domain/bankruptcy';
import type { ExecState } from '@/domain/exec';
import { preloadAvatars } from '@/avatars';
import { BGM } from '@/bgm';
import { preloadEventCategories } from '@/eventCategoryAssets';
import { ICON_DIR, ICONS } from '@/icons';
import { preloadIllustrations } from '@/illustrations';
import {
  loadData,
  loadPrestigeCount,
  replaceLocalSave,
  saveData,
  loadSettings,
  DEFAULT_COMPANY_NAME,
  type SaveData,
  type SavedResult,
} from '@/save';
import { setSfxVolume, preloadSfx } from '@/sounds';
import { drawRaisedRect, drawScreenBackdrop, preloadUITextures } from '@/util/ui';
import { fitCamera } from '@/util/cameraFit';
import { COLOR, TEXT_COLOR, TYPE } from '@/theme';
import { isSupabaseEnabled } from '@/cloud/supabase';
import { loadCloudSave, pushNow, signInWithEmail, signUpWithEmail, getSessionUserId, isLoggedIn } from '@/cloud/sync';
import { SCENE_KEYS } from './keys';

type QaBootTarget = 'genre' | 'assignment' | 'development';

function getQaBootTarget(): QaBootTarget | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('qa') ?? params.get('dev');
  if (raw === 'genre') return 'genre';
  if (raw === 'assignment') return 'assignment';
  if (raw === 'development' || raw === 'dev') return 'development';
  return null;
}

function makeQaState(): GameState {
  const base = newTutorialGame();
  return {
    ...base,
    gold: 640,
    productIndex: 1,
    availableAp: 4,
    assignment: {
      planning: 'emp-planner',
      graphics: 'emp-designer',
      programming: 'emp-programmer',
    },
    project: {
      ...base.project,
      appeal: 35,
      appealEnabled: true,
    },
  };
}

/**
 * 진입점. localStorage에서 진행 상태를 읽어 라우팅을 결정한다:
 *  - 첫 프로젝트(productCount=0): G1+T1 고정 — Assignment 직행
 *  - 두 번째 이상: GenreSelect 경유 (장르·테마 선택 후 Assignment)
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Boot });
  }

  preload(): void {
    for (const { key, file } of Object.values(ICONS)) {
      this.load.svg(key, `${ICON_DIR}/${file}`, { width: 32, height: 32 });
    }
    preloadUITextures(this);
    preloadIllustrations(this);
    preloadAvatars(this);
    preloadEventCategories(this);
    preloadSfx(this);

    // 모든 자산 로드 완료 후 초기 스피너 제거.
    this.load.once('complete', () => {
      document.getElementById('initial-loader')?.remove();
    });
  }

  create(): void {
    // 저장된 볼륨 설정 복원.
    const settings = loadSettings();
    BGM.setVolume(settings.bgmVolume);
    setSfxVolume(settings.sfxVolume);

    // 첫 입력 후 AudioContext resume — 브라우저 자동재생 정책 우회.
    this.input.once('pointerdown', () => {
      BGM.resume();
      BGM.setMood('calm');
    });

    const qaTarget = getQaBootTarget();
    if (qaTarget) {
      const state = makeQaState();
      if (qaTarget === 'genre') {
        this.scene.start(SCENE_KEYS.GenreSelect, {
          productIndex: state.productIndex,
          gold: state.gold,
          employees: state.employees,
          lastResult: null,
          officeLevel: state.officeLevel,
          reputation: state.reputation,
          policy: state.policy,
          trend: state.trend,
          rnd: state.rnd,
          facilities: state.facilities,
          markets: state.markets,
          economy: state.economy,
          rivals: state.rivals,
          lateGame: state.lateGame,
        });
        return;
      }
      this.scene.start(qaTarget === 'assignment' ? SCENE_KEYS.Assignment : SCENE_KEYS.Development, {
        state,
        isOnboarding: false,
      });
      return;
    }

    const saved = loadData();
    if (isSupabaseEnabled()) {
      void this.requireLoginBeforeBoot(saved, () => this.continueBoot(loadData()));
      return;
    }

    this.continueBoot(saved);
  }

  private continueBoot(saved: SaveData | null): void {
    const productIndex = saved?.productCount ?? 0;
    const gold = saved?.gold ?? 0;
    const officeLevel: OfficeLevel = saved?.officeLevel ?? 1;
    const reputation = saved?.reputation ?? 0;
    const policy: CompanyPolicy = saved?.policy ?? DEFAULT_POLICY;
    // 트렌드 — saved 값이 없거나 만료(null)면 새로 결정.
    const trend: TrendStatus = saved?.trend ?? pickRandomTrend();
    // R&D 영구 업그레이드 상태.
    const rnd: RndState = saved?.rnd ?? EMPTY_RND;
    // 회사 시설 상태.
    const facilities: FacilityState = saved?.facilities ?? EMPTY_FACILITIES;
    // 글로벌 시장 진출 상태.
    const markets: MarketState = saved?.markets ?? EMPTY_MARKETS;
    // 자회사 인수 상태.
    const acquisitions: AcquisitionState = saved?.acquisitions ?? EMPTY_ACQUISITIONS;
    const lateGame = saved?.lateGame;
    // 프레스티지 보너스 — 별도 키에서 로드, clearData와 독립.
    const prestigeCount = loadPrestigeCount();
    const prestigeBonus = computePrestigeBonus(prestigeCount);
    // 신규 데이터(employees 필드 보유) → 튜토리얼+채용 직원 모두 포함된 풀 리스트.
    // 옛 데이터 → TUTORIAL_EMPLOYEES + hiredEmployees 머지로 폴백.
    const employees: ReadonlyArray<Employee> = saved?.employees?.length
      ? saved.employees
      : saved?.hiredEmployees?.length
        ? [...TUTORIAL_EMPLOYEES, ...saved.hiredEmployees]
        : TUTORIAL_EMPLOYEES;
    const lastResult: SavedResult | null = saved?.lastResult ?? null;

    // 직전 슬롯 배정 — 현재 직원 id가 여전히 존재하는 항목만 필터링 (6 슬롯 포함).
    const empIds = new Set(employees.map((e) => e.id));
    const filteredAssignment: NonNullable<typeof saved>['lastAssignment'] = {};
    if (saved?.lastAssignment) {
      for (const slot of ['planning', 'graphics', 'qa', 'programming', 'marketing', 'data'] as const) {
        const id = saved.lastAssignment[slot];
        if (id && empIds.has(id)) filteredAssignment[slot] = id;
      }
    }

    // 직전 support 배정 — 현재 직원 id가 여전히 존재하는 항목만 필터링 (6 슬롯 포함).
    const filteredSupport: NonNullable<typeof saved>['lastSupport'] = {};
    if (saved?.lastSupport) {
      for (const slot of ['planning', 'graphics', 'qa', 'programming', 'marketing', 'data'] as const) {
        const id = saved.lastSupport[slot];
        if (id && empIds.has(id)) filteredSupport[slot] = id;
      }
    }
    const hasFilteredSupport = Object.keys(filteredSupport).length > 0;

    if (productIndex === 0) {
      // 프레스티지 보너스를 newTutorialGame에 전달 — 시작 골드 + 직원 skill 가산.
      const fresh = newTutorialGame(rnd, prestigeCount > 0 ? prestigeBonus : undefined);
      const state = {
        ...fresh,
        employees,
        gold: fresh.gold + gold, // fresh.gold 이미 startingGoldBonus 포함, saved gold 이월 추가.
        officeLevel,
        reputation,
        policy,
        trend,
        rnd,
        facilities,
        markets,
        acquisitions,
        ...(lateGame ? { lateGame } : {}),
        ...(prestigeCount > 0 ? { prestigeBonus } : {}),
      };
      const carry: { lastResult?: SavedResult } = {};
      if (lastResult) carry.lastResult = lastResult;

      if (!saved?.companyName) {
        this.showCompanyNameModal(() => {
          this.routeAfterSplash(SCENE_KEYS.Assignment, { state, ...carry });
        });
        return;
      }

      this.routeAfterSplash(SCENE_KEYS.Assignment, { state, ...carry });
      return;
    }

    const history = saved?.history ?? [];
    const bankruptcy: BankruptcyState | undefined = saved?.bankruptcy;
    const exec: ExecState | undefined = saved?.exec;
    const economy = saved?.economy;
    const rivals = saved?.rivals;
    this.routeAfterSplash(SCENE_KEYS.GenreSelect, {
      productIndex,
      gold,
      officeLevel,
      reputation,
      policy,
      trend,
      employees,
      lastResult,
      rnd,
      facilities,
      markets,
      history,
      lastAssignment: filteredAssignment,
      ...(hasFilteredSupport ? { lastSupport: filteredSupport } : {}),
      ...(prestigeCount > 0 ? { prestigeBonus } : {}),
      ...(bankruptcy ? { bankruptcy } : {}),
      ...(exec ? { exec } : {}),
      ...(economy ? { economy } : {}),
      ...(rivals ? { rivals } : {}),
      ...(lateGame ? { lateGame } : {}),
    });
  }

  private routeAfterSplash(sceneKey: string, data?: object): void {
    fitCamera(this);
    this.children.removeAll();
    const layer = this.add.container(0, 0);
    layer.add(drawScreenBackdrop(this, 0.98));
    const mark = this.add.text(360, 502, '(주)판교개발', {
      ...TYPE.hero,
      color: TEXT_COLOR.primary,
    }).setOrigin(0.5);
    const tag = this.add.text(360, 560, '출시하고, 버티고, 더 큰 사무실로', {
      ...TYPE.lead,
      color: TEXT_COLOR.dim,
    }).setOrigin(0.5);
    const bar = this.add.graphics();
    drawRaisedRect(bar, 220, 630, 280, 10, COLOR.btn, {
      radius: 5,
      shadow: false,
      gloss: true,
    });
    layer.add([mark, tag, bar]);
    this.tweens.add({
      targets: [mark, tag, bar],
      alpha: { from: 0, to: 1 },
      y: '-=10',
      duration: 280,
      ease: 'Cubic.easeOut',
    });
    this.time.delayedCall(520, () => this.scene.start(sceneKey, data));
  }

  /**
   * 회사명 입력 모달. DOM input 사용. 완료 시 onDone() 호출.
   * 첫 진입(productIndex=0, companyName 없음)에서 한 번만 표시.
   */
  private showCompanyNameModal(onDone: () => void): void {
    // BootScene은 평소엔 즉시 scene.start로 넘어가므로 fitCamera를 안 부르지만,
    // 모달을 띄울 땐 720×1280 logical을 viewport에 맞춰야 DOM input 위치도 맞음.
    fitCamera(this);
    this.scale.on('resize', () => fitCamera(this));

    // 어두운 배경
    drawScreenBackdrop(this);

    // 텍스트
    this.add.text(360, 460, '회사명을 입력하세요', {
      fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
      fontSize: '34px',
      fontStyle: 'bold',
      color: '#f2f2f7',
    }).setOrigin(0.5);

    this.add.text(360, 510, '최대 20자 · 나중에 설정에서 변경 가능', {
      fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
      fontSize: '22px',
      color: '#9b9bb0',
    }).setOrigin(0.5);

    // Native HTML input — Phaser DOM은 모바일에서 위치/가시성 불안정해 직접 body에 attach.
    // 캔버스 위에 절대 좌표로 띄우고 onDone 시 제거.
    const node = document.createElement('input');
    node.type = 'text';
    node.placeholder = DEFAULT_COMPANY_NAME;
    node.maxLength = 20;
    node.autocomplete = 'off';
    node.autocapitalize = 'off';
    node.spellcheck = false;
    node.style.cssText = [
      'position: fixed',
      'left: 50%',
      'top: 50%',
      'transform: translate(-50%, -50%)',
      'width: min(80vw, 360px)',
      'height: 48px',
      'padding: 0 14px',
      'border: 2px solid #4a4a62',
      'border-radius: 12px',
      'background: #20202a',
      'color: #f2f2f7',
      'font-size: 18px',
      'font-family: "Apple SD Gothic Neo","Malgun Gothic",sans-serif',
      'outline: none',
      'box-sizing: border-box',
      'text-align: center',
      'z-index: 9999',
    ].join('; ');
    document.body.appendChild(node);
    // 자동 포커스 — 모바일은 키보드 자동 펼침은 막혀있을 수 있음.
    setTimeout(() => node.focus(), 100);

    // 씬이 떠날 때 input 제거 보장.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => node.remove());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => node.remove());

    // 시작 버튼
    const btnW = 280;
    const btnH = 60;
    const btnX = 360 - btnW / 2;
    const btnY = 820;
    const btnBg = this.add.graphics();
    drawRaisedRect(btnBg, btnX, btnY, btnW, btnH, COLOR.btn, { radius: 14 });
    this.add.text(360, btnY + btnH / 2, '게임 시작', {
      fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#f2f2f7',
    }).setOrigin(0.5);

    const hit = this.add
      .zone(360, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerup', () => {
      const raw = node.value.trim();
      const name = raw.length > 0 ? raw.slice(0, 20) : DEFAULT_COMPANY_NAME;
      // 저장 — 현재 저장 데이터가 없을 수 있으므로 최소 데이터로 기록
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
          rnd: existing.rnd,
          milestones: existing.milestones,
          facilities: existing.facilities,
          markets: existing.markets,
          acquisitions: existing.acquisitions,
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
      node.remove();
      onDone();
    });
  }

  private async requireLoginBeforeBoot(localSave: SaveData | null, onReady: () => void): Promise<void> {
    await getSessionUserId();
    if (!isLoggedIn()) {
      this.showLoginForm(localSave, onReady);
      return;
    }
    await this.reconcileCloudAfterAuth(localSave, onReady);
  }

  private async reconcileCloudAfterAuth(
    localSave: SaveData | null,
    onReady: () => void,
    setStatus?: (message: string, color: string) => void,
  ): Promise<void> {
    setStatus?.('클라우드 저장 확인 중...', '#f2c94c');
    const cloud = await loadCloudSave();
    const localSavedAt = localSave?.savedAt ?? 0;
    const cloudSavedAt = cloud?.data.savedAt ?? 0;

    if (cloud && cloudSavedAt >= localSavedAt) {
      if (!replaceLocalSave(cloud.data)) {
        setStatus?.('클라우드 저장 적용 실패', '#e55f5f');
        return;
      }
      setStatus?.('클라우드 저장을 불러왔습니다.', '#3ec07b');
      this.time.delayedCall(350, () => this.scene.restart());
      return;
    }

    if (localSave) {
      setStatus?.('로컬 저장을 클라우드에 업로드 중...', '#f2c94c');
      await pushNow(localSave);
      setStatus?.('클라우드 동기화 준비 완료.', '#3ec07b');
    } else {
      setStatus?.('새 클라우드 세이브를 시작합니다.', '#3ec07b');
    }
    this.time.delayedCall(350, onReady);
  }

  /**
   * 인라인 로그인 폼 — 이메일/비밀번호 입력 + 로그인.
   * 성공 → cloud pull → localStorage 적용 후 Boot 재시작.
   */
  private showLoginForm(localSave: SaveData | null, onReady: () => void): void {
    // 기존 환영 모달 제거 (간단히 화면 다시 그림).
    this.children.removeAll();
    fitCamera(this);
    drawScreenBackdrop(this);

    this.add.text(360, 330, '로그인이 필요합니다', {
      fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#f2f2f7',
    }).setOrigin(0.5);

    this.add.text(360, 382, '저장 데이터 동기화를 위해 계정으로 시작합니다.', {
      fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
      fontSize: '18px',
      color: '#9b9bb0',
      align: 'center',
    }).setOrigin(0.5);

    // Native HTML inputs (Phaser DOM 우회).
    const inputs: HTMLInputElement[] = [];
    const baseTop = window.innerHeight / 2 - 88;
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
        'height: 48px',
        'padding: 0 14px',
        'border: 2px solid #4a4a62',
        'border-radius: 12px',
        'background: #20202a',
        'color: #f2f2f7',
        'font-size: 18px',
        'font-family: "Apple SD Gothic Neo","Malgun Gothic",sans-serif',
        'outline: none',
        'box-sizing: border-box',
        'z-index: 9999',
      ].join('; ');
      document.body.appendChild(el);
      inputs.push(el);
      return el;
    };
    const cleanup = (): void => inputs.forEach((el) => el.remove());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);

    const emailInput = makeInput('이메일', 'email', baseTop);
    const passwordInput = makeInput('비밀번호', 'password', baseTop + 60);
    const nicknameInput = makeInput('닉네임 (가입 시만)', 'text', baseTop + 120);
    nicknameInput.maxLength = 20;

    // 상태 텍스트.
    const statusText = this.add.text(360, 720, '', {
      fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
      fontSize: '20px',
      color: '#f2c94c',
      align: 'center',
      wordWrap: { width: 600 },
    }).setOrigin(0.5);
    const setStatus = (message: string, color: string): void => {
      statusText.setText(message).setColor(color);
    };

    // 로그인 버튼.
    const makeBtn = (y: number, label: string, color: number, onTap: () => void): void => {
      const w = 320;
      const h = 56;
      const x = 360 - w / 2;
      const btnBg = this.add.graphics();
      drawRaisedRect(btnBg, x, y, w, h, color, { radius: 14 });
      this.add.text(360, y + h / 2, label, {
        fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#f2f2f7',
      }).setOrigin(0.5);
      const hit = this.add.zone(360, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      hit.on('pointerup', onTap);
    };

    makeBtn(790, '로그인', 0x4f6fff, () => {
      void (async () => {
        setStatus('로그인 중...', '#f2c94c');
        const r = await signInWithEmail(emailInput.value, passwordInput.value);
        if (!r.ok) {
          setStatus(`실패: ${r.reason}`, '#e55f5f');
          return;
        }
        cleanup();
        await this.reconcileCloudAfterAuth(localSave, onReady, setStatus);
      })();
    });

    makeBtn(865, '회원가입 후 시작', 0x3a3a48, () => {
      void (async () => {
        setStatus('가입 처리 중...', '#f2c94c');
        const r = await signUpWithEmail(emailInput.value, passwordInput.value, nicknameInput.value);
        if (!r.ok) {
          setStatus(`실패: ${r.reason}`, '#e55f5f');
          return;
        }
        cleanup();
        await this.reconcileCloudAfterAuth(localSave, onReady, setStatus);
      })();
    });
  }
}
