# Design System (Phase 1)

`src/theme.ts`(토큰) + `src/ui/`(헬퍼) 두 파일에 디자인 시스템이 모여 있다. 새 씬·컴포넌트를 만들 땐 **무조건** 여기서 import해서 쓰고, 임의 숫자/색을 코드에 박지 않는다.

## 토큰 카테고리 한눈에

| 토큰        | 용도                                           | 예시                                                  |
| ----------- | ---------------------------------------------- | ----------------------------------------------------- |
| `COLOR`     | Phaser Graphics용 number 색                    | `COLOR.btn`, `COLOR.panel`                            |
| `TEXT_COLOR`| Phaser Text용 string 색                        | `TEXT_COLOR.primary`, `TEXT_COLOR.warn`               |
| `TINT`      | Phaser Image setTint용 number                  | `TINT.warn`                                           |
| `CATEGORY`  | 도메인별 시그니처 색 (R&D/시설/시장/...)       | `CATEGORY.rnd.num`, `CATEGORY.facility.str`           |
| `SPACING`   | 4 베이스 grid                                  | `SPACING.md` (12), `SPACING.xl` (24)                  |
| `TYPE`      | fontSize × weight 매트릭스 (spread해서 사용)   | `this.add.text(x, y, 'Hi', { ...TYPE.bodyBold, color: TEXT_COLOR.primary })` |
| `RADIUS`    | 모서리 반경                                    | `RADIUS.md` (10)                                      |
| `ELEVATION` | Phaser depth 단계                              | `setDepth(ELEVATION.modal)`                           |
| `MOTION`    | duration·ease 토큰                             | `tweens.add({ duration: MOTION.duration.slow })`      |

## UI 헬퍼

`@/ui` barrel에서 import.

```ts
import { formatGold, addCategoryStripe, countUp } from '@/ui';

// 숫자 포매팅
formatGold(26962);        // "26,962g"
formatGain(-100);         // "-100"
formatPercent(0.95);      // "95%"
formatWeeks(16);          // "4개월"

// 카테고리 시그니처 stripe
addCategoryStripe(scene, x, y, h, 'rnd');
addCategoryHeaderBand(scene, x, y, w, 'facility');

// 모션
countUp(scene, goldText, 100, 500, formatGold);
slideUpIn(scene, modalContainer, 24);
bloomBurst(scene, purchasedCard);
pressTap(scene, buttonContainer);
```

## 마이그레이션 체크리스트

기존 씬을 점진적으로 옮길 때:

- [ ] `'13px'`, `fontSize: 18` 같은 매직 넘버 → `TYPE.body`, `TYPE.metaBold` 등
- [ ] `0xRRGGBB` 직접 박힌 색 → `COLOR.*` / `CATEGORY.*`
- [ ] `'#RRGGBB'` 박힌 색 → `TEXT_COLOR.*` / `CATEGORY.*.str`
- [ ] `n + 'g'` 골드 표시 → `formatGold(n)`
- [ ] `n.toLocaleString()` 일관성 → `formatNumber(n)` 또는 `formatGold(n)`
- [ ] gap 14, padding 18 같은 임의 숫자 → `SPACING.lg`(16), `SPACING.xl`(24)
- [ ] 모달 depth 100 박힌 값 → `ELEVATION.modal`
- [ ] 트윈 duration 200/400 박힌 값 → `MOTION.duration.base/slow`
- [ ] 카테고리 모달(R&D/시설 등) 헤더에 `addCategoryHeaderBand` 추가
- [ ] 카테고리 카드 좌측에 `addCategoryStripe` 추가

## Phase 2 — 컴포넌트 factory (진행 중)

`src/ui/components/`에 토큰을 소비하는 factory 함수들을 추가. 이제 새 모달/버튼은 매번 Graphics+Text+Zone 묶음을 직접 만들지 않아도 된다.

### Button

```ts
import { createButton } from '@/ui';

const btn = createButton(this, {
  x: 100, y: 200, w: 200, h: 48,
  label: '구매',
  variant: 'primary',  // primary | secondary | ghost | danger
  size: 'md',          // sm | md | lg
  iconKey: ICONS.cart.key,  // 선택
  onTap: () => buy(),
});
layer.add([btn.bg, btn.text, btn.hit]);
btn.icon && layer.add(btn.icon);

btn.setEnabled(false);
btn.setLabel('구매 완료');
btn.destroy();
```

자동으로 `pressTap` 애니메이션(scale 0.96 yoyo) 적용됨.

### Modal

```ts
import { createModal } from '@/ui';

const modal = createModal(this, {
  w: 600,
  h: 800,
  category: 'rnd',   // 헤더 띠 + 제목 색
  title: 'R&D 연구소',
  subtitle: '영구 업그레이드 — 한 번 구매하면 모든 프로젝트에 적용',
  onClose: () => console.log('closed'),
});

// modal.layer는 모든 자식이 들어갈 Container.
// modal.contentArea는 헤더 아래 컨텐츠가 그려질 영역.
modal.layer.add(myCard);

const { x, y, width, height } = modal.contentArea;
// ...

modal.close();  // onClose 발화 후 destroy.
```

자동으로:
- Scrim (overlay) 생성
- 카테고리 헤더 띠 (3px)
- 제목 + 부제
- 우상단 X 닫기 버튼
- slide-up + fade-in 진입 애니메이션

### Card

```ts
import { createCard } from '@/ui';

const c = createCard(this, {
  x: 100, y: 200, w: 560, h: 132,
  category: 'rnd',  // 좌측 4px 시그니처 stripe
  dim: false,       // true면 비활성 어두운 배경
});
layer.add([c.panel]);
c.stripe && layer.add(c.stripe);

// 안에 컨텐츠 추가:
layer.add(this.add.text(c.contentX, c.contentY, '카드 제목'));
```

### Badge

```ts
import { createBadge } from '@/ui';

const b = createBadge(this, x, y, {
  label: 'T5',
  tone: 'rnd',  // CategoryKey | 'ok' | 'warn' | 'bad' | 'neutral'
  size: 'sm',   // sm | md
});
layer.add([b.bg, b.text]);
```

## 시범 적용

- `ResultScene.openMailDetailModal` — `createModal` + `createButton` 사용으로 이전 80줄을 40줄로 축소.

## 남은 모달 (마이그레이션 후보)

- `openRndModal` — `category: 'rnd'`
- `openFacilitiesModal` — `category: 'facility'`
- `openMarketsModal` — `category: 'market'`
- `openAcquisitionsModal` — `category: 'acquisition'`
- `openEquipmentModal` — 기존 헤더 패턴 유지하되 `createButton` 전환
- `openMailInboxModal` — `category: 'mail'`
- `openInterviewModal` — `category: 'hire'`

각 모달은 한 번에 1개씩 옮기면 안전. tsc + 시각 확인 후 커밋.

## Phase 3 예고

- 컴포넌트에 `hover` 상태 추가 (PC에서 cursor over 시 살짝 밝아짐).
- `Tabs` factory — 탭 바 빌더 표준화.
- `Modal`에 scrollable content 영역 (긴 R&D 목록 등).
- `Toast` 알림 — "+100g 시설 효과 적용" 같은 컨텍스트 메시지.
- Confetti 파티클 — 구매·업그레이드 셀러브레이션.
