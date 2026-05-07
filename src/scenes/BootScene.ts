import Phaser from 'phaser';
import { newTutorialGame, TUTORIAL_EMPLOYEES } from '@/domain/seed';
import type { Employee } from '@/domain/types';
import { ICON_DIR, ICONS } from '@/icons';
import { loadData, type SavedResult } from '@/save';
import { SCENE_KEYS } from './keys';

/**
 * 진입점. localStorage에서 진행 상태를 읽어 라우팅을 결정한다:
 *  - 첫 작품(productCount=0): G1+T1 고정 — Assignment 직행
 *  - 두 번째 이상: GenreSelect 경유 (장르·테마 선택 후 Assignment)
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.Boot });
  }

  preload(): void {
    // Lucide 아이콘 SVG들을 32×32 텍스처로 일괄 로드. 모든 씬이 등록 후 공유.
    for (const { key, file } of Object.values(ICONS)) {
      this.load.svg(key, `${ICON_DIR}/${file}`, { width: 32, height: 32 });
    }
  }

  create(): void {
    const saved = loadData();
    const productIndex = saved?.productCount ?? 0;
    const gold = saved?.gold ?? 0;
    const employees: ReadonlyArray<Employee> = saved?.hiredEmployees?.length
      ? [...TUTORIAL_EMPLOYEES, ...saved.hiredEmployees]
      : TUTORIAL_EMPLOYEES;
    const lastResult: SavedResult | null = saved?.lastResult ?? null;

    if (productIndex === 0) {
      const fresh = newTutorialGame();
      const state = { ...fresh, employees, gold };
      const carry: { lastResult?: SavedResult } = {};
      if (lastResult) carry.lastResult = lastResult;
      this.scene.start(SCENE_KEYS.Assignment, { state, ...carry });
      return;
    }

    this.scene.start(SCENE_KEYS.GenreSelect, {
      productIndex,
      gold,
      employees,
      lastResult,
    });
  }
}
