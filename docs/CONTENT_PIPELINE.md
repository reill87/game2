# 콘텐츠 파이프라인 (초안)

## 1. 원칙

- v1은 **파일 기반 데이터** (JSON 또는 `src/data/*.ts`)  
- 나중에 시트 → JSON 변환이 필요하면 스크립트 추가

## 2. 과제(던전) 정의 예시 (가상 스키마)

```yaml
# mission.yaml (개념 예시 — 실제는 JSON 권장)
id: sprint_onboarding
name: "온보딩 스프린트"
description: "첫 티켓들을 처리합니다."
duration_turns_max: 12
enemies:
  - enemy_id: bug_trivial
    count: 2
rewards:
  xp: 40
  gold: 25
unlock_requires: []
```

## 3. 적(Enemy) 정의 예시

```json
{
  "id": "bug_trivial",
  "name": "Trivial 버그",
  "hp": 30,
  "atk": 6,
  "def": 2,
  "skills": ["nibble"],
  "flavor": "재현 단계가 '가끔' 입니다."
}
```

## 4. 대사·이벤트

- **인라인**: 과제 `intro_lines[]`, `clear_lines[]`  
- **공용 풀**: `data/lines/common.json` — 플레이어 직군별 분기는 `speaker_job` 키

## 5. 스킬 정의 예시

```json
{
  "id": "scope_cut",
  "name": "스코프 컷",
  "job": "planner",
  "cost_mp": 8,
  "target": "enemy_all",
  "effect": { "type": "damage_percent_hp", "percent": 8 },
  "cooldown": 0
}
```

`effect` 타입 목록은 구현하면서 enum 으로 고정.

## 6. 작업 순서 (콘텐츠 제작)

1. 적 3종 + 과제 2개 + 보스 1개  
2. 스킬 직군당 2개  
3. 튜토리얼 대사 10줄 이내  

## 7. LLM·외부 도구

- 초안 메시지·이름 생성에 활용 가능 — **최종 검수는 사람**  
- 특정 회사·실명 패러디는 제외
