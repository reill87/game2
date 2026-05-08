/**
 * 출시 후 운영 결정 — 출시 즉시 랜덤 시나리오 1개를 플레이어에게 제시.
 * 선택에 따라 최종 매출·별점·직원 사기가 변동된다.
 */

export interface OpsChoice {
  readonly label: string;
  readonly summary: string;
  /** 매출 배수 (1.0=중립, 1.1=+10%). */
  readonly revenueMul: number;
  /** 별점 변동량 (-1, 0, +1). 합산 후 1~5로 clamp. */
  readonly starsDelta: number;
  /** 전 직원 사기 변동량. */
  readonly moraleDelta: number;
}

export interface OpsDecision {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly choices: ReadonlyArray<OpsChoice>;
}

export const OPS_DECISIONS: ReadonlyArray<OpsDecision> = [
  {
    id: 'cs_flood',
    title: 'CS 폭주',
    description: '출시 직후 문의가 쏟아지고 있습니다. 유저들이 답변을 기다리고 있어요. 어떻게 대응하시겠습니까?',
    choices: [
      {
        label: '팀 전원 동원 즉시 답변',
        summary: '사기가 떨어지지만 평점을 지켜냅니다.',
        revenueMul: 1.05,
        starsDelta: 0,
        moraleDelta: -10,
      },
      {
        label: '핵심 문의만 선별 대응',
        summary: '적당히 처리. 일부 유저가 실망합니다.',
        revenueMul: 0.95,
        starsDelta: -1,
        moraleDelta: 0,
      },
      {
        label: '자동 응답 봇으로 처리',
        summary: '팀은 쉬지만 유저 반응이 싸늘해집니다.',
        revenueMul: 0.85,
        starsDelta: -1,
        moraleDelta: 5,
      },
    ],
  },
  {
    id: 'hotfix_vs_patch',
    title: '긴급 버그 발견',
    description: '주요 기능에 치명적 버그가 발견됐습니다. 오늘 핫픽스를 낼 것인지, 다음 주 정기 패치에 포함할지 결정해야 합니다.',
    choices: [
      {
        label: '오늘 바로 핫픽스 배포',
        summary: '팀이 야근이지만 유저 신뢰를 지킵니다.',
        revenueMul: 1.1,
        starsDelta: 1,
        moraleDelta: -15,
      },
      {
        label: '다음 주 정기 패치로 수정',
        summary: '팀은 편하지만 별점이 잠시 흔들립니다.',
        revenueMul: 0.9,
        starsDelta: -1,
        moraleDelta: 5,
      },
    ],
  },
  {
    id: 'bad_reviews',
    title: '별점 테러',
    description: '리뷰 평균이 별 2개입니다. SNS에 사과 영상을 올리자는 의견이 나왔습니다.',
    choices: [
      {
        label: 'CEO 직접 사과 영상 게시',
        summary: '이슈를 잠재우고 별점이 반등합니다.',
        revenueMul: 1.1,
        starsDelta: 1,
        moraleDelta: -5,
      },
      {
        label: '공식 사과문만 올리기',
        summary: '조용히 넘어갑니다.',
        revenueMul: 1.0,
        starsDelta: 0,
        moraleDelta: 0,
      },
      {
        label: '무시하고 다음 프로젝트 집중',
        summary: '팀 사기는 오르지만 여론은 악화됩니다.',
        revenueMul: 0.8,
        starsDelta: -1,
        moraleDelta: 10,
      },
    ],
  },
  {
    id: 'viral_praise',
    title: '입소문 기회',
    description: '유명 유저가 SNS에서 우리 제품을 극찬했습니다. 이 기회를 어떻게 활용하시겠습니까?',
    choices: [
      {
        label: '광고 예산 집중 투입',
        summary: '매출이 크게 오르지만 팀이 바빠집니다.',
        revenueMul: 1.2,
        starsDelta: 0,
        moraleDelta: -8,
      },
      {
        label: '리트윗·공유만 적극 활용',
        summary: '소소한 매출 상승, 팀 부담 없음.',
        revenueMul: 1.08,
        starsDelta: 0,
        moraleDelta: 0,
      },
      {
        label: '자연스럽게 두기',
        summary: '아무 행동도 하지 않습니다.',
        revenueMul: 1.0,
        starsDelta: 0,
        moraleDelta: 3,
      },
    ],
  },
  {
    id: 'bug_report_reward',
    title: '버그 제보 보상',
    description: '유저가 주요 보안 버그를 제보했습니다. 공개 보상을 제공하면 신뢰도가 올라갈 수 있습니다.',
    choices: [
      {
        label: '보상금 지급 + 공개 감사 표시',
        summary: '비용이 들지만 별점과 신뢰가 오릅니다.',
        revenueMul: 1.08,
        starsDelta: 1,
        moraleDelta: 5,
      },
      {
        label: '조용히 수정만',
        summary: '별 변화 없이 넘어갑니다.',
        revenueMul: 1.0,
        starsDelta: 0,
        moraleDelta: 0,
      },
    ],
  },
  {
    id: 'paid_ads',
    title: '유료 광고 추가 집행',
    description: '퍼포먼스 마케팅팀이 광고 추가 집행을 제안했습니다. 비용 대비 효과가 불확실합니다.',
    choices: [
      {
        label: '전면 광고 집행',
        summary: '매출이 오르지만 팀이 부담스러워합니다.',
        revenueMul: 1.15,
        starsDelta: 0,
        moraleDelta: -10,
      },
      {
        label: '소규모 테스트 집행',
        summary: '작은 상승, 작은 부담.',
        revenueMul: 1.05,
        starsDelta: 0,
        moraleDelta: -3,
      },
      {
        label: '광고 안 함',
        summary: '팀은 편합니다.',
        revenueMul: 1.0,
        starsDelta: 0,
        moraleDelta: 2,
      },
    ],
  },
];

/**
 * OPS_DECISIONS 배열에서 무작위로 하나를 반환한다.
 * Phaser 씬 밖에서 순수 Math.random 사용.
 */
export function pickOpsDecision(): OpsDecision {
  const idx = Math.floor(Math.random() * OPS_DECISIONS.length);
  // noUncheckedIndexedAccess 대응 — 배열이 비어있을 수 없으므로 non-null assertion.
  return OPS_DECISIONS[idx]!;
}
