// 균열 크로스오버 연출 미리보기 한 파일 만들기: node tools/crossfx/build.mjs [--dev <출력.html>]
//   docs/showcase/cross.html   그대로 열어 보는 완전한 HTML (저장소에 남김)
//   dist-showcase/cross.html   앱 대화창에 페이지로 띄우는 판 (Artifact: doctype·head·body 없이 내용만)
// 스크립트는 파일마다 <script> 하나씩 (세계 모듈 하나가 깨져도 나머지는 돈다)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'tools/crossfx';
const WORLDS = ['base', 'ops', 'steel', 'sumi', 'rift', 'comic', 'bio'];
const files = [`${dir}/data.js`, `${dir}/runtime.js`, ...WORLDS.map((k) => `${dir}/worlds/${k}.js`).filter((f) => existsSync(f)), `${dir}/page.js`];
const scripts = files.map((f) => `<script>/* ${f} */\n${readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
const tpl = readFileSync(`${dir}/template.html`, 'utf8').replace('/*__SCRIPTS__*/', () => scripts);

const dev = process.argv.indexOf('--dev');
if (dev > 0) {
  const out = process.argv[dev + 1];
  writeFileSync(out, tpl);
  console.log(`${out} (${Math.round(tpl.length / 1024)} KB)`);
} else {
  mkdirSync('docs/showcase', { recursive: true });
  writeFileSync('docs/showcase/cross.html', tpl);
  const part = (tag) => {
    const m = new RegExp(`<!--${tag}-->([\\s\\S]*?)<!--/${tag}-->`).exec(tpl);
    if (!m) throw new Error(`template 에 ${tag} 표시가 없다`);
    return m[1].trim();
  };
  mkdirSync('dist-showcase', { recursive: true });
  const body = tpl.slice(tpl.indexOf('<!--/BODY-->') + '<!--/BODY-->'.length, tpl.lastIndexOf('</body>'));
  writeFileSync('dist-showcase/cross.html', `${part('PAGE')}\n${part('BODY')}\n${body.trim()}\n`);
  console.log(`docs/showcase/cross.html (${Math.round(tpl.length / 1024)} KB) · dist-showcase/cross.html · ${files.length} scripts`);
}
