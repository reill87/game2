# 에셋 전략 (v1) — 추천 조합 확정

> 목표: 원화 제작 부담을 줄이고, 빠르게 플레이 가능한 UI/화면 퀄리티를 확보한다.

## 1) 채택 스택

- **UI 베이스:** Kenney UI Pack (CC0)
- **UI 컴포넌트:** `phaser3-rex-plugins` (rexUI, MIT)
- **아이콘:** Phosphor Icons 또는 Lucide (MIT)
- **폰트:** Pretendard (OFL)
- **팔레트 가이드:** Lospec 팔레트 1개 선택 후 고정

## 2) 왜 이 조합인가

- 커스텀 일러스트 없이도 버튼/패널/바/라벨을 빠르게 구성 가능
- Phaser에서 구현 난이도가 낮고 샘플/문서가 풍부함
- 라이선스가 명확해서 배포 시 리스크가 작음

## 3) 도입 순서 (체크리스트)

- [x] Kenney UI Pack 1종 다운로드 후 `public/assets/ui/kenney/`에 정리 (OpenGameArt 미러 ZIP 펼침, CC0)
- [ ] 아이콘 팩(Phosphor 또는 Lucide)에서 v1 필요한 아이콘만 추출 → `public/assets/icons/phosphor/` 또는 `.../lucide/`
- [x] 폰트(Pretendard) woff2를 `public/assets/fonts/pretendard/`에 배치 (`Regular`, `SemiBold`, 라이선스 텍스트)
- [ ] 팔레트 1개를 선택하고 `docs/THEME_TOKENS.md` 또는 상수 파일로 고정
- [x] rexUI 설치 후 `Sizer` + `Label` + `RoundRectangle` 최소 샘플 1개 씬(`RexUISampleScene`)에서 검증

## 4) v1에 필요한 최소 에셋 목록

- 버튼 상태 3종: 기본 / hover(or press) / 비활성
- 패널 배경 2종: 일반 패널 / 경고 패널
- 아이콘 8개 내외: 골드, 주차, 진행도, 버그, 매력, 기획, 디자인, 개발
- 폰트 1종 + 굵기 2종

## 5) 라이선스 운영 규칙

- **CC0(Kenney):** 보통 크레딧 의무가 없지만, 프로젝트 문서에는 출처를 남긴다.
- **MIT(라이브러리/아이콘):** 라이선스 파일 보관.
- **OFL(폰트):** 폰트 라이선스 포함 및 재배포 조건 준수.
- OpenGameArt/itch에서 추가 에셋을 가져올 때는 **에셋별 라이선스**를 반드시 문서화.

## 6) 크레딧 템플릿 (복붙용)

아래 문구를 `CREDITS.md` 또는 게임 내 크레딧 화면에 사용:

```text
Art/UI assets:
- Kenney (CC0) — https://kenney.nl/assets

UI framework:
- phaser3-rex-plugins (MIT) — https://github.com/rexrainbow/phaser3-rex-notes

Icons:
- Phosphor Icons (MIT) — https://phosphoricons.com/
  or Lucide (MIT) — https://lucide.dev/

Font:
- Pretendard (OFL) — https://github.com/orioncactus/pretendard
```

## 7) 링크

- Kenney: https://kenney.nl/assets
- rexUI docs: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/index.html
- Phosphor: https://phosphoricons.com/
- Lucide: https://lucide.dev/
- Pretendard: https://github.com/orioncactus/pretendard
- Lospec palettes: https://lospec.com/palette-list

## 8) game2 레포 — 다운로드 후 넣을 경로 (Vite `public/`)

Vite는 `public/`을 루트 URL(`/`)로 그대로 제공한다. 아래 경로에 맞추면 `src/style.css`의 `@font-face`와 추후 `this.load.image` 경로가 일관된다.

| 에셋 | 넣을 디렉터리 / 파일 |
|------|----------------------|
| **Kenney UI Pack** (PNG·폰트 등) | `public/assets/ui/kenney/` — ZIP 기준 `PNG/`, `Font/` 등 하위 폴더 유지 권장 |
| **Pretendard** (woff2) | `public/assets/fonts/pretendard/Pretendard-Regular.woff2`, `Pretendard-SemiBold.woff2`, `LICENSE-Pretendard.txt` |
| **아이콘** (Phosphor 또는 Lucide에서 필요한 것만) | `public/assets/icons/phosphor/` 또는 `public/assets/icons/lucide/` |

**폰트 로드:** 게임 캔버스 텍스트는 `fontFamily: 'Pretendard'` + 루트 `src/style.css`의 `@font-face`로 묶는다( `~/workspace/game` 의 `Scale.FIT`·해상도 설정과 동일한 패턴은 `src/config.ts`에 새로 작성).

**Kenney 재다운로드 예시 (미러):** OpenGameArt `kenney_ui-pack.zip` — 펼친 뒤 위 Kenney 경로와 동일 구조로 맞출 것.
