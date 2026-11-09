// 연출 미리보기 한 파일 만들기: node tools/showcase/build.mjs <페이지 이름>
// tools/showcase/pages/<이름>.ts 를 실제 게임 코드와 함께 묶는다 (외부 파일·CDN 없음).
//   docs/showcase/<이름>.html      그대로 열어 보는 완전한 HTML (저장소에 남김)
//   dist/showcase/<이름>.html      앱 대화창에 페이지로 띄우는 판 (Artifact 로 올림: doctype·head·body 없이 내용만)
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const name = process.argv[2] ?? 'categories';
const entry = `tools/showcase/pages/${name}.ts`;
const out = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
// 페이지 이름: 페이지 정의의 name: '...'
const title = /name:\s*'([^']+)'/.exec(readFileSync(entry, 'utf8'))?.[1] ?? '연출 미리보기';
const tpl = readFileSync('tools/showcase/template.html', 'utf8')
  .replace('/*__TITLE__*/', () => title)
  .replace('/*__SCRIPT__*/', () => js);

mkdirSync('docs/showcase', { recursive: true });
const full = `docs/showcase/${name}.html`;
writeFileSync(full, tpl);

const part = (tag) => {
  const m = new RegExp(`<!--${tag}-->([\\s\\S]*?)<!--/${tag}-->`).exec(tpl);
  if (!m) throw new Error(`template 에 ${tag} 표시가 없다`);
  return m[1].trim();
};
mkdirSync('dist/showcase', { recursive: true });
const artifact = `dist/showcase/${name}.html`;
writeFileSync(artifact, `${part('PAGE')}\n${part('BODY')}\n`);

console.log(`${full} (${Math.round(tpl.length / 1024)} KB) · ${artifact}`);
