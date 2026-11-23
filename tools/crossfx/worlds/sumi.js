// 수묵 요괴 (sumi) — 한지 · 먹 · 주홍 낙관 · 금박.
// 어두운 균열 판 위에서는 먹이 묻히니, 먹은 한지색 띠·금박 테 위에만 올리고 판 위 획은 한지색으로 긋는다.
// 불여우(소환수): 붓 원상에서 뛰어나와 주홍 불꼬리를 끌며 달려 문다 / 유령(정령): 떠돌며 혼불을 휘어 쏜다 / 전쟁 북(음파): 둥·둥·둥 한지색 붓 원 물결이 부채꼴로 퍼져 밀어낸다.
(function () {
  'use strict';
  const { TAU, rnd, clamp, ease, lerp } = CX.util;
  const { W, H } = CX.size;
  const sprite = CX.util.sprite;

  const PAPER = '#ECE4D3';
  const INK = '#1A1A1A';
  const VERM = '#C8372D';
  const GOLD = '#B8913A';
  const pa = (a) => `rgba(236,228,211,${a})`;
  const ia = (a) => `rgba(26,26,26,${a})`;
  const va = (a) => `rgba(200,55,45,${a})`;
  const ga = (a) => `rgba(218,178,90,${a})`; // 금박 (판 위에서 조금 밝게)
  const fa = (a) => `rgba(255,200,112,${a})`; // 불 속
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // ── 모양 ────────────────────────────────────────────────────
  // 낙관 글자 斬 (0..40 칸)
  const ZAN = [new Path2D('M2,5 H18 M4,10 H16 V24 H4 Z M4,17 H16 M10,1 V39 M1,31 H19'), new Path2D('M24,7 L37,3 M25,7 V22 C25,30 24,34 22,38 M25,17 H39 M33,17 V39')];
  // 여우 몸 (오른쪽을 본다): A 다리 뻗음 · B 다리 모음 (번갈아 → 달림)
  const FOX_A = new Path2D('M-8,4 C-4,-2 4,-4 9,-4 L12,-9 L13,-14 L15.5,-10 L17,-14 L18.5,-8.5 C20,-7 22,-6 24,-5 L23,-3.5 C20,-3 17,-2.5 15,-1 C13,2 11,5 8,6 L10,13 L7,13 L4,7 C1,8 -3,8 -6,7 L-9,13 L-12,13 L-10,6 Z');
  const FOX_B = new Path2D('M-8,4 C-4,-2 4,-4 9,-4 L12,-9 L13,-14 L15.5,-10 L17,-14 L18.5,-8.5 C20,-7 22,-6 24,-5 L23,-3.5 C20,-3 17,-2.5 15,-1 C13,2 11,5 8,6 L15,8.5 L13.5,11 L4,7 C1,8 -3,8 -6,7 L-15,9.5 L-16.5,6.8 L-10,6 Z');
  const FOX_TAILS = [new Path2D('M-8,3 C-14,0 -18,-6 -16,-14 C-14,-9 -11,-6 -6,-3 Z'), new Path2D('M-8,4 C-16,4 -22,0 -23,-8 C-19,-4 -14,-1 -7,1 Z'), new Path2D('M-8,5 C-15,8 -21,8 -24,4 C-19,5 -14,4 -8,3 Z')];
  const FOX_TIPS = new Path2D('M-16,-14 C-15,-17 -13,-18 -12,-20 C-12,-17 -13,-15 -14,-12 Z M-23,-8 C-25,-11 -25,-13 -24,-16 C-22,-13 -21,-11 -21,-8 Z M-24,4 C-27,3 -28,1 -29,-1 C-26,0 -24,1 -22,3 Z');
  const FOX_RUNTAIL = new Path2D('M-7,2 C-12,0 -16,-3 -19,-8 C-15,-6 -11,-4 -6,-1 Z');

  function glyph(g, x, y, sc, col, lw) {
    g.save();
    g.translate(x, y);
    g.scale(sc, sc);
    g.strokeStyle = col;
    g.lineWidth = lw;
    g.lineCap = 'square';
    g.lineJoin = 'miter';
    for (const p of ZAN) g.stroke(p);
    g.restore();
  }

  /** 붓 원호 (눌렀다 떼는 굵기, sym 이면 양끝이 같은 물결): 가운데 (cx,cy), 반지름 r, a0→a1, 굵기 th. 경로만 만든다 */
  function arcPath(c, cx, cy, r, a0, a1, th, seed, sym) {
    const N = Math.max(10, Math.min(30, Math.ceil((Math.abs(a1 - a0) * r) / 9)));
    const prof = sym
      ? (k) => Math.pow(Math.sin(Math.PI * k), 0.45) * (0.82 + 0.18 * Math.sin(k * 13 + seed))
      : (k) => Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.06)), 0.55) * (1.2 - 0.5 * k) * (0.86 + 0.14 * Math.sin(k * 11 + seed));
    c.beginPath();
    for (let j = 0; j <= N; j++) {
      const k = j / N;
      const a = a0 + (a1 - a0) * k;
      const rr = r + th * prof(k);
      if (j) c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    for (let j = N; j >= 0; j--) {
      const k = j / N;
      const a = a0 + (a1 - a0) * k;
      const rr = r - th * prof(k) * 0.55;
      c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
  }
  /** 붓 원호 안의 갈필 (마른 붓 자국) */
  function dryArc(c, cx, cy, r, a0, a1, th, seed) {
    const lo = Math.min(a0, a1);
    const span = Math.abs(a1 - a0);
    c.lineWidth = 0.6;
    for (let s = 0; s < 2; s++) {
      const g0 = lo + span * (0.25 + 0.25 * hash(seed + s));
      const g1 = lo + span * (0.62 + 0.3 * hash(seed + s + 7));
      c.beginPath();
      c.arc(cx, cy, r + (s ? 0.35 : -0.05) * th, g0, g1);
      c.stroke();
    }
  }

  /** 줄 (P=[x0,y0,x1,y1,…] 옛→새) 둘레 띠. wf(k 0→1, i) 반폭 */
  function ribbon(c, P, wf) {
    const n = P.length >> 1;
    const L = [];
    const R = [];
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(n - 1, i + 1);
      let dx = P[i1 * 2] - P[i0 * 2];
      let dy = P[i1 * 2 + 1] - P[i0 * 2 + 1];
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const w = wf(n > 1 ? i / (n - 1) : 1, i);
      L.push(P[i * 2] - dy * w, P[i * 2 + 1] + dx * w);
      R.push(P[i * 2] + dy * w, P[i * 2 + 1] - dx * w);
    }
    c.beginPath();
    c.moveTo(L[0], L[1]);
    for (let i = 1; i < n; i++) c.lineTo(L[i * 2], L[i * 2 + 1]);
    for (let i = n - 1; i >= 0; i--) c.lineTo(R[i * 2], R[i * 2 + 1]);
    c.closePath();
    return L;
  }

  function flamePath(c, x, y, h, w, lean) {
    c.beginPath();
    c.moveTo(x - w, y);
    c.quadraticCurveTo(x - w * 0.7, y - h * 0.55, x + lean, y - h);
    c.quadraticCurveTo(x + w * 0.75, y - h * 0.45, x + w, y);
    c.quadraticCurveTo(x, y + w * 0.6, x - w, y);
    c.closePath();
  }

  function diamond(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y - s);
    c.lineTo(x + s * 0.7, y);
    c.lineTo(x, y + s);
    c.lineTo(x - s * 0.7, y);
    c.closePath();
    c.fill();
  }

  // ── 미리 그려 두는 그림 ─────────────────────────────────────
  const sealSpr = () =>
    sprite('sumi-seal', 20, 20, (g) => {
      g.fillStyle = VERM;
      g.beginPath();
      [
        [1.4, 1.0],
        [10, 1.6],
        [18.8, 1.1],
        [18.5, 10],
        [19, 18.8],
        [10, 18.3],
        [1.1, 18.9],
        [1.7, 10],
      ].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      g.fill();
      g.strokeStyle = pa(0.85);
      g.lineWidth = 0.6;
      g.strokeRect(3, 3, 14, 14);
      glyph(g, 4.3, 4.1, 0.29, PAPER, 3.8);
      // 닳은 인주
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 16; i++) {
        g.beginPath();
        g.arc(rnd(1, 19), rnd(1, 19), rnd(0.15, 0.5), 0, TAU);
        g.fill();
      }
      for (let i = 0; i < 10; i++) {
        const u = rnd(1, 19);
        const side = i % 4;
        const p = side === 0 ? [u, 1.3] : side === 1 ? [18.7, u] : side === 2 ? [u, 18.7] : [1.3, u];
        g.beginPath();
        g.arc(p[0], p[1], rnd(0.4, 1.1), 0, TAU);
        g.fill();
      }
    });

  const splashSpr = (v) =>
    sprite('sumi-splash' + v, 40, 40, (g) => {
      const B = [];
      for (let k = 0; k < 6; k++) {
        const a = rnd(0, TAU);
        const d = rnd(0, 3.5);
        B.push([20 + Math.cos(a) * d, 20 + Math.sin(a) * d, rnd(4.2, 6.6)]);
      }
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + rnd(-0.3, 0.3);
        const d = rnd(10, 17);
        const r = rnd(0.9, 2.3);
        B.push([20 + Math.cos(a) * d, 20 + Math.sin(a) * d, r]);
        B.push([20 + Math.cos(a) * d * 0.62, 20 + Math.sin(a) * d * 0.62, r * 0.55]);
      }
      g.fillStyle = GOLD;
      for (const [x, y, r] of B) {
        g.beginPath();
        g.arc(x, y, r + 0.7, 0, TAU);
        g.fill();
      }
      g.fillStyle = PAPER;
      for (const [x, y, r] of B) {
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
      g.fillStyle = INK;
      for (let k = 0; k < 9; k++) {
        const a = rnd(0, TAU);
        const d = rnd(0, 8);
        g.beginPath();
        g.arc(20 + Math.cos(a) * d, 20 + Math.sin(a) * d, rnd(0.3, 1.0), 0, TAU);
        g.fill();
      }
      g.strokeStyle = INK;
      g.lineWidth = 1.1;
      g.lineCap = 'round';
      const a = rnd(0, TAU);
      g.beginPath();
      g.moveTo(20 + Math.cos(a) * 3, 20 + Math.sin(a) * 3);
      g.quadraticCurveTo(20 + Math.cos(a + 0.4) * 9, 20 + Math.sin(a + 0.4) * 9, 20 + Math.cos(a + 0.2) * 14, 20 + Math.sin(a + 0.2) * 14);
      g.stroke();
    });

  const soulSpr = () =>
    sprite('sumi-soul', 32, 32, (g) => {
      const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      rg.addColorStop(0, 'rgba(255,253,244,1)');
      rg.addColorStop(0.18, 'rgba(240,234,218,0.85)');
      rg.addColorStop(0.45, 'rgba(176,192,214,0.3)');
      rg.addColorStop(1, 'rgba(120,140,170,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 32, 32);
    });

  const fireSpr = () =>
    sprite('sumi-fire', 32, 32, (g) => {
      const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      rg.addColorStop(0, 'rgba(255,176,96,0.9)');
      rg.addColorStop(0.35, 'rgba(214,70,45,0.5)');
      rg.addColorStop(1, 'rgba(200,55,45,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 32, 32);
    });

  // ── 그림 조각 ───────────────────────────────────────────────
  /** 달리는 것의 옆모습 자세: 좌우는 뒤집고 기울기만 (위로 뛰면 코가 들린다). o 에 face 를 기억 */
  function pose(o, vx, vy) {
    if (vx > 25) o.face = 1;
    else if (vx < -25) o.face = -1;
    else if (!o.face) o.face = 1;
    o.tilt = clamp(Math.atan2(vy, Math.abs(vx) + 1), -0.8, 0.8);
  }
  /** 여우 엉덩이 자리 (불꼬리 시작) */
  function foxRear(o, sc) {
    const lx = -13 * sc;
    const ly = 2 * sc;
    const cs = Math.cos(o.tilt);
    const sn = Math.sin(o.tilt);
    return [o.x + o.face * (lx * cs - ly * sn), o.y + lx * sn + ly * cs];
  }
  /** 여우 한 마리 (옆모습, face 좌우 · tilt 기울기). 한지색 테 + 먹 몸 + 금 눈 */
  function drawFox(c, x, y, face, tilt, age, sc) {
    c.save();
    c.translate(x, y);
    c.scale(face, 1);
    c.rotate(tilt + Math.sin(age * 34) * 0.07);
    c.scale(sc, sc);
    c.translate(-5, 0);
    const body = Math.floor(age / 0.085) % 2 ? FOX_B : FOX_A;
    c.lineJoin = 'round';
    c.strokeStyle = PAPER;
    c.lineWidth = 2.8;
    c.stroke(FOX_RUNTAIL);
    c.stroke(body);
    c.fillStyle = INK;
    c.fill(FOX_RUNTAIL);
    c.fill(body);
    c.fillStyle = '#F0CB72';
    c.beginPath();
    c.arc(16.6, -6.4, 1.15, 0, TAU);
    c.fill();
    c.strokeStyle = VERM;
    c.lineWidth = 1.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(5, -1.5);
    c.bezierCurveTo(6, 0.5, 7, 1.5, 9.5, 1.5);
    c.stroke();
    c.fillStyle = VERM;
    c.beginPath();
    c.moveTo(12.3, -10.6);
    c.lineTo(13, -14);
    c.lineTo(14.4, -11.2);
    c.fill();
    c.restore();
  }

  /** 불꼬리: P=[…] 옛→새 (끝이 여우 엉덩이) */
  function fireTail(c, P, wmax, t, seed) {
    const n = P.length >> 1;
    if (n < 3) return;
    ribbon(c, P, (k, i) => wmax * Math.pow(k, 0.85) * (0.72 + 0.38 * Math.sin(t * 26 + i * 1.7 + seed)));
    c.fillStyle = va(0.92);
    c.fill();
    c.globalCompositeOperation = 'lighter';
    ribbon(c, P, (k, i) => wmax * 0.42 * Math.pow(k, 1.4) * (0.8 + 0.3 * Math.sin(t * 31 + i * 2.3)));
    c.fillStyle = fa(0.85);
    c.fill();
    for (let j = 0; j < 3; j++) {
      const i = Math.floor(n * (0.15 + j * 0.25));
      const ph = (t * 1.7 + j * 0.37 + seed) % 1;
      c.fillStyle = ga(1 - ph);
      diamond(c, P[i * 2] + Math.sin(j * 5 + t * 5) * 5 * ph, P[i * 2 + 1] - ph * 11, 1.4);
    }
    c.globalCompositeOperation = 'source-over';
  }

  function ghostPath(c, sway) {
    c.beginPath();
    c.moveTo(2, -17);
    c.bezierCurveTo(11, -17, 15, -9, 14, -1);
    c.bezierCurveTo(13, 7, 7, 12, 1 + sway * 0.3, 15);
    c.bezierCurveTo(-4 + sway * 0.6, 17, -8 + sway, 19, -12 + sway * 1.6, 24);
    c.bezierCurveTo(-10 + sway, 18, -12, 15, -13, 11);
    c.bezierCurveTo(-16, 6, -15, -3, -12, -9);
    c.bezierCurveTo(-9, -14, -5, -17, 2, -17);
    c.closePath();
  }

  /** 유령 (옅은 먹 혼). flare: 쏘는 순간 눈이 주홍으로 */
  function drawGhost(c, x, y, t, a, flare, seed, sc) {
    c.save();
    c.translate(x, y);
    c.scale(sc, sc);
    c.globalAlpha = a * 0.6;
    const gs = 56 + flare * 60;
    c.globalCompositeOperation = 'lighter';
    c.drawImage(soulSpr(), -gs / 2, -gs / 2 - 3, gs, gs);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = a;
    const sway = Math.sin(t * 4.2 + seed) * 3;
    ghostPath(c, sway);
    c.fillStyle = pa(0.88);
    c.fill();
    const lg = c.createLinearGradient(0, -2, 0, 24);
    lg.addColorStop(0, 'rgba(60,58,62,0)');
    lg.addColorStop(1, 'rgba(60,58,62,0.75)');
    c.fillStyle = lg;
    c.fill();
    c.strokeStyle = ia(0.8);
    c.lineWidth = 1.4;
    c.stroke();
    // 먹 갈필 한 획 (머리 둘레)
    c.strokeStyle = ia(0.55);
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(1, -3, 12.5, -2.6, -0.9);
    c.stroke();
    // 눈 · 입
    c.fillStyle = flare > 0 ? VERM : INK;
    c.beginPath();
    c.ellipse(-3.6, -6, 1.5, 2.6, 0.35, 0, TAU);
    c.ellipse(5.4, -6, 1.5, 2.6, -0.35, 0, TAU);
    c.fill();
    c.fillStyle = ia(0.8);
    c.beginPath();
    c.ellipse(1, 2, 1.5, 2.3 + flare * 4, 0, 0, TAU);
    c.fill();
    c.restore();
  }

  function soulDraw(c, p) {
    const h = p.hist;
    if (h.length >= 6) {
      const P = h.concat([p.x, p.y]);
      ribbon(c, P, (k) => 4.2 * Math.pow(k, 1.1));
      c.fillStyle = pa(0.32);
      c.fill();
      ribbon(c, P, (k, i) => 1.6 * k * (0.7 + 0.3 * Math.sin(p.age * 30 + i)));
      c.fillStyle = pa(0.75);
      c.fill();
    }
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.9;
    c.drawImage(soulSpr(), p.x - 13, p.y - 13, 26, 26);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.translate(p.x, p.y);
    c.rotate(Math.atan2(p.vy, p.vx));
    c.beginPath();
    c.moveTo(4.2, 0);
    c.bezierCurveTo(4.2, 3.6, -2, 3.6, -10, Math.sin(p.age * 20) * 1.5);
    c.bezierCurveTo(-2, -3.6, 4.2, -3.6, 4.2, 0);
    c.fillStyle = PAPER;
    c.fill();
    c.strokeStyle = ga(0.95);
    c.lineWidth = 0.7;
    c.stroke();
  }

  /** 불길 터짐 (여우가 물 때 · 화염 반응) */
  function fireBurst(api, x, y, size) {
    const seed = rnd(0, 10);
    CX.mark(api, x, y, 0.6, (c, k) => {
      const a = 1 - k;
      c.globalCompositeOperation = 'lighter';
      const gs = size * (1.8 + k * 1.6);
      c.globalAlpha = a * 0.85;
      c.drawImage(fireSpr(), x - gs / 2, y - gs / 2, gs, gs);
      c.globalAlpha = 1;
      const rise = ease(k * 2.5);
      for (let j = 0; j < 5; j++) {
        const ox = (j - 2) * size * 0.3 + Math.sin(seed + j) * 3;
        const hh = size * (0.8 + 0.6 * hash(seed + j)) * (0.35 + rise * 0.85) * (1 - k * 0.4);
        flamePath(c, x + ox, y + size * 0.35 - k * 10, hh, size * 0.17, Math.sin(seed + j + k * 7) * 4);
        c.fillStyle = va(0.9 * a);
        c.fill();
        flamePath(c, x + ox, y + size * 0.35 - k * 10, hh * 0.55, size * 0.08, Math.sin(seed + j + k * 7) * 2);
        c.fillStyle = fa(0.85 * a);
        c.fill();
      }
    });
  }

  /** 붓 원상이 그어진다 (소환 · 홀림) */
  function ensoMark(api, x, y, r, life, col, th) {
    const a0 = rnd(0, TAU);
    const seed = rnd(0, 10);
    CX.mark(api, x, y, life, (c, k) => {
      const draw = ease(Math.min(1, k * 2.2));
      const a = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      arcPath(c, x, y, r * (1 + k * 0.15), a0, a0 + 5.6 * draw, th, seed);
      c.fillStyle = col(0.92 * a);
      c.fill();
      c.strokeStyle = ia(0.45 * a);
      dryArc(c, x, y, r * (1 + k * 0.15), a0, a0 + 5.6 * draw, th, seed);
      c.fillStyle = ga(a);
      for (let j = 0; j < 3; j++) {
        const aa = a0 + 1.2 + j * 1.7;
        diamond(c, x + Math.cos(aa) * (r + 6 + k * 8), y + Math.sin(aa) * (r + 6 + k * 8), 1.5);
      }
    });
  }

  /** 먹 연기로 흩어짐 (소환수가 사라질 때) */
  function vanish(api, x, y) {
    const seed = rnd(0, 10);
    CX.mark(api, x, y, 0.5, (c, k) => {
      const a = 1 - k;
      for (let j = 0; j < 4; j++) {
        const aa = seed + j * 1.6;
        const d = 4 + ease(k) * 14;
        c.fillStyle = pa(0.45 * a);
        c.beginPath();
        c.arc(x + Math.cos(aa) * d, y + Math.sin(aa) * d - k * 8, 3 + k * 4, 0, TAU);
        c.fill();
      }
      c.strokeStyle = va(0.8 * a);
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(x, y, 6 + k * 16, seed, seed + 4);
      c.stroke();
    });
  }

  // ── 무기 셋 ─────────────────────────────────────────────────
  const FOX_SC = 1.08;
  function foxDraw(c, u) {
    if (u.seed == null) (u.seed = rnd(0, 10)), (u.tail = []);
    pose(u, u.vx, u.vy);
    const [rx, ry] = foxRear(u, FOX_SC);
    const tl = u.tail;
    const n = tl.length;
    if (!n || Math.hypot(tl[n - 2] - rx, tl[n - 1] - ry) > 2.5) {
      tl.push(rx, ry);
      if (tl.length > 34) tl.splice(0, 2);
    }
    c.save();
    fireTail(c, tl.concat([rx, ry]), 8, u.age, u.seed);
    c.restore();
    // 여우불 빛
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.55;
    c.drawImage(fireSpr(), rx - 15, ry - 15, 30, 30);
    c.restore();
    drawFox(c, u.x, u.y, u.face, u.tilt, u.age, FOX_SC);
  }

  function fireFox(api, w, tg) {
    const sx = w.x;
    const sy = w.y - 30;
    ensoMark(api, sx, sy, 15, 0.55, pa, 3.2);
    api.later(0.14, (a) => {
      CX.runner(a, w, tg, {
        speed: 190,
        dmg: 4,
        n: 3,
        r: 10,
        draw: foxDraw,
        onHit: (a2, u, en) => {
          fireBurst(a2, en.x, en.y, 12);
          if (u.left <= 1) vanish(a2, u.x, u.y);
        },
      });
    });
    return 2.4;
  }

  function fireGhost(api, w) {
    const ox = w.x;
    const oy = w.y - 26;
    const hx = clamp(w.x + rnd(-70, 70), 40, W - 40);
    const hy = rnd(292, 345);
    ensoMark(api, ox, oy, 13, 0.45, pa, 2.4);
    api.add(
      {
        x: ox,
        y: oy,
        vx: 0,
        vy: 0,
        z: 0,
        life: 3.9,
        shots: [0.75, 1.45, 2.15, 2.85],
        si: 0,
        flare: 0,
        seed: rnd(0, 10),
        update(dt, a) {
          const px = this.x;
          const py = this.y;
          const k = ease(this.age / 0.75);
          this.x = lerp(ox, hx, k) + Math.sin(this.age * 1.7 + this.seed) * 18 * k;
          this.y = lerp(oy, hy, k) + Math.sin(this.age * 2.6 + this.seed) * 6 * k;
          this.vx = (this.x - px) / Math.max(dt, 1e-4);
          this.vy = (this.y - py) / Math.max(dt, 1e-4);
          this.flare = Math.max(0, this.flare - dt);
          if (this.si < this.shots.length && this.age >= this.shots[this.si]) {
            this.si++;
            const tg = a.target('near', this.x, this.y - 140) || a.target('front');
            if (tg) {
              this.flare = 0.28;
              soulFire(a, w, this.x + 2, this.y - 10, tg);
            }
          }
        },
        draw(c) {
          const a = Math.min(1, this.age / 0.25) * (this.age > 3.5 ? Math.max(0, (3.9 - this.age) / 0.4) : 1);
          drawGhost(c, this.x, this.y, this.age, a, this.flare, this.seed, 1 + this.flare * 0.5);
        },
      },
      w,
    );
    return 3.0;
  }

  function soulFire(api, w, x, y, tg) {
    const side = Math.random() < 0.5 ? -1 : 1;
    api.add(
      {
        x,
        y,
        vx: side * rnd(90, 140),
        vy: -rnd(60, 110),
        z: 0,
        r: 6,
        tgt: tg,
        life: 2.6,
        update(dt, a) {
          if (!this.tgt || !this.tgt.alive) this.tgt = a.target('near', this.x, this.y);
          const sp = 250 + this.age * 120;
          if (this.tgt) {
            const dx = this.tgt.x - this.x;
            const dy = this.tgt.y - this.y;
            const d = Math.hypot(dx, dy) || 1;
            const k = Math.min(1, dt * 5.5);
            this.vx += ((dx / d) * sp - this.vx) * k;
            this.vy += ((dy / d) * sp - this.vy) * k;
          }
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          for (const e of a.near(this.x, this.y, this.r)) {
            a.hit(w, e, 3, this.x, this.y);
            return false;
          }
          return this.y > -20 && this.y < H && this.x > -20 && this.x < W + 20;
        },
        draw(c) {
          soulDraw(c, this);
        },
      },
      w,
    );
  }

  function fireDrum(api, w, tg) {
    const ox = w.x;
    const oy = w.y - 24;
    const ang = Math.atan2(tg.y - oy, tg.x - ox);
    const reach = Math.min(440, Math.hypot(tg.x - ox, tg.y - oy) + 70);
    for (let i = 0; i < 3; i++) api.later(i * 0.2, (a) => drumWave(a, w, ox, oy, ang, reach, i));
    return 2.3;
  }

  function drumWave(api, w, ox, oy, ang, reach, i) {
    // 북 치는 자리: 주홍 북가죽 번쩍 + 한지 원
    CX.mark(api, ox, oy - 6, 0.34, (c, k) => {
      const a = 1 - k;
      c.fillStyle = va(0.8 * a);
      c.beginPath();
      c.arc(ox, oy - 6, 8 + ease(k) * 10, 0, TAU);
      c.fill();
      c.strokeStyle = pa(0.95 * a);
      c.lineWidth = 3 * a + 0.5;
      c.beginPath();
      c.arc(ox, oy - 6, 12 + ease(k) * (22 + i * 6), 0, TAU);
      c.stroke();
    });
    if (i === 2) api.shake(1.4);
    const spread = 0.46 + i * 0.06;
    const th = 5.5 + i * 2;
    const push = 5 + i * 3;
    const flip = i % 2 ? -1 : 1;
    const seed = rnd(0, 10);
    const hitSet = new Set();
    api.add(
      {
        x: ox,
        y: oy,
        vx: Math.cos(ang) * 340,
        vy: Math.sin(ang) * 340,
        z: -1,
        rad: 12,
        update(dt, a) {
          this.rad += 340 * dt;
          this.x = ox + Math.cos(ang) * this.rad;
          this.y = oy + Math.sin(ang) * this.rad;
          for (const e of a.enemies) {
            if (!e.alive || hitSet.has(e)) continue;
            const d = Math.hypot(e.x - ox, e.y - oy);
            if (Math.abs(d - this.rad) > e.r + 6) continue;
            const da = Math.atan2(e.y - oy, e.x - ox) - ang;
            if (Math.abs(Math.atan2(Math.sin(da), Math.cos(da))) > spread + e.r / Math.max(d, 1)) continue;
            hitSet.add(e);
            a.hit(w, e, 2, e.x, e.y, { push });
          }
          return this.rad < reach;
        },
        draw(c) {
          const r = this.rad;
          const al = clamp(1 - Math.pow(r / reach, 3), 0, 1) * Math.min(1, r / 30);
          const t2 = th * (0.8 + 0.3 * (r / reach));
          const a0 = ang - spread * flip;
          const a1 = ang + spread * flip;
          // 뒤따르는 옅은 물결
          if (r > 26) {
            arcPath(c, ox, oy, r - 11 - i * 2, ang - spread * 0.8, ang + spread * 0.8, t2 * 0.45, seed + 3, true);
            c.fillStyle = pa(0.4 * al);
            c.fill();
          }
          arcPath(c, ox, oy, r, a0, a1, t2, seed, true);
          c.fillStyle = pa(0.92 * al);
          c.fill();
          c.strokeStyle = ia(0.55 * al);
          dryArc(c, ox, oy, r, a0, a1, t2, seed);
          c.strokeStyle = ga(al);
          c.lineWidth = 1.1;
          c.beginPath();
          c.arc(ox, oy, r + t2 * 0.8, ang - spread * 0.7, ang + spread * 0.7);
          c.stroke();
        },
      },
      w,
    );
  }

  // ── 반응 셋 (보조일 때의 큰 한 방) ──────────────────────────
  function nearestChain(api, e, n, maxD) {
    const out = [];
    const used = new Set([e]);
    let cx = e.x;
    let cy = e.y;
    for (let i = 0; i < n; i++) {
      let best = null;
      let bd = maxD * maxD;
      for (const m of api.enemies) {
        if (!m.alive || used.has(m)) continue;
        const d = (m.x - cx) ** 2 + (m.y - cy) ** 2;
        if (d < bd) (bd = d), (best = m);
      }
      if (!best) break;
      used.add(best);
      out.push(best);
      cx = best.x;
      cy = best.y;
    }
    return out;
  }

  // 불여우: 전향 무리 · 화염 — 홀린 적에서 불여우 혼이 뛰쳐나와 제 무리를 차례로 들이받고 불태운다
  function reactFox(api, e, w) {
    const x0 = e.x;
    const y0 = e.y;
    ensoMark(api, x0, y0, 22, 0.75, va, 4.5);
    fireBurst(api, x0, y0, 18);
    const path = nearestChain(api, e, 3, 150);
    if (!path.length && e.alive) path.push(e);
    api.add({
      x: x0,
      y: y0,
      vx: 0,
      vy: -1,
      z: 1,
      noTrail: true,
      dir: -Math.PI / 2,
      pi: 0,
      tail: [],
      seed: rnd(0, 10),
      fade: 0,
      update(dt, a) {
        if (this.age < 0.2) return true;
        const tg = this.path[this.pi];
        if (!tg) {
          this.fade += dt;
          return this.fade < 0.3;
        }
        const dx = tg.x - this.x;
        const dy = tg.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = 430;
        this.vx = (dx / d) * sp;
        this.vy = (dy / d) * sp;
        this.dir = Math.atan2(dy, dx);
        if (d < 12 || !tg.alive) {
          if (tg.alive || d < 12) {
            for (const m of a.near(tg.x, tg.y, 30)) a.hit(w, m, 5, m.x, m.y, { isReact: true, push: 6 });
            fireBurst(a, tg.x, tg.y, 16);
            a.shake(1.5);
          }
          this.pi++;
          return true;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        return this.age < 2.4;
      },
      draw(c) {
        const a = this.fade ? 1 - this.fade / 0.3 : Math.min(1, this.age / 0.15);
        c.globalAlpha = a;
        pose(this, this.vx, this.vy);
        const [rx, ry] = foxRear(this, 1.45);
        const tl = this.tail;
        const n = tl.length;
        if (!n || Math.hypot(tl[n - 2] - rx, tl[n - 1] - ry) > 3) {
          tl.push(rx, ry);
          if (tl.length > 32) tl.splice(0, 2);
        }
        c.save();
        fireTail(c, tl.concat([rx, ry]), 12, this.age, this.seed);
        c.restore();
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.7 * a;
        c.drawImage(fireSpr(), this.x - 28, this.y - 28, 56, 56);
        c.restore();
        drawFox(c, this.x, this.y, this.face, this.tilt, this.age, 1.45);
      },
      path,
    });
  }

  // 유령: 혼 거두기 · 관통 — 둘레 적들에게서 혼을 뽑아 모으고, 모인 혼이 한지색 붓창이 되어 줄을 꿰뚫는다
  function reactGhost(api, e, w) {
    const x0 = e.x;
    const y0 = e.y;
    // 혼을 모으는 자리는 족자 반대쪽 위
    const side = -labelSide(clamp(x0, 112, W - 112));
    const P = { x: clamp(x0 + side * 72, 26, W - 26), y: clamp(y0 - 80, 74, 380) };
    const ang = Math.atan2(y0 - P.y, x0 - P.x);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const LEN = 470;
    const souls = api.near(x0, y0, 92).slice(0, 6).map((n) => ({ n, x: n.x, y: n.y, d: rnd(0, 0.12), s: rnd(-1, 1) }));
    if (!souls.length) souls.push({ n: e, x: x0, y: y0, d: 0, s: 0.5 });
    const seed = rnd(0, 10);
    const T = 1.15;
    CX.mark(
      api,
      P.x,
      P.y,
      T,
      (c, k) => {
        const t = k * T;
        // 혼 뽑기
        if (t < 0.55) {
          for (const s of souls) {
            const q = clamp((t - s.d) / 0.36, 0, 1);
            if (q <= 0) continue;
            if (s.n.alive) (s.x = s.n.x), (s.y = s.n.y);
            const cx = s.x + (P.x - s.x) * 0.2 + s.s * 34;
            const cy = s.y - 44;
            const at = (u) => [(1 - u) * (1 - u) * s.x + 2 * (1 - u) * u * cx + u * u * P.x, (1 - u) * (1 - u) * s.y + 2 * (1 - u) * u * cy + u * u * P.y];
            const fade = t > 0.42 ? 1 - (t - 0.42) / 0.13 : 1;
            c.strokeStyle = pa(0.7 * fade);
            c.lineWidth = 1.6;
            c.lineCap = 'round';
            c.beginPath();
            const q0 = Math.max(0, q - 0.45);
            for (let j = 0; j <= 8; j++) {
              const [px, py] = at(q0 + ((q - q0) * j) / 8);
              j ? c.lineTo(px, py) : c.moveTo(px, py);
            }
            c.stroke();
            const [hx, hy] = at(q);
            c.globalCompositeOperation = 'lighter';
            c.globalAlpha = fade;
            c.drawImage(soulSpr(), hx - 13, hy - 13, 26, 26);
            c.globalAlpha = 1;
            c.globalCompositeOperation = 'source-over';
          }
        }
        // 모이는 유령
        const gin = clamp(t / 0.3, 0, 1);
        const gout = t > 0.55 ? clamp((t - 0.55) / 0.35, 0, 1) : 0;
        if (gin * (1 - gout) > 0) drawGhost(c, P.x, P.y, t, gin * (1 - gout), t > 0.36 && t < 0.6 ? 1 : 0, seed, 1.3 + clamp((t - 0.2) / 0.25, 0, 1) * 0.35 * (1 - gout));
        // 관통 붓창
        if (t >= 0.45) {
          const q = t - 0.45;
          const len = LEN * ease(q / 0.09);
          const fade = 1 - clamp((q - 0.14) / 0.5, 0, 1);
          if (fade <= 0) return;
          const nx = -uy;
          const ny = ux;
          const pts = [];
          const N = 16;
          for (let j = 0; j <= N; j++) {
            const u = j / N;
            const wv = 8.5 * Math.pow(1 - u, 0.7) * (u < 0.05 ? u / 0.05 : 1) * (0.85 + 0.15 * Math.sin(u * 23 + seed)) * (0.5 + 0.5 * fade);
            pts.push([P.x + ux * len * u, P.y + uy * len * u, wv]);
          }
          c.save();
          c.shadowColor = 'rgba(236,228,211,0.8)';
          c.shadowBlur = 12;
          c.beginPath();
          pts.forEach(([px, py, wv], j) => (j ? c.lineTo(px + nx * wv, py + ny * wv) : c.moveTo(px + nx * wv, py + ny * wv)));
          for (let j = pts.length - 1; j >= 0; j--) c.lineTo(pts[j][0] - nx * pts[j][2] * 0.6, pts[j][1] - ny * pts[j][2] * 0.6);
          c.closePath();
          c.fillStyle = pa(0.95 * fade);
          c.fill();
          c.restore();
          // 갈필 · 금박 테
          c.strokeStyle = ia(0.45 * fade);
          c.lineWidth = 0.7;
          for (const o of [0.15, 0.5]) {
            c.beginPath();
            c.moveTo(P.x + ux * len * 0.12 + nx * 8 * o, P.y + uy * len * 0.12 + ny * 8 * o);
            c.lineTo(P.x + ux * len * (0.55 + o * 0.3) + nx * 3 * o, P.y + uy * len * (0.55 + o * 0.3) + ny * 3 * o);
            c.stroke();
          }
          c.strokeStyle = ga(0.95 * fade);
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(P.x + nx * 8, P.y + ny * 8);
          c.lineTo(P.x + ux * len * 0.7 + nx * 2.4, P.y + uy * len * 0.7 + ny * 2.4);
          c.stroke();
          // 꿰뚫린 자리 혼불 조각
          c.fillStyle = ga(fade);
          for (let j = 0; j < 6; j++) {
            const u = 0.15 + j * 0.13;
            if (u * LEN > len) break;
            const off = Math.sin(j * 2.7 + seed) * 12 * (1 + q * 2);
            diamond(c, P.x + ux * LEN * u + nx * off, P.y + uy * LEN * u + ny * off - q * 14, 1.5);
          }
        }
      },
      1,
    );
    api.later(0.49, (a) => {
      const x2 = P.x + ux * LEN;
      const y2 = P.y + uy * LEN;
      for (const n of a.enemies) if (n.alive && CX.util.distSeg(n.x, n.y, P.x, P.y, x2, y2) < n.r + 10) a.hit(w, n, 6, n.x, n.y, { isReact: true });
      a.shake(2.5);
    });
  }

  // 전쟁 북: 날려 보내기 · 얼음 — 큰 북이 울리며 붓 원 물결 셋이 적을 밀어 올리고, 맞은 적에 서리꽃이 핀다
  function reactDrum(api, e, w) {
    const x0 = e.x;
    const y0 = e.y;
    const seed = rnd(0, 10);
    const R = 88;
    CX.mark(api, x0, y0, 1.0, (c, k) => {
      const t = k;
      // 북면: 한지 가죽 + 주홍 테 + 쇠못, 둥 하고 울리며 커진다
      if (t < 0.45) {
        const a = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.15;
        const r = 14 + ease(t / 0.12) * 14 + Math.sin(t * 60) * 1.5 * (1 - t / 0.45);
        c.fillStyle = pa(0.92 * a);
        c.beginPath();
        c.arc(x0, y0, r, 0, TAU);
        c.fill();
        c.strokeStyle = va(0.95 * a);
        c.lineWidth = 6;
        c.stroke();
        c.strokeStyle = ia(0.75 * a);
        c.lineWidth = 1;
        c.beginPath();
        c.arc(x0, y0, r + 3.4, 0, TAU);
        c.stroke();
        c.fillStyle = ga(a);
        for (let j = 0; j < 10; j++) {
          const aa = (j / 10) * TAU;
          c.beginPath();
          c.arc(x0 + Math.cos(aa) * (r + 6), y0 + Math.sin(aa) * (r + 6), 1.5, 0, TAU);
          c.fill();
        }
        // 가죽 가운데: 먹 원상 + 금 점
        arcPath(c, x0, y0, r * 0.5, seed, seed + 5, 2.2, seed);
        c.fillStyle = ia(0.55 * a);
        c.fill();
        c.fillStyle = ga(a);
        c.beginPath();
        c.arc(x0, y0, 3.4, 0, TAU);
        c.fill();
      }
      // 붓 원 물결 셋
      for (let j = 0; j < 3; j++) {
        const tj = t - j * 0.09;
        if (tj <= 0) continue;
        const r = 18 + ease(tj / 0.5) * (R - 14 + j * 18);
        const al = 1 - clamp(tj / 0.72, 0, 1);
        if (al <= 0) continue;
        const a0 = seed + j * 2.1;
        arcPath(c, x0, y0, r, a0, a0 + 5.5, 6 - j * 1.3, seed + j);
        c.fillStyle = pa(0.92 * al);
        c.fill();
        c.strokeStyle = ia(0.5 * al);
        dryArc(c, x0, y0, r, a0, a0 + 5.5, 6 - j * 1.3, seed + j);
        c.strokeStyle = ga(0.9 * al);
        c.lineWidth = 0.9;
        c.beginPath();
        c.arc(x0, y0, r + 5 - j, a0 + 0.8, a0 + 4.2);
        c.stroke();
      }
    });
    api.shake(3);
    api.later(0.06, (a) => {
      for (const n of a.near(x0, y0, R)) {
        const oy = n.y;
        a.hit(w, n, 5, n.x, n.y, { isReact: true, push: 34, slow: 2.4 });
        frostMark(a, n, oy);
      }
    });
  }

  function frostMark(api, n, oy) {
    const rot = rnd(0, TAU);
    let lx = n.x;
    let ly = n.y;
    CX.mark(api, n.x, n.y, 1.5, (c, k) => {
      if (n.alive) (lx = n.x), (ly = n.y);
      // 밀려난 자국 (한지색 속도선)
      if (k < 0.25) {
        const a = 1 - k / 0.25;
        c.strokeStyle = pa(0.7 * a);
        c.lineWidth = 1.4;
        for (const dx of [-5, 0, 5]) {
          c.beginPath();
          c.moveTo(lx + dx, oy + 6);
          c.lineTo(lx + dx * 0.6, ly + 10);
          c.stroke();
        }
      }
      // 서리꽃: 여섯 갈래 붓 획
      const a = k < 0.15 ? k / 0.15 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const r = (n.r || 11) * 0.95;
      c.translate(lx, ly);
      c.rotate(rot + k * 0.6);
      c.strokeStyle = pa(0.95 * a);
      c.lineCap = 'round';
      c.lineWidth = 1.6;
      c.beginPath();
      for (let j = 0; j < 6; j++) {
        const aa = (j / 6) * TAU;
        const cx = Math.cos(aa);
        const cy = Math.sin(aa);
        c.moveTo(cx * 2, cy * 2);
        c.lineTo(cx * r, cy * r);
        const bx = cx * r * 0.6;
        const by = cy * r * 0.6;
        c.moveTo(bx, by);
        c.lineTo(bx + Math.cos(aa + 0.7) * r * 0.3, by + Math.sin(aa + 0.7) * r * 0.3);
        c.moveTo(bx, by);
        c.lineTo(bx + Math.cos(aa - 0.7) * r * 0.3, by + Math.sin(aa - 0.7) * r * 0.3);
      }
      c.stroke();
      c.fillStyle = ga(a);
      diamond(c, 0, 0, 1.8);
    });
  }

  // ── 아이콘 ──────────────────────────────────────────────────
  const ICON = {
    arm_su_fox(g) {
      g.translate(25.9, 26.6);
      g.scale(0.78, 0.78);
      g.lineJoin = 'round';
      g.strokeStyle = PAPER;
      g.lineWidth = 3.2;
      for (const p of FOX_TAILS) g.stroke(p);
      g.stroke(FOX_A);
      g.fillStyle = INK;
      for (const p of FOX_TAILS) g.fill(p);
      g.fill(FOX_A);
      g.fillStyle = VERM;
      g.fill(FOX_TIPS);
      g.fillStyle = GOLD;
      g.beginPath();
      g.arc(-15, -15, 1.3, 0, TAU);
      g.arc(-23.5, -10, 1.2, 0, TAU);
      g.fill();
      g.fillStyle = '#F0CB72';
      g.beginPath();
      g.arc(16.4, -6.6, 1.1, 0, TAU);
      g.fill();
      g.strokeStyle = VERM;
      g.lineWidth = 1.5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(5, -1.5);
      g.bezierCurveTo(6, 0.5, 7, 1.5, 9, 1.5);
      g.stroke();
    },
    arm_sl_ghost(g) {
      g.translate(24.5, 21);
      g.scale(0.92, 0.92);
      ghostPath(g, 0);
      g.lineJoin = 'round';
      g.strokeStyle = PAPER;
      g.lineWidth = 5.5;
      g.stroke();
      g.fillStyle = PAPER;
      g.fill();
      const lg = g.createLinearGradient(0, -2, 0, 24);
      lg.addColorStop(0, 'rgba(26,26,26,0)');
      lg.addColorStop(1, 'rgba(26,26,26,0.55)');
      g.fillStyle = lg;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2.6;
      g.stroke();
      g.fillStyle = INK;
      g.beginPath();
      g.ellipse(-3.6, -6, 1.9, 3.1, 0.35, 0, TAU);
      g.ellipse(5.4, -6, 1.9, 3.1, -0.35, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(1, 2.5, 1.8, 2.8, 0, 0, TAU);
      g.fill();
      // 혼불 하나
      g.fillStyle = VERM;
      g.beginPath();
      g.moveTo(17, -9);
      g.bezierCurveTo(21, -12, 19, -17, 17.5, -21);
      g.bezierCurveTo(16.5, -17, 13, -14, 14.5, -10.5);
      g.closePath();
      g.fill();
      g.fillStyle = '#F0CB72';
      g.beginPath();
      g.arc(16.6, -11.4, 1.5, 0, TAU);
      g.fill();
    },
    arm_s_janggu(g) {
      g.translate(24, 27.4);
      g.scale(0.8, 0.8);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const arcs = new Path2D('M-19,-8 C-22,-3 -22,3 -19,8 M-23,-11 C-27,-4 -27,5 -23,11 M19,-8 C22,-3 22,3 19,8 M23,-11 C27,-4 27,5 23,11');
      const sticks = new Path2D('M4,-22 L12,-12 M16,-22 L8,-12');
      const body = new Path2D('M-13,-8 C-15,-2 -15,6 -13,12 L13,12 C15,6 15,-2 13,-8 Z');
      g.strokeStyle = PAPER;
      g.lineWidth = 4;
      g.stroke(arcs);
      g.stroke(sticks);
      g.stroke(body);
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.stroke(arcs);
      g.fillStyle = VERM;
      g.fill(body);
      g.lineWidth = 1.8;
      g.stroke(body);
      g.beginPath();
      g.moveTo(-13, 12);
      g.bezierCurveTo(-8, 15.5, 8, 15.5, 13, 12);
      g.stroke();
      g.strokeStyle = ia(0.6);
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(-14, 2);
      g.bezierCurveTo(-6, 4, 6, 4, 14, 2);
      g.stroke();
      g.fillStyle = PAPER;
      g.strokeStyle = INK;
      g.lineWidth = 1.8;
      g.beginPath();
      g.ellipse(0, -8, 13, 3.8, 0, 0, TAU);
      g.fill();
      g.stroke();
      g.fillStyle = GOLD;
      g.beginPath();
      g.arc(0, -8, 2, 0, TAU);
      g.fill();
      g.fillStyle = INK;
      for (const x of [-10, -5, 0, 5, 10]) {
        g.beginPath();
        g.arc(x, -4.2 + Math.abs(x) * -0.05, 0.9, 0, TAU);
        g.fill();
      }
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.stroke(sticks);
      g.fillStyle = VERM;
      g.lineWidth = 0.9;
      for (const x of [4, 16]) {
        g.beginPath();
        g.arc(x, -22, 2.2, 0, TAU);
        g.fill();
        g.stroke();
      }
    },
  };

  // ── 세계 ────────────────────────────────────────────────────
  CX.world('sumi', {
    name: '수묵 요괴',
    short: '수묵',
    desc: '먹으로 그린 요괴가 한지색 붓 획을 끌고 싸운다. 맞은 자리엔 주홍 낙관, 반응 이름은 한지 띠에 세로 붓글씨.',
    colors: { main: '#ECE4D3', soft: '#3A1E1A' },
    fonts: ['East Sea Dokdo'],

    box(c, x, y, w, h) {
      const s = sprite(`sumi-box-${w}x${h}`, w, h, (g) => {
        g.fillStyle = PAPER;
        g.fillRect(0, 0, w, h);
        const rg = g.createRadialGradient(w * 0.5, h * 0.42, w * 0.1, w * 0.5, h * 0.5, w * 0.78);
        rg.addColorStop(0, 'rgba(255,251,240,0.55)');
        rg.addColorStop(1, 'rgba(150,126,88,0.38)');
        g.fillStyle = rg;
        g.fillRect(0, 0, w, h);
        // 한지 섬유
        g.strokeStyle = 'rgba(120,100,70,0.22)';
        g.lineWidth = 0.35;
        for (let i = 0; i < 24; i++) {
          const x0 = rnd(0, w);
          const y0 = rnd(0, h);
          const a = rnd(0, TAU);
          const l = rnd(3, 9);
          g.beginPath();
          g.moveTo(x0, y0);
          g.quadraticCurveTo(x0 + Math.cos(a) * l * 0.5 + rnd(-2, 2), y0 + Math.sin(a) * l * 0.5 + rnd(-2, 2), x0 + Math.cos(a) * l, y0 + Math.sin(a) * l);
          g.stroke();
        }
        // 옅은 먹 원상
        arcPath(g, w * 0.5, h * 0.52, w * 0.36, -2.1, -2.1 + 5.3, w * 0.055, 2);
        g.fillStyle = 'rgba(43,41,38,0.3)';
        g.fill();
        g.strokeStyle = 'rgba(236,228,211,0.6)';
        dryArc(g, w * 0.5, h * 0.52, w * 0.36, -2.1, -2.1 + 5.3, w * 0.055, 2);
        // 금박
        g.fillStyle = GOLD;
        for (const [fx, fy, fs] of [
          [0.82, 0.17, 1.6],
          [0.15, 0.8, 1.3],
          [0.88, 0.76, 1.1],
        ]) {
          g.beginPath();
          g.moveTo(w * fx, h * fy - fs);
          g.lineTo(w * fx + fs * 1.2, h * fy + fs * 0.3);
          g.lineTo(w * fx - fs * 0.6, h * fy + fs);
          g.closePath();
          g.fill();
        }
      });
      c.drawImage(s, x, y, w, h);
    },

    crest(c, x, y, r) {
      const s = sprite('sumi-crest', 20, 20, (g) => {
        g.fillStyle = VERM;
        CX.util.roundRect(g, 1.2, 1.2, 17.6, 17.6, 1.6);
        g.fill();
        g.strokeStyle = PAPER;
        g.lineWidth = 1.1;
        g.stroke();
        glyph(g, 3.9, 3.7, 0.31, PAPER, 3.8);
      });
      c.drawImage(s, x, y, r * 2, r * 2);
    },

    icon(c, id, x, y, s) {
      const f = ICON[id];
      if (!f) {
        // 다른 세계 무기: 한지 원 + 첫 글자
        c.fillStyle = PAPER;
        c.strokeStyle = INK;
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(x, y, s * 0.32, 0, TAU);
        c.fill();
        c.stroke();
        c.font = `400 ${Math.round(s * 0.46)}px "East Sea Dokdo", "Noto Sans KR", sans-serif`;
        c.fillStyle = INK;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText((CX.data.weapons[id] || { name: '?' }).name.slice(0, 1), x, y + 1);
        return;
      }
      c.drawImage(sprite('sumi-ic-' + id, 48, 48, f), x - s / 2, y - s / 2, s, s);
    },

    fire(api, w, tg) {
      if (w.id === 'arm_su_fox') return fireFox(api, w, tg);
      if (w.id === 'arm_sl_ghost') return fireGhost(api, w);
      if (w.id === 'arm_s_janggu') return fireDrum(api, w, tg);
      return CX.worlds.base.fire(api, w, tg);
    },

    /** 보조 궤적: 한지색 붓 획 꼬리 + 금박 티. 서 있는 것(장판·광선 끝)은 도는 붓 원상 */
    trail(c, e, t) {
      const m = e.__su || (e.__su = { s: rnd(0, 100) });
      const s = m.s;
      const h = e.hist;
      // 광선: 빔을 감아 도는 한지색 붓 실
      if (e.x1 != null && e.x2 != null) {
        const a = Math.sqrt(clamp(1 - e.age / (e.life || 0.35), 0, 1));
        const dx = e.x2 - e.x1;
        const dy = e.y2 - e.y1;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const reach = Math.min(len, Math.hypot(e.x - e.x1, e.y - e.y1) + 40);
        // 빔을 감아 오르는 한지색 붓 실 두 가닥
        c.lineCap = 'round';
        for (let strand = 0; strand < 2; strand++) {
          c.strokeStyle = pa((strand ? 0.55 : 0.9) * a);
          c.lineWidth = strand ? 1.3 : 2.3;
          c.beginPath();
          for (let j = 0; j <= 28; j++) {
            const k = j / 28;
            const off = Math.sin(k * 16 - t * 18 + s + strand * Math.PI) * 5.5 * Math.sin(Math.PI * k);
            const px = e.x1 + ux * reach * k - uy * off;
            const py = e.y1 + uy * reach * k + ux * off;
            j ? c.lineTo(px, py) : c.moveTo(px, py);
          }
          c.stroke();
        }
        c.fillStyle = ga(a);
        for (let j = 1; j <= 4; j++) {
          const k = j / 5;
          const off = (j % 2 ? 1 : -1) * (7 + (1 - a) * 8);
          diamond(c, e.x1 + ux * reach * k - uy * off, e.y1 + uy * reach * k + ux * off, 1.5);
        }
        c.globalAlpha = a;
        stillEnso(c, e.x, e.y, 13, t, s);
        return;
      }
      const n = h.length >> 1;
      const moved = n >= 3 ? Math.hypot(h[0] - e.x, h[1] - e.y) : 0;
      if (moved < 6) {
        const R = e.r && e.r > 12 ? Math.min(70, e.r * 0.95) : 13;
        stillEnso(c, e.x, e.y, R, t, s);
        return;
      }
      // 움직이는 머리: 머리 바로 뒤에서 끝나는 붓 획
      const P = [];
      const gapR = clamp((e.r || 4) * 0.8, 4, 12);
      for (let i = 0; i < n; i++) {
        if (Math.hypot(h[i * 2] - e.x, h[i * 2 + 1] - e.y) < gapR) break;
        P.push(h[i * 2], h[i * 2 + 1]);
      }
      if (P.length < 6) return;
      const wmax = clamp((e.r || 4) * 0.45 + 2.8, 3.4, 6);
      const L = ribbon(c, P, (k, i) => wmax * Math.pow(k, 1.1) * (0.9 + 0.1 * Math.sin(i * 1.9 + s)));
      c.fillStyle = pa(0.8);
      c.fill();
      // 금박 가장자리
      const np = L.length >> 1;
      c.strokeStyle = ga(0.9);
      c.lineWidth = 0.8;
      c.beginPath();
      for (let i = Math.floor(np * 0.3); i < np; i++) i > Math.floor(np * 0.3) ? c.lineTo(L[i * 2], L[i * 2 + 1]) : c.moveTo(L[i * 2], L[i * 2 + 1]);
      c.stroke();
      // 갈필 한 올
      c.strokeStyle = ia(0.35);
      c.lineWidth = 0.6;
      c.beginPath();
      const np2 = P.length >> 1;
      for (let i = Math.floor(np2 * 0.35); i < Math.floor(np2 * 0.9); i++) i > Math.floor(np2 * 0.35) ? c.lineTo(P[i * 2], P[i * 2 + 1]) : c.moveTo(P[i * 2], P[i * 2 + 1]);
      c.stroke();
      // 금박 티 (흩날림)
      for (let j = 0; j < 3; j++) {
        const i = Math.min(np2 - 2, Math.floor(np2 * (0.2 + j * 0.28)));
        const ph = (t * 1.4 + j * 0.33 + s) % 1;
        const i1 = i + 1;
        let dx = P[i1 * 2] - P[i * 2];
        let dy = P[i1 * 2 + 1] - P[i * 2 + 1];
        const d = Math.hypot(dx, dy) || 1;
        dx /= d;
        dy /= d;
        const off = (j % 2 ? 1 : -1) * (wmax + 2 + ph * 7);
        c.fillStyle = ga(0.95 * (1 - ph));
        diamond(c, P[i * 2] - dy * off, P[i * 2 + 1] + dx * off, 1.6);
      }
    },

    hit(api, x, y, w, asSub) {
      if (asSub) {
        const rot = rnd(-0.3, 0.3);
        const ox = rnd(5, 9);
        const oy = -rnd(5, 9);
        const fl = rnd(0, TAU);
        CX.mark(api, x, y, 0.5, (c, k) => {
          const a = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
          c.fillStyle = pa(0.9 * a);
          for (let j = 0; j < 3; j++) {
            const aa = fl + j * 2.1;
            const d = 5 + ease(k * 2) * 10;
            c.beginPath();
            c.arc(x + Math.cos(aa) * d, y + Math.sin(aa) * d, 1.3 * (1 - k * 0.5), 0, TAU);
            c.fill();
          }
          const sc = k < 0.14 ? 1.7 - 0.7 * (k / 0.14) : 1;
          c.globalAlpha = a;
          c.translate(x + ox, y + oy);
          c.rotate(rot);
          c.scale(sc, sc);
          c.drawImage(sealSpr(), -5.5, -5.5, 11, 11);
        });
        return;
      }
      const v = Math.floor(Math.random() * 3);
      const rot = rnd(0, TAU);
      const srot = rnd(-0.25, 0.25);
      const da = rnd(0, TAU);
      CX.mark(api, x, y, 0.62, (c, k) => {
        const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        // 한지 먹 튐
        c.save();
        c.globalAlpha = a * 0.8;
        c.translate(x, y);
        c.rotate(rot);
        const ss = 0.55 + 0.45 * ease(k * 4);
        c.scale(ss, ss);
        c.drawImage(splashSpr(v), -14, -14, 28, 28);
        c.restore();
        // 튀는 먹방울: 한지색 물방울이 꼬리를 끌며 흩어진다
        c.lineCap = 'round';
        for (let j = 0; j < 5; j++) {
          const aa = da + j * 1.26 + 0.3 * Math.sin(j * 3);
          const d = 7 + ease(k * 1.6) * (13 + (j % 3) * 4);
          const px = x + Math.cos(aa) * d;
          const py = y + Math.sin(aa) * d + k * k * 10;
          const tl = 5 * (1 - ease(k * 1.6)) + 1;
          c.strokeStyle = pa(0.9 * a);
          c.lineWidth = 2.2 - k;
          c.beginPath();
          c.moveTo(px - Math.cos(aa) * tl, py - Math.sin(aa) * tl);
          c.lineTo(px, py);
          c.stroke();
        }
        // 주홍 낙관 (쾅 찍힘)
        const sc = k < 0.12 ? 1.8 - 0.8 * (k / 0.12) : 1;
        c.globalAlpha = a * Math.min(1, k / 0.05);
        c.translate(x, y);
        c.rotate(srot);
        c.scale(sc, sc);
        c.drawImage(sealSpr(), -7.5, -7.5, 15, 15);
      });
    },

    react(api, e, w) {
      if (w.sub === 'arm_sl_ghost') return reactGhost(api, e, w);
      if (w.sub === 'arm_s_janggu') return reactDrum(api, e, w);
      return reactFox(api, e, w);
    },

    /** 반응 이름: 한지 띠(족자) 위 세로 붓글씨, 붓이 그어지듯 한 자씩, 끝에 주홍 낙관 */
    label(c, text, x, y, age, life) {
      const parts = String(text)
        .split('·')
        .map((s) => s.replace(/\s+/g, ''))
        .filter(Boolean);
      const A = parts[0] || '';
      const B = parts.slice(1).join('');
      const step = 25;
      const w1 = 38;
      const w2 = 30;
      const gap = 5;
      const h1 = A.length * step + 24;
      const h2 = B ? B.length * step + 20 : 0;
      const tw = B ? w1 + gap + w2 : w1;
      // 족자는 세로로 길어서, 공통이 정한 자리(적 위·아래)에서 조금 옆으로 비켜 건다: 판 왼쪽이면 오른쪽, 오른쪽이면 왼쪽
      const cx = clamp(x + labelSide(x) * 44, tw / 2 + 8, W - tw / 2 - 8);
      const x1 = cx - tw / 2;
      let top = y - h1 / 2;
      if (top + h1 > 438) top = 438 - h1;
      if (top < 94) top = 94;
      const out = clamp((life - age) / 0.32, 0, 1);
      c.globalAlpha = Math.min(1, out * 1.6);
      const u1 = ease(age / 0.24) * (out < 1 ? ease(out) : 1);
      const per = 0.075;
      const tA = 0.16;
      const tB = tA + A.length * per + 0.05;
      const tS = tB + B.length * per + 0.06;
      strip(c, x1, top, w1, h1, u1, 1, true);
      c.font = '400 29px "East Sea Dokdo", "Nanum Brush Script", serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      brushCol(c, A, x1 + w1 / 2, top + 13, step, age - tA, INK, x1, top, w1, h1 * u1);
      let sx = x1 + w1 - 4;
      let sy = top + h1 + 8;
      if (B) {
        const x2 = x1 + w1 + gap;
        const top2 = top + 20;
        const u2 = ease((age - 0.1) / 0.24) * (out < 1 ? ease(out) : 1);
        if (u2 > 0) {
          strip(c, x2, top2, w2, h2, u2, 2, false);
          c.font = '400 27px "East Sea Dokdo", "Nanum Brush Script", serif';
          brushCol(c, B, x2 + w2 / 2, top2 + 10, step, age - tB, '#B2241C', x2, top2, w2, h2 * u2);
        }
        sx = x2 + w2 / 2 + 3;
        sy = top2 + h2 + 12;
      }
      // 낙관
      if (age > tS) {
        const q = clamp((age - tS) / 0.12, 0, 1);
        const sc = 1 + 0.9 * (1 - ease(q));
        c.save();
        c.globalAlpha *= q;
        c.translate(sx, sy);
        c.rotate(0.12);
        c.scale(sc, sc);
        c.drawImage(sealSpr(), -10, -10, 20, 20);
        c.restore();
      }
    },
  });

  /** 반응 이름 족자를 거는 쪽 (+1 오른쪽, -1 왼쪽). label 의 x 는 runtime 이 112..248 로 죈 반응 자리 */
  function labelSide(x) {
    return x < W / 2 ? 1 : -1;
  }

  /** 한지 띠 (u: 펼쳐진 정도 0→1). rod: 위에 족자 축 */
  function strip(c, x, y, w, h, u, seed, rod) {
    if (u <= 0) return;
    const hh = h * u;
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.55)';
    c.shadowBlur = 10;
    c.shadowOffsetY = 3;
    c.beginPath();
    c.moveTo(x, y + 1.5);
    for (let j = 1; j <= 5; j++) c.lineTo(x + (w * j) / 5, y + (hash(seed * 9 + j) * 2.4 - 0.6));
    c.lineTo(x + w + 0.5, y + hh);
    for (let j = 4; j >= 0; j--) c.lineTo(x + (w * j) / 5, y + hh + (hash(seed * 13 + j) * 3 - 1.5) * Math.min(1, u * 3));
    c.closePath();
    c.fillStyle = PAPER;
    c.fill();
    c.restore();
    // 한지 결 (옅은 얼룩)
    const lg = c.createLinearGradient(x, 0, x + w, 0);
    lg.addColorStop(0, 'rgba(150,126,88,0.28)');
    lg.addColorStop(0.5, 'rgba(255,250,238,0)');
    lg.addColorStop(1, 'rgba(150,126,88,0.28)');
    c.fillStyle = lg;
    c.fill();
    // 금박 테
    c.strokeStyle = ga(0.95);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x + 1.6, y + 2);
    c.lineTo(x + 1.6, y + hh - 1);
    c.moveTo(x + w - 1.6, y + 2);
    c.lineTo(x + w - 1.6, y + hh - 1);
    c.stroke();
    if (rod) {
      c.fillStyle = '#2A1C14';
      c.fillRect(x - 4, y - 3, w + 8, 4.5);
      c.fillStyle = ga(1);
      c.fillRect(x - 6, y - 3.5, 3, 5.5);
      c.fillRect(x + w + 3, y - 3.5, 3, 5.5);
    }
  }

  /** 세로 붓글씨: 한 자씩 위에서 아래로 그어지며 나타남 */
  function brushCol(c, str, cx, y0, step, tt, col, bx, by, bw, bh) {
    if (tt <= 0 || bh <= 0) return;
    c.save();
    c.beginPath();
    c.rect(bx, by, bw, bh);
    c.clip();
    c.fillStyle = col;
    for (let i = 0; i < str.length; i++) {
      const ti = tt - i * 0.075;
      if (ti <= 0) break;
      const q = ease(ti / 0.14);
      const cy = y0 + i * step;
      c.save();
      c.beginPath();
      c.rect(cx - 20, cy - 3, 40, (step + 6) * q);
      c.clip();
      c.fillText(str[i], cx, cy + step / 2 + 1);
      c.restore();
      if (q < 1) {
        // 붓끝
        c.fillStyle = col === INK ? ia(0.7) : va(0.8);
        c.beginPath();
        c.ellipse(cx + Math.sin(ti * 40) * 3, cy + (step + 4) * q, 3.2, 1.8, 0.4, 0, TAU);
        c.fill();
        c.fillStyle = col;
      }
    }
    c.restore();
  }

  /** 서 있는 머리 둘레를 도는 한지색 붓 원상 + 금박 */
  function stillEnso(c, x, y, R, t, s) {
    const a0 = t * 1.9 + s;
    const th = R > 30 ? 3.4 : 2.3;
    arcPath(c, x, y, R, a0, a0 + 4.4, th, s);
    c.fillStyle = pa(0.72);
    c.fill();
    c.strokeStyle = ia(0.35);
    dryArc(c, x, y, R, a0, a0 + 4.4, th, s);
    c.fillStyle = ga(0.95);
    for (let j = 0; j < 3; j++) {
      const aa = -t * 1.2 + s + j * 2.09;
      diamond(c, x + Math.cos(aa) * (R + 4), y + Math.sin(aa) * (R + 4), 1.5);
    }
  }
})();
