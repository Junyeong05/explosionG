// 테마 tactical — 현대 전술 지도 (11-24)
// 위에서 본 땅(위성 지형: 밭 · 숲 · 도로 · 마을 · 등고선 · 격자) 위에 적성 드론·차량(붉은 표지),
// 사실적인 불·연기·파편, 얇은 군사 UI (요즘 슈터). 아군 = 파랑 · 적 = 빨강 · UI 강조 = 호박.
// 무기는 모래주머니 진지 위에 놓인다. 세계 그림(무기·공격)은 그대로.
(function () {
  'use strict';
  const { W, FIELD_H, GUN, CAT_TH, ORDER } = CX.runInfo;
  const { LINE_Y } = CX.size;
  const { TAU, clamp, ease, roundRect, bgCanvas, sprite } = CX.util;

  const C = {
    fg: '#EEEDE3',
    sub: '#B8B9A6',
    dim: '#8E9080',
    panel: 'rgba(15,17,12,0.9)',
    edge: 'rgba(236,234,220,0.14)',
    amber: '#FFB547',
    amberHi: '#FFD58C',
    red: '#FF4D3D',
    blue: '#6CB6FF',
  };
  const FN = (wt, px) => `${wt} ${px}px "Oswald", "IBM Plex Sans KR", "Noto Sans KR", sans-serif`;
  const FK = (wt, px) => `${wt} ${px}px "IBM Plex Sans KR", "Noto Sans KR", sans-serif`;
  const colOf = (k) => (CX.wo(k).colors || {}).main || C.fg;
  const ls = (c, v) => {
    if ('letterSpacing' in c) c.letterSpacing = v;
  };

  // 글꼴: 캔버스 글자라 미리 불러 둔다. 바탕(격자 숫자)은 글꼴이 온 뒤 다시 그린다
  if (document.fonts && document.fonts.load) {
    const ui = '목숨웨이브레벨업연쇄갈래합성칸새무기강화방어선붕괴작전실패잠시뒤판보급하나고르기선택피해쿨다운몸연출반응적지휘전차고가치표적접근중카드를눌러고른다세계더열린다까지등급완료';
    Promise.all([
      document.fonts.load(FN(700, 20), 'WAVE LV EXP 0123456789'),
      document.fonts.load(FN(500, 10), 'WAVE LV EXP FPL 0123456789'),
      document.fonts.load(FK(700, 16), ui),
      document.fonts.load(FK(500, 12), ui),
    ])
      .then(() => {
        if (window.__run) window.__run.bg = null;
      })
      .catch(() => null);
  }

  // 판 시간 · 목숨 잃은 순간 (line 이 빨갛게) · 땅에 남는 그을음
  let nowT = 0;
  let hurtK = 0;
  let hurtAt = -9;
  const scorch = [];

  function mulberry(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const frac = (v) => v - Math.floor(v);

  // ── 바탕: 위성 지형 ─────────────────────────────────────────
  function terrain(c) {
    const R = mulberry(20261124);
    const rr = (a, b) => a + R() * (b - a);
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const FH = LINE_Y;
    c.fillStyle = '#2E3128';
    c.fillRect(0, 0, W, FH);
    // 밭 (기운 격자로 조각조각)
    const tones = ['#363B2D', '#3A3C2E', '#414030', '#33382B', '#3D3A2E', '#373A2D', '#444130', '#30352A', '#3B3F31'];
    c.save();
    c.translate(W / 2, FH / 2);
    c.rotate(-0.2);
    for (let y = -340; y < 340; ) {
      const rh = rr(30, 60);
      for (let x = -320; x < 320; ) {
        const pw = rr(26, 84);
        c.fillStyle = pick(tones);
        c.fillRect(x + 0.9, y + 0.9, pw - 1.8, rh - 1.8);
        if (R() < 0.6) {
          c.strokeStyle = R() < 0.5 ? 'rgba(0,0,0,0.11)' : 'rgba(255,245,210,0.05)';
          c.lineWidth = 0.6;
          c.beginPath();
          const step = rr(2.4, 3.8);
          if (R() < 0.5) {
            for (let fx = x + 2.5; fx < x + pw - 1.5; fx += step) {
              c.moveTo(fx, y + 2);
              c.lineTo(fx, y + rh - 2);
            }
          } else {
            for (let fy = y + 2.5; fy < y + rh - 1.5; fy += step) {
              c.moveTo(x + 2, fy);
              c.lineTo(x + pw - 2, fy);
            }
          }
          c.stroke();
        }
        x += pw;
      }
      y += rh;
    }
    c.restore();
    // 결 (위성 사진 알갱이)
    for (let i = 0; i < 2200; i++) {
      c.fillStyle = R() < 0.5 ? `rgba(0,0,0,${rr(0.05, 0.14)})` : `rgba(255,248,220,${rr(0.02, 0.06)})`;
      c.fillRect(rr(0, W), rr(0, FH), rr(0.6, 1.6), rr(0.6, 1.6));
    }
    const path = (pts) => {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        c.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      }
      const L = pts[pts.length - 1];
      c.lineTo(L[0], L[1]);
    };
    // 개울
    const stream = [[370, 178], [326, 156], [288, 122], [240, 130], [200, 100], [150, 66], [104, 76], [58, 46], [-10, 56]];
    c.lineCap = 'round';
    c.lineJoin = 'round';
    path(stream);
    c.strokeStyle = '#272C22';
    c.lineWidth = 9;
    c.stroke();
    path(stream);
    c.strokeStyle = '#1B2324';
    c.lineWidth = 4.2;
    c.stroke();
    path(stream);
    c.strokeStyle = 'rgba(160,190,190,0.10)';
    c.lineWidth = 1;
    c.stroke();
    // 나무 (그림자 → 수관 → 윗빛)
    const tree = (x, y, r) => {
      c.fillStyle = 'rgba(12,14,9,0.6)';
      c.beginPath();
      c.arc(x + r * 0.5, y + r * 0.55, r, 0, TAU);
      c.fill();
      c.fillStyle = pick(['#28311F', '#2C3522', '#252D1C', '#313A25', '#2A3020']);
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(140,155,100,0.14)';
      c.beginPath();
      c.arc(x - r * 0.32, y - r * 0.32, r * 0.5, 0, TAU);
      c.fill();
    };
    const forest = (cx, cy, rx, ry, n) => {
      for (let i = 0; i < n; i++) {
        const a = R() * TAU;
        const d = Math.sqrt(R());
        tree(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rr(2.2, 4.8));
      }
    };
    const hedge = (x1, y1, x2, y2) => {
      const L = Math.hypot(x2 - x1, y2 - y1);
      for (let d = 0; d < L; d += rr(3, 5.5)) {
        const k = d / L;
        tree(x1 + (x2 - x1) * k + rr(-1.4, 1.4), y1 + (y2 - y1) * k + rr(-1.4, 1.4), rr(1.7, 3.1));
      }
    };
    forest(34, 168, 58, 56, 150);
    forest(330, 330, 46, 72, 120);
    forest(262, 34, 44, 22, 44);
    forest(110, 410, 34, 16, 26);
    hedge(70, 228, 150, 212);
    hedge(240, 196, 330, 214);
    hedge(110, 300, 120, 390);
    hedge(250, 330, 270, 420);
    hedge(150, 30, 120, 120);
    // 도로 (갓길 → 아스팔트 → 가운데 선) · 흙길
    const road = (pts, wd, center) => {
      c.lineCap = 'butt';
      path(pts);
      c.strokeStyle = '#4B4838';
      c.lineWidth = wd + 4;
      c.stroke();
      path(pts);
      c.strokeStyle = '#2B2D29';
      c.lineWidth = wd;
      c.stroke();
      path(pts);
      c.strokeStyle = 'rgba(255,255,255,0.04)';
      c.lineWidth = wd * 0.5;
      c.stroke();
      if (center) {
        path(pts);
        c.setLineDash([5, 7]);
        c.strokeStyle = 'rgba(214,204,160,0.34)';
        c.lineWidth = 0.9;
        c.stroke();
        c.setLineDash([]);
      }
    };
    const track = (pts) => {
      c.lineCap = 'round';
      path(pts);
      c.strokeStyle = 'rgba(92,84,62,0.8)';
      c.lineWidth = 3.4;
      c.stroke();
      path(pts);
      c.strokeStyle = 'rgba(0,0,0,0.2)';
      c.lineWidth = 0.7;
      c.setLineDash([2, 3]);
      c.stroke();
      c.setLineDash([]);
    };
    track([[22, 452], [60, 382], [36, 300], [72, 232], [52, 120], [94, -10]]);
    track([[302, -10], [320, 90], [292, 182], [290, 276]]);
    track([[190, 262], [120, 330], [96, 452]]);
    road([[-10, 266], [90, 250], [188, 264], [290, 278], [370, 264]], 9, true);
    road([[216, -10], [198, 90], [160, 172], [188, 264], [212, 352], [178, 452]], 12, true);
    // 마을 (지붕 · 그림자 · 무너진 집)
    const bld = (x, y, w, h, a, ruin) => {
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.fillStyle = 'rgba(8,9,6,0.7)';
      c.fillRect(-w / 2 + 2.2, -h / 2 + 2.4, w, h);
      if (ruin) {
        c.fillStyle = '#3A372F';
        c.fillRect(-w / 2, -h / 2, w, h);
        for (let i = 0; i < 9; i++) {
          c.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(150,140,115,0.35)';
          c.fillRect(rr(-w / 2, w / 2 - 1.5), rr(-h / 2, h / 2 - 1.5), rr(0.8, 2), rr(0.8, 2));
        }
      } else {
        c.fillStyle = pick(['#6A675C', '#5D5A4F', '#726957', '#55584F', '#7B7464', '#645C4E']);
        c.fillRect(-w / 2, -h / 2, w, h);
        c.fillStyle = 'rgba(255,250,230,0.12)';
        c.fillRect(-w / 2, -h / 2, w, h / 2);
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.fillRect(-w / 2, -0.35, w, 0.7);
      }
      c.strokeStyle = 'rgba(0,0,0,0.4)';
      c.lineWidth = 0.6;
      c.strokeRect(-w / 2, -h / 2, w, h);
      c.restore();
    };
    const block = (cx, cy, a) => {
      for (let gx = 0; gx < 2; gx++)
        for (let gy = 0; gy < 2; gy++) {
          if (R() < 0.22) continue;
          bld(cx + (gx - 0.5) * 17 + rr(-2, 2), cy + (gy - 0.5) * 15 + rr(-2, 2), rr(9, 14), rr(7, 10), a + rr(-0.06, 0.06), R() < 0.16);
        }
    };
    block(148, 232, 0.12);
    block(232, 236, 0.12);
    block(146, 294, 0.14);
    block(234, 300, 0.14);
    block(232, 166, -0.3);
    block(120, 150, -0.3);
    bld(84, 344, 14, 9, 0.5, false);
    bld(96, 356, 9, 7, 0.5, false);
    bld(290, 206, 13, 9, -0.2, false);
    bld(276, 214, 8, 6, -0.2, true);
    bld(250, 400, 12, 8, 0.1, false);
    // 묵은 포탄 구멍
    const crater = (x, y, r) => {
      c.fillStyle = 'rgba(120,110,85,0.22)';
      c.beginPath();
      c.arc(x, y, r * 1.35, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(16,16,11,0.7)';
      c.beginPath();
      c.arc(x + r * 0.1, y + r * 0.1, r, 0, TAU);
      c.fill();
    };
    for (let i = 0; i < 18; i++) crater(rr(20, W - 20), rr(110, FH - 30), rr(1.6, 4.2));
    // 등고선
    const hill = (cx, cy, n, sp, ph, sx, sy) => {
      for (let k = 1; k <= n; k++) {
        c.beginPath();
        for (let i = 0; i <= 72; i++) {
          const a = (i / 72) * TAU;
          const rad = k * sp * (1 + 0.16 * Math.sin(3 * a + ph) + 0.09 * Math.sin(5 * a + ph * 2.1) + 0.04 * Math.sin(7 * a + k * 0.5));
          const x = cx + Math.cos(a) * rad * sx;
          const y = cy + Math.sin(a) * rad * sy;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.closePath();
        const idx = k % 4 === 0;
        c.strokeStyle = idx ? 'rgba(232,220,176,0.16)' : 'rgba(232,220,176,0.085)';
        c.lineWidth = idx ? 1 : 0.6;
        c.stroke();
      }
    };
    hill(66, 336, 9, 10, 0.7, 1.3, 0.85);
    hill(300, 146, 8, 11, 2.2, 1.2, 0.8);
    hill(190, 6, 4, 15, 4.1, 1.4, 0.7);
    // 누르기: 지형은 낮게, 위(적이 오는 쪽)는 더 어둡게, 가장자리 비네트
    c.fillStyle = 'rgba(10,12,8,0.12)';
    c.fillRect(0, 0, W, FH);
    const fog = c.createLinearGradient(0, 0, 0, 170);
    fog.addColorStop(0, 'rgba(9,10,7,0.58)');
    fog.addColorStop(1, 'rgba(9,10,7,0)');
    c.fillStyle = fog;
    c.fillRect(0, 0, W, 170);
    const vg = c.createRadialGradient(W / 2, 250, 120, W / 2, 250, 390);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, FH);
    // 격자 (1 km) · 교차점 십자 · 좌표 숫자
    c.strokeStyle = 'rgba(236,232,210,0.075)';
    c.lineWidth = 0.6;
    c.beginPath();
    for (let x = 60; x < W; x += 60) {
      c.moveTo(x + 0.5, 0);
      c.lineTo(x + 0.5, FH);
    }
    for (let y = FH - 60; y > 0; y -= 60) {
      c.moveTo(0, y + 0.5);
      c.lineTo(W, y + 0.5);
    }
    c.stroke();
    c.strokeStyle = 'rgba(236,232,210,0.26)';
    c.beginPath();
    for (let x = 60; x < W; x += 60)
      for (let y = FH - 60; y > 0; y -= 60) {
        c.moveTo(x - 2.5, y + 0.5);
        c.lineTo(x + 3.5, y + 0.5);
        c.moveTo(x + 0.5, y - 2.5);
        c.lineTo(x + 0.5, y + 3.5);
      }
    c.stroke();
    c.font = FN(500, 8);
    c.fillStyle = 'rgba(236,232,210,0.42)';
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    for (let x = 60, e = 52; x < W; x += 60, e++) c.fillText(String(e), x + 3, 11);
    c.textAlign = 'right';
    for (let y = FH - 60, n = 31; y > 0; y -= 60, n++) c.fillText(String(n), W - 3, y - 3);
  }

  // 방어선 아래: 아군 진지 (콘크리트 바닥 · 방벽 블록)
  function compound(c) {
    const R = mulberry(4471);
    const top = LINE_Y;
    const cg = c.createLinearGradient(0, top, 0, FIELD_H);
    cg.addColorStop(0, '#2D2E29');
    cg.addColorStop(1, '#1C1D19');
    c.fillStyle = cg;
    c.fillRect(0, top, W, FIELD_H - top);
    for (let i = 0; i < 700; i++) {
      c.fillStyle = R() < 0.5 ? `rgba(0,0,0,${0.06 + R() * 0.1})` : `rgba(255,250,230,${0.015 + R() * 0.035})`;
      c.fillRect(R() * W, top + R() * (FIELD_H - top), 0.6 + R(), 0.6 + R());
    }
    // 판 이음
    for (let x = 0; x <= W; x += 45) {
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(x, top + 16, 1, FIELD_H);
      c.fillStyle = 'rgba(255,255,255,0.03)';
      c.fillRect(x + 1, top + 16, 1, FIELD_H);
    }
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, 505, W, 1);
    // 방벽 블록 (모래 채운 철망 상자, 위에서)
    const y0 = top + 2;
    for (let x = -4; x < W + 12; x += 12) {
      c.fillStyle = 'rgba(0,0,0,0.5)';
      c.fillRect(x + 1, y0 + 9, 12, 4);
      c.fillStyle = '#5B5545';
      c.fillRect(x, y0, 12, 10);
      c.fillStyle = '#4C4738';
      c.fillRect(x + 1.6, y0 + 1.6, 8.8, 6.8);
      c.strokeStyle = 'rgba(0,0,0,0.22)';
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(x + 4.5, y0 + 1.6);
      c.lineTo(x + 4.5, y0 + 8.4);
      c.moveTo(x + 7.5, y0 + 1.6);
      c.lineTo(x + 7.5, y0 + 8.4);
      c.moveTo(x + 1.6, y0 + 5);
      c.lineTo(x + 10.4, y0 + 5);
      c.stroke();
      c.fillStyle = 'rgba(255,245,215,0.12)';
      c.fillRect(x, y0, 12, 0.8);
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillRect(x + 11.4, y0, 0.6, 10);
    }
  }

  // ── 미리 그려 두는 그림 ─────────────────────────────────────
  const shadowSpr = () =>
    sprite('tac-shadow', 40, 40, (c) => {
      const g = c.createRadialGradient(20, 20, 0, 20, 20, 20);
      g.addColorStop(0, 'rgba(0,0,0,0.8)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.42)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 40, 40);
    });
  const fireSpr = () =>
    sprite('tac-fire', 48, 48, (c) => {
      const g = c.createRadialGradient(24, 24, 0, 24, 24, 24);
      g.addColorStop(0, 'rgba(255,246,222,1)');
      g.addColorStop(0.18, 'rgba(255,214,140,0.98)');
      g.addColorStop(0.42, 'rgba(236,132,58,0.86)');
      g.addColorStop(0.7, 'rgba(150,62,28,0.45)');
      g.addColorStop(1, 'rgba(80,30,16,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 48, 48);
    });
  const flashSpr = () =>
    sprite('tac-flash', 32, 32, (c) => {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,248,1)');
      g.addColorStop(0.4, 'rgba(255,236,190,0.6)');
      g.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    });
  // 연기: 0 그을음(검게) · 1 연기(위에서 보면 회색) · 2 흙먼지
  const SMOKE = [
    ['rgba(34,32,28,0.92)', 'rgba(30,28,25,0.55)', 'rgba(28,26,22,0)'],
    ['rgba(128,122,110,0.8)', 'rgba(104,99,89,0.45)', 'rgba(90,86,78,0)'],
    ['rgba(140,126,98,0.7)', 'rgba(118,106,84,0.38)', 'rgba(100,92,74,0)'],
  ];
  const smokeSpr = (i) =>
    sprite('tac-smoke' + i, 40, 40, (c) => {
      const g = c.createRadialGradient(20, 20, 0, 20, 20, 20);
      g.addColorStop(0, SMOKE[i][0]);
      g.addColorStop(0.5, SMOKE[i][1]);
      g.addColorStop(1, SMOKE[i][2]);
      c.fillStyle = g;
      c.fillRect(0, 0, 40, 40);
    });
  const ringSpr = () =>
    sprite('tac-ring', 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(200,186,150,0)');
      g.addColorStop(0.62, 'rgba(200,186,150,0)');
      g.addColorStop(0.84, 'rgba(214,200,162,0.55)');
      g.addColorStop(0.93, 'rgba(200,186,150,0.2)');
      g.addColorStop(1, 'rgba(200,186,150,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    });
  const scorchSpr = () =>
    sprite('tac-scorch', 40, 40, (c) => {
      const g = c.createRadialGradient(20, 20, 0, 20, 20, 20);
      g.addColorStop(0, 'rgba(10,9,7,0.85)');
      g.addColorStop(0.45, 'rgba(16,14,10,0.6)');
      g.addColorStop(0.75, 'rgba(30,26,18,0.25)');
      g.addColorStop(1, 'rgba(30,26,18,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 40, 40);
    });
  const cloudSpr = () =>
    sprite('tac-cloud', 120, 80, (c) => {
      c.save();
      c.translate(60, 40);
      c.scale(1, 0.62);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 60);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(0.6, 'rgba(0,0,0,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 60, 0, TAU);
      c.fill();
      c.restore();
    });
  const trailSpr = () =>
    sprite('tac-trail', 10, 40, (c) => {
      const g = c.createLinearGradient(0, 40, 0, 0);
      g.addColorStop(0, 'rgba(200,190,170,0.7)');
      g.addColorStop(1, 'rgba(200,190,170,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(3, 40);
      c.lineTo(7, 40);
      c.lineTo(10, 0);
      c.lineTo(0, 0);
      c.closePath();
      c.fill();
    });

  // 흰 실루엣 (맞은 번쩍)
  const SIL = new Map();
  function sil(spr) {
    let s = SIL.get(spr);
    if (s) return s;
    s = document.createElement('canvas');
    s.width = spr.width;
    s.height = spr.height;
    const x = s.getContext('2d');
    x.drawImage(spr, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#FFF6E6';
    x.fillRect(0, 0, s.width, s.height);
    SIL.set(spr, s);
    return s;
  }

  // 적 1: 사륜 드론 (위에서, 앞 = 아래)
  function droneSpr(r) {
    const S = r * 3.4;
    return {
      w: S,
      h: S,
      cv: sprite('tac-drone-' + r, S, S, (c) => {
        c.translate(S / 2, S / 2);
        const d = r * 0.66;
        const rr = r * 0.52;
        c.lineCap = 'round';
        for (const [lw, col] of [
          [r * 0.34, '#0B0C0A'],
          [r * 0.2, '#50544C'],
        ]) {
          c.strokeStyle = col;
          c.lineWidth = lw;
          c.beginPath();
          for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            c.moveTo(0, 0);
            c.lineTo(sx * d, sy * d);
          }
          c.stroke();
        }
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          c.beginPath();
          c.arc(sx * d, sy * d, rr, 0, TAU);
          c.fillStyle = 'rgba(196,202,188,0.2)';
          c.fill();
          c.strokeStyle = 'rgba(214,220,206,0.28)';
          c.lineWidth = 0.7;
          c.stroke();
          c.beginPath();
          c.arc(sx * d, sy * d, r * 0.14, 0, TAU);
          c.fillStyle = '#141512';
          c.fill();
          c.strokeStyle = '#7A7F74';
          c.lineWidth = 0.5;
          c.stroke();
        }
        const bw = r * 0.8;
        const bh = r * 1.08;
        c.fillStyle = '#0A0B09';
        roundRect(c, -bw / 2 - 0.9, -bh / 2 - 0.9, bw + 1.8, bh + 1.8, r * 0.26);
        c.fill();
        const g = c.createLinearGradient(-bw / 2, -bh / 2, bw / 2, bh / 2);
        g.addColorStop(0, '#7A7E73');
        g.addColorStop(1, '#383B35');
        c.fillStyle = g;
        roundRect(c, -bw / 2, -bh / 2, bw, bh, r * 0.22);
        c.fill();
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(-bw * 0.28, -bh * 0.36, bw * 0.56, bh * 0.22);
        c.fillStyle = 'rgba(255,255,255,0.2)';
        c.fillRect(-bw * 0.34, -bh / 2 + 0.6, bw * 0.68, 0.7);
        c.fillStyle = '#0B0C0A';
        c.beginPath();
        c.arc(0, bh * 0.3, r * 0.2, 0, TAU);
        c.fill();
        c.fillStyle = 'rgba(150,200,255,0.7)';
        c.beginPath();
        c.arc(-r * 0.05, bh * 0.27, r * 0.07, 0, TAU);
        c.fill();
        c.fillStyle = C.red;
        c.fillRect(-bw * 0.42, bh * 0.38, r * 0.14, r * 0.14);
        c.fillRect(bw * 0.42 - r * 0.14, bh * 0.38, r * 0.14, r * 0.14);
      }),
    };
  }

  // 적 2: 자폭 드론 (삼각 날개, 앞 = 아래)
  function kamiSpr(r) {
    const w = r * 2.8;
    const h = r * 3.4;
    return {
      w,
      h,
      cv: sprite('tac-kami-' + r, w, h, (c) => {
        c.translate(w / 2, h / 2);
        const wing = [
          [r * 0.2, r * 0.55],
          [r * 1.18, -r * 0.72],
          [r * 1.18, -r * 0.98],
          [r * 0.2, -r * 0.78],
          [-r * 0.2, -r * 0.78],
          [-r * 1.18, -r * 0.98],
          [-r * 1.18, -r * 0.72],
          [-r * 0.2, r * 0.55],
        ];
        const poly = (pts) => {
          c.beginPath();
          pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
          c.closePath();
        };
        poly(wing);
        c.strokeStyle = '#0A0B09';
        c.lineWidth = 1.8;
        c.lineJoin = 'round';
        c.stroke();
        const g = c.createLinearGradient(-r, -r, r, r);
        g.addColorStop(0, '#6E7268');
        g.addColorStop(1, '#3A3D36');
        c.fillStyle = g;
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.3)';
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(r * 0.35, -r * 0.05);
        c.lineTo(r * 1.0, -r * 0.8);
        c.moveTo(-r * 0.35, -r * 0.05);
        c.lineTo(-r * 1.0, -r * 0.8);
        c.stroke();
        // 날개 끝 수직판
        c.fillStyle = '#26281F';
        c.fillRect(r * 1.08, -r * 1.06, r * 0.16, r * 0.46);
        c.fillRect(-r * 1.24, -r * 1.06, r * 0.16, r * 0.46);
        // 몸통
        c.fillStyle = '#0A0B09';
        roundRect(c, -r * 0.24, -r * 0.92, r * 0.48, r * 2.42, r * 0.22);
        c.fill();
        const fg = c.createLinearGradient(-r * 0.2, 0, r * 0.2, 0);
        fg.addColorStop(0, '#8A8E82');
        fg.addColorStop(1, '#4A4D45');
        c.fillStyle = fg;
        roundRect(c, -r * 0.18, -r * 0.86, r * 0.36, r * 2.3, r * 0.18);
        c.fill();
        // 뒤 프로펠러 (흐림)
        c.fillStyle = 'rgba(200,205,195,0.28)';
        c.beginPath();
        c.ellipse(0, -r * 1.02, r * 0.5, r * 0.09, 0, 0, TAU);
        c.fill();
        c.fillStyle = C.red;
        c.beginPath();
        c.arc(0, r * 1.22, r * 0.09, 0, TAU);
        c.fill();
      }),
    };
  }

  // 적 3: 장갑차 · 4: 지휘 전차 (몸 + 포탑 따로)
  function hullSpr(r, boss) {
    const w = r * 2.1;
    const h = r * 2.7;
    return {
      w,
      h,
      cv: sprite('tac-hull-' + r, w, h, (c) => {
        c.translate(w / 2, h / 2);
        const L = r * 2.2;
        const Wd = r * 1.56;
        const tw = r * 0.34;
        // 궤도
        for (const sx of [-1, 1]) {
          const x0 = sx * (Wd / 2 - tw / 2) - tw / 2;
          c.fillStyle = '#090A08';
          c.fillRect(x0 - 0.8, -L / 2 - 0.8, tw + 1.6, L + 1.6);
          c.fillStyle = '#1D1E1A';
          c.fillRect(x0, -L / 2, tw, L);
          c.fillStyle = 'rgba(140,140,125,0.28)';
          for (let y = -L / 2 + 1; y < L / 2; y += r * 0.17) c.fillRect(x0, y, tw, 0.7);
        }
        // 몸
        const bx = -Wd / 2 + tw * 0.8;
        const bw = Wd - tw * 1.6;
        c.fillStyle = '#0A0B09';
        roundRect(c, bx - 0.9, -L / 2 + r * 0.02 - 0.9, bw + 1.8, L - r * 0.04 + 1.8, r * 0.14);
        c.fill();
        const g = c.createLinearGradient(bx, -L / 2, bx + bw, L / 2);
        g.addColorStop(0, boss ? '#6C6E64' : '#6A6E63');
        g.addColorStop(1, boss ? '#383A33' : '#3E413A');
        c.fillStyle = g;
        roundRect(c, bx, -L / 2 + r * 0.02, bw, L - r * 0.04, r * 0.12);
        c.fill();
        // 앞 경사판 (아래)
        c.fillStyle = 'rgba(255,255,240,0.08)';
        c.fillRect(bx + 1, L / 2 - r * 0.42, bw - 2, r * 0.36);
        // 뒤 기관실 격자 (위)
        c.strokeStyle = 'rgba(0,0,0,0.4)';
        c.lineWidth = 0.6;
        c.beginPath();
        for (let i = 0; i < 4; i++) {
          const y = -L / 2 + r * 0.16 + i * r * 0.11;
          c.moveTo(bx + bw * 0.2, y);
          c.lineTo(bx + bw * 0.8, y);
        }
        c.stroke();
        if (boss) {
          // 반응 장갑 블록 (옆치마)
          c.fillStyle = '#4F5149';
          c.strokeStyle = 'rgba(0,0,0,0.5)';
          c.lineWidth = 0.5;
          for (const sx of [-1, 1])
            for (let i = 0; i < 6; i++) {
              const x = sx > 0 ? Wd / 2 - tw * 0.95 : -Wd / 2 + tw * 0.05;
              const y = -L / 2 + r * 0.3 + i * r * 0.3;
              c.fillRect(x, y, tw * 0.9, r * 0.26);
              c.strokeRect(x, y, tw * 0.9, r * 0.26);
            }
        }
        c.fillStyle = C.red;
        c.fillRect(bx + 1.2, L / 2 - r * 0.2, r * 0.14, r * 0.1);
        c.fillRect(bx + bw - 1.2 - r * 0.14, L / 2 - r * 0.2, r * 0.14, r * 0.1);
      }),
    };
  }
  function turretSpr(r, boss) {
    const w = r * 1.5;
    const h = r * 3.8;
    return {
      w,
      h,
      cv: sprite('tac-tur-' + r, w, h, (c) => {
        c.translate(w / 2, h / 2);
        // 포신 (아래로)
        c.fillStyle = '#0A0B09';
        c.fillRect(-r * 0.1 - 0.8, r * 0.2, r * 0.2 + 1.6, r * 1.55);
        c.fillStyle = '#34362F';
        c.fillRect(-r * 0.1, r * 0.2, r * 0.2, r * 1.5);
        c.fillStyle = '#0A0B09';
        c.fillRect(-r * 0.16, r * 1.56, r * 0.32, r * 0.22);
        c.fillStyle = '#2A2C26';
        c.fillRect(-r * 0.13, r * 1.58, r * 0.26, r * 0.17);
        // 포탑
        const pts = [
          [-r * 0.32, r * 0.5],
          [r * 0.32, r * 0.5],
          [r * 0.56, r * 0.12],
          [r * 0.5, -r * 0.48],
          [-r * 0.5, -r * 0.48],
          [-r * 0.56, r * 0.12],
        ];
        c.beginPath();
        pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.closePath();
        c.strokeStyle = '#0A0B09';
        c.lineWidth = 1.8;
        c.lineJoin = 'round';
        c.stroke();
        const g = c.createLinearGradient(-r * 0.5, -r * 0.5, r * 0.5, r * 0.5);
        g.addColorStop(0, '#7E8276');
        g.addColorStop(1, '#43463F');
        c.fillStyle = g;
        c.fill();
        c.fillStyle = 'rgba(255,255,240,0.14)';
        c.fillRect(-r * 0.46, -r * 0.46, r * 0.92, r * 0.08);
        if (boss) {
          c.fillStyle = '#585A51';
          c.strokeStyle = 'rgba(0,0,0,0.5)';
          c.lineWidth = 0.5;
          for (let i = 0; i < 4; i++) {
            const x = -r * 0.42 + i * r * 0.22;
            c.fillRect(x, r * 0.3, r * 0.18, r * 0.14);
            c.strokeRect(x, r * 0.3, r * 0.18, r * 0.14);
          }
        }
        // 해치
        c.fillStyle = '#2E302A';
        c.beginPath();
        c.arc(-r * 0.18, -r * 0.18, r * 0.15, 0, TAU);
        c.fill();
        c.strokeStyle = 'rgba(200,200,185,0.3)';
        c.lineWidth = 0.5;
        c.stroke();
        c.fillStyle = '#262823';
        c.fillRect(r * 0.12, -r * 0.3, r * 0.22, r * 0.12);
      }),
    };
  }

  function diamond(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y - s);
    c.lineTo(x + s, y);
    c.lineTo(x, y + s);
    c.lineTo(x - s, y);
    c.closePath();
  }

  // 진지: 모래주머니 고리 + 웅덩이 + 땅 그림자 (s 마다 한 장)
  function baseSpr(s) {
    const bw = s * 1.4;
    const bh = s * 0.74;
    return {
      w: bw,
      h: bh,
      cv: sprite('tac-base-' + s, bw, bh, (c) => {
        const cx = bw / 2;
        const cy = bh / 2;
        const rx = s * 0.5;
        const ry = s * 0.2;
        c.save();
        c.translate(cx + s * 0.05, cy + s * 0.07);
        c.scale(1, (ry / rx) * 1.15);
        const g = c.createRadialGradient(0, 0, rx * 0.4, 0, 0, rx * 1.3);
        g.addColorStop(0, 'rgba(0,0,0,0.6)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, rx * 1.3, 0, TAU);
        c.fill();
        c.restore();
        c.fillStyle = '#13140E';
        c.beginPath();
        c.ellipse(cx, cy, rx * 0.84, ry * 0.82, 0, 0, TAU);
        c.fill();
        const n = 13;
        const as = [];
        for (let i = 0; i < n; i++) as.push((i / n) * TAU + 0.12);
        as.sort((a, b) => Math.sin(a) - Math.sin(b));
        const bl = s * 0.18;
        const bt = s * 0.105;
        for (const a of as) {
          const x = cx + Math.cos(a) * rx;
          const y = cy + Math.sin(a) * ry;
          c.save();
          c.translate(x, y);
          c.rotate(Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx));
          c.fillStyle = '#1B1A14';
          roundRect(c, -bl / 2 - 0.7, -bt / 2 - 0.3, bl + 1.4, bt + 1.4, bt * 0.5);
          c.fill();
          const front = Math.sin(a) > 0;
          c.fillStyle = front ? '#8F8569' : '#7A7159';
          roundRect(c, -bl / 2, -bt / 2, bl, bt, bt * 0.48);
          c.fill();
          c.fillStyle = 'rgba(255,248,220,0.16)';
          roundRect(c, -bl / 2 + 0.6, -bt / 2 + 0.4, bl - 1.2, bt * 0.38, bt * 0.2);
          c.fill();
          c.strokeStyle = 'rgba(0,0,0,0.3)';
          c.lineWidth = 0.5;
          c.beginPath();
          c.moveTo(-bl * 0.3, -bt / 2 + 0.4);
          c.lineTo(-bl * 0.3, bt / 2 - 0.4);
          c.moveTo(bl * 0.3, -bt / 2 + 0.4);
          c.lineTo(bl * 0.3, bt / 2 - 0.4);
          c.stroke();
          c.restore();
        }
      }),
    };
  }

  function chamfer(c, x, y, w, h, k) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + w - k, y);
    c.lineTo(x + w, y + k);
    c.lineTo(x + w, y + h);
    c.lineTo(x + k, y + h);
    c.lineTo(x, y + h - k);
    c.closePath();
  }

  CX.defineTheme('tactical', {
    name: '전술 지도',
    desc: '위성 지형 · 붉은 적성 표지 · 불과 연기 · 모래주머니 진지',
    fonts: ['Oswald', 'IBM Plex Sans KR'],

    bg(scale) {
      return bgCanvas(scale, (c) => {
        terrain(c);
        compound(c);
      });
    },

    // 구름 그림자가 천천히 지나가고, 폭발 자리에 그을음이 몇 초 남는다
    sky(c, t) {
      nowT = t;
      if (scorch.length) {
        const sp = scorchSpr();
        let keep = 0;
        for (const s of scorch) {
          const age = t - s.t0;
          if (age < -1 || age > 7) continue;
          scorch[keep++] = s;
          const a = clamp(1 - age / 7, 0, 1) * clamp(age / 0.25, 0, 1);
          if (a <= 0) continue;
          c.globalAlpha = 0.62 * a;
          c.drawImage(sp, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
        }
        scorch.length = keep;
        c.globalAlpha = 1;
      }
      const cl = cloudSpr();
      for (let i = 0; i < 3; i++) {
        const sp = 5 + i * 1.7;
        const span = W + 300;
        const x = ((t * sp + i * 173) % span) - 150;
        const y = ((t * sp * 0.42 + i * 191) % (LINE_Y + 160)) - 80;
        c.globalAlpha = 0.26;
        c.drawImage(cl, x - 110, y - 70, 220 + i * 30, 140 + i * 16);
      }
      c.globalAlpha = 1;
    },

    enemy(c, e, t) {
      if (!e.alive && e.flash <= 0) return;
      const r = e.r;
      const kind = e.boss ? 'boss' : e.type;
      const air = kind === 'normal' || kind === 'charge';
      const sh = shadowSpr();
      // 그림자: 떠 있는 드론은 멀리, 땅의 차량은 가까이
      if (air) {
        c.globalAlpha = 0.55;
        c.drawImage(sh, e.x + r * 0.5 - r * 1.2, e.y + r * 1.0 - r * 1.2, r * 2.4, r * 2.4);
      } else {
        c.globalAlpha = 0.7;
        c.drawImage(sh, e.x + 2.5 - r * 1.15, e.y + 3 - r * 1.45, r * 2.3, r * 2.9);
      }
      c.globalAlpha = 1;
      c.save();
      c.translate(e.x, e.y);
      let top;
      if (kind === 'normal') {
        const s = droneSpr(r);
        c.rotate(Math.sin(t * 1.3 + e.ph) * 0.12);
        c.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h);
        // 프로펠러 날
        const d = r * 0.66;
        const a = t * 38 + e.ph;
        c.strokeStyle = 'rgba(230,234,224,0.6)';
        c.lineWidth = 0.8;
        c.beginPath();
        for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const ca = Math.cos(a * sx) * r * 0.48;
          const sa = Math.sin(a * sx) * r * 0.48;
          c.moveTo(sx * d - ca, sy * d - sa);
          c.lineTo(sx * d + ca, sy * d + sa);
        }
        c.stroke();
        if (e.flash > 0) {
          c.globalAlpha = Math.min(1, e.flash / 0.12);
          c.drawImage(sil(s.cv), -s.w / 2, -s.h / 2, s.w, s.h);
        }
        top = r * 1.35;
      } else if (kind === 'charge') {
        const s = kamiSpr(r);
        c.globalAlpha = 0.32;
        c.drawImage(trailSpr(), -r * 0.32, -r * 3.4, r * 0.64, r * 2.4);
        c.globalAlpha = 1;
        c.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h);
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = `rgba(255,170,90,${0.45 + 0.35 * Math.sin(t * 43 + e.ph)})`;
        c.beginPath();
        c.arc(0, -r * 1.0, r * 0.16, 0, TAU);
        c.fill();
        c.globalCompositeOperation = 'source-over';
        if (e.flash > 0) {
          c.globalAlpha = Math.min(1, e.flash / 0.12);
          c.drawImage(sil(s.cv), -s.w / 2, -s.h / 2, s.w, s.h);
        }
        top = r * 1.25;
      } else {
        const boss = kind === 'boss';
        const hs = hullSpr(r, boss);
        const ts = turretSpr(r, boss);
        c.drawImage(hs.cv, -hs.w / 2, -hs.h / 2, hs.w, hs.h);
        c.save();
        c.translate(0, -r * 0.12);
        c.rotate(Math.sin(t * 0.55 + e.ph) * 0.28);
        c.drawImage(ts.cv, -ts.w / 2, -ts.h / 2, ts.w, ts.h);
        c.restore();
        if (e.flash > 0) {
          c.globalAlpha = Math.min(1, e.flash / 0.12);
          c.drawImage(sil(hs.cv), -hs.w / 2, -hs.h / 2, hs.w, hs.h);
        }
        top = r * 1.2;
      }
      c.restore();
      if (!e.alive) return;
      // 느려짐: 옅은 파랑 점선 고리
      if (e.slow > 0) {
        c.strokeStyle = 'rgba(160,215,255,0.75)';
        c.lineWidth = 1;
        c.setLineDash([2.5, 2.5]);
        c.beginPath();
        c.arc(e.x, e.y, r * 1.45, 0, TAU);
        c.stroke();
        c.setLineDash([]);
      }
      // 적성 표지: 붉은 마름모 (+ 장갑·지휘는 체력 띠)
      const my = e.y - top - 4;
      if (e.boss) {
        c.strokeStyle = 'rgba(255,77,61,0.85)';
        c.lineWidth = 1.2;
        diamond(c, e.x, e.y, r * 1.75);
        c.stroke();
        const bw = 44;
        const k = clamp(e.hp / e.max, 0, 1);
        const by = e.y - r * 1.75 - 10;
        c.fillStyle = 'rgba(10,10,8,0.8)';
        c.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 5);
        c.fillStyle = C.red;
        c.fillRect(e.x - bw / 2, by, bw * k, 3);
        c.font = FN(700, 9);
        c.textAlign = 'center';
        c.textBaseline = 'alphabetic';
        c.lineWidth = 2.5;
        c.strokeStyle = 'rgba(10,10,8,0.85)';
        c.strokeText('HVT', e.x, by - 4);
        c.fillStyle = C.red;
        c.fillText('HVT', e.x, by - 4);
        return;
      }
      diamond(c, e.x, my, kind === 'armor' ? 3.4 : 2.5);
      c.fillStyle = C.red;
      c.fill();
      c.strokeStyle = 'rgba(8,8,6,0.75)';
      c.lineWidth = 1;
      c.stroke();
      if (kind === 'armor' && e.hp < e.max) {
        const bw = 18;
        const k = clamp(e.hp / e.max, 0, 1);
        c.fillStyle = 'rgba(10,10,8,0.8)';
        c.fillRect(e.x + 5, my - 2, bw + 2, 4);
        c.fillStyle = C.red;
        c.fillRect(e.x + 6, my - 1, bw * k, 2);
      }
    },

    // 연쇄 폭발: 섬광 → 불덩이 → 연기 · 먼지 고리 · 파편, 자리에 그을음
    boom(c, b) {
      const k = b.age / 0.55;
      if (b.leak) {
        const q = 1 - k;
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = q;
        const fr = 10 + ease(k) * 10;
        c.drawImage(fireSpr(), b.x - fr, b.y - fr, fr * 2, fr * 2);
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = `rgba(255,77,61,${0.9 * q})`;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(b.x, b.y, 8 + ease(k) * 26, Math.PI, TAU);
        c.stroke();
        c.globalAlpha = 1;
        return;
      }
      if (!b._tac) {
        b._tac = 1;
        scorch.push({ x: b.x, y: b.y, r: b.r * (b.big ? 0.55 : 0.42), t0: nowT });
        if (scorch.length > 48) scorch.shift();
      }
      const R = b.r * (b.big ? 0.7 : 0.58);
      const seed = b.x * 0.731 + b.y * 0.377;
      // 먼지 고리 (충격파가 땅을 쓸고 간다)
      if (k < 0.55) {
        const q = k / 0.55;
        const rr = R * (0.6 + 1.25 * ease(q));
        c.globalAlpha = 0.9 * (1 - q);
        c.drawImage(ringSpr(), b.x - rr, b.y - rr, rr * 2, rr * 2);
      }
      // 불덩이: 가운데 + 부풀어 나가는 덩이 넷 (빨리 꺼짐)
      const fk = k / 0.62;
      if (fk < 1) {
        const fs = fireSpr();
        c.globalAlpha = (1 - fk) ** 1.2;
        const fr = R * (0.5 + 0.5 * ease(fk * 1.6));
        for (let i = 0; i < 4; i++) {
          const a = seed * 5 + i * 1.71;
          const sr = fr * (0.5 + 0.14 * ((i * 7 + Math.floor(seed)) % 3));
          const od = fr * (0.35 + 0.35 * ease(fk * 2));
          c.drawImage(fs, b.x + Math.cos(a) * od - sr, b.y + Math.sin(a) * od - sr, sr * 2, sr * 2);
        }
        c.drawImage(fs, b.x - fr, b.y - fr, fr * 2, fr * 2);
      }
      // 연기: 불 위를 덮으며 퍼지고 바람(오른쪽)에 밀린다
      const nP = b.big ? 7 : 5;
      for (let i = 0; i < nP; i++) {
        const a = seed * 7 + i * 2.399;
        const f = frac(seed * 3.1 + i * 0.618);
        const d = R * (0.25 + 0.6 * f) * (0.3 + 0.95 * ease(k * 1.3));
        const px = b.x + Math.cos(a) * d + k * 7;
        const py = b.y + Math.sin(a) * d * 0.9;
        const pr = R * (0.4 + 0.3 * frac(f * 5.3)) * (0.5 + 0.95 * ease(k * 1.15));
        const kind = i === 0 ? 0 : i % 3 === 0 ? 2 : 1;
        c.globalAlpha = (kind === 0 ? 0.75 : 0.55) * clamp((k - 0.06) / 0.2, 0, 1) * (1 - k) ** 0.7;
        if (c.globalAlpha > 0.01) c.drawImage(smokeSpr(kind), px - pr, py - pr, pr * 2, pr * 2);
      }
      // 섬광
      if (k < 0.16) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1 - k / 0.16;
        const r0 = R * (b.big ? 1.1 : 0.9);
        c.drawImage(flashSpr(), b.x - r0, b.y - r0, r0 * 2, r0 * 2);
        c.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha = 1;
      // 파편
      const n = b.big ? 8 : 6;
      const dd = R * (0.3 + 1.25 * ease(k * 1.1));
      c.lineCap = 'round';
      c.strokeStyle = `rgba(20,19,15,${0.9 * (1 - k)})`;
      c.lineWidth = 1.3;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const a = seed * 11 + i * (TAU / n) + frac(seed + i * 0.37) * 0.6;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const d2 = dd * (0.75 + 0.5 * frac(seed * 2 + i * 0.73));
        c.moveTo(b.x + ca * (d2 - 3.5), b.y + sa * (d2 - 3.5));
        c.lineTo(b.x + ca * d2, b.y + sa * d2);
      }
      c.stroke();
      if (k < 0.5) {
        c.fillStyle = `rgba(255,190,110,${1 - k / 0.5})`;
        for (let i = 0; i < n; i++) {
          const a = seed * 13 + i * (TAU / n) + 0.3;
          const d2 = dd * 1.08;
          c.fillRect(b.x + Math.cos(a) * d2 - 0.8, b.y + Math.sin(a) * d2 - 0.8, 1.6, 1.6);
        }
      }
    },

    // 번지는 줄: 달군 파편 하나가 옆 적으로 날아간다 (머리 밝고 꼬리 짧게)
    seam(c, s) {
      const k = s.age / 0.3;
      const h = Math.min(1, k * 2.4);
      const tl = Math.max(0, h - 0.5);
      const x1 = s.x1 + (s.x2 - s.x1) * tl;
      const y1 = s.y1 + (s.y2 - s.y1) * tl;
      const x2 = s.x1 + (s.x2 - s.x1) * h;
      const y2 = s.y1 + (s.y2 - s.y1) * h;
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      c.strokeStyle = `rgba(255,140,60,${0.4 * (1 - k)})`;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
      c.strokeStyle = `rgba(255,226,170,${0.95 * (1 - k)})`;
      c.lineWidth = 1.1;
      c.stroke();
      if (h < 1) {
        c.fillStyle = 'rgba(255,248,230,0.95)';
        c.beginPath();
        c.arc(x2, y2, 1.8, 0, TAU);
        c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    },

    num(c, n) {
      const a = n.age > 0.5 ? 1 - (n.age - 0.5) / 0.3 : 1;
      const pop = n.age < 0.1 ? 1 + (1 - n.age / 0.1) * (n.kind === 2 ? 0.45 : 0.25) : 1;
      const size = n.kind === 2 ? 18 : n.kind === 1 ? 14 : 11.5;
      c.save();
      c.globalAlpha = Math.max(0, a);
      c.translate(n.x, n.y);
      c.scale(pop, pop);
      c.font = FN(n.kind ? 700 : 500, size);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.lineJoin = 'round';
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(8,9,6,0.88)';
      c.strokeText(String(n.v), 0, 0);
      c.fillStyle = n.kind === 2 ? '#FF7A45' : n.kind === 1 ? C.amber : C.fg;
      c.fillText(String(n.v), 0, 0);
      c.restore();
    },

    // 방어선: 아군 파랑 '방어 진지선' 기호 (네모 이빨) + 지나가는 빛 + 이름표. 목숨 잃으면 붉게
    line(c, t) {
      const hk = nowT - hurtAt < 0.1 ? hurtK : 0;
      const col = hk > 0.02 ? C.red : C.blue;
      const g = c.createLinearGradient(0, LINE_Y - 10, 0, LINE_Y);
      g.addColorStop(0, 'rgba(108,182,255,0)');
      g.addColorStop(1, hk > 0.02 ? `rgba(255,77,61,${0.15 + 0.3 * hk})` : 'rgba(108,182,255,0.14)');
      c.fillStyle = g;
      c.fillRect(0, LINE_Y - 10, W, 10);
      c.strokeStyle = col;
      c.globalAlpha = 0.8;
      c.lineWidth = 1.1;
      c.beginPath();
      for (let x = 0; x < W; x += 14) {
        c.moveTo(x + 4.5, LINE_Y);
        c.lineTo(x + 4.5, LINE_Y - 4.5);
        c.lineTo(x + 10.5, LINE_Y - 4.5);
        c.lineTo(x + 10.5, LINE_Y);
      }
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = col;
      c.fillRect(0, LINE_Y - 0.8, W, 1.6);
      // 지나가는 빛
      const sx = ((t * 80) % (W + 200)) - 100;
      const sg = c.createLinearGradient(sx - 60, 0, sx + 60, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(225,240,255,0.75)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = sg;
      c.fillRect(sx - 60, LINE_Y - 1, 120, 2);
      c.globalCompositeOperation = 'source-over';
      // 이름표
      c.font = FK(700, 9);
      ls(c, '1px');
      const label = '방어선';
      const tw = c.measureText(label).width;
      c.font = FN(500, 9);
      const pw = c.measureText('FPL').width;
      const bw = tw + pw + 15;
      c.fillStyle = 'rgba(10,12,9,0.88)';
      c.fillRect(6, LINE_Y - 19, bw, 12);
      c.fillStyle = col;
      c.fillRect(6, LINE_Y - 19, 2, 12);
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText('FPL', 12, LINE_Y - 12.6);
      c.font = FK(700, 9);
      c.fillStyle = C.fg;
      c.fillText(label, 15 + pw, LINE_Y - 12.6);
      ls(c, '0px');
    },

    chain(c, n, since) {
      const pop = 1 + 0.3 * Math.max(0, 1 - since / 0.16);
      const a = since > 0.8 ? 1 - (since - 0.8) / 0.3 : 1;
      c.save();
      c.globalAlpha = Math.max(0, a);
      c.translate(W / 2, 196);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      // 이름 줄 (양옆 가는 선)
      c.font = FK(700, 12);
      ls(c, '2px');
      c.fillStyle = C.amber;
      c.shadowColor = 'rgba(0,0,0,0.9)';
      c.shadowBlur = 6;
      c.fillText('연쇄', 1, -46);
      ls(c, '0px');
      c.shadowBlur = 0;
      c.fillRect(-58, -50, 30, 1);
      c.fillRect(28, -50, 30, 1);
      c.scale(pop, pop);
      c.font = FN(700, 56);
      c.shadowColor = 'rgba(0,0,0,0.85)';
      c.shadowBlur = 14;
      c.fillStyle = C.fg;
      c.fillText(String(n), 0, 12);
      c.shadowBlur = 0;
      const bw = Math.min(110, 18 + n * 4);
      c.fillStyle = C.amber;
      c.fillRect(-bw / 2, 20, bw, 2.5);
      c.restore();
    },

    // ── 무기 받침 · 표시 ──
    base(c, w, x, y, s) {
      const b = baseSpr(s);
      c.drawImage(b.cv, x - b.w / 2, y + s * 0.3 - b.h / 2, b.w, b.h);
      // 세계 색 표시 고리 (진지 안쪽 바닥)
      c.globalAlpha = 0.9;
      c.lineWidth = 1.2;
      c.strokeStyle = colOf(w.world);
      c.beginPath();
      c.ellipse(x, y + s * 0.3, s * 0.36, s * 0.13, 0, 0, TAU);
      c.stroke();
      if (w.sub) {
        c.strokeStyle = colOf(w.subWorld);
        c.beginPath();
        c.ellipse(x, y + s * 0.3, s * 0.36, s * 0.13, 0, 0.15, Math.PI - 0.15);
        c.lineWidth = 2;
        c.stroke();
      }
      c.globalAlpha = 1;
    },

    pips(c, w, x, y, s) {
      const py = y + s * 0.62;
      const bw = 4;
      const gap = 1.8;
      const tot = 5 * bw + 4 * gap;
      c.fillStyle = 'rgba(10,11,8,0.78)';
      c.fillRect(x - tot / 2 - 3, py - 3.5, tot + 6, 7);
      for (let i = 0; i < 5; i++) {
        const px = x - tot / 2 + i * (bw + gap);
        c.beginPath();
        c.moveTo(px + 1, py - 2);
        c.lineTo(px + bw + 1, py - 2);
        c.lineTo(px + bw - 1, py + 2);
        c.lineTo(px - 1, py + 2);
        c.closePath();
        c.fillStyle = i < w.lv ? C.amber : 'rgba(255,181,71,0.22)';
        c.fill();
      }
    },

    pop(c, p) {
      const k = p.age / 1.6;
      c.globalAlpha = k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.25);
      const isNew = p.text === 'NEW';
      c.font = FN(700, 11);
      ls(c, '0.5px');
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      const ty = p.w.y - GUN * 0.78 - ease(Math.min(1, p.age / 0.3)) * 14;
      const tw = c.measureText(p.text).width + 14;
      const x0 = p.w.x - tw / 2;
      c.fillStyle = 'rgba(12,14,10,0.92)';
      c.fillRect(x0, ty - 8, tw, 16);
      c.fillStyle = isNew ? C.blue : C.amber;
      c.fillRect(x0, ty - 8, 2, 16);
      c.fillStyle = isNew ? '#BFE0FF' : C.amberHi;
      c.fillText(p.text, x0 + 8, ty + 0.5);
      ls(c, '0px');
    },

    // ── 실전 판 화면 ──
    hurt(c, run, k) {
      hurtK = k;
      hurtAt = nowT;
      const g = c.createRadialGradient(W / 2, 260, 140, W / 2, 260, 380);
      g.addColorStop(0, 'rgba(255,60,40,0)');
      g.addColorStop(1, `rgba(255,60,40,${0.4 * k})`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, FIELD_H);
      c.fillStyle = `rgba(255,77,61,${0.5 * k})`;
      c.fillRect(0, 0, W, 2);
      c.fillRect(0, FIELD_H - 2, W, 2);
    },

    hud(c, run) {
      const H = run.oy;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#131510');
      g.addColorStop(1, '#0D0F0B');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(236,234,220,0.13)';
      c.fillRect(0, H - 1, W, 1);
      c.fillStyle = C.amber;
      c.fillRect(0, H - 1, 28, 1);
      c.fillRect(W - 28, H - 1, 28, 1);
      // 이름 줄
      c.textBaseline = 'alphabetic';
      c.fillStyle = C.dim;
      c.font = FK(500, 9.5);
      c.textAlign = 'left';
      c.fillText('목숨', 14, 17);
      c.font = FN(500, 9.5);
      ls(c, '1.5px');
      c.textAlign = 'center';
      c.fillText('LV', W / 2 + 0.75, 17);
      c.textAlign = 'right';
      c.fillText('WAVE', W - 12.5, 17);
      ls(c, '0px');
      // 목숨: 기운 판 다섯 (둘 이하면 붉게)
      const low = run.hearts <= 2;
      for (let i = 0; i < 5; i++) {
        const x0 = 14 + i * 19;
        c.beginPath();
        c.moveTo(x0 + 3, 25);
        c.lineTo(x0 + 17, 25);
        c.lineTo(x0 + 14, 37);
        c.lineTo(x0, 37);
        c.closePath();
        if (i < run.hearts) {
          c.fillStyle = low ? C.red : C.fg;
          c.fill();
        } else {
          c.strokeStyle = 'rgba(236,234,220,0.26)';
          c.lineWidth = 1;
          c.stroke();
        }
      }
      // LV · WAVE
      c.fillStyle = C.fg;
      c.font = FN(700, 24);
      c.textAlign = 'center';
      c.fillText(String(run.level), W / 2, 39);
      c.textAlign = 'right';
      c.fillText(String(run.wave), W - 14, 39);
      c.fillStyle = 'rgba(236,234,220,0.1)';
      c.fillRect(124, 10, 1, 29);
      c.fillRect(W - 124, 10, 1, 29);
      // 경험치
      const k = clamp(run.exp / run.need, 0, 1);
      const bx = 40;
      const bw = W - bx - 62;
      const by = 49;
      c.font = FN(500, 9);
      ls(c, '1px');
      c.fillStyle = C.dim;
      c.textAlign = 'left';
      c.fillText('EXP', 14, 54);
      ls(c, '0px');
      c.fillStyle = 'rgba(236,234,220,0.1)';
      c.fillRect(bx, by, bw, 4);
      c.fillStyle = C.amber;
      c.fillRect(bx, by, Math.max(1, bw * k), 4);
      c.fillStyle = '#0D0F0B';
      for (let i = 1; i < 10; i++) c.fillRect(Math.round(bx + (bw * i) / 10), by, 1, 4);
      c.font = FN(500, 10);
      c.fillStyle = C.sub;
      c.textAlign = 'right';
      c.fillText(`${run.exp} / ${run.need}`, W - 14, 54);
      // 아래 띠 (판 밑에 남는 자리): 처치 · 연쇄 최고
      const fy = run.oy + FIELD_H;
      const fh = run.ch - fy;
      if (fh > 8) {
        c.fillStyle = '#0D0F0B';
        c.fillRect(0, fy, W, fh);
        c.fillStyle = 'rgba(236,234,220,0.1)';
        c.fillRect(0, fy, W, 1);
        const my = fy + fh / 2 + 1;
        c.textBaseline = 'middle';
        const stat = (label, v, right) => {
          c.font = FK(500, 10);
          const lw = c.measureText(label).width;
          c.font = FN(500, 11.5);
          const vw = c.measureText(String(v)).width;
          const x0 = right ? W - 14 - vw - 6 - lw : 14;
          c.textAlign = 'left';
          c.font = FK(500, 10);
          c.fillStyle = C.dim;
          c.fillText(label, x0, my);
          c.font = FN(500, 11.5);
          c.fillStyle = C.sub;
          c.fillText(String(v), x0 + lw + 6, my);
        };
        stat('처치', run.kills, false);
        stat('연쇄 최고', run.chainPeak, true);
      }
    },

    chips(c, run) {
      const m = run.worlds();
      let y = 44;
      for (const k of ORDER) {
        if (!m[k]) continue;
        const wo = CX.wo(k);
        c.fillStyle = 'rgba(13,15,11,0.86)';
        c.fillRect(6, y, 40, 19);
        c.strokeStyle = C.edge;
        c.lineWidth = 1;
        c.strokeRect(6.5, y + 0.5, 39, 18);
        c.fillStyle = colOf(k);
        c.fillRect(6, y, 2, 19);
        c.save();
        wo.crest(c, 12, y + 3, 6.5);
        c.restore();
        c.fillStyle = C.fg;
        c.font = FN(500, 12);
        c.textAlign = 'right';
        c.textBaseline = 'middle';
        c.fillText(String(m[k]), 41, y + 10);
        y += 22;
      }
    },

    gate(c, run) {
      const n = run.cats().size;
      const next = CAT_TH.find((t) => t > n) || 15;
      const slots = run.fuseSlots();
      const a = `갈래 ${n}/${next}`;
      const b = `합성 칸 ${slots}`;
      c.font = FK(500, 10.5);
      const aw = c.measureText(a).width + 14;
      c.font = FK(700, 10.5);
      const bw = c.measureText(b).width + 14;
      const y = 40;
      const h = 20;
      const xb = W - 8 - bw;
      const xa = xb - aw;
      c.fillStyle = 'rgba(13,15,11,0.86)';
      c.fillRect(xa, y, aw + bw, h);
      c.strokeStyle = C.edge;
      c.lineWidth = 1;
      c.strokeRect(xa + 0.5, y + 0.5, aw + bw - 1, h - 1);
      if (slots > 0) {
        c.fillStyle = C.amber;
        c.fillRect(xb, y, bw, h);
      } else {
        c.fillStyle = 'rgba(236,234,220,0.12)';
        c.fillRect(xb, y + 4, 1, h - 8);
      }
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.font = FK(500, 10.5);
      c.fillStyle = C.sub;
      c.fillText(a, xa + 7, y + h / 2 + 0.5);
      c.font = FK(700, 10.5);
      c.fillStyle = slots > 0 ? '#1A1407' : C.sub;
      c.fillText(b, xb + 7, y + h / 2 + 0.5);
    },

    banner(c, b) {
      const k = b.age / b.life;
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      c.save();
      c.globalAlpha = Math.max(0, a);
      c.textBaseline = 'alphabetic';
      if (b.wave) {
        const parts = b.text.split(' · ');
        const boss = parts.length > 1;
        const y = 140;
        const acc = boss ? C.red : C.amber;
        const band = c.createLinearGradient(0, 0, W, 0);
        band.addColorStop(0, 'rgba(10,11,8,0)');
        band.addColorStop(0.5, 'rgba(10,11,8,0.7)');
        band.addColorStop(1, 'rgba(10,11,8,0)');
        c.fillStyle = band;
        c.fillRect(0, y - 40, W, boss ? 86 : 70);
        c.textAlign = 'center';
        c.font = FK(700, 10.5);
        ls(c, '1.5px');
        c.fillStyle = acc;
        c.fillText(boss ? '고가치 표적 접근' : '적 접근 중', W / 2 + 0.75, y - 20);
        ls(c, '1px');
        c.font = FN(700, 34);
        c.fillStyle = C.fg;
        c.shadowColor = 'rgba(0,0,0,0.75)';
        c.shadowBlur = 10;
        const tw = c.measureText(parts[0]).width;
        c.fillText(parts[0], W / 2 + 0.5, y + 14);
        c.shadowBlur = 0;
        ls(c, '0px');
        const ex = ease(Math.min(1, b.age / 0.4));
        const ll = 54 * ex;
        c.fillStyle = acc;
        c.fillRect(W / 2 - tw / 2 - 12 - ll, y + 1, ll, 1.5);
        c.fillRect(W / 2 + tw / 2 + 12, y + 1, ll, 1.5);
        if (boss) {
          c.font = FK(700, 11.5);
          c.fillStyle = '#FFB3A8';
          c.fillText('적 지휘 전차 · ' + parts.slice(1).join(' · '), W / 2, y + 36);
        }
      } else {
        const y = 150;
        const x0 = 24;
        const w0 = W - 48;
        const slide = (1 - ease(Math.min(1, b.age / 0.3))) * -18;
        c.translate(slide, 0);
        c.fillStyle = 'rgba(13,15,11,0.94)';
        c.fillRect(x0, y - 31, w0, 62);
        c.strokeStyle = C.edge;
        c.lineWidth = 1;
        c.strokeRect(x0 + 0.5, y - 30.5, w0 - 1, 61);
        c.fillStyle = C.amber;
        c.fillRect(x0, y - 31, 3, 62);
        c.textAlign = 'left';
        c.font = FK(700, 10);
        ls(c, '1px');
        c.fillStyle = C.amber;
        c.fillText('합성 완료', x0 + 16, y - 12);
        ls(c, '0px');
        c.fillStyle = C.fg;
        c.font = FK(700, 18);
        c.fillText(b.text.replace(/^합성 · /, ''), x0 + 16, y + 10, w0 - 30);
        c.fillStyle = C.sub;
        c.font = FK(500, 11);
        c.fillText(b.sub, x0 + 16, y + 25, w0 - 30);
      }
      c.restore();
    },

    offer(c, o, run) {
      const t = o.age;
      c.save();
      c.fillStyle = `rgba(8,9,7,${0.84 * Math.min(1, t / 0.2)})`;
      c.fillRect(0, -run.oy, W, run.ch);
      c.globalAlpha = Math.min(1, t / 0.25);
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
      c.font = FN(500, 11);
      ls(c, '1.5px');
      c.fillStyle = C.amber;
      c.fillText(`LV ${o.from} → ${o.from + 1}`, 18, 100);
      ls(c, '0px');
      c.font = FK(700, 24);
      c.fillStyle = C.fg;
      c.fillText('레벨 업', 18, 128);
      c.textAlign = 'right';
      c.font = FK(500, 11);
      c.fillStyle = C.sub;
      c.fillText('보급 하나 고르기', W - 18, 127);
      c.globalAlpha = 1;
      o.cards.forEach((cd, i) => {
        const y = 140 + i * 112;
        const enter = ease(clamp((t - i * 0.08) / 0.3, 0, 1));
        const picked = o.pick === i;
        const faded = o.pick >= 0 && !picked;
        c.save();
        c.globalAlpha = enter * (faded ? 0.32 : 1);
        c.translate((1 - enter) * 50, 0);
        if (picked) {
          const s = 1 + 0.025 * Math.sin(Math.min(1, (t - o.pickAt) / 0.2) * Math.PI);
          c.translate(W / 2, y + 50);
          c.scale(s, s);
          c.translate(-W / 2, -(y + 50));
        }
        CX.th().card(c, cd, 18, y, W - 36, 100, picked, run);
        c.restore();
      });
      if (!run.auto && o.pick < 0) {
        c.fillStyle = C.sub;
        c.font = FK(500, 11);
        c.textAlign = 'center';
        c.fillText('카드를 눌러 고른다', W / 2, 140 + 3 * 112 + 4);
      }
      c.restore();
    },

    card(c, cd, x, y, w, h, picked, run) {
      const acc = cd.kind === 'fuse' ? C.amber : cd.kind === 'new' ? C.blue : C.fg;
      chamfer(c, x, y, w, h, 10);
      c.fillStyle = 'rgba(21,23,17,0.97)';
      c.fill();
      c.strokeStyle = picked ? C.amber : cd.kind === 'fuse' ? 'rgba(255,181,71,0.55)' : 'rgba(236,234,220,0.16)';
      c.lineWidth = picked ? 2 : 1;
      c.stroke();
      if (picked) {
        c.save();
        c.shadowColor = 'rgba(255,181,71,0.75)';
        c.shadowBlur = 14;
        c.stroke();
        c.restore();
      }
      c.fillStyle = acc;
      c.fillRect(x, y + 10, 3, h - 20);
      // 그림 칸: 진지 위 무기 (모서리 눈금)
      const ix = x + 12;
      const iy = y + 12;
      const is = 76;
      c.fillStyle = '#0E100C';
      c.fillRect(ix, iy, is, is);
      c.strokeStyle = 'rgba(236,234,220,0.05)';
      c.lineWidth = 1;
      c.beginPath();
      for (let g = 19; g < is; g += 19) {
        c.moveTo(ix + g + 0.5, iy);
        c.lineTo(ix + g + 0.5, iy + is);
        c.moveTo(ix, iy + g + 0.5);
        c.lineTo(ix + is, iy + g + 0.5);
      }
      c.stroke();
      c.strokeStyle = 'rgba(236,234,220,0.45)';
      c.beginPath();
      const q = 6;
      for (const [cx, cy, dx, dy] of [
        [ix, iy, 1, 1],
        [ix + is, iy, -1, 1],
        [ix, iy + is, 1, -1],
        [ix + is, iy + is, -1, -1],
      ]) {
        c.moveTo(cx + dx * 0.5, cy + dy * q);
        c.lineTo(cx + dx * 0.5, cy + dy * 0.5);
        c.lineTo(cx + dx * q, cy + dy * 0.5);
      }
      c.stroke();
      const v = cd.view;
      c.save();
      CX.drawGun(c, v, x + 50, y + h / 2 + 10, 50, run.t);
      c.restore();
      // 글
      const tx = x + 100;
      const tw = w - 110;
      const wn = (k) => CX.wo(k).name;
      let kindL;
      let tag;
      let name;
      let lvTxt = '';
      let l1;
      let l2 = '';
      if (cd.kind === 'fuse') {
        kindL = '합성';
        tag = `칸 ${run.fuseSlots()} 중 1 · 등급 ${Math.min(cd.a.lv, cd.b.lv)}`;
        name = v.name;
        l1 = `몸 ${cd.a.name} (${CX.wo(cd.a.world).short}) + 연출 ${cd.b.name} (${CX.wo(cd.b.world).short})`;
        l2 = `반응: ${v.react}`;
      } else if (cd.kind === 'new') {
        const own = run.worlds();
        kindL = '새 무기';
        tag = `${wn(v.world)} · ${v.catLabel}${own[v.world] ? '' : ' · 새 세계'}`;
        name = v.name;
        const left = (CAT_TH.find((tt) => tt > run.cats().size) || 15) - run.cats().size - 1;
        l1 = run.cats().has(v.cat) ? `${v.catLabel} 갈래 하나 더` : left <= 0 ? '새 갈래 · 이걸로 합성 칸이 열린다' : `새 갈래 · 합성 칸까지 갈래 ${left}`;
      } else {
        kindL = '강화';
        tag = `${wn(v.world)} · ${v.catLabel}`;
        name = v.name;
        lvTxt = `LV ${v.lv} → ${v.lv + 1}`;
        l1 = '피해 +28% · 쿨다운 −6%';
      }
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      // 종류 꼬리표
      c.font = FK(700, 10);
      const kw = c.measureText(kindL).width + 10;
      c.fillStyle = cd.kind === 'fuse' ? 'rgba(255,181,71,0.16)' : cd.kind === 'new' ? 'rgba(108,182,255,0.16)' : 'rgba(236,234,220,0.1)';
      c.fillRect(tx, y + 13, kw, 15);
      c.fillStyle = cd.kind === 'up' ? C.fg : acc;
      c.fillText(kindL, tx + 5, y + 24.5);
      c.font = FK(500, 10.5);
      c.fillStyle = C.sub;
      c.fillText(tag, tx + kw + 7, y + 24.5, tw - kw - 7);
      // 이름 (+ 강화면 레벨)
      c.fillStyle = C.fg;
      c.font = FK(700, 18);
      c.fillText(name, tx, y + 50, tw);
      if (lvTxt) {
        const nw = Math.min(tw, c.measureText(name).width);
        c.font = FN(700, 14);
        c.fillStyle = C.amber;
        c.fillText(lvTxt, tx + nw + 8, y + 49.5);
      }
      c.fillStyle = C.sub;
      c.font = FK(500, 11);
      c.fillText(l1, tx, y + 70, tw);
      if (l2) {
        c.fillStyle = C.amberHi;
        c.font = FK(700, 11);
        c.fillText(l2, tx, y + 87, tw);
      }
      if (picked) {
        c.font = FK(700, 9.5);
        const sw = c.measureText('선택').width + 12;
        c.fillStyle = C.amber;
        c.fillRect(x + w - sw - 14, y + h - 22, sw, 14);
        c.fillStyle = '#1A1407';
        c.fillText('선택', x + w - sw - 8, y + h - 11.5);
      }
    },

    over(c, run) {
      const a = Math.min(1, run.over / 0.4);
      c.save();
      c.fillStyle = `rgba(10,8,6,${0.86 * a})`;
      c.fillRect(0, -run.oy, W, run.ch);
      c.globalAlpha = a;
      c.fillStyle = `rgba(255,77,61,0.12)`;
      c.fillRect(0, 186, W, 64);
      c.fillStyle = C.red;
      c.fillRect(0, 186, W, 1);
      c.fillRect(0, 249, W, 1);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.font = FK(700, 10.5);
      ls(c, '2px');
      c.fillStyle = '#FF8C80';
      c.fillText('작전 실패', W / 2 + 1, 208);
      ls(c, '0px');
      c.font = FK(700, 28);
      c.fillStyle = C.fg;
      c.fillText('방어선 붕괴', W / 2, 238);
      // 전과 넷
      const stats = [
        ['웨이브', run.wave],
        ['LV', run.level],
        ['연쇄 최고', run.chainPeak],
        ['합성', run.fusedN],
      ];
      const cw = 76;
      const x0 = W / 2 - cw * 2;
      stats.forEach(([lab, v], i) => {
        const cx = x0 + cw * i + cw / 2;
        c.font = FN(700, 26);
        c.fillStyle = C.fg;
        c.fillText(String(v), cx, 300);
        c.font = FK(500, 10.5);
        c.fillStyle = C.sub;
        c.fillText(lab, cx, 318);
        if (i) {
          c.fillStyle = 'rgba(236,234,220,0.14)';
          c.fillRect(x0 + cw * i, 278, 1, 44);
        }
      });
      // 새 판까지
      const p = clamp((run.over - 0.4) / 3.6, 0, 1);
      c.font = FK(500, 11);
      c.fillStyle = C.sub;
      c.fillText('잠시 뒤 새 판', W / 2, 356);
      c.fillStyle = 'rgba(236,234,220,0.12)';
      c.fillRect(W / 2 - 70, 366, 140, 2);
      c.fillStyle = C.amber;
      c.fillRect(W / 2 - 70, 366, 140 * p, 2);
      c.restore();
    },
  });
})();
