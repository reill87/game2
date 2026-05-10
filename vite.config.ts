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
    rollupOptions: {
      output: {
        // phaser + rex-ui를 한 vendor chunk로 묶음. 분리하면 rex가 Phaser 글로벌 못 찾음.
        // 메인 앱 코드만 별도 chunk로 분리해 캐시 활용.
        manualChunks: {
          vendor: ['phaser', 'phaser3-rex-plugins/templates/ui/ui-plugin.js'],
        },
      },
    },
  },
});
