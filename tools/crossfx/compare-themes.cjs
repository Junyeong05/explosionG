// 테마 비교: node tools/crossfx/compare-themes.cjs <cross-run.html> <출력 폴더> [영상: 1]
// 같은 판 같은 순간을 테마마다 찍는다 (판 · 레벨 업 카드), 영상을 주면 테마를 5초씩 바꾸며 녹화 (video.webm)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const [file, out, withVideo] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const ctxOpt = { viewport: { width: 400, height: 760 }, deviceScaleFactor: 2 };
  const ctx = await b.newContext(ctxOpt);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto('file://' + path.resolve(file));
  await p.waitForTimeout(3000);
  // 판을 앞으로: 합성 둘 · 웨이브 9 쯤, 화면에 적이 많을 때
  const keys = await p.evaluate(() => {
    const s = window.__run;
    Math.random = (() => {
      let x = 7;
      return () => ((x = (x * 16807) % 2147483647) / 2147483647);
    })();
    s.reset();
    for (let i = 0; i < 30 * 400; i++) {
      s.step(1 / 30);
      if (s.over) s.reset();
      if (s.t > 100 && s.fusedN >= 2 && !s.offer && s.enemies.filter((e) => e.alive && e.y > 120).length > 14 && s.chainN >= 3) break;
    }
    CX.speed = 0;
    return Object.keys(CX.themes);
  });
  const cv = await p.$('#run');
  for (const k of keys) {
    await p.evaluate((k) => {
      CX.themeKey = k;
      window.__run.draw();
    }, k);
    await cv.screenshot({ path: path.join(out, `play-${k}.png`) });
  }
  await p.evaluate(() => {
    const s = window.__run;
    s.openOffer();
    s.offer.age = 0.9;
  });
  for (const k of keys) {
    await p.evaluate((k) => {
      CX.themeKey = k;
      window.__run.draw();
    }, k);
    await cv.screenshot({ path: path.join(out, `offer-${k}.png`) });
  }
  console.log('themes', keys.join(' '), 'errors', errs.slice(0, 3));
  await ctx.close();
  if (withVideo) {
    const vdir = path.join(out, 'v');
    fs.mkdirSync(vdir, { recursive: true });
    const vc = await b.newContext({ viewport: { width: 400, height: 820 }, recordVideo: { dir: vdir, size: { width: 400, height: 820 } } });
    const q = await vc.newPage();
    await q.goto('file://' + path.resolve(file));
    await q.waitForTimeout(3000);
    const rect = await q.evaluate(() => {
      const s = window.__run;
      for (let i = 0; i < 30 * 400; i++) {
        s.step(1 / 30);
        if (s.over) s.reset();
        if (s.t > 60 && s.fusedN >= 1 && !s.offer) break;
      }
      // 테마 버튼 줄(눌린 테마가 보이게)부터 판 아래까지
      const r = document.getElementById('run').getBoundingClientRect();
      const top = document.querySelector('.themes').getBoundingClientRect().top;
      return { x: r.left, y: top, w: r.width, h: r.bottom - top };
    });
    const order = ['glass', 'city', 'anime', 'tactical', 'mono', 'orbit', 'rift'].filter((k) => keys.includes(k));
    const t0 = Date.now();
    const marks = [];
    for (const k of order) {
      await q.evaluate((k) => {
        CX.themeKey = k;
      }, k);
      marks.push({ k, at: (Date.now() - t0) / 1000 });
      await q.waitForTimeout(5000);
    }
    await vc.close();
    const v = fs.readdirSync(vdir).find((f) => f.endsWith('.webm'));
    fs.renameSync(path.join(vdir, v), path.join(out, 'video.webm'));
    fs.writeFileSync(path.join(out, 'video.json'), JSON.stringify({ rect, marks, recorded: (Date.now() - t0) / 1000 }));
    console.log('video', JSON.stringify({ rect, recorded: (Date.now() - t0) / 1000 }));
  }
  await b.close();
})();
