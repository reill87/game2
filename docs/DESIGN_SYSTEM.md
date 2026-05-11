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

## Phase 2 예고

- 컴포넌트 헬퍼: `Card`, `Button`, `Modal` factory를 `src/ui/components/`에 추가.
- 카드/모달이 토큰만 받아 동일한 외관을 만들도록.
- `src/scenes/`의 기존 모달들이 점진적으로 새 컴포넌트로 교체.
