/**
 * 씬 키 상수. 각 씬 클래스가 자신의 키만 참조하므로 씬 ↔ 씬 import 순환을 피한다.
 * 새 씬 추가 시 여기에 한 줄 추가하고 config의 scene 배열에 등록.
 */
export const SCENE_KEYS = {
  Boot: 'BootScene',
  Assignment: 'AssignmentScene',
  Development: 'DevelopmentScene',
  Result: 'ResultScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];
