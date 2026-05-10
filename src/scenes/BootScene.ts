import Phaser from 'phaser';
import { DEFAULT_POLICY, newTutorialGame, pickRandomTrend, TUTORIAL_EMPLOYEES } from '@/domain/seed';
import { EMPTY_RND, type RndState } from '@/domain/rnd';
import { EMPTY_FACILITIES, type FacilityState } from '@/domain/facilities';
import { EMPTY_MARKETS, type MarketState } from '@/domain/markets';
import { EMPTY_ACQUISITIONS, type AcquisitionState } from '@/domain/acquisitions';
import { computePrestigeBonus } from '@/domain/prestige';
import type { CompanyPolicy, Employee, TrendStatus } from '@/domain/types';
import type { BankruptcyState } from '@/domain/bankruptcy';
import type { ExecState } from '@/domain/exec';
import { preloadAvatars } from '@/avatars';
import { BGM } from '@/bgm';
import { preloadEventCategories } from '@/eventCategoryAssets';
import { ICON_DIR, ICONS } from '@/icons';
import { preloadIllustrations } from '@/illustrations';
import { loadData, loadPrestigeCount, saveData, loadSettings, DEFAULT_COMPANY_NAME, type SavedResult } from '@/save';
import { setSfxVolume, preloadSfx } from '@/sounds';
import { preloadUITextures } from '@/util/ui';
import { SCENE_KEYS } from './keys';

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
    const saved = loadData();
    const productIndex = saved?.productCount ?? 0;
    const gold = saved?.gold ?? 0;
    const officeLevel: 1 | 2 | 3 | 4 = saved?.officeLevel ?? 1;
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
        ...(prestigeCount > 0 ? { prestigeBonus } : {}),
      };
      const carry: { lastResult?: SavedResult } = {};
      if (lastResult) carry.lastResult = lastResult;

      // 첫 진입(저장 데이터 없음)에서 회사명 입력 모달 표시.
      if (!saved?.companyName) {
        this.showCompanyNameModal(() => {
          this.scene.start(SCENE_KEYS.Assignment, { state, ...carry });
        });
        return;
      }

      this.scene.start(SCENE_KEYS.Assignment, { state, ...carry });
      return;
    }

    const history = saved?.history ?? [];
    const bankruptcy: BankruptcyState | undefined = saved?.bankruptcy;
    const exec: ExecState | undefined = saved?.exec;
    const economy = saved?.economy;
    const rivals = saved?.rivals;
    this.scene.start(SCENE_KEYS.GenreSelect, {
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
    });
  }

  /**
   * 회사명 입력 모달. DOM input 사용. 완료 시 onDone() 호출.
   * 첫 진입(productIndex=0, companyName 없음)에서 한 번만 표시.
   */
  private showCompanyNameModal(onDone: () => void): void {
    // 어두운 배경
    const bg = this.add.graphics();
    bg.fillStyle(0x0e0e12, 1);
    bg.fillRect(0, 0, 720, 1280);

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

    // DOM input
    const inputStyle = [
      'width: 460px',
      'height: 60px',
      'padding: 0 18px',
      'border: 2px solid #4a4a62',
      'border-radius: 12px',
      'background: #20202a',
      'color: #f2f2f7',
      'font-size: 26px',
      'font-family: "Apple SD Gothic Neo","Malgun Gothic",sans-serif',
      'outline: none',
      'box-sizing: border-box',
      'text-align: center',
    ].join('; ');
    const inputEl = this.add.dom(360, 590, 'input', inputStyle);
    const node = inputEl.node as HTMLInputElement;
    node.type = 'text';
    node.placeholder = DEFAULT_COMPANY_NAME;
    node.maxLength = 20;

    // 시작 버튼
    const btnW = 280;
    const btnH = 60;
    const btnX = 360 - btnW / 2;
    const btnY = 660;
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x4f6fff, 1);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 14);
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
          companyName: name,
        });
      }
      inputEl.destroy();
      onDone();
    });
  }
}
