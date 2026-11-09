// 연출 미리보기 한 파일 만들기: node tools/showcase/build.mjs <페이지 이름>
// tools/showcase/pages/<이름>.ts 를 실제 게임 코드와 함께 묶어 docs/showcase/<이름>.html 로 낸다 (외부 파일·CDN 없음)
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const name = process.argv[2] ?? 'categories';
const out = await build({
  entryPoints: [`tools/showcase/pages/${name}.ts`],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  charset: 'utf8',
  legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync('tools/showcase/template.html', 'utf8');
mkdirSync('docs/showcase', { recursive: true });
const file = `docs/showcase/${name}.html`;
writeFileSync(file, tpl.replace('/*__SCRIPT__*/', () => js));
console.log(`${file} (${Math.round((tpl.length + js.length) / 1024)} KB)`);
