// 균열 크로스오버 쪽 한 파일 만들기: node tools/crossfx/build.mjs [cross|run] [--dev <출력.html>]
//   cross: 연출 미리보기 (세계 여섯 · 합성 · 섞어 보기) → docs/showcase/cross.html + dist-showcase/cross.html
//   run:   실전 시뮬 (게임 한 판처럼: HUD · 웨이브 · 레벨 업 카드 · 합성) → docs/showcase/cross-run.html + dist-showcase/cross-run.html
// docs/ 판은 그대로 여는 완전한 HTML (저장소에 남김), dist-showcase/ 판은 Artifact 로 올리는 판 (doctype·head·body 없이 내용만).
// 스크립트는 파일마다 <script> 하나씩 (세계 모듈 하나가 깨져도 나머지는 돈다)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'tools/crossfx';
const PAGES = {
  cross: { tpl: 'template.html', page: 'page.js', out: 'cross' },
  run: { tpl: 'template-run.html', page: 'run.js', out: 'cross-run' },
};
const args = process.argv.slice(2);
const name = args[0] && !args[0].startsWith('--') ? args[0] : 'cross';
const P = PAGES[name];
if (!P) throw new Error(`모르는 쪽: ${name} (cross | run)`);
const WORLDS = ['base', 'ops', 'steel', 'sumi', 'rift', 'comic', 'bio'];
const THEMES = ['glass', 'city', 'anime', 'tactical', 'mono', 'orbit'];
const themeFiles = name === 'run' ? THEMES.map((k) => `${dir}/themes/${k}.js`).filter((f) => existsSync(f)) : [];
// 쪽 스크립트(run.js)가 기본 틀(rift)을 채운 뒤에 테마 파일이 온다
const files = [`${dir}/data.js`, `${dir}/runtime.js`, ...WORLDS.map((k) => `${dir}/worlds/${k}.js`).filter((f) => existsSync(f)), `${dir}/${P.page}`, ...themeFiles];
const scripts = files.map((f) => `<script>/* ${f} */\n${readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
const tpl = readFileSync(`${dir}/${P.tpl}`, 'utf8').replace('/*__SCRIPTS__*/', () => scripts);

const dev = args.indexOf('--dev');
if (dev >= 0) {
  const out = args[dev + 1];
  writeFileSync(out, tpl);
  console.log(`${out} (${Math.round(tpl.length / 1024)} KB)`);
} else {
  mkdirSync('docs/showcase', { recursive: true });
  writeFileSync(`docs/showcase/${P.out}.html`, tpl);
  const part = (tag) => {
    const m = new RegExp(`<!--${tag}-->([\\s\\S]*?)<!--/${tag}-->`).exec(tpl);
    if (!m) throw new Error(`template 에 ${tag} 표시가 없다`);
    return m[1].trim();
  };
  mkdirSync('dist-showcase', { recursive: true });
  const body = tpl.slice(tpl.indexOf('<!--/BODY-->') + '<!--/BODY-->'.length, tpl.lastIndexOf('</body>'));
  writeFileSync(`dist-showcase/${P.out}.html`, `${part('PAGE')}\n${part('BODY')}\n${body.trim()}\n`);
  console.log(`docs/showcase/${P.out}.html (${Math.round(tpl.length / 1024)} KB) · dist-showcase/${P.out}.html · ${files.length} scripts`);
}
