/**
 * NPC 카탈로그 — 판교 IT 시뮬의 주변 인물들.
 * 메일 시스템의 발신자로 활용된다.
 */

export type NpcId =
  | 'rival-ceo'
  | 'angel-investor'
  | 'exec-coach'
  | 'venture-capital'
  | 'gov-regulator'
  | 'tech-blogger';

export interface Npc {
  readonly id: NpcId;
  readonly name: string;
  readonly role: string;
  readonly desc: string;
  /** 해당 NPC 메일 수신 최소 출시 횟수. */
  readonly minProductCount: number;
  /** 해당 NPC 메일 수신 최소 명성. */
  readonly minReputation?: number;
}

export const NPCS: ReadonlyArray<Npc> = [
  {
    id: 'rival-ceo',
    name: '이라이벌',
    role: '경쟁사 CEO',
    desc: '같은 시장에서 작품을 내는 경쟁사 대표. 매출 비교를 자주 함.',
    minProductCount: 5,
  },
  {
    id: 'angel-investor',
    name: '김엔젤',
    role: '엔젤 투자자',
    desc: '초기 투자자. 회사 성장을 응원하지만 빠른 수익도 기대.',
    minProductCount: 3,
  },
  {
    id: 'exec-coach',
    name: '박코치',
    role: '경영 코치',
    desc: '리더십 조언. 메일은 늘 진지하지만 도움 됨.',
    minProductCount: 8,
    minReputation: 50,
  },
  {
    id: 'venture-capital',
    name: 'VC 정대표',
    role: '벤처캐피털',
    desc: '시리즈 펀딩 가능. 큰 투자 + 큰 압박.',
    minProductCount: 12,
    minReputation: 100,
  },
  {
    id: 'gov-regulator',
    name: '규제기관',
    role: '정부 감독자',
    desc: '데이터·세금·노동 규제 관련 메일.',
    minProductCount: 10,
  },
  {
    id: 'tech-blogger',
    name: '테크블로거 한리뷰',
    role: 'IT 블로거',
    desc: '제품 리뷰 + 팬·악플. 명성에 영향.',
    minProductCount: 6,
  },
];

