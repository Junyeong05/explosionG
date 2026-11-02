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
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
