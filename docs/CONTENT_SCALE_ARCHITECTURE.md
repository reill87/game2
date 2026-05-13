# 콘텐츠 확장 설계 — 이벤트 100~500개와 장기 스케일업

## 목표

현재 게임은 이미 이벤트 88개, R&D 28개, 시설 13개, 메일 13개를 가진 상태다. 100개 이벤트까지는 기존 구조에 바로 추가해도 되지만, 300~500개 규모로 가려면 이벤트를 코드 덩어리로 계속 쓰는 방식에서 벗어나야 한다.

목표는 개별 콘텐츠를 많이 넣는 것이 아니라, 다음을 조합해 플레이 체감량을 늘리는 것이다.

- 이벤트 카드
- 프로젝트 타입
- Era
- 경쟁사/시장 상황
- 직원/사옥/정책 조건
- AP 행동과 중간 이벤트의 성공 요소 영향

## 핵심 판단

### 100개

현재 구조로 가능하다. `src/domain/events.ts`에 12~40개를 더 추가하는 정도는 큰 리스크가 아니다.

### 200개

가능하지만 `events.ts` 단일 파일 유지보수성이 떨어진다. 최소한 카테고리별 파일 분리가 필요하다.

### 300~500개

이벤트를 모두 손수 TS 함수로 작성하면 비효율적이다. 이 구간부터는 데이터팩 + 효과 DSL + validator가 필요하다.

권장 목표는 “500개 이벤트 객체”보다 “200개 이벤트 + 프로젝트 타입 20개 + 경쟁사/시장/시대 변형”이다. 같은 이벤트라도 Era, 경쟁사, 프로젝트 타입에 따라 다른 의미를 가지면 체감 콘텐츠량은 훨씬 커진다.

## 콘텐츠 단위

### 1. Event

개발 중간에 뜨는 선택 이벤트. 지금의 `GameEvent`를 데이터팩으로 옮기는 대상이다.

```ts
interface ContentEvent {
  id: string;
  category: EventCategory;
  title: string;
  description: string;
  tags: ContentTag[];
  gates?: ContentGate[];
  weight?: number;
  cooldown?: number;
  choices: ContentChoice[];
}
```

### 2. Project Type

장르/테마와 별도로 프로젝트의 운영 방식을 정한다.

예시:

- 빠른 MVP
- 팬덤형 작품
- 대형 라이브 서비스
- B2B 플랫폼
- 글로벌 현지화
- AI 기능 중심 제품
- 레거시 리빌드
- 규제 산업 프로젝트

프로젝트 타입은 목표 기간, scope, 성공 요소 요구치, 경쟁사 매칭 방식에 영향을 준다.

```ts
interface ProjectType {
  id: string;
  name: string;
  desc: string;
  minProductCount?: number;
  minOfficeLevel?: number;
  scopeMul: number;
  revenueMul: number;
  requiredSignals: Partial<Record<ProjectSignalKey, number>>;
  eventTags: ContentTag[];
}
```

### 3. Era

반복감을 줄이기 위해 회사 성장 단계를 명시한다.

| Era | 구간 | 주요 변화 |
| --- | --- | --- |
| indie | 1~2작 | 생존, 첫 매출, 기본 배치 |
| studio | 3~7작 | 채용, 지원 슬롯, 사옥 2~3단계 |
| scaleup | 8~15작 | R&D, 시설, 경쟁사 압력 |
| platform | 16~30작 | 시장 진출, 인수, 규제, 대형 프로젝트 |
| global | 31작+ | 글로벌 경쟁, AI/자동화, 시즌/랭킹 준비 |

Era는 이벤트 풀과 경쟁사 강도를 바꾸는 상위 필터다.

### 4. Rival/Market Variant

AI 경쟁 모드는 콘텐츠 변형의 중심축이다.

예시:

- 특정 경쟁사가 같은 장르를 선점
- 대형사가 마케팅으로 압박
- 스타트업이 빠른 출시로 트렌드 점유
- 글로벌 기업이 해외 시장에서 강세
- 규제/플랫폼 정책 변화로 특정 프로젝트 타입이 위험

이 변형은 이벤트를 새로 500개 쓰지 않아도, 기존 이벤트를 조건부로 다르게 보이게 만든다.

## 효과 DSL

현재 이벤트 선택지는 `apply: (state) => GameState` 함수로 직접 작성한다. 강력하지만 대량 제작에는 부적합하다.

대량 콘텐츠는 preset 효과로 표현한다.

```ts
type EffectSpec =
  | { type: 'gold'; amount: number }
  | { type: 'bugDebt'; amount: number }
  | { type: 'progress'; amount: number }
  | { type: 'appeal'; amount: number }
  | { type: 'projectSignal'; key: ProjectSignalKey; amount: number }
  | { type: 'allEmployees'; morale?: number; stamina?: number }
  | { type: 'jobEmployees'; job: Job; morale?: number; stamina?: number; skill?: number }
  | { type: 'rivalPressure'; amount: number }
  | { type: 'triggerMail'; templateId: string };
```

대부분의 이벤트는 `EffectSpec[]`로 충분하다. 특수 이벤트만 기존처럼 `customApply`를 허용한다.

## 게이트 DSL

이벤트가 언제 나오는지 명확해야 500개까지 관리할 수 있다.

```ts
type ContentGate =
  | { type: 'minProductCount'; value: number }
  | { type: 'minReputation'; value: number }
  | { type: 'officeLevelAtLeast'; value: OfficeLevel }
  | { type: 'hasRnd'; id: RndId }
  | { type: 'hasFacility'; id: FacilityId }
  | { type: 'projectSignalAtLeast'; key: ProjectSignalKey; value: number }
  | { type: 'rivalPressureAtLeast'; value: '보통' | '높음' | '정면승부' }
  | { type: 'employeeJobExists'; job: Job };
```

게이트는 함수가 아니라 데이터로 두어 validator가 검사할 수 있어야 한다.

## 파일 구조

권장 구조:

```text
src/content/
  events/
    index.ts
    communication.ts
    planning.ts
    engineering.ts
    organization.ts
    launch.ts
    industry.ts
    culture.ts
    incident.ts
    conflict.ts
  projectTypes.ts
  eras.ts
  tags.ts
  effectDsl.ts
  validateContent.ts
```

초기에는 TS 상수로 시작한다. JSON은 사람이 많이 편집하기 시작할 때 전환한다.

## Validator

대량 확장 전에 반드시 validator가 필요하다.

검사 항목:

- id 중복 없음
- 카테고리 누락 없음
- 선택지 2~3개 유지
- title/description/summary 길이 제한
- gate가 참조하는 R&D/시설/직군/신호 키가 실제 존재
- effect가 허용 범위 안에 있음
- 이벤트 카테고리 분포가 한쪽으로 치우치지 않음
- Era별 최소 이벤트 수 충족
- `customApply` 이벤트 비율 제한

권장 명령:

```bash
npm run content:validate
```

초기 기준:

- 이벤트 120개까지: warning만
- 이벤트 200개부터: validator fail 기준 적용
- 이벤트 300개부터: category/Era coverage fail 기준 적용

## 마이그레이션 순서

### Phase 1: 구조만 분리

- 기존 `GameEvent` 런타임 동작과 `pickRandomEvent` API를 유지한다.
- 새 파일 `src/content/events/*.ts`를 만들고 카테고리별 이벤트를 옮긴다.
- 이벤트 객체의 `category` 필드에서 카테고리 lookup을 파생해 수동 id 매핑 중복을 없앤다.
- `src/domain/events.ts`는 re-export와 runtime picker만 남긴다.
- `npm run content:validate`로 id 중복, category, choices 수, 텍스트 길이, gate 범위를 검사한다.

완료 기준:

- 동작 변화 없음
- `pickRandomEvent` 결과 타입 동일
- typecheck/build 통과

### Phase 2: Effect DSL 도입

- 단순 이벤트부터 `apply` 함수를 `effects` 배열로 변환한다.
- `applyEffects(state, effects)`를 만든다.
- 특수 이벤트는 `customApply`로 유지한다.

완료 기준:

- 전체 이벤트 중 50% 이상이 data-only
- validator가 effect 범위 검사

### Phase 3: Project Type 추가

- 장르/테마 선택 뒤 프로젝트 타입을 선택하거나 추천한다.
- 프로젝트 타입이 scope, 성공 요소 요구치, 경쟁 압력에 영향을 준다.

완료 기준:

- 최소 6개 프로젝트 타입
- 결과 화면에 “프로젝트 타입 성과” 표시

### Phase 4: Era Deck 추가

- productIndex/officeLevel/reputation으로 Era를 계산한다.
- `pickRandomEvent`가 Era별 deck weight를 반영한다.

완료 기준:

- 각 Era별 고유 이벤트 20개 이상
- 후반부에 초반 소규모 사무실 이벤트가 과도하게 나오지 않음

### Phase 5: Season/Online 준비

- 온라인은 실시간 멀티가 아니라 비동기 시즌/고스트 경쟁부터 준비한다.
- 로컬 run summary를 업로드 가능한 형태로 분리한다.

예상 스키마:

```text
run_id
user_id
season_id
product_count
total_revenue
best_review_score
reputation
office_level
project_type_mix
rival_results
created_at
```

## 콘텐츠 수량 로드맵

| 단계 | 이벤트 | 프로젝트 타입 | 메일 | 경쟁 변형 | 목표 |
| --- | ---: | ---: | ---: | ---: | --- |
| A | 120 | 0 | 20 | 5 | 현재 구조 보강 |
| B | 180 | 6 | 30 | 10 | 데이터팩 분리 완료 |
| C | 250 | 12 | 50 | 20 | Era별 체감 차이 |
| D | 350+ | 20 | 80 | 40 | 시즌/고스트 경쟁 준비 |

## 다음 구현 추천

가장 먼저 할 일은 이벤트를 더 쓰는 것이 아니라, 다음 세 가지다.

1. `src/content/events/` 구조 생성
2. 기존 88개 이벤트를 카테고리별로 분리
3. `content:validate` 스크립트 추가

이 작업 후에 이벤트를 120개로 늘리면 이후 200~500개 확장이 훨씬 안전해진다.
