// 연출 미리보기 확인: node tools/crossfx/check.cjs <html> <출력 폴더> [only]
// 오류 · 가로 넘침(390px) · 카드마다 몇 초 돌린 뒤 캔버스 스크린샷
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [file, out, only] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + path.resolve(file) + (only ? '?only=' + only : ''));
  await p.waitForTimeout(3000);
  const cards = await p.$$('.card');
  let i = 0;
  for (const c of cards) {
    await c.scrollIntoViewIfNeeded();
    await p.waitForTimeout(only ? 3800 : 1600);
    const h = await c.evaluate((n) => (n.querySelector('h3') || {}).textContent || 'mix');
    await c.screenshot({ path: path.join(out, `c${String(i).padStart(2, '0')}.png`) });
    console.log(i, h);
    i++;
  }
  // 폰 너비 가로 넘침
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto('file://' + path.resolve(file));
  await m.waitForTimeout(2500);
  const ov = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await m.screenshot({ path: path.join(out, 'phone.png') });
  console.log('cards', cards.length, 'overflow390', ov, 'errors', errs.slice(0, 5));
  await b.close();
})();
