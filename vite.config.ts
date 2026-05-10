import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // rex가 끌고 오는 nested eventemitter3(CJS)와 루트 의존성을 한 벌로 맞춤
    dedupe: ['eventemitter3'],
  },
  server: {
    host: true,
    port: 5173,
  },
  // phaser3-rex-plugins 패키지 루트에는 main/exports가 없어 optimizeDeps.include에 넣으면 실패한다.
  optimizeDeps: {
    include: ['eventemitter3'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    // manualChunks 사용 안 함 — phaser3-rex-plugins가 Phaser 전역 의존이라
    // chunk 분리하면 import 순서 문제로 ReferenceError 발생.
    // 단일 bundle로 두되 chunkSizeWarningLimit만 늘려 경고 회피.
  },
});
