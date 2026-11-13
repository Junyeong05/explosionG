import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

function buildId(): string {
  let commit = 'dev';
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    /* 커밋 전 */
  }
  return `${new Date().toISOString().slice(0, 10)}-${commit}`;
}

export default defineConfig({
  // 상대 경로 빌드: GitHub Pages·사내 서버·Capacitor(웹뷰) 어디에 올려도 동작
  base: './',
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  server: { host: true, port: 5173 },
  build: { target: 'es2022', sourcemap: true },
  // 테스트 대부분이 판을 실제로 돌리는 시뮬레이션이라 (210짝 · 봇 한 판) CI 에서 기본 5초를 넘긴 적이 있다 (11-13)
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 20000 },
});
