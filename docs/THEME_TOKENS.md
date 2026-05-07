# 디자인 토큰 — Studio Night 팔레트

`src/theme.ts`에 정의된 색·폰트 토큰의 의도와 사용 규칙. 새 색이 필요하면 이 문서와 `theme.ts`를 함께 갱신한다.

## 1. 사용 규칙

- 씬 코드에 **`0xRRGGBB` 또는 `'#RRGGBB'`를 직접 작성하지 않는다.** `COLOR.* / TEXT_COLOR.*` 키로만 참조.
- Phaser Graphics(`fillStyle`, `lineStyle` 등)는 number(`0x…`), Phaser Text.color는 string(`'#…'`)을 요구한다. 의미가 같은 색은 두 형태 모두 토큰으로 둔다.
- 한 토큰이 2개 이상 컴포넌트에 쓰인다면 그대로 두고, 의미가 갈라지면 새 토큰으로 분리.

## 2. 팔레트

| 토큰 | hex | 역할 |
|---|---|---|
| `bg.deepest` (body) | `#0e0e12` | 앱 배경. `index.html` body, Phaser `backgroundColor`. |
| `bg.gauge` (`COLOR.gaugeBg`) | `#1a1a22` | 게이지 트랙. |
| `bg.empty` (`COLOR.panelEmpty`) | `#20202a` | 빈 카드/슬롯. |
| `bg.surface` (`COLOR.panel`) | `#2a2a38` | 기본 패널 배경. |
| `bg.disabled` (`COLOR.btnDisabled`, `COLOR.btnSecondary`) | `#3a3a48` | 비활성 버튼·보조 버튼. |
| `bg.surfaceDn` (`COLOR.btnSecondaryDown`) | `#2a2a30` | 눌린 보조 버튼. |
| `border` (`COLOR.panelStroke`) | `#4a4a62` | 패널 테두리. |
| `text.disabled` (`TEXT_COLOR.disabled`) | `#6a6a78` | 비활성 버튼 글자. |
| `text.dim` (`TEXT_COLOR.dim`) | `#9b9bb0` | 라벨·보조 텍스트. |
| `text.body` (`TEXT_COLOR.primary`) | `#f2f2f7` | 본문. |
| `accent.primary` (`COLOR.btn`, `COLOR.selected`, `COLOR.gaugeFillProgress`) | `#4f6fff` | CTA·선택 강조·진행 게이지. |
| `accent.primaryDn` (`COLOR.btnDown`) | `#3d58cc` | 눌린 CTA. |
| `state.ok` (`COLOR.matchOk`, `TEXT_COLOR.ok`) | `#3ec07b` | 정배치·성공·★4–5. |
| `state.bad` (`COLOR.matchBad`, `COLOR.gaugeFillBug`, `TEXT_COLOR.bad`) | `#e55f5f` | 오배치·실패·BugDebt·★1–2. |
| `state.warn` (`TEXT_COLOR.warn`) | `#f2c94c` | 연체·★3 경계·주의. |

명도 곡선은 `bg.deepest` → `bg.surface` → `border` → `text.body` 로 균일하게 흐르도록 잡았다. 강조색 3개(파랑/녹색/적색)는 본문 위에서 모두 AA 대비를 충족한다.

## 3. 폰트

`src/theme.ts`의 `FONT_STACK` 1개로 통일.

```
"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", Pretendard, system-ui, sans-serif
```

- Pretendard 우선 사용을 원해도 macOS·Windows의 시스템 한글 폰트가 텍스트 메트릭이 더 안정적이라 시스템을 앞에 둔다(과거 rexUI 샘플에서 Sizer가 0 크기로 붕괴한 사례 있음 — `bc85903` 참고).
- 개별 Text는 `fontStyle: 'bold'`까지만 안전. 숫자 weight(`'600'`)는 일부 환경에서 무효 → bold 키워드로 통일.

## 4. 라이선스 / 출처

- 자체 팔레트(외부 팔레트 직접 채택 X). Lospec 계열 어두운 다크 모던 톤을 참고만 함.
- Pretendard: OFL — `public/assets/fonts/pretendard/LICENSE-Pretendard.txt`.
- 관련 자산: [docs/ASSETS.md](./ASSETS.md).

## 5. 다음 단계 (Phase B/C 예정)

- **B. Kenney 9-patch 버튼/패널** — `Graphics.fillRoundedRect` → `addNineSlice` 전환. 토큰은 그대로 두되 쉐이드는 이미지에 위임.
- **C. 아이콘 도입** — Phosphor/Lucide 8종(gold/week/progress/bug/appeal/기획/디자인/개발). `state.ok / bad` 토큰 색을 그대로 적용해 컬러 아이콘 대신 단색(monochrome) 사용.
