/**
 * 개인 장비 시스템 — 직원 1명당 슬롯 4개(책상·의자·모니터·노트북).
 * 각 슬롯은 tier 1~5 중 하나를 보유할 수 있으며, 0은 미보유를 의미한다.
 */

export type EquipmentSlot = 'desk' | 'chair' | 'monitor' | 'laptop';

export interface EquipmentTier {
  /** 1~5. */
  readonly tier: number;
  readonly name: string;
  readonly cost: number;
  /** 효과 (장비 슬롯 4개 모두 합산). */
  readonly skillBonus: number;       // base skill 가산
  readonly moraleBonus: number;      // 매주 morale 회복에 추가
  readonly staminaBonus: number;     // 매주 stamina 회복에 추가
}

export const EQUIPMENT_TIERS: ReadonlyArray<EquipmentTier> = [
  { tier: 1, name: '기본',     cost: 100,  skillBonus: 0.05, moraleBonus: 0,   staminaBonus: 0   },
  { tier: 2, name: '준수',     cost: 300,  skillBonus: 0.1,  moraleBonus: 0.5, staminaBonus: 0.5 },
  { tier: 3, name: '고급',     cost: 800,  skillBonus: 0.15, moraleBonus: 1,   staminaBonus: 1   },
  { tier: 4, name: '프리미엄', cost: 2000, skillBonus: 0.2,  moraleBonus: 1.5, staminaBonus: 1.5 },
  { tier: 5, name: '플래그십', cost: 5000, skillBonus: 0.3,  moraleBonus: 2,   staminaBonus: 2   },
];

export const SLOT_LABEL: Readonly<Record<EquipmentSlot, string>> = {
  desk:    '책상',
  chair:   '의자',
  monitor: '모니터',
  laptop:  '노트북',
};

/** 직원 한 명의 장비 상태 — 슬롯별 보유 tier. 0 = 없음. */
export interface EmployeeEquipment {
  readonly desk?:    number;
  readonly chair?:   number;
  readonly monitor?: number;
  readonly laptop?:  number;
}

/** 효과 합산 — 4슬롯에 장착된 tier 보너스를 모두 더한다. */
export function computeEquipmentBonuses(eq: EmployeeEquipment | undefined): {
  skillBonus: number;
  moraleBonus: number;
  staminaBonus: number;
} {
  if (!eq) return { skillBonus: 0, moraleBonus: 0, staminaBonus: 0 };
  let s = 0, m = 0, st = 0;
  for (const slot of ['desk', 'chair', 'monitor', 'laptop'] as EquipmentSlot[]) {
    const t = eq[slot];
    if (!t || t < 1) continue;
    const def = EQUIPMENT_TIERS[t - 1];
    if (!def) continue;
    s  += def.skillBonus;
    m  += def.moraleBonus;
    st += def.staminaBonus;
  }
  return { skillBonus: s, moraleBonus: m, staminaBonus: st };
}
