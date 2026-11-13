// 플레이 빌드 한 파일: node tools/play/build.mjs
// 게임 전체(src/main.ts + style.css)를 외부 파일 없이 HTML 한 장으로 묶는다 (앱 대화창에서 바로 플레이, 11-13 유저 "실제로 플레이해 볼 수 있게").
//   docs/play/index.html     그대로 여는 완전한 HTML (저장소에 남김)
//   dist-play/game.html      앱 대화창에 페이지로 띄우는 판 (Artifact 로 올림: doctype·head·body 없이 내용만)
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

let commit = 'dev';
try {
  commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  /* 커밋 전 */
}
const buildId = `${new Date().toISOString().slice(0, 10)}-${commit}`;

const out = await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  outdir: 'dist-play/tmp',
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'none',
  define: { __BUILD_ID__: JSON.stringify(buildId), 'import.meta.env.DEV': 'false' },
});
const js = out.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = out.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';

const body = `<style>${css}</style>
<div id="app"><canvas id="game"></canvas><div id="ui"></div></div>
<script>${js}</script>`;

const full = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#07080d" />
<title>연쇄 폭발</title>
</head>
<body>
${body}
</body>
</html>
`;
mkdirSync('docs/play', { recursive: true });
writeFileSync('docs/play/index.html', full);
mkdirSync('dist-play', { recursive: true });
writeFileSync('dist-play/game.html', `<title>연쇄 폭발</title>\n${body}\n`);
console.log(`docs/play/index.html (${Math.round(full.length / 1024)} KB) · dist-play/game.html · ${buildId}`);
