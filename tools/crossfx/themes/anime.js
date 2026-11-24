// 테마 anime — 밝은 낮 애니 액션 (11-24)
// 파란 하늘 · 큰 적운 · 햇빛, 아래는 성벽 위 통로(광장 돌바닥). 셀 셰이딩 두 톤 + 깔끔한 외곽선.
// 적 = 검보라 결정 괴수(굵은 외곽선, 분홍 눈), 폭발 = 흰·노랑 별 + 속도선, 방어선 = 성벽 위 하늘빛 결계.
// UI = 흰 유리 패널 + 남색 글자 + 파랑·연금 강조, 숫자는 기운 Oswald (요즘 수집형 액션 게임 말투).
(function () {
  const { W, GUN, CAT_TH, ORDER } = CX.runInfo;
  const { LINE_Y } = CX.size;
  const { TAU, clamp, ease, roundRect, bgCanvas, sprite } = CX.util;
  const FH = 540; // 판 높이
  const STRIP = 36; // 판 아래 캔버스 남는 띠 (640 − 64 − 540)

  // ── 색 ──
  const NAVY = '#1B2650';
  const SLATE = '#4E5A78';
  const BLUE = '#2F6FE4';
  const BLUE_D = '#1D4FC0';
  const SKY0 = '#1C58C4';
  const GOLD = '#F2C14E';
  const GOLD_L = '#FFE7A6';
  const GOLD_D = '#875A00';
  const PINK = '#F0386B';
  const INK = '#140A26';
  const CR = { base: '#3D2766', dark: '#231540', lite: '#7458AE', spec: '#D9C8FF', eye: '#FF4FB0', hot: '#FFE3F3', plate: '#4D3483', rim: '#A990EC' };
  const NUM = '"Oswald", "Noto Sans KR", sans-serif';
  const KR = '"Noto Sans KR", sans-serif';
  const mainCol = (k) => (CX.wo(k).colors || {}).main || '#CFC6E8';

  if (document.fonts && document.fonts.load) for (const f of ['700 20px "Oswald"', '500 20px "Oswald"', '900 20px "Noto Sans KR"', '700 20px "Noto Sans KR"']) document.fonts.load(f).catch(() => null);

  // 판마다 같은 바탕 (시드 고정)
  function seeded(s) {
    return () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── 작은 도구 ──
  /** 기운 글자 (k < 0 이면 오른쪽으로 기움) */
  function slant(c, text, x, y, k, stroke) {
    c.save();
    c.translate(x, y);
    c.transform(1, 0, k, 1, 0, 0);
    if (stroke) c.strokeText(text, 0, 0);
    c.fillText(text, 0, 0);
    c.restore();
  }
  function spacing(c, v) {
    try {
      c.letterSpacing = v;
    } catch (e) {
      /* 없는 브라우저 */
    }
  }
  /** 흰 유리 패널: 아래 옅은 그림자 + 흰 면 + 흰 테 */
  function glass(c, x, y, w, h, r, a) {
    const al = a == null ? 0.95 : a;
    c.fillStyle = 'rgba(8,28,86,0.22)';
    roundRect(c, x, y + 2, w, h, r);
    c.fill();
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(255,255,255,${al})`);
    g.addColorStop(1, `rgba(232,240,252,${al})`);
    c.fillStyle = g;
    roundRect(c, x, y, w, h, r);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineWidth = 1;
    c.stroke();
  }
  /** 애니 반짝임 (네 갈래 오목 별) */
  function twinkle(c, x, y, R) {
    c.beginPath();
    c.moveTo(x, y - R);
    c.quadraticCurveTo(x, y, x + R, y);
    c.quadraticCurveTo(x, y, x, y + R);
    c.quadraticCurveTo(x, y, x - R, y);
    c.quadraticCurveTo(x, y, x, y - R);
    c.closePath();
  }
  function star5(c, x, y, R, rot) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i / 10) * TAU - Math.PI / 2;
      const r = i % 2 ? R * 0.45 : R;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  function ell(c, x, y, rx, ry) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, TAU);
  }
  function hash(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  // ── 바탕 그림 ──
  /** 셀 셰이딩 적운: 그늘 톤 전체 → 빛 톤(왼쪽 위로 비켜) → 평평한 밑 그늘 */
  function cloud(c, x, y, s, puffs, tone, alpha) {
    c.save();
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.beginPath();
    c.rect(x - 10 * s, y - 10 * s, 20 * s, 10 * s + 0.62 * s);
    c.clip();
    const path = (ox, oy, k) => {
      c.beginPath();
      for (const [dx, dy, r] of puffs) {
        const cx = x + dx * s + ox;
        const cy = y + dy * s + oy;
        c.moveTo(cx + r * s * k, cy);
        c.arc(cx, cy, r * s * k, 0, TAU);
      }
    };
    path(0, 0, 1);
    c.fillStyle = tone.shade;
    c.fill();
    c.clip();
    path(0.1 * s, -0.17 * s, 0.93);
    c.fillStyle = tone.lit;
    c.fill();
    // 밑 그늘
    c.fillStyle = tone.deep;
    c.fillRect(x - 10 * s, y + 0.36 * s, 20 * s, s);
    c.restore();
  }
  const CLOUD_HI = { lit: '#FFFFFF', shade: '#CAD9F4', deep: '#AFC4EC' };
  const CLOUD_FAR = { lit: '#F2F7FF', shade: '#C4D6F3', deep: '#AEC6EE' };

  function tower(c, x, baseY, w, h, roofH) {
    // 먼 탑 (대기 원근: 옅은 파랑)
    c.fillStyle = '#9DBBE6';
    c.fillRect(x - w / 2, baseY - h, w, h);
    c.fillStyle = '#BCD3F2';
    c.fillRect(x, baseY - h, w / 2, h);
    // 창
    c.fillStyle = '#7B9BD0';
    for (let i = 0; i < 3; i++) {
      const wy = baseY - h + 14 + i * 22;
      if (wy > baseY - 12) break;
      roundRect(c, x - 2, wy, 4, 8, 2);
      c.fill();
    }
    // 처마 띠
    c.fillStyle = '#C9DCF6';
    c.fillRect(x - w / 2 - 2, baseY - h - 3, w + 4, 4);
    // 뾰족 지붕
    c.fillStyle = '#4F78C2';
    c.beginPath();
    c.moveTo(x - w / 2 - 4, baseY - h - 3);
    c.lineTo(x + w / 2 + 4, baseY - h - 3);
    c.lineTo(x, baseY - h - 3 - roofH);
    c.closePath();
    c.fill();
    c.fillStyle = '#7CA0DD';
    c.beginPath();
    c.moveTo(x, baseY - h - 3);
    c.lineTo(x + w / 2 + 4, baseY - h - 3);
    c.lineTo(x, baseY - h - 3 - roofH);
    c.closePath();
    c.fill();
    // 깃발
    const ty = baseY - h - 3 - roofH;
    c.strokeStyle = '#6F8FC6';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, ty);
    c.lineTo(x, ty - 12);
    c.stroke();
    c.fillStyle = '#E9B949';
    c.beginPath();
    c.moveTo(x, ty - 12);
    c.lineTo(x + 10, ty - 9.5);
    c.lineTo(x, ty - 7);
    c.closePath();
    c.fill();
  }

  /** 성벽 위 통로 (판 y 446 ~ 576): 바탕과 아래 띠가 같은 그림을 나눠 쓴다 */
  function floorSprite() {
    return sprite('anime-floor', W, 130, (c, w, h) => {
      const top = LINE_Y;
      const Y = (y) => y - top;
      // 갓돌 (성벽 꼭대기 앞면)
      c.fillStyle = '#D9D0C0';
      c.fillRect(0, 0, w, 7);
      c.fillStyle = '#FFFDF6';
      c.fillRect(0, 0, w, 1.2);
      c.fillStyle = '#9D927F';
      c.fillRect(0, 6, w, 1);
      // 바닥
      const g = c.createLinearGradient(0, 7, 0, h);
      g.addColorStop(0, '#ECE6DA');
      g.addColorStop(1, '#D9D1C3');
      c.fillStyle = g;
      c.fillRect(0, 7, w, h - 7);
      // 성가퀴 그늘 (해가 성벽 너머 → 그늘이 이쪽으로, 틈으로 빛이 든다)
      c.fillStyle = 'rgba(150,140,175,0.2)';
      c.fillRect(0, 7, w, 20);
      c.fillStyle = '#ECE6DA';
      for (let mx = -6; mx < w + 44; mx += 44) {
        const g0 = mx + 28;
        const g1 = mx + 44;
        c.beginPath();
        c.moveTo(g0, 7);
        c.lineTo(g1, 7);
        c.lineTo(g1 - 12, 27);
        c.lineTo(g0 - 12, 27);
        c.closePath();
        c.fill();
      }
      // 돌 이음 (원근)
      const vx = w / 2;
      const vy = Y(150);
      c.strokeStyle = 'rgba(128,114,92,0.32)';
      c.lineWidth = 1;
      for (const yy of [462, 478, 498, 522, 550, 582]) {
        c.beginPath();
        c.moveTo(0, Y(yy));
        c.lineTo(w, Y(yy));
        c.stroke();
      }
      for (let i = -9; i <= 9; i++) {
        const x0 = vx + i * 26;
        const y0 = 7;
        const k = (h - vy) / (y0 - vy);
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(vx + (x0 - vx) * k, h);
        c.stroke();
      }
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      for (const yy of [462, 478, 498, 522, 550, 582]) {
        c.beginPath();
        c.moveTo(0, Y(yy) + 1);
        c.lineTo(w, Y(yy) + 1);
        c.stroke();
      }
      // 가운데 옅은 빛
      const rg = c.createRadialGradient(w / 2, 40, 10, w / 2, 40, 200);
      rg.addColorStop(0, 'rgba(255,250,235,0.35)');
      rg.addColorStop(1, 'rgba(255,250,235,0)');
      c.fillStyle = rg;
      c.fillRect(0, 7, w, h - 7);
    });
  }

  /** 해 빛 (오른쪽 위 바깥): 판과 HUD 가 같은 자리로 이어 그린다 */
  function sun(c, x, y) {
    const sg = c.createRadialGradient(x, y, 4, x, y, 280);
    sg.addColorStop(0, 'rgba(255,255,250,0.95)');
    sg.addColorStop(0.1, 'rgba(255,250,228,0.6)');
    sg.addColorStop(0.38, 'rgba(255,242,205,0.14)');
    sg.addColorStop(1, 'rgba(255,240,200,0)');
    c.fillStyle = sg;
    c.fillRect(x - 280, Math.max(y - 280, -64), 560, 560);
  }

  function drawBg(c) {
    const R = seeded(7);
    // 하늘
    const g = c.createLinearGradient(0, 0, 0, LINE_Y);
    g.addColorStop(0, SKY0);
    g.addColorStop(0.38, '#2E77DA');
    g.addColorStop(0.7, '#4D93E5');
    g.addColorStop(1, '#74B0EE');
    c.fillStyle = g;
    c.fillRect(0, 0, W, FH);
    // 해 (오른쪽 위, HUD 와 이어짐)
    sun(c, 334, -64);
    // 햇살 (가는 빛기둥)
    c.save();
    c.translate(334, -64);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.55 + i * 0.13 + R() * 0.05;
      const wA = 0.025 + R() * 0.03;
      c.fillStyle = `rgba(255,255,255,${0.05 + R() * 0.05})`;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a - wA) * 620, Math.sin(a - wA) * 620);
      c.lineTo(Math.cos(a + wA) * 620, Math.sin(a + wA) * 620);
      c.closePath();
      c.fill();
    }
    c.restore();
    // 새털구름
    c.fillStyle = 'rgba(255,255,255,0.22)';
    for (const [x, y, w] of [
      [70, 34, 90],
      [150, 58, 70],
      [250, 96, 110],
      [40, 112, 60],
    ]) {
      ell(c, x, y, w / 2, 2.4);
      c.fill();
      ell(c, x + w * 0.2, y + 5, w / 3, 1.6);
      c.fill();
    }
    // 큰 적운 (가장자리에: 가운데 판은 비운다)
    cloud(c, 22, 336, 44, [[0, 0, 0.7], [0.7, 0.15, 0.55], [-0.6, 0.2, 0.5], [0.25, -0.6, 0.55], [-0.3, -1.05, 0.45], [0.35, -1.35, 0.38], [1.2, 0.3, 0.38]], CLOUD_HI, 0.97);
    cloud(c, 342, 246, 40, [[0, 0, 0.66], [-0.75, 0.18, 0.5], [0.6, 0.12, 0.5], [-0.2, -0.62, 0.5], [0.3, -1.0, 0.42], [-1.35, 0.32, 0.36]], CLOUD_HI, 0.95);
    cloud(c, 226, 300, 13, [[0, 0, 0.7], [0.8, 0.2, 0.5], [-0.8, 0.22, 0.48], [0.2, -0.5, 0.5]], CLOUD_FAR, 0.55);
    // 먼 탑
    tower(c, 28, LINE_Y, 24, 92, 32);
    tower(c, 336, LINE_Y, 20, 66, 26);
    // 지평 구름 바다
    const puffs = [];
    for (let x = -20; x < W + 30; x += 22 + R() * 14) puffs.push([(x - W / 2) / 30, R() * 0.25, 0.45 + R() * 0.35]);
    cloud(c, W / 2, 420, 30, puffs, CLOUD_FAR, 0.95);
    // 성가퀴 (성벽 위 이 모양: 해를 등져 안쪽 면은 그늘, 윗면은 밝게)
    c.save();
    c.lineJoin = 'round';
    c.fillStyle = '#D3C8B6';
    c.fillRect(0, LINE_Y - 7, W, 7);
    c.strokeStyle = '#857A67';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, LINE_Y - 7.5);
    c.lineTo(W, LINE_Y - 7.5);
    c.stroke();
    for (let mx = -6; mx < W; mx += 44) {
      const top = LINE_Y - 20;
      c.fillStyle = '#D9CFBD';
      c.fillRect(mx, top, 28, 20);
      c.fillStyle = '#C6BAA6';
      c.fillRect(mx + 21, top, 7, 20);
      c.fillStyle = '#FFFBF1';
      c.fillRect(mx, top, 28, 3);
      c.strokeStyle = '#857A67';
      c.strokeRect(mx + 0.5, top + 0.5, 27, 20);
    }
    c.restore();
    // 통로
    const fl = floorSprite();
    c.drawImage(fl, 0, 0, fl.width, (FH - LINE_Y) * 3, 0, LINE_Y, W, FH - LINE_Y);
  }

  // ── 적: 검보라 결정 괴수 (스프라이트) ──
  const SH = {
    normal: {
      ext: 1.6,
      lw: 0.17,
      back: [
        [[-0.36, -0.76], [-0.98, -1.42], [-0.1, -0.9]],
        [[-0.7, -0.3], [-1.42, 0.32], [-0.74, 0.42]],
      ],
      backLit: [[[-0.98, -1.42], [-0.1, -0.9], [-0.34, -0.8]]],
      body: [[0, -0.95], [0.64, -0.58], [0.84, 0.06], [0.4, 0.84], [0, 1.28], [-0.4, 0.84], [-0.84, 0.06], [-0.64, -0.58]],
      shade: [[0, -0.95], [-0.06, 0.05], [0.4, 0.84], [0, 1.28], [-0.4, 0.84], [-0.84, 0.06], [-0.64, -0.58]],
      lit: [[0, -0.95], [0.64, -0.58], [0.48, -0.16], [0.06, -0.34]],
      facets: [[[0, -0.95], [-0.06, 0.05], [0.4, 0.84]], [[-0.06, 0.05], [-0.84, 0.06]]],
      eyes: [[[-0.48, -0.06], [-0.12, 0.1], [-0.42, 0.18]]],
      spec: [[0.14, -0.8], [0.48, -0.58]],
    },
    charge: {
      ext: 1.9,
      lw: 0.17,
      back: [[[-0.5, -0.4], [-1.15, -0.95], [-0.7, 0.05]]],
      backLit: [],
      body: [[0, 1.78], [0.62, 0.3], [0.9, -0.62], [0.34, -0.38], [0, -1.0], [-0.34, -0.38], [-0.9, -0.62], [-0.62, 0.3]],
      shade: [[0, -1.0], [-0.34, -0.38], [-0.9, -0.62], [-0.62, 0.3], [0, 1.78], [0.06, 0.18]],
      lit: [[0, -1.0], [0.34, -0.38], [0.9, -0.62], [0.5, -0.06], [0.08, 0.0]],
      facets: [[[0, -1.0], [0.06, 0.18], [0, 1.78]]],
      eyes: [[[-0.3, 0.26], [0.3, 0.26], [0, 0.66]]],
      mirrorEyes: false,
      spec: [[0.12, -0.82], [0.46, -0.48]],
    },
    armor: {
      ext: 1.7,
      lw: 0.15,
      back: [[[-0.7, -0.66], [-1.45, -1.08], [-1.02, -0.18]]],
      backLit: [[[-1.45, -1.08], [-0.7, -0.66], [-0.9, -0.5]]],
      body: [[0, -1.0], [0.88, -0.62], [1.06, 0.3], [0.56, 0.98], [-0.56, 0.98], [-1.06, 0.3], [-0.88, -0.62]],
      shade: [[0, -1.0], [-0.88, -0.62], [-1.06, 0.3], [-0.56, 0.98], [0.1, 0.98], [0.0, -0.2]],
      lit: [[0, -1.0], [0.88, -0.62], [0.66, -0.42], [0.02, -0.68]],
      plate: [[0, -0.62], [0.56, -0.38], [0.66, 0.2], [0.34, 0.62], [-0.34, 0.62], [-0.66, 0.2], [-0.56, -0.38]],
      facets: [],
      eyes: [[[-0.46, -0.04], [0.46, -0.04], [0.34, 0.14], [-0.34, 0.14]]],
      mirrorEyes: false,
      spec: [[0.12, -0.86], [0.66, -0.56]],
    },
    boss: {
      ext: 2.08,
      lw: 0.11,
      back: [
        [[-0.78, -0.32], [-1.8, -1.0], [-1.52, -0.22], [-1.96, 0.36], [-1.24, 0.3], [-0.9, 0.52]],
        [[-0.6, -0.55], [-0.62, -1.02], [-0.36, -0.7]],
        [[-0.34, -0.62], [-0.3, -1.3], [-0.12, -0.74]],
        [[-0.12, -0.74], [0, -1.62], [0.12, -0.74]],
      ],
      backLit: [[[-1.8, -1.0], [-1.52, -0.22], [-1.1, -0.36], [-0.78, -0.32]]],
      body: [[0, -0.82], [0.7, -0.5], [0.98, 0.16], [0.52, 0.9], [0, 1.22], [-0.52, 0.9], [-0.98, 0.16], [-0.7, -0.5]],
      shade: [[0, -0.82], [-0.06, 0.1], [0.52, 0.9], [0, 1.22], [-0.52, 0.9], [-0.98, 0.16], [-0.7, -0.5]],
      lit: [[0, -0.82], [0.7, -0.5], [0.56, -0.1], [0.06, -0.3]],
      facets: [[[-0.06, 0.1], [-0.98, 0.16]], [[-0.06, 0.1], [0.98, 0.16]]],
      eyes: [[[-0.52, -0.24], [-0.14, -0.1], [-0.46, -0.02]]],
      spec: [[0.14, -0.7], [0.56, -0.46]],
      core: true,
    },
  };
  function poly(c, pts, r, mir) {
    c.beginPath();
    pts.forEach(([x, y], i) => {
      const X = (mir ? -x : x) * r;
      const Y = y * r;
      i ? c.lineTo(X, Y) : c.moveTo(X, Y);
    });
    c.closePath();
  }
  function drawBeast(c, kind, r) {
    const S = SH[kind];
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = INK;
    c.lineWidth = Math.max(1.4, S.lw * r);
    // 뒤 조각 (뿔 · 팔 · 날개 · 왕관) 좌우
    for (const m of [false, true]) {
      for (const p of S.back) {
        poly(c, p, r, m);
        c.fillStyle = CR.dark;
        c.fill();
        c.stroke();
      }
      for (const p of S.backLit) {
        poly(c, p, r, m);
        c.fillStyle = m ? CR.lite : CR.base;
        c.fill();
      }
      for (const p of S.back) {
        poly(c, p, r, m);
        c.stroke();
      }
    }
    // 몸
    poly(c, S.body, r);
    c.fillStyle = CR.base;
    c.fill();
    c.save();
    poly(c, S.body, r);
    c.clip();
    poly(c, S.shade, r);
    c.fillStyle = CR.dark;
    c.fill();
    poly(c, S.lit, r);
    c.fillStyle = CR.lite;
    c.fill();
    c.strokeStyle = 'rgba(20,10,38,0.55)';
    c.lineWidth = Math.max(0.7, r * 0.05);
    for (const f of S.facets) {
      c.beginPath();
      f.forEach(([x, y], i) => (i ? c.lineTo(x * r, y * r) : c.moveTo(x * r, y * r)));
      c.stroke();
    }
    c.restore();
    if (S.plate) {
      poly(c, S.plate, r);
      c.fillStyle = CR.plate;
      c.fill();
      c.strokeStyle = CR.rim;
      c.lineWidth = r * 0.07;
      c.stroke();
      c.save();
      poly(c, S.plate, r);
      c.clip();
      c.fillStyle = 'rgba(20,10,40,0.35)';
      c.fillRect(-r, -r, r, 2 * r);
      c.restore();
    }
    poly(c, S.body, r);
    c.strokeStyle = INK;
    c.lineWidth = Math.max(1.4, S.lw * r);
    c.stroke();
    // 반짝 선
    c.strokeStyle = CR.spec;
    c.lineWidth = Math.max(0.8, r * 0.07);
    c.beginPath();
    c.moveTo(S.spec[0][0] * r, S.spec[0][1] * r);
    c.lineTo(S.spec[1][0] * r, S.spec[1][1] * r);
    c.stroke();
    // 눈
    for (const m of S.mirrorEyes === false ? [false] : [false, true]) {
      for (const p of S.eyes) {
        poly(c, p, r, m);
        c.fillStyle = CR.eye;
        c.fill();
        c.strokeStyle = INK;
        c.lineWidth = Math.max(0.6, r * 0.04);
        c.stroke();
      }
    }
    if (S.core) {
      const cp = [[0, 0.14], [0.17, 0.4], [0, 0.66], [-0.17, 0.4]];
      poly(c, cp, r);
      c.fillStyle = CR.eye;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = r * 0.05;
      c.stroke();
      poly(c, [[0, 0.2], [0.08, 0.36], [0, 0.44], [-0.08, 0.36]], r);
      c.fillStyle = CR.hot;
      c.fill();
    }
  }
  function beastSprite(kind, r, white) {
    const S = SH[kind];
    const side = Math.ceil(2 * S.ext * r + 8);
    return sprite(`anime-en-${kind}-${r}${white ? '-w' : ''}`, side, side, (c, w, h) => {
      c.translate(w / 2, h / 2);
      drawBeast(c, kind, r);
      if (white) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalCompositeOperation = 'source-in';
        c.fillStyle = '#FFFFFF';
        c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      }
    });
  }

  // 흘러가는 조각구름 (하늘 위 움직임)
  function wispSprite() {
    return sprite('anime-wisp', 130, 34, (c) => {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [x, y, rx, ry] of [
        [46, 20, 30, 9],
        [72, 16, 24, 10],
        [94, 21, 26, 7],
        [26, 23, 18, 6],
      ]) {
        ell(c, x, y, rx, ry);
        c.fill();
      }
      c.fillStyle = 'rgba(200,218,246,0.9)';
      c.fillRect(0, 24, 130, 10);
    });
  }

  CX.defineTheme('anime', {
    name: '맑은 하늘 액션',
    desc: '파란 하늘 · 적운 · 성벽 위 포대 · 셀 셰이딩 결정 괴수 · 흰 유리 UI',
    fonts: ['Oswald', 'Noto Sans KR'],

    bg(scale) {
      return bgCanvas(scale, (c) => drawBg(c));
    },

    sky(c, t) {
      // 조각구름 둘이 천천히 흐른다
      const ws = wispSprite();
      c.save();
      c.globalAlpha = 0.5;
      for (const [y, sp, off, s] of [
        [70, 5, 0, 0.9],
        [262, 3.4, 230, 0.7],
      ]) {
        const x = ((t * sp + off) % (W + 160)) - 140;
        c.drawImage(ws, x, y, 130 * s, 34 * s);
      }
      c.restore();
      // 판 아래 남는 띠도 같은 바닥으로
      const fl = floorSprite();
      c.drawImage(fl, 0, (FH - LINE_Y) * 3, fl.width, STRIP * 3, 0, FH, W, STRIP);
    },

    enemy(c, e, t) {
      if (!e.alive && e.flash <= 0) return;
      const kind = e.boss ? 'boss' : e.type;
      const r = e.r;
      const spr = beastSprite(kind, r, false);
      const side = spr.width / 3;
      c.save();
      c.translate(e.x, e.y + Math.sin(t * 3 + e.ph) * 1.1);
      if (kind === 'normal') c.rotate(Math.sin(t * 2.2 + e.ph) * 0.06);
      // 돌진: 뒤로 속도선
      if (kind === 'charge' && e.alive) {
        c.strokeStyle = 'rgba(255,255,255,0.75)';
        c.lineWidth = 1.2;
        c.beginPath();
        for (let i = 0; i < 3; i++) {
          const lx = (i - 1) * r * 0.5;
          const L = r * (1.8 + ((t * 7 + i * 0.37 + e.ph) % 1) * 1.4);
          c.moveTo(lx, -r * 1.15);
          c.lineTo(lx, -r * 1.15 - L);
        }
        c.stroke();
      }
      if (e.alive) {
        c.drawImage(spr, -side / 2, -side / 2, side, side);
        if (kind === 'boss') {
          const p = 0.5 + Math.sin(t * 5) * 0.5;
          const rg = c.createRadialGradient(0, r * 0.4, 0, 0, r * 0.4, r * 0.55);
          rg.addColorStop(0, `rgba(255,200,235,${0.55 + p * 0.35})`);
          rg.addColorStop(1, 'rgba(255,79,176,0)');
          c.fillStyle = rg;
          c.beginPath();
          c.arc(0, r * 0.4, r * 0.55, 0, TAU);
          c.fill();
        }
        if (e.slow > 0) {
          c.strokeStyle = 'rgba(214,248,255,0.95)';
          c.lineWidth = 1.4;
          c.beginPath();
          c.arc(0, 0, r * 1.3, 0, TAU);
          c.stroke();
          c.fillStyle = '#E4FBFF';
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + 0.6;
            twinkle(c, Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, 3.2);
            c.fill();
          }
        }
      }
      if (e.flash > 0) {
        const w = beastSprite(kind, r, true);
        const k = e.flash / 0.12;
        c.globalAlpha = e.alive ? k * 0.9 : k;
        const g = e.alive ? 1 : 1 + (1 - k) * 0.35;
        c.drawImage(w, (-side / 2) * g, (-side / 2) * g, side * g, side * g);
        c.globalAlpha = 1;
      }
      // 체력 띠 (군주 · 다친 중장)
      if (e.alive && (e.boss || (e.type === 'armor' && e.hp < e.max))) {
        const bw = e.boss ? r * 2.3 : r * 1.7;
        const by = r * (e.boss ? 1.5 : 1.35);
        const k = clamp(e.hp / e.max, 0, 1);
        c.fillStyle = e.boss ? 'rgba(20,16,48,0.75)' : 'rgba(20,16,48,0.4)';
        roundRect(c, -bw / 2 - 1, by - 1, bw + 2, e.boss ? 6 : 4, 2.5);
        c.fill();
        c.fillStyle = e.boss ? '#FF4F8E' : 'rgba(255,150,190,0.85)';
        roundRect(c, -bw / 2, by, Math.max(2, bw * k), e.boss ? 4 : 2, 1.5);
        c.fill();
      }
      c.restore();
    },

    boom(c, b) {
      const k = b.age / 0.55;
      c.save();
      c.lineJoin = 'round';
      if (b.leak) {
        // 결계에 부딪힘: 붉은 별 + 위로 퍼지는 반원
        const a = 1 - k;
        c.globalAlpha = a;
        c.fillStyle = '#FF4D6D';
        star5(c, b.x, b.y, 9 + k * 10, hash(b.x, 1) * TAU);
        c.fill();
        c.fillStyle = '#FFFFFF';
        star5(c, b.x, b.y, (9 + k * 10) * 0.45, hash(b.x, 1) * TAU);
        c.fill();
        c.strokeStyle = '#FF4D6D';
        c.lineWidth = 2.4 * a;
        c.beginPath();
        c.ellipse(b.x, b.y, 10 + k * 30, 5 + k * 12, 0, Math.PI, TAU);
        c.stroke();
        c.restore();
        return;
      }
      const R = b.r * (b.big ? 1.12 : 0.95);
      const rot = hash(b.x, b.y) * TAU;
      // 첫 순간 흰 원
      if (k < 0.16) {
        c.fillStyle = `rgba(255,255,255,${0.9 * (1 - k / 0.16)})`;
        c.beginPath();
        c.arc(b.x, b.y, R * (0.5 + k * 3), 0, TAU);
        c.fill();
      }
      // 고리
      c.strokeStyle = `rgba(255,255,255,${0.95 * (1 - k)})`;
      c.lineWidth = 3.2 * (1 - k) + 0.4;
      c.beginPath();
      c.arc(b.x, b.y, R * (0.45 + ease(k) * 0.95), 0, TAU);
      c.stroke();
      // 속도선 (바깥으로 뻗는 쐐기)
      const n = b.big ? 12 : 9;
      const r0 = R * (0.55 + ease(k) * 0.75);
      const r1 = R * (0.95 + ease(k) * 1.15);
      c.fillStyle = `rgba(255,255,255,${0.95 * (1 - k)})`;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU + (hash(i, b.x) - 0.5) * 0.3;
        const wd = 0.05 * (1 - k * 0.6);
        const rr1 = r1 * (0.8 + hash(b.y, i) * 0.4);
        c.moveTo(b.x + Math.cos(a - wd) * r0, b.y + Math.sin(a - wd) * r0);
        c.lineTo(b.x + Math.cos(a) * rr1, b.y + Math.sin(a) * rr1);
        c.lineTo(b.x + Math.cos(a + wd) * r0, b.y + Math.sin(a + wd) * r0);
        c.closePath();
      }
      c.fill();
      // 별 (커졌다가 작아지며 사라짐)
      const grow = ease(Math.min(1, k / 0.22));
      const shrink = k < 0.3 ? 1 : 1 - ease((k - 0.3) / 0.7);
      const sr = R * (0.45 + 0.6 * grow) * shrink;
      if (sr > 0.5) {
        const pts = b.big ? 10 : 8;
        const spike = (rr, inner) => {
          c.beginPath();
          for (let i = 0; i < pts * 2; i++) {
            const a = rot + (i / (pts * 2)) * TAU;
            const j = i % 2 ? inner : 0.75 + hash(i, b.y) * 0.25;
            const px = b.x + Math.cos(a) * rr * j;
            const py = b.y + Math.sin(a) * rr * j;
            i ? c.lineTo(px, py) : c.moveTo(px, py);
          }
          c.closePath();
        };
        spike(sr, 0.42);
        c.fillStyle = b.big ? '#FFB01F' : '#FFD23D';
        c.fill();
        c.strokeStyle = b.big ? '#E8590C' : '#F59F00';
        c.lineWidth = 1.2;
        c.stroke();
        spike(sr * 0.66, 0.46);
        c.fillStyle = '#FFFBEA';
        c.fill();
      }
      c.restore();
    },

    seam(c, s) {
      const k = s.age / 0.3;
      const mx = (s.x1 + s.x2) / 2 + (s.y2 - s.y1) * 0.12;
      const my = (s.y1 + s.y2) / 2 - (s.x2 - s.x1) * 0.12;
      c.save();
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.quadraticCurveTo(mx, my, s.x2, s.y2);
      c.strokeStyle = `rgba(255,196,40,${0.9 * (1 - k)})`;
      c.lineWidth = 3.4 * (1 - k * 0.5);
      c.stroke();
      c.strokeStyle = `rgba(255,255,255,${1 - k})`;
      c.lineWidth = 1.3;
      c.stroke();
      // 줄을 타고 가는 반짝임
      const u = ease(Math.min(1, k * 2.6));
      const px = (1 - u) * (1 - u) * s.x1 + 2 * (1 - u) * u * mx + u * u * s.x2;
      const py = (1 - u) * (1 - u) * s.y1 + 2 * (1 - u) * u * my + u * u * s.y2;
      c.fillStyle = `rgba(255,255,255,${1 - k})`;
      twinkle(c, px, py, 6 * (1 - k * 0.6));
      c.fill();
      c.restore();
    },

    num(c, n) {
      const a = n.age > 0.5 ? 1 - (n.age - 0.5) / 0.3 : 1;
      const pop = n.age < 0.1 ? 1 + (1 - n.age / 0.1) * 0.55 : 1;
      const size = n.kind === 2 ? 21 : n.kind === 1 ? 16 : 13;
      const s = String(n.v);
      c.save();
      c.globalAlpha = clamp(a, 0, 1);
      c.translate(n.x, n.y);
      c.scale(pop, pop);
      c.transform(1, 0, -0.18, 1, 0, 0);
      c.font = `700 ${size}px ${NUM}`;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.lineJoin = 'round';
      c.lineWidth = size > 15 ? 4.2 : 3.2;
      c.strokeStyle = 'rgba(18,22,58,0.92)';
      c.strokeText(s, 0, 0);
      if (n.kind === 2) {
        const g = c.createLinearGradient(0, -size * 0.8, 0, 0);
        g.addColorStop(0, '#FFF7C8');
        g.addColorStop(1, '#FF9A1F');
        c.fillStyle = g;
      } else c.fillStyle = n.kind === 1 ? '#FFE066' : '#FFFFFF';
      c.fillText(s, 0, 0);
      c.restore();
    },

    line(c, t) {
      c.save();
      // 결계 막: 성가퀴 위로 옅게 피어오름
      const g = c.createLinearGradient(0, LINE_Y - 46, 0, LINE_Y);
      g.addColorStop(0, 'rgba(160,236,255,0)');
      g.addColorStop(1, 'rgba(160,236,255,0.34)');
      c.fillStyle = g;
      c.fillRect(0, LINE_Y - 46, W, 46);
      // 결계 선
      c.fillStyle = 'rgba(120,220,255,0.45)';
      c.fillRect(0, LINE_Y - 2.5, W, 5);
      c.fillStyle = '#FFFFFF';
      c.fillRect(0, LINE_Y - 0.9, W, 1.8);
      // 지나가는 빛
      const sx = ((t * 110) % (W + 160)) - 80;
      const sg = c.createLinearGradient(sx - 60, 0, sx + 60, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = sg;
      c.fillRect(sx - 60, LINE_Y - 3, 120, 6);
      // 피어오르는 반짝임
      c.fillStyle = '#FFFFFF';
      for (let i = 0; i < 7; i++) {
        const ph = (t * 0.55 + i * 0.37) % 1;
        const x = 26 + i * 51 + Math.sin(t + i) * 6;
        c.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
        twinkle(c, x, LINE_Y - 4 - ph * 30, 3.4 * (1 - ph * 0.5));
        c.fill();
      }
      c.restore();
    },

    chain(c, n, since) {
      const pop = 1 + 0.4 * Math.max(0, 1 - since / 0.16);
      const a = since > 0.8 ? 1 - (since - 0.8) / 0.3 : 1;
      const hi = n >= 10;
      c.save();
      c.globalAlpha = clamp(a, 0, 1);
      c.translate(W - 22, 158);
      c.scale(pop, pop);
      // 띠: "CHAIN 연쇄"
      c.save();
      c.transform(1, 0, -0.25, 1, 0, 0);
      const rg = c.createLinearGradient(-120, 0, 0, 0);
      rg.addColorStop(0, hi ? 'rgba(242,170,40,0)' : 'rgba(47,111,228,0)');
      rg.addColorStop(0.35, hi ? '#F2AA28' : BLUE);
      rg.addColorStop(1, hi ? '#E07B00' : BLUE_D);
      c.fillStyle = rg;
      c.fillRect(-118, -66, 122, 18);
      c.restore();
      c.textAlign = 'right';
      c.textBaseline = 'middle';
      c.fillStyle = '#FFFFFF';
      c.font = `900 12px ${KR}`;
      const kw = c.measureText('연쇄').width;
      slant(c, '연쇄', -10, -57, -0.2);
      c.font = `700 11px ${NUM}`;
      spacing(c, '2px');
      slant(c, 'CHAIN', -10 - kw - 6, -56.5, -0.2);
      spacing(c, '0px');
      // 숫자
      const s = String(n);
      c.textBaseline = 'alphabetic';
      c.font = `700 56px ${NUM}`;
      c.lineJoin = 'round';
      c.fillStyle = 'rgba(12,28,84,0.45)';
      slant(c, s, 3, 5, -0.2);
      c.lineWidth = 6;
      c.strokeStyle = NAVY;
      const g = c.createLinearGradient(0, -44, 0, 0);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(1, hi ? '#FFC93C' : '#A9D4FF');
      c.fillStyle = g;
      slant(c, s, 0, 0, -0.2, true);
      // 속도선
      const tw = c.measureText(s).width;
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i < 3; i++) {
        const y = -34 + i * 11;
        const x0 = -tw - 12 - i * 5;
        c.moveTo(x0, y);
        c.lineTo(x0 - 20 + i * 4, y);
      }
      c.stroke();
      c.restore();
    },

    // ── 무기 받침: 남색 원판 + 연금 테 + 세계 색 고리 (밝은 돌바닥 위에서 무기가 또렷하게) ──
    base(c, w, x, y, s, t) {
      const col = mainCol(w.world);
      const cy = y + s * 0.3;
      const rx = s * 0.5;
      const ry = s * 0.17;
      const th = s * 0.09;
      // 바닥 그림자
      c.fillStyle = 'rgba(40,40,90,0.22)';
      ell(c, x + 2, cy + th + 2, rx * 1.08, ry * 1.2);
      c.fill();
      // 옆면
      c.fillStyle = '#111A3C';
      ell(c, x, cy + th, rx, ry);
      c.fill();
      c.fillRect(x - rx, cy, rx * 2, th);
      // 윗면
      const g = c.createLinearGradient(0, cy - ry, 0, cy + ry);
      g.addColorStop(0, '#2E4A90');
      g.addColorStop(1, '#1A2958');
      c.fillStyle = g;
      ell(c, x, cy, rx, ry);
      c.fill();
      c.strokeStyle = GOLD_L;
      c.lineWidth = 1.1;
      c.stroke();
      // 세계 색 빛
      const rg = c.createRadialGradient(x, cy, 0, x, cy, rx * 0.8);
      rg.addColorStop(0, col);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.35;
      c.fillStyle = rg;
      ell(c, x, cy, rx * 0.8, ry * 0.8);
      c.fill();
      c.globalAlpha = 1;
      // 도는 고리
      c.strokeStyle = col;
      c.lineWidth = 1.3;
      c.setLineDash([s * 0.13, s * 0.06]);
      c.lineDashOffset = -t * 10;
      ell(c, x, cy, rx * 0.68, ry * 0.68);
      c.stroke();
      c.setLineDash([]);
      if (w.sub) {
        const sc = mainCol(w.subWorld);
        c.strokeStyle = sc;
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(x, cy + th * 0.5, rx * 1.06, ry * 1.15, 0, 0.15, Math.PI - 0.15);
        c.stroke();
        // 합성 표: 반짝임
        c.fillStyle = '#FFFFFF';
        twinkle(c, x + rx * 0.98, cy - ry * 0.4, 4);
        c.fill();
        if (w.world === w.subWorld) {
          // 같은 세계 = 공명: 고리가 위로 퍼진다
          const ph = (t * 0.9) % 1;
          c.globalAlpha = 0.8 * (1 - ph);
          c.strokeStyle = col;
          c.lineWidth = 1.6;
          ell(c, x, cy - ph * s * 0.4, rx * (0.9 + ph * 0.2), ry * (0.9 + ph * 0.2));
          c.stroke();
          c.globalAlpha = 1;
        }
      }
    },

    pips(c, w, x, y, s) {
      const py = y + s * 0.64;
      c.fillStyle = 'rgba(20,30,70,0.86)';
      roundRect(c, x - 19, py - 4.6, 38, 9.2, 4.6);
      c.fill();
      for (let i = 0; i < 5; i++) {
        const px = x - 14 + i * 7;
        star5(c, px, py + 0.2, 3.2, 0);
        c.fillStyle = i < w.lv ? GOLD : 'rgba(255,255,255,0.22)';
        c.fill();
      }
    },

    pop(c, p) {
      const k = p.age / 1.6;
      c.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const isNew = p.text === 'NEW';
      const text = isNew ? 'NEW' : p.text.replace('Lv ', 'LV ');
      const ty = p.w.y - GUN * 0.8 - ease(Math.min(1, p.age / 0.3)) * 14;
      const sc = p.age < 0.12 ? 0.6 + (p.age / 0.12) * 0.5 : p.age < 0.2 ? 1.1 - ((p.age - 0.12) / 0.08) * 0.1 : 1;
      c.translate(p.w.x, ty);
      c.scale(sc, sc);
      c.font = `700 11px ${NUM}`;
      spacing(c, '0.5px');
      const tw = c.measureText(text).width + (isNew ? 14 : 22);
      c.fillStyle = 'rgba(8,28,86,0.3)';
      roundRect(c, -tw / 2, -9 + 2, tw, 17, 8.5);
      c.fill();
      const g = c.createLinearGradient(0, -9, 0, 8);
      if (isNew) {
        g.addColorStop(0, '#FFE9A8');
        g.addColorStop(1, '#F2B83A');
      } else {
        g.addColorStop(0, '#5B95FF');
        g.addColorStop(1, BLUE_D);
      }
      c.fillStyle = g;
      roundRect(c, -tw / 2, -9, tw, 17, 8.5);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 1;
      c.stroke();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = isNew ? NAVY : '#FFFFFF';
      if (!isNew) {
        // 위 화살표
        c.beginPath();
        c.moveTo(-tw / 2 + 7, 2.5);
        c.lineTo(-tw / 2 + 10.5, -3);
        c.lineTo(-tw / 2 + 14, 2.5);
        c.closePath();
        c.fill();
        c.fillText(text, 5, 0.5);
      } else c.fillText(text, 0, 0.5);
      spacing(c, '0px');
    },

    hurt(c, run, k) {
      const g = c.createRadialGradient(W / 2, 250, 150, W / 2, 250, 420);
      g.addColorStop(0, 'rgba(255,50,90,0)');
      g.addColorStop(1, `rgba(255,50,90,${0.5 * k})`);
      c.fillStyle = g;
      c.fillRect(0, -run.oy, W, run.ch);
      c.fillStyle = `rgba(255,77,109,${0.85 * k})`;
      c.fillRect(0, LINE_Y - 2, W, 4);
    },

    hud(c, run) {
      const H = run.oy;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#15449F');
      g.addColorStop(1, SKY0);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      // 해 빛 (판과 이어짐)
      sun(c, 334, H - 64);
      // 목숨: 흰 패널 + 하트 + 기운 칸 다섯
      glass(c, 10, 10, 128, 28, 14);
      c.save();
      c.translate(26, 24);
      c.beginPath();
      const r = 6.5;
      c.moveTo(0, r * 0.9);
      c.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.7, -r * 1.1, 0, -r * 0.45);
      c.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.3, -r * 0.1, 0, r * 0.9);
      c.closePath();
      c.fillStyle = PINK;
      c.fill();
      c.restore();
      for (let i = 0; i < 5; i++) {
        const x0 = 40 + i * 18.5;
        c.beginPath();
        c.moveTo(x0 + 3, 18);
        c.lineTo(x0 + 17, 18);
        c.lineTo(x0 + 14, 30);
        c.lineTo(x0, 30);
        c.closePath();
        if (i < run.hearts) {
          const hg = c.createLinearGradient(0, 18, 0, 30);
          hg.addColorStop(0, '#FF7C9C');
          hg.addColorStop(1, PINK);
          c.fillStyle = hg;
        } else c.fillStyle = '#D6DDEA';
        c.fill();
      }
      // LV: 가운데 남색 알약
      const lg = c.createLinearGradient(0, 7, 0, 41);
      lg.addColorStop(0, '#2A4187');
      lg.addColorStop(1, '#17234D');
      c.fillStyle = 'rgba(8,28,86,0.3)';
      roundRect(c, 150, 9, 60, 32, 16);
      c.fill();
      c.fillStyle = lg;
      roundRect(c, 150, 7, 60, 32, 16);
      c.fill();
      c.strokeStyle = 'rgba(255,231,166,0.85)';
      c.lineWidth = 1;
      c.stroke();
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
      c.fillStyle = GOLD_L;
      c.font = `700 10px ${NUM}`;
      spacing(c, '1px');
      slant(c, 'LV', 162, 30, -0.18);
      spacing(c, '0px');
      c.fillStyle = '#FFFFFF';
      c.font = `700 22px ${NUM}`;
      c.textAlign = 'center';
      slant(c, String(run.level), 189, 32, -0.18);
      // 웨이브: 흰 패널 + 군주까지 다섯 칸
      glass(c, 222, 10, 128, 28, 14);
      c.textAlign = 'left';
      c.fillStyle = SLATE;
      c.font = `700 10px ${NUM}`;
      spacing(c, '1.5px');
      slant(c, 'WAVE', 236, 29, -0.18);
      spacing(c, '0px');
      c.fillStyle = NAVY;
      c.font = `700 20px ${NUM}`;
      slant(c, String(run.wave), 272, 31.5, -0.18);
      const inCycle = ((run.wave - 1) % 5) + 1;
      for (let i = 0; i < 5; i++) {
        const dx = 300 + i * 9.5;
        const boss = i === 4;
        c.beginPath();
        c.moveTo(dx, 19);
        c.lineTo(dx + 3.6, 24);
        c.lineTo(dx, 29);
        c.lineTo(dx - 3.6, 24);
        c.closePath();
        c.fillStyle = i < inCycle ? (boss ? '#E0306E' : BLUE) : boss ? 'rgba(224,48,110,0.25)' : '#D6DDEA';
        c.fill();
      }
      // 경험치
      const k = clamp(run.exp / run.need, 0, 1);
      c.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(c, 10, 47, W - 20, 6, 3);
      c.fill();
      const eg = c.createLinearGradient(10, 0, W - 10, 0);
      eg.addColorStop(0, '#F2B83A');
      eg.addColorStop(1, '#FFF1C2');
      c.fillStyle = eg;
      roundRect(c, 10, 47, Math.max(6, (W - 20) * k), 6, 3);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.92)';
      c.font = `500 9px ${NUM}`;
      c.textAlign = 'right';
      spacing(c, '1px');
      c.fillText(`EXP ${run.exp}/${run.need}`, W - 10, 62);
      spacing(c, '0px');
    },

    chips(c, run) {
      const m = run.worlds();
      let y = 42;
      for (const k of ORDER) {
        if (!m[k]) continue;
        const wo = CX.wo(k);
        glass(c, 6, y, 44, 21, 10.5, 0.94);
        c.fillStyle = NAVY;
        c.beginPath();
        c.arc(17, y + 10.5, 8.6, 0, TAU);
        c.fill();
        c.strokeStyle = mainCol(k);
        c.lineWidth = 1;
        c.stroke();
        c.save();
        wo.crest(c, 17 - 6.5, y + 10.5 - 6.5, 6.5);
        c.restore();
        c.fillStyle = NAVY;
        c.font = `700 13px ${NUM}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(String(m[k]), 37.5, y + 11);
        y += 25;
      }
    },

    gate(c, run) {
      const n = run.cats().size;
      const next = CAT_TH.find((t) => t > n) || 15;
      const slots = run.fuseSlots();
      const t1 = `갈래 ${n}/${next}`;
      const t2 = `합성 칸 ${slots}`;
      c.font = `700 10.5px ${KR}`;
      const w1 = c.measureText(t1).width;
      const w2 = c.measureText(t2).width;
      const pw = w1 + w2 + 34;
      const x0 = W - 8 - pw;
      glass(c, x0, 40, pw, 24, 12, 0.95);
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = NAVY;
      c.fillText(t1, x0 + 10, 52.5);
      const cx = x0 + w1 + 16;
      if (slots > 0) {
        const g = c.createLinearGradient(0, 43, 0, 61);
        g.addColorStop(0, '#5B95FF');
        g.addColorStop(1, BLUE_D);
        c.fillStyle = g;
      } else c.fillStyle = '#E2E8F3';
      roundRect(c, cx, 43, w2 + 12, 18, 9);
      c.fill();
      c.fillStyle = slots > 0 ? '#FFFFFF' : SLATE;
      c.fillText(t2, cx + 6, 52.5);
    },

    banner(c, b, run) {
      const k = b.age / b.life;
      const inT = ease(Math.min(1, b.age / 0.22));
      const outT = b.age > b.life - 0.28 ? ease((b.age - (b.life - 0.28)) / 0.28) : 0;
      c.save();
      c.textBaseline = 'middle';
      if (b.wave) {
        const parts = b.text.split(' · ');
        const boss = parts.length > 1;
        const ox = (1 - inT) * -W + outT * W;
        const y = 138;
        c.globalAlpha = 1 - outT * 0.6;
        c.translate(W / 2 + ox, y);
        c.rotate(-0.05);
        const g = c.createLinearGradient(-W * 0.7, 0, W * 0.7, 0);
        if (boss) {
          g.addColorStop(0, 'rgba(150,16,70,0)');
          g.addColorStop(0.2, '#A3124F');
          g.addColorStop(0.8, '#E0306E');
          g.addColorStop(1, 'rgba(224,48,110,0)');
        } else {
          g.addColorStop(0, 'rgba(23,52,140,0)');
          g.addColorStop(0.2, '#183C9C');
          g.addColorStop(0.8, BLUE);
          g.addColorStop(1, 'rgba(47,111,228,0)');
        }
        c.fillStyle = g;
        c.fillRect(-W * 0.7, -22, W * 1.4, 44);
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.fillRect(-W * 0.5, -26, W, 1.5);
        c.fillRect(-W * 0.5, 24.5, W, 1.5);
        // 띠 위 속도선
        c.fillStyle = 'rgba(255,255,255,0.22)';
        for (let i = 0; i < 6; i++) {
          const lx = ((i * 83 + b.age * 420) % (W * 1.2)) - W * 0.6;
          c.fillRect(lx, -14 + (i % 3) * 12, 40 + (i % 2) * 30, 1.5);
        }
        c.fillStyle = '#FFFFFF';
        c.textAlign = 'center';
        c.font = `700 32px ${NUM}`;
        spacing(c, '3px');
        slant(c, parts[0], 0, 2, -0.2);
        spacing(c, '0px');
        if (boss) {
          const sub = (parts[1] || '').replace('균열 군주', '결정 군주') + ' 출현';
          c.rotate(0.05);
          c.font = `900 12px ${KR}`;
          const sw = c.measureText(sub).width + 24;
          glass(c, -sw / 2, 32, sw, 22, 11, 0.96);
          c.fillStyle = '#B0124F';
          c.fillText(sub, 0, 43.5);
        }
      } else {
        const a = k < 0.12 ? k / 0.12 : 1 - outT;
        const sc = 0.92 + 0.08 * inT;
        c.globalAlpha = Math.max(0, a);
        c.translate(W / 2, 150);
        c.scale(sc, sc);
        const bw = W - 56;
        glass(c, -bw / 2, -32, bw, 64, 14, 0.97);
        // 왼쪽 금 띠
        const gg = c.createLinearGradient(0, -32, 0, 32);
        gg.addColorStop(0, '#FFE08A');
        gg.addColorStop(1, '#E3A52B');
        c.fillStyle = gg;
        roundRect(c, -bw / 2, -32, 6, 64, 3);
        c.fill();
        // FUSION 꼬리표
        c.font = `700 10px ${NUM}`;
        spacing(c, '2px');
        const tg = 'FUSION';
        const tgw = c.measureText(tg).width + 16;
        c.fillStyle = gg;
        roundRect(c, -tgw / 2, -42, tgw, 17, 8.5);
        c.fill();
        c.fillStyle = NAVY;
        c.textAlign = 'center';
        c.fillText(tg, 1, -33);
        spacing(c, '0px');
        c.fillStyle = NAVY;
        c.font = `900 19px ${KR}`;
        c.fillText(b.text.replace(/^합성 · /, ''), 0, -4, bw - 40);
        c.fillStyle = SLATE;
        c.font = `500 11px ${KR}`;
        c.fillText(b.sub, 0, 18, bw - 40);
        c.fillStyle = GOLD;
        twinkle(c, bw / 2 - 16, -18, 6);
        c.fill();
        twinkle(c, bw / 2 - 28, -8, 3.5);
        c.fill();
      }
      c.restore();
    },

    offer(c, o, run) {
      const t = o.age;
      const a = Math.min(1, t / 0.2);
      c.save();
      const g = c.createLinearGradient(0, -run.oy, 0, run.ch - run.oy);
      g.addColorStop(0, `rgba(18,44,108,${0.8 * a})`);
      g.addColorStop(1, `rgba(8,16,44,${0.88 * a})`);
      c.fillStyle = g;
      c.fillRect(0, -run.oy, W, run.ch);
      // 제목 뒤 빛
      const rg = c.createRadialGradient(W / 2, 96, 0, W / 2, 96, 170);
      rg.addColorStop(0, `rgba(140,200,255,${0.32 * a})`);
      rg.addColorStop(1, 'rgba(140,200,255,0)');
      c.fillStyle = rg;
      c.fillRect(0, 0, W, 240);
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillStyle = GOLD_L;
      c.font = `700 12px ${NUM}`;
      spacing(c, '5px');
      slant(c, 'LEVEL UP', W / 2 + 2, 76, -0.18);
      spacing(c, '0px');
      c.fillStyle = '#FFFFFF';
      c.font = `900 26px ${KR}`;
      c.fillText('레벨 업', W / 2, 106);
      // 양쪽 가는 선
      c.strokeStyle = 'rgba(255,231,166,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(W / 2 - 110, 97);
      c.lineTo(W / 2 - 62, 97);
      c.moveTo(W / 2 + 62, 97);
      c.lineTo(W / 2 + 110, 97);
      c.stroke();
      c.fillStyle = GOLD_L;
      twinkle(c, W / 2 - 114, 97, 4);
      c.fill();
      twinkle(c, W / 2 + 114, 97, 4);
      c.fill();
      c.fillStyle = '#CFE0FF';
      c.font = `700 12px ${NUM}`;
      spacing(c, '1px');
      c.fillText(`LV ${o.from}  →  ${o.from + 1}`, W / 2, 128);
      spacing(c, '0px');
      c.globalAlpha = 1;
      o.cards.forEach((cd, i) => {
        const y = 140 + i * 112;
        const enter = ease(clamp((t - i * 0.08) / 0.3, 0, 1));
        const picked = o.pick === i;
        const faded = o.pick >= 0 && !picked;
        c.save();
        c.globalAlpha = enter * (faded ? 0.35 : 1);
        c.translate((1 - enter) * 60, 0);
        if (picked) {
          const s = 1 + 0.035 * Math.sin(Math.min(1, (t - o.pickAt) / 0.2) * Math.PI);
          c.translate(W / 2, y + 50);
          c.scale(s, s);
          c.translate(-W / 2, -(y + 50));
        }
        CX.th().card(c, cd, 18, y, W - 36, 100, picked, run);
        c.restore();
      });
      if (!run.auto && o.pick < 0) {
        c.fillStyle = '#E4EEFF';
        c.font = `500 11px ${KR}`;
        c.textAlign = 'center';
        c.fillText('카드를 눌러 고른다', W / 2, 140 + 3 * 112 + 4);
      }
      c.restore();
    },

    card(c, cd, x, y, w, h, picked, run) {
      const v = cd.view;
      const fuse = cd.kind === 'fuse';
      // 그림자 + 흰 면
      c.fillStyle = 'rgba(4,12,40,0.4)';
      roundRect(c, x, y + 4, w, h, 14);
      c.fill();
      const g = c.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(1, '#EAF1FB');
      c.fillStyle = g;
      roundRect(c, x, y, w, h, 14);
      c.fill();
      if (fuse) {
        const fg = c.createLinearGradient(x, y, x + w * 0.75, y + h);
        fg.addColorStop(0, 'rgba(255,214,120,0.45)');
        fg.addColorStop(1, 'rgba(255,214,120,0)');
        c.fillStyle = fg;
        roundRect(c, x, y, w, h, 14);
        c.fill();
      }
      // 테
      roundRect(c, x, y, w, h, 14);
      if (picked) {
        c.save();
        c.shadowColor = 'rgba(90,160,255,0.95)';
        c.shadowBlur = 18;
        c.strokeStyle = '#5B95FF';
        c.lineWidth = 3;
        c.stroke();
        c.restore();
      } else if (fuse) {
        const bg = c.createLinearGradient(x, y, x + w, y + h);
        bg.addColorStop(0, '#F7D57A');
        bg.addColorStop(1, '#D9962A');
        c.strokeStyle = bg;
        c.lineWidth = 2;
        c.stroke();
      } else {
        c.strokeStyle = 'rgba(255,255,255,0.9)';
        c.lineWidth = 1;
        c.stroke();
      }
      // 왼쪽 그림 칸: 남색 + 세계 색 빛 + 사선 빛
      const px = x + 8;
      const py = y + 8;
      const pw = 84;
      const ph = h - 16;
      c.save();
      roundRect(c, px, py, pw, ph, 10);
      c.clip();
      const pg = c.createLinearGradient(px, py, px, py + ph);
      pg.addColorStop(0, fuse ? '#3B2F7A' : '#2D4E9E');
      pg.addColorStop(1, fuse ? '#1B1640' : '#152752');
      c.fillStyle = pg;
      c.fillRect(px, py, pw, ph);
      const wg = c.createRadialGradient(px + pw / 2, py + ph * 0.78, 0, px + pw / 2, py + ph * 0.78, pw * 0.6);
      wg.addColorStop(0, mainCol(v.world));
      wg.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.42;
      c.fillStyle = wg;
      c.fillRect(px, py, pw, ph);
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.beginPath();
      c.moveTo(px + pw * 0.45, py);
      c.lineTo(px + pw * 0.75, py);
      c.lineTo(px + pw * 0.3, py + ph);
      c.lineTo(px, py + ph);
      c.closePath();
      c.fill();
      if (fuse) {
        c.fillStyle = 'rgba(255,214,120,0.9)';
        twinkle(c, px + pw - 12, py + 12, 5);
        c.fill();
      }
      c.restore();
      c.save();
      CX.drawGun(c, v, x + 50, y + h / 2 + 10, 50, run.t);
      c.restore();
      // 글
      const tx = x + 104;
      const tw = w - 116;
      const wn = (k) => CX.wo(k).name;
      let chip;
      let chipBg;
      let chipFg = '#FFFFFF';
      let rest;
      let extra = '';
      let name = v.name;
      let lvText = '';
      let l1;
      let l2 = '';
      if (fuse) {
        chip = '합성';
        chipBg = ['#FFE08A', '#E3A52B'];
        chipFg = NAVY;
        rest = `칸 ${run.fuseSlots()} 중 1 · 등급 ${Math.min(cd.a.lv, cd.b.lv)}`;
        l1 = `몸 ${cd.a.name} (${CX.wo(cd.a.world).short}) + 연출 ${cd.b.name} (${CX.wo(cd.b.world).short})`;
        l2 = `반응 · ${v.react}`;
      } else if (cd.kind === 'new') {
        const own = run.worlds();
        chip = '새 무기';
        chipBg = ['#5B95FF', BLUE_D];
        rest = `${wn(v.world)} · ${v.catLabel}`;
        if (!own[v.world]) extra = '새 세계';
        const left = (CAT_TH.find((tt) => tt > run.cats().size) || 15) - run.cats().size - 1;
        l1 = run.cats().has(v.cat) ? `${v.catLabel} 갈래 하나 더` : left <= 0 ? '새 갈래 · 이걸로 합성 칸이 열린다' : `새 갈래 · 합성 칸까지 갈래 ${left}`;
      } else {
        chip = '강화';
        chipBg = ['#22B39A', '#0B7A67'];
        rest = `${wn(v.world)} · ${v.catLabel}`;
        lvText = `LV ${v.lv} → ${v.lv + 1}`;
        l1 = '피해 +28% · 쿨다운 −6%';
      }
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.font = `700 10.5px ${KR}`;
      const cw = c.measureText(chip).width + 14;
      const cg = c.createLinearGradient(0, y + 13, 0, y + 30);
      cg.addColorStop(0, chipBg[0]);
      cg.addColorStop(1, chipBg[1]);
      c.fillStyle = cg;
      roundRect(c, tx, y + 13, cw, 18, 9);
      c.fill();
      c.fillStyle = chipFg;
      c.fillText(chip, tx + 7, y + 22.5);
      let rx = tx + cw + 7;
      if (extra) {
        const ew = c.measureText(extra).width + 12;
        c.strokeStyle = '#D9962A';
        c.lineWidth = 1.2;
        roundRect(c, rx, y + 13.5, ew, 17, 8.5);
        c.stroke();
        c.fillStyle = GOLD_D;
        c.fillText(extra, rx + 6, y + 22.5);
        rx += ew + 7;
      }
      c.fillStyle = SLATE;
      c.font = `500 10.5px ${KR}`;
      c.fillText(rest, rx, y + 22.5, Math.max(20, tx + tw - rx));
      c.textBaseline = 'alphabetic';
      c.fillStyle = NAVY;
      c.font = `900 18px ${KR}`;
      const nmax = lvText ? tw - 74 : tw;
      c.fillText(name, tx, y + 52, nmax);
      if (lvText) {
        const nw = Math.min(nmax, c.measureText(name).width);
        c.fillStyle = BLUE;
        c.font = `700 14px ${NUM}`;
        slant(c, lvText, tx + nw + 8, y + 51.5, -0.18);
      }
      c.fillStyle = SLATE;
      c.font = `500 11px ${KR}`;
      c.fillText(l1, tx, y + 72, tw);
      if (l2) {
        c.fillStyle = GOLD_D;
        c.font = `700 11px ${KR}`;
        c.fillText(l2, tx, y + 89, tw);
      }
      if (picked) {
        // 고름 표시
        const bx = x + w - 18;
        const by = y + 18;
        c.fillStyle = BLUE;
        c.beginPath();
        c.arc(bx, by, 10, 0, TAU);
        c.fill();
        c.strokeStyle = '#FFFFFF';
        c.lineWidth = 2.2;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();
        c.moveTo(bx - 4.5, by + 0.5);
        c.lineTo(bx - 1, by + 4);
        c.lineTo(bx + 5, by - 3.5);
        c.stroke();
        // 지나가는 빛
        const sk = clamp((run.offer ? run.offer.age - run.offer.pickAt : 1) / 0.35, 0, 1);
        if (sk < 1) {
          c.save();
          roundRect(c, x, y, w, h, 14);
          c.clip();
          const sx = x - 60 + sk * (w + 120);
          const sg = c.createLinearGradient(sx - 40, 0, sx + 40, 0);
          sg.addColorStop(0, 'rgba(255,255,255,0)');
          sg.addColorStop(0.5, 'rgba(255,255,255,0.7)');
          sg.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = sg;
          c.beginPath();
          c.moveTo(sx - 30, y);
          c.lineTo(sx + 50, y);
          c.lineTo(sx + 30, y + h);
          c.lineTo(sx - 50, y + h);
          c.closePath();
          c.fill();
          c.restore();
        }
      }
    },

    over(c, run) {
      const a = Math.min(1, run.over / 0.4);
      c.save();
      const g = c.createLinearGradient(0, -run.oy, 0, run.ch - run.oy);
      g.addColorStop(0, `rgba(18,40,100,${0.82 * a})`);
      g.addColorStop(1, `rgba(8,14,40,${0.9 * a})`);
      c.fillStyle = g;
      c.fillRect(0, -run.oy, W, run.ch);
      c.globalAlpha = a;
      // DEFEAT 띠
      c.save();
      c.translate(W / 2 - (1 - ease(Math.min(1, run.over / 0.35))) * W, 168);
      c.rotate(-0.05);
      const rg = c.createLinearGradient(-W * 0.6, 0, W * 0.6, 0);
      rg.addColorStop(0, 'rgba(160,18,70,0)');
      rg.addColorStop(0.25, '#A3124F');
      rg.addColorStop(0.75, '#E0306E');
      rg.addColorStop(1, 'rgba(224,48,110,0)');
      c.fillStyle = rg;
      c.fillRect(-W * 0.6, -15, W * 1.2, 30);
      c.fillStyle = '#FFFFFF';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `700 18px ${NUM}`;
      spacing(c, '6px');
      slant(c, 'DEFEAT', 3, 1, -0.2);
      spacing(c, '0px');
      c.restore();
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#FFFFFF';
      c.font = `900 30px ${KR}`;
      c.fillText('성벽 함락', W / 2, 226);
      // 기록 넷
      const stats = [
        ['WAVE', run.wave],
        ['LV', run.level],
        ['최고 연쇄', run.chainPeak],
        ['합성', run.fusedN],
      ];
      const tw = (W - 40 - 3 * 8) / 4;
      stats.forEach(([lab, val], i) => {
        const x = 20 + i * (tw + 8);
        glass(c, x, 248, tw, 54, 12, 0.96);
        c.fillStyle = SLATE;
        c.font = /[A-Z]/.test(lab) ? `700 10px ${NUM}` : `700 10px ${KR}`;
        c.textBaseline = 'middle';
        c.fillText(lab, x + tw / 2, 262);
        c.fillStyle = NAVY;
        c.font = `700 22px ${NUM}`;
        slant(c, String(val), x + tw / 2, 284, -0.18);
      });
      // 새 판까지
      c.fillStyle = '#DCE7FF';
      c.font = `500 12px ${KR}`;
      c.textBaseline = 'alphabetic';
      c.fillText('잠시 뒤 새 판', W / 2, 330);
      c.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(c, W / 2 - 60, 340, 120, 4, 2);
      c.fill();
      c.fillStyle = GOLD;
      roundRect(c, W / 2 - 60, 340, Math.max(4, 120 * clamp(run.over / 4, 0, 1)), 4, 2);
      c.fill();
      c.restore();
    },
  });
})();
