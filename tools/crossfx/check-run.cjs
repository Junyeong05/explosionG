// 실전 시뮬 확인: node tools/crossfx/check-run.cjs <html> <출력 폴더> [빨리 돌릴 초=0]
// 오류 · 390px 넘침 · 화면을 몇 초 간격으로 찍고, 마지막에 상태(웨이브·LV·무기·합성·목숨) 출력.
// 빨리 돌릴 초를 주면 먼저 그만큼 판을 그리지 않고 돌려(밸런스 확인) 그 상태를 찍는다.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [file, out, fastStr] = process.argv.slice(2);
  const fast = Number(fastStr || 0);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 980, height: 820 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + path.resolve(file));
  await p.waitForTimeout(3000);
  const state = () =>
    p.evaluate(() => {
      const s = window.__run;
      return { t: Math.round(s.t), wave: s.wave, lv: s.level, hearts: s.hearts, weapons: s.owned.map((w) => `${w.name}:${w.lv}`).join(' '), fused: s.fusedN, peak: s.chainPeak, best: s.best };
    });
  if (fast) {
    // 판 시간 fast 초를 그리지 않고 돈다 (카드는 자동 고르기)
    const tune = process.env.TUNE ? JSON.parse(process.env.TUNE) : null;
    const log = await p.evaluate(([sec, tune]) => {
      const s = window.__run;
      if (tune) Object.assign(s.tune, tune), s.reset();
      const res = [];
      let deaths = 0;
      for (let i = 0; i < sec * 30; i++) {
        const before = s.over;
        s.step(1 / 30);
        if (!before && s.over) deaths++, res.push(`over at wave ${s.wave} t=${Math.round(s.t)}`);
        if (i % (30 * 20) === 0) res.push(`t=${Math.round(s.t)} wave ${s.wave} lv ${s.level} hp ${s.hearts} w ${s.owned.length} fused ${s.fusedN}`);
      }
      res.push(`avgDeathY ${Math.round(s.stat.deathY / Math.max(1, s.stat.deaths))} leaks ${s.stat.leaks} firstFuse ${s.stat.firstFuse}`);
      return { res, deaths };
    }, [fast, tune]);
    console.log(log.res.join('\n'), '\ngameovers', log.deaths);
  }
  const cv = await p.$('#run');
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(2500);
    await cv.screenshot({ path: path.join(out, `r${i}.png`) });
  }
  console.log(JSON.stringify(await state()));
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto('file://' + path.resolve(file));
  await m.waitForTimeout(2500);
  const ov = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await m.screenshot({ path: path.join(out, 'phone.png') });
  console.log('overflow390', ov, 'errors', errs.slice(0, 5));
  await b.close();
})();
