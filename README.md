# 개발팀 키우기 (가칭) — 스튜디오 경영 시뮬

**개발팀 컨셉**은 유지하되, 장르는 **『게임개발 스토리』식 작품 루프 + 사무실 성장 타이쿤**으로 잡는 신규 기획 레포입니다.  
**기획·설계 문서**(`docs/`)와 함께, 루트에 **Vite + TypeScript + Phaser 3** 스캐폴딩이 있다(경영 본체·전투 없음, rexUI 샘플 씬만).

## 문서 목록

| 문서 | 내용 |
|------|------|
| [docs/PRD.md](docs/PRD.md) | 프로젝트 정의, 목표, 범위 |
| [docs/CORE_LOOP.md](docs/CORE_LOOP.md) | 세션 단위 핵심 루프 |
| [docs/SYSTEMS.md](docs/SYSTEMS.md) | 성장·전투(과제)·파티·경제 |
| [docs/CONTENT_PIPELINE.md](docs/CONTENT_PIPELINE.md) | 퀘스트·대사 등 데이터 형식 |
| [docs/BALANCE.md](docs/BALANCE.md) | 경영 시뮬 수치 v0.1 (틱·폴리싱·홍보·오배치) |
| [docs/UI_SCENES.md](docs/UI_SCENES.md) | 화면·Phaser 씬 플로우 |
| [docs/TECH_SPIKES.md](docs/TECH_SPIKES.md) | 구현 전 검증 과제 |
| [docs/SCOPE.md](docs/SCOPE.md) | Non-goals, v1 버티컬 슬라이스 |
| [docs/CONTENT_POLICY.md](docs/CONTENT_POLICY.md) | 카피·이벤트 가드레일, 플레이어용 디스클레이머 |
| [docs/PRODUCT_LOOP.md](docs/PRODUCT_LOOP.md) | 작품 사이클, 3×3 장르·테마, 튜토리얼 고정 조합 |
| [docs/ASSETS.md](docs/ASSETS.md) | Kenney + rexUI + 아이콘 + 폰트 에셋 전략 |

## 실행 (프로토타입)

```bash
npm install
npm run dev      # 개발 서버
npm run build    # tsc --noEmit && vite build
npm run preview  # 빌드 미리보기
```

에셋 로컬 경로는 [docs/ASSETS.md](docs/ASSETS.md) §8 참고.

## 배포 (Vercel)

`vercel.json` 사전 구성됨. 두 가지 방법:

**A. GitHub 연동 (권장)** — 푸시 시 자동 배포
1. https://vercel.com/new 접속
2. `reill87/game2` 저장소 import
3. Framework: Vite (자동 감지) / Build: `npm run build` / Output: `dist`
4. Deploy 클릭 → 푸시할 때마다 자동 재배포

**B. Vercel CLI** — 로컬에서 한 번
```bash
vercel login
vercel        # 첫 실행 시 프로젝트 연동
vercel --prod # 프로덕션 배포
```

## 다음 단계 (제안)

1. [PRODUCT_LOOP.md](docs/PRODUCT_LOOP.md) + [BALANCE.md](docs/BALANCE.md) 기준으로 **v1 슬라이스**를 [SCOPE.md](docs/SCOPE.md)와 맞추어 갱신  
2. `TECH_SPIKES.md`에서 1~2개만 골라 **틱·출시 패널** 프로토타입  
3. `ASSETS.md` 체크리스트로 아이콘·팔레트 등 나머지 정리

## 관련

- 기존 작품(강화 중심): `~/workspace/game` — 재사용 가능한 아이디어는 `TECH_SPIKES.md`에 메모
