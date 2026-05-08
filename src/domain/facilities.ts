/**
 * 회사 시설 시스템 — 한 번 짓고 영구 효과.
 * 시설 ID는 화이트리스트로 관리하며 save.ts sanitize 시 사용한다.
 */

export type FacilityId =
  | 'gym'
  | 'gameroom'
  | 'rooftop-garden'
  | 'cafeteria-deluxe'
  | 'big-meeting-room'
  | 'inhouse-studio'
  | 'ai-copilot'
  | 'wellness-trainer'
  | 'esports-team';

export interface Facility {
  readonly id: FacilityId;
  readonly name: string;
  readonly desc: string;
  readonly cost: number;
  readonly effectLabel: string;
  /** 의존 시설 (있으면 먼저 구매해야 함). */
  readonly requires?: ReadonlyArray<FacilityId>;
  /** 사옥 단계 게이트 — 해당 단계 미만이면 건설 불가. */
  readonly minOfficeLevel?: 1 | 2 | 3;
}

export const FACILITIES: ReadonlyArray<Facility> = [
  {
    id: 'gym',
    name: '헬스장',
    desc: '운동 공간 — 매주 전원 stamina +1',
    cost: 1500,
    effectLabel: '전원 매주 stamina +1',
    minOfficeLevel: 2,
  },
  {
    id: 'gameroom',
    name: '게임룸',
    desc: '쉴 공간 — 매주 전원 morale +1',
    cost: 2500,
    effectLabel: '전원 매주 morale +1',
    minOfficeLevel: 2,
  },
  {
    id: 'rooftop-garden',
    name: '옥상정원',
    desc: '햇빛과 바람 — 매주 전원 morale +2',
    cost: 4000,
    effectLabel: '전원 매주 morale +2',
    minOfficeLevel: 2,
  },
  {
    id: 'cafeteria-deluxe',
    name: '실내 카페',
    desc: '에스프레소가 무료 — 사기 보너스 ×2',
    cost: 6000,
    effectLabel: 'espresso 효과 ×2',
    minOfficeLevel: 2,
  },
  {
    id: 'big-meeting-room',
    name: '대회의실',
    desc: '주간 회의 효율 ↑ — AP +1/주',
    cost: 8000,
    effectLabel: '주간 AP +1',
    minOfficeLevel: 3,
  },
  {
    id: 'inhouse-studio',
    name: '사내 스튜디오',
    desc: '디자인·프로토타이핑 가속 — Appeal +0.5/주',
    cost: 12000,
    effectLabel: 'Appeal 매주 +0.5',
    minOfficeLevel: 3,
  },
  {
    id: 'ai-copilot',
    name: 'AI 코파일럿',
    desc: '모든 직원 효율 +10%',
    cost: 20000,
    effectLabel: '모든 effective skill ×1.1',
    minOfficeLevel: 3,
  },
  {
    id: 'wellness-trainer',
    name: '사내 트레이너',
    desc: 'stamina drain ×0.7',
    cost: 35000,
    effectLabel: 'stamina drain ×0.7',
    minOfficeLevel: 3,
    requires: ['gym'],
  },
  {
    id: 'esports-team',
    name: '회사 e스포츠팀',
    desc: '브랜드 ↑ — 명성 +1/출시',
    cost: 50000,
    effectLabel: '출시 시 명성 +1',
    minOfficeLevel: 3,
  },
];

/** save.ts sanitize용 화이트리스트 — FACILITIES ID 목록. */
export const VALID_FACILITY_IDS: ReadonlyArray<FacilityId> = [
  'gym',
  'gameroom',
  'rooftop-garden',
  'cafeteria-deluxe',
  'big-meeting-room',
  'inhouse-studio',
  'ai-copilot',
  'wellness-trainer',
  'esports-team',
];

export interface FacilityState {
  readonly built: ReadonlyArray<FacilityId>;
}

export const EMPTY_FACILITIES: FacilityState = { built: [] };

export function isFacilityBuilt(fs: FacilityState | undefined, id: FacilityId): boolean {
  return !!fs?.built.includes(id);
}

export function isFacilityAvailable(
  fs: FacilityState | undefined,
  item: Facility,
  officeLevel: 1 | 2 | 3,
): boolean {
  if (item.minOfficeLevel !== undefined && officeLevel < item.minOfficeLevel) return false;
  if (item.requires) {
    for (const req of item.requires) if (!isFacilityBuilt(fs, req)) return false;
  }
  return true;
}

export function buildFacility(fs: FacilityState, id: FacilityId): FacilityState {
  if (fs.built.includes(id)) return fs;
  return { built: [...fs.built, id] };
}
