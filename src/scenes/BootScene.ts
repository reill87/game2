import Phaser from 'phaser';
import { DEFAULT_POLICY, newTutorialGame, pickRandomTrend, TUTORIAL_EMPLOYEES } from '@/domain/seed';
import { EMPTY_RND, type RndState } from '@/domain/rnd';
import { EMPTY_FACILITIES, type FacilityState } from '@/domain/facilities';
import { EMPTY_MARKETS, type MarketState } from '@/domain/markets';
import { EMPTY_ACQUISITIONS, type AcquisitionState } from '@/domain/acquisitions';
import type { CompanyPolicy, Employee, TrendStatus } from '@/domain/types';
import { preloadAvatars } from '@/avatars';
import { BGM } from '@/bgm';
import { preloadEventCategories } from '@/eventCategoryAssets';
import { ICON_DIR, ICONS } from '@/icons';
import { preloadIllustrations } from '@/illustrations';
import { loadData, type SavedResult } from '@/save';
import { preloadSfx } from '@/sounds';
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
  }

  create(): void {
    // 첫 입력 후 AudioContext resume — 브라우저 자동재생 정책 우회.
    this.input.once('pointerdown', () => {
      BGM.resume();
      BGM.setMood('calm');
    });
    const saved = loadData();
    const productIndex = saved?.productCount ?? 0;
    const gold = saved?.gold ?? 0;
    const officeLevel: 1 | 2 | 3 = saved?.officeLevel ?? 1;
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
    // 신규 데이터(employees 필드 보유) → 튜토리얼+채용 직원 모두 포함된 풀 리스트.
    // 옛 데이터 → TUTORIAL_EMPLOYEES + hiredEmployees 머지로 폴백.
    const employees: ReadonlyArray<Employee> = saved?.employees?.length
      ? saved.employees
      : saved?.hiredEmployees?.length
        ? [...TUTORIAL_EMPLOYEES, ...saved.hiredEmployees]
        : TUTORIAL_EMPLOYEES;
    const lastResult: SavedResult | null = saved?.lastResult ?? null;

    // 직전 슬롯 배정 — 현재 직원 id가 여전히 존재하는 항목만 필터링.
    const empIds = new Set(employees.map((e) => e.id));
    const filteredAssignment: NonNullable<typeof saved>['lastAssignment'] = {};
    if (saved?.lastAssignment) {
      for (const slot of ['planning', 'graphics', 'qa', 'programming'] as const) {
        const id = saved.lastAssignment[slot];
        if (id && empIds.has(id)) filteredAssignment[slot] = id;
      }
    }

    // 직전 support 배정 — 현재 직원 id가 여전히 존재하는 항목만 필터링.
    const filteredSupport: NonNullable<typeof saved>['lastSupport'] = {};
    if (saved?.lastSupport) {
      for (const slot of ['planning', 'graphics', 'qa', 'programming'] as const) {
        const id = saved.lastSupport[slot];
        if (id && empIds.has(id)) filteredSupport[slot] = id;
      }
    }
    const hasFilteredSupport = Object.keys(filteredSupport).length > 0;

    if (productIndex === 0) {
      const fresh = newTutorialGame(rnd);
      const state = { ...fresh, employees, gold, officeLevel, reputation, policy, trend, rnd, facilities, markets, acquisitions };
      const carry: { lastResult?: SavedResult } = {};
      if (lastResult) carry.lastResult = lastResult;
      this.scene.start(SCENE_KEYS.Assignment, { state, ...carry });
      return;
    }

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
      lastAssignment: filteredAssignment,
      ...(hasFilteredSupport ? { lastSupport: filteredSupport } : {}),
    });
  }
}
