// 테마 orbit · 궤도 방어 (11-24): 깊은 우주 · 판 아래 행성 곡면 (방어선 = 대기권 빛 띠) · 생체기계 외계 함선 · 플라스마 번짐 · 가늘고 빛나는 선 HUD.
// 무기 연출(세계 여섯)은 그대로, 판의 틀만 바꾼다. 매 프레임 같은 그림은 bg(한 번) 또는 sprite.
(function () {
  const { W, CH, HUD, FIELD_H, GUN, CAT_TH, ORDER } = CX.runInfo;
  const { LINE_Y } = CX.size;
  const { TAU, clamp, ease, roundRect, bgCanvas, sprite } = CX.util;
  const H = FIELD_H;
  /** 연쇄 수 자리: 웨이브·합성 배너(위 110~182) 아래 */
  const CHAIN_Y = 248;
  /** 0~1 고정 난수 (폭발마다 모양이 다르게, 프레임마다는 같게) */
  const hs = (n) => {
    const v = Math.sin(n * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };

  // ── 색 · 글꼴 ──
  const UI = '#86D8FF'; // HUD 선 (전기 하늘색)
  const ICE = '#DDF3FF';
  const AMB = '#FFB54D'; // 호박 (강조 · 합성)
  const HOT = '#FF7A45';
  const RED = '#FF5A6E';
  const VEIN = '#38F2C4'; // 적 혈관 (청록)
  const INK = '#EEF6FF'; // 글자
  const MUTED = '#98B4CC'; // 작은 글자 (바탕 #050B18 위 8:1)
  const BOTTOM = '#030914'; // 행성 맨 아래 (판 밖 36px 도 이 색)
  const NUM = '"Oswald", "Noto Sans KR", sans-serif';
  const KR = '"Noto Sans KR", sans-serif';
  const ui = (a) => `rgba(134,216,255,${a})`;
  const am = (a) => `rgba(255,181,77,${a})`;
  const rgba = (hex, a) => {
    let h = String(hex || '#CFC6E8').replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const wcol = (k) => ((CX.wo(k).colors || {}).main || '#CFC6E8');

  /** 매번 같은 별자리 (bg 를 다시 그려도 같은 하늘) */
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── 행성: 아주 큰 원의 윗부분. 가운데 꼭대기 = 방어선, 양 끝은 6px 낮다 ──
  const PR = 2600;
  const PCX = W / 2;
  const PCY = LINE_Y + PR;
  const LIMB_A = Math.asin((W / 2 + 20) / PR);
  const limbY = (x) => PCY - Math.sqrt(PR * PR - (x - PCX) ** 2);
  const limbPath = (c, rr) => {
    c.beginPath();
    c.arc(PCX, PCY, rr == null ? PR : rr, -Math.PI / 2 - LIMB_A, -Math.PI / 2 + LIMB_A);
  };

  /** 둥근 번짐 한 점 */
  function blob(c, x, y, r, col, sy) {
    c.save();
    c.translate(x, y);
    c.scale(1, sy || 1);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.fill();
    c.restore();
  }

  /** 모서리 둘을 깎은 패널 (오른쪽 위 · 왼쪽 아래) */
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

  // 움직이는 하늘: 반짝이는 별 · 내려앉는 먼지 (고정 자리)
  const TW = [];
  const DUST = [];
  {
    const R = rng(91);
    for (let i = 0; i < 16; i++) TW.push({ x: 8 + R() * (W - 16), y: 10 + R() * 360, f: 0.8 + R() * 2.2, p: R() * TAU, big: R() > 0.7, warm: R() > 0.75 });
    for (let i = 0; i < 22; i++) DUST.push({ x: R() * W, y: R() * 420, v: 5 + R() * 9, a: 0.1 + R() * 0.18, s: 0.6 + R() * 0.7 });
  }

  // ── 미리 그려 두는 그림 ──
  const auroraSpr = () =>
    sprite('orbit-aurora', 40, 40, (c, w, h) => {
      const g = c.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, 'rgba(120,230,255,0.95)');
      g.addColorStop(0.3, 'rgba(70,170,255,0.45)');
      g.addColorStop(0.75, 'rgba(110,90,255,0.12)');
      g.addColorStop(1, 'rgba(110,90,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'destination-in';
      const m = c.createLinearGradient(0, 0, w, 0);
      m.addColorStop(0, 'rgba(0,0,0,0)');
      m.addColorStop(0.5, 'rgba(0,0,0,1)');
      m.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = m;
      c.fillRect(0, 0, w, h);
    });
  const glowSpr = (key, stops) =>
    sprite('orbit-glow-' + key, 64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      for (const [o, col] of stops) g.addColorStop(o, col);
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 64);
    });
  const coreSpr = () =>
    glowSpr('core', [
      [0, 'rgba(255,255,255,1)'],
      [0.16, 'rgba(255,244,220,0.95)'],
      [0.38, 'rgba(255,176,84,0.6)'],
      [0.68, 'rgba(255,110,60,0.16)'],
      [1, 'rgba(255,90,60,0)'],
    ]);
  const haloSpr = () =>
    glowSpr('halo', [
      [0, 'rgba(170,244,255,0.72)'],
      [0.4, 'rgba(80,180,255,0.32)'],
      [0.8, 'rgba(90,80,255,0.06)'],
      [1, 'rgba(90,80,255,0)'],
    ]);
  const violetSpr = () =>
    glowSpr('violet', [
      [0, 'rgba(210,190,255,0.45)'],
      [0.45, 'rgba(130,100,255,0.2)'],
      [1, 'rgba(90,60,255,0)'],
    ]);
  const redSpr = () =>
    glowSpr('red', [
      [0, 'rgba(255,230,220,0.95)'],
      [0.25, 'rgba(255,120,90,0.7)'],
      [0.6, 'rgba(255,60,90,0.22)'],
      [1, 'rgba(255,60,90,0)'],
    ]);
  const plumeSpr = () =>
    sprite('orbit-plume', 16, 40, (c, w, h) => {
      const g = c.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, 'rgba(255,245,220,1)');
      g.addColorStop(0.2, 'rgba(255,170,70,0.85)');
      g.addColorStop(0.6, 'rgba(255,90,50,0.28)');
      g.addColorStop(1, 'rgba(255,60,40,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(w * 0.18, h);
      c.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.5, 0);
      c.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.82, h);
      c.closePath();
      c.fill();
    });

  // ── 적: 생체기계 함선 (코가 아래 = 행성 쪽). 좌표는 r 단위, 오른쪽 반을 베지어로 → 왼쪽은 거울 ──
  const SHAPES = {
    normal: {
      box: 3.4,
      start: [0, 1.32],
      segs: [
        [0.3, 1.1, 0.46, 0.62, 0.55, 0.24],
        [0.86, 0.1, 1.24, -0.3, 1.45, -0.9],
        [1.15, -0.72, 0.86, -0.6, 0.6, -0.62],
        [0.5, -0.92, 0.28, -1.1, 0, -1.0],
      ],
    },
    charge: {
      box: 4.4,
      start: [0, 1.95],
      segs: [
        [0.18, 1.5, 0.42, 0.62, 0.5, 0.1],
        [0.64, -0.2, 0.95, -0.55, 1.0, -0.98],
        [0.78, -0.84, 0.55, -0.78, 0.38, -0.8],
        [0.32, -1.0, 0.18, -1.12, 0, -1.05],
      ],
    },
    armor: {
      box: 3.3,
      start: [0, 1.0],
      segs: [
        [0.14, 1.0, 0.24, 0.92, 0.3, 0.82],
        [0.4, 1.1, 0.48, 1.32, 0.52, 1.42],
        [0.74, 1.14, 0.95, 0.92, 1.08, 0.56],
        [1.26, 0.1, 1.22, -0.52, 0.95, -0.86],
        [0.7, -1.12, 0.35, -1.14, 0, -1.1],
      ],
    },
    boss: {
      box: 3.5,
      start: [0, 1.12],
      segs: [
        [0.12, 1.12, 0.22, 0.98, 0.3, 0.84],
        [0.45, 1.04, 0.62, 1.3, 0.72, 1.44],
        [0.8, 1.15, 0.95, 0.9, 1.05, 0.68],
        [1.3, 0.62, 1.5, 0.48, 1.64, 0.2],
        [1.42, 0.12, 1.3, 0.05, 1.22, -0.05],
        [1.38, -0.2, 1.45, -0.42, 1.5, -0.64],
        [1.25, -0.6, 1.1, -0.6, 0.95, -0.66],
        [0.8, -0.95, 0.45, -1.12, 0, -1.08],
      ],
    },
  };
  function hullPath(c, kind) {
    const S = SHAPES[kind];
    const st = S.start;
    const segs = S.segs;
    c.beginPath();
    c.moveTo(st[0], st[1]);
    for (const s of segs) c.bezierCurveTo(s[0], s[1], s[2], s[3], s[4], s[5]);
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      const p = i ? [segs[i - 1][4], segs[i - 1][5]] : st;
      c.bezierCurveTo(-s[2], s[3], -s[0], s[1], -p[0], p[1]);
    }
    c.closePath();
  }
  /** 혈관 (r 단위 폴리라인, 거울로 둘) · 눈 자리 · 색 */
  const VEINS = {
    normal: {
      col: VEIN,
      lines: [
        [0, 0.42, 0.42, 0.06, 0.9, -0.36, 1.3, -0.82],
        [0.42, 0.06, 0.58, -0.4],
        [0, 0.42, 0, -0.86],
      ],
      eyes: [[0, 0.62, 0.34]],
    },
    charge: {
      col: '#FF9A52',
      lines: [
        [0, 1.5, 0, 0.2, 0, -0.9],
        [0, 0.2, 0.45, -0.3, 0.9, -0.88],
      ],
      eyes: [[0, 1.0, 0.3]],
    },
    armor: {
      col: AMB,
      lines: [
        [0, 0.66, 0.5, 0.34, 0.98, 0.16],
        [0, 0.1, 0.55, -0.22, 1.08, -0.36],
        [0, -0.46, 0.42, -0.74, 0.78, -0.88],
        [0, 0.78, 0, -1.05],
      ],
      eyes: [
        [0.26, 0.78, 0.2],
        [-0.26, 0.78, 0.2],
      ],
    },
    boss: {
      col: VEIN,
      lines: [
        [0, 0.25, 0.6, 0.16, 1.1, 0.16, 1.56, 0.2],
        [0, -0.15, 0.6, -0.32, 1.0, -0.48, 1.42, -0.6],
        [0.24, 0.55, 0.5, 0.9, 0.68, 1.36],
        [0, 0.95, 0, -1.0],
        [0, -0.6, 0.4, -0.8, 0.6, -0.95],
      ],
      eyes: [
        [0, 0.4, 0.3],
        [0.36, 0.66, 0.13],
        [-0.36, 0.66, 0.13],
      ],
    },
  };
  function enSprite(kind, r, layer) {
    const S = SHAPES[kind].box * r;
    return sprite(`orbit-en-${kind}-${r}-${layer}`, S, S, (c) => {
      c.translate(S / 2, S / 2);
      c.scale(r, r);
      const px = 1 / r;
      if (layer === 'sil') {
        hullPath(c, kind);
        c.fillStyle = '#FFFFFF';
        c.fill();
        return;
      }
      if (layer === 'glow') {
        const V = VEINS[kind];
        c.lineCap = 'round';
        c.lineJoin = 'round';
        const veinPass = (lw, a) => {
          c.strokeStyle = rgba(V.col, a);
          c.lineWidth = lw * px;
          for (const L of V.lines)
            for (const sx of [1, -1]) {
              if (sx < 0 && L.every((v, i) => i % 2 || v === 0)) continue;
              c.beginPath();
              for (let i = 0; i < L.length; i += 2) (i ? c.lineTo : c.moveTo).call(c, L[i] * sx, L[i + 1]);
              c.stroke();
            }
        };
        c.save();
        hullPath(c, kind);
        c.clip();
        veinPass(3.2, 0.22);
        veinPass(1.0, 0.95);
        c.restore();
        for (const [ex, ey, er] of V.eyes) {
          const g = c.createRadialGradient(ex, ey, 0, ex, ey, er * 2.4);
          g.addColorStop(0, 'rgba(255,255,255,1)');
          g.addColorStop(0.22, 'rgba(255,214,140,0.95)');
          g.addColorStop(0.5, kind === 'charge' ? 'rgba(255,110,50,0.45)' : 'rgba(255,170,60,0.4)');
          g.addColorStop(1, 'rgba(255,140,60,0)');
          c.fillStyle = g;
          c.beginPath();
          c.arc(ex, ey, er * 2.4, 0, TAU);
          c.fill();
        }
        return;
      }
      // 몸 (hull): 짙은 키틴 + 윗왼쪽 빛 + 갈비 + 테
      hullPath(c, kind);
      const g = c.createLinearGradient(-1.2, -1.2, 1.0, 1.3);
      g.addColorStop(0, kind === 'armor' ? '#4A4E63' : '#3C4560');
      g.addColorStop(0.55, '#1A1F31');
      g.addColorStop(1, '#0C0F1B');
      c.fillStyle = g;
      c.fill();
      c.save();
      c.clip();
      // 갈비 (몸을 가로지르는 마디)
      c.strokeStyle = 'rgba(0,0,0,0.45)';
      c.lineWidth = 1.4 * px;
      const ribs = kind === 'armor' ? [0.42, -0.08, -0.6] : kind === 'boss' ? [0.35, -0.2, -0.65] : [0.05, -0.45];
      for (const yy of ribs) {
        c.beginPath();
        c.moveTo(-1.6, yy - 0.18);
        c.quadraticCurveTo(0, yy + 0.32, 1.6, yy - 0.18);
        c.stroke();
      }
      c.strokeStyle = 'rgba(190,210,240,0.16)';
      c.lineWidth = 0.8 * px;
      for (const yy of ribs) {
        c.beginPath();
        c.moveTo(-1.6, yy - 0.18 - 2 * px);
        c.quadraticCurveTo(0, yy + 0.32 - 2 * px, 1.6, yy - 0.18 - 2 * px);
        c.stroke();
      }
      // 등줄기
      c.strokeStyle = 'rgba(0,0,0,0.4)';
      c.lineWidth = 1.2 * px;
      c.beginPath();
      c.moveTo(0, -1.2);
      c.lineTo(0, 1.0);
      c.stroke();
      // 윤기
      const sh = c.createRadialGradient(-0.35, -0.35, 0, -0.35, -0.35, 1.1);
      sh.addColorStop(0, 'rgba(200,220,255,0.22)');
      sh.addColorStop(1, 'rgba(200,220,255,0)');
      c.fillStyle = sh;
      c.fillRect(-2, -2, 4, 4);
      c.restore();
      hullPath(c, kind);
      c.strokeStyle = kind === 'armor' ? 'rgba(255,200,140,0.5)' : 'rgba(170,195,235,0.55)';
      c.lineWidth = (kind === 'armor' || kind === 'boss' ? 1.3 : 0.9) * px;
      c.stroke();
    });
  }

  // ── 무기 받침: 궤도 포대 패드 (금속 원판 + 세계 색 고리 + 위로 비추는 빛) ──
  function padSprite(col, sub, s) {
    const bw = s * 1.4;
    const bh = s * 0.62;
    return sprite(`orbit-pad-${col}-${sub || ''}-${s}`, bw, bh, (c) => {
      const cx = bw / 2;
      const cy = bh * 0.46;
      const rx = s * 0.47;
      const ry = s * 0.15;
      // 그림자 (행성 위에 떠 있는 포대)
      c.save();
      c.translate(cx, cy + s * 0.07);
      c.scale(1, 0.3);
      const sg = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.66);
      sg.addColorStop(0, 'rgba(0,2,8,0.75)');
      sg.addColorStop(1, 'rgba(0,2,8,0)');
      c.fillStyle = sg;
      c.beginPath();
      c.arc(0, 0, s * 0.66, 0, TAU);
      c.fill();
      c.restore();
      // 옆면 (두께)
      c.fillStyle = '#060B16';
      c.beginPath();
      c.ellipse(cx, cy + s * 0.055, rx, ry, 0, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(150,180,220,0.45)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.ellipse(cx, cy + s * 0.055, rx, ry, 0, 0.1, Math.PI - 0.1);
      c.stroke();
      // 윗면 금속
      const tg = c.createLinearGradient(0, cy - ry, 0, cy + ry);
      tg.addColorStop(0, '#3A4B68');
      tg.addColorStop(1, '#151E30');
      c.fillStyle = tg;
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      c.fill();
      // 판 이음 (방사형)
      c.strokeStyle = 'rgba(0,0,0,0.4)';
      c.lineWidth = 0.7;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.2;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * rx * 0.66, cy + Math.sin(a) * ry * 0.66);
        c.lineTo(cx + Math.cos(a) * rx * 0.97, cy + Math.sin(a) * ry * 0.97);
        c.stroke();
      }
      // 테 빛 (뒤쪽 밝게)
      c.strokeStyle = 'rgba(215,235,255,0.55)';
      c.lineWidth = 0.9;
      c.beginPath();
      c.ellipse(cx, cy, rx, ry, 0, Math.PI + 0.15, TAU - 0.15);
      c.stroke();
      // 가운데 우물
      c.fillStyle = '#050911';
      c.beginPath();
      c.ellipse(cx, cy, rx * 0.62, ry * 0.62, 0, 0, TAU);
      c.fill();
      // 우물 속 방출기 빛 (세계 색)
      c.save();
      c.translate(cx, cy);
      c.scale(1, ry / rx);
      const wg = c.createRadialGradient(0, 0, 0, 0, 0, rx * 0.62);
      wg.addColorStop(0, rgba(col, 0.42));
      wg.addColorStop(1, rgba(col, 0));
      c.fillStyle = wg;
      c.beginPath();
      c.arc(0, 0, rx * 0.62, 0, TAU);
      c.fill();
      c.restore();
      // 세계 색 고리
      c.strokeStyle = rgba(col, 0.28);
      c.lineWidth = 3.2;
      c.beginPath();
      c.ellipse(cx, cy, rx * 0.8, ry * 0.8, 0, 0, TAU);
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = 1.2;
      c.stroke();
      // 합친 무기: 바깥 앞쪽 반고리 (보조 세계 색) + 끝 점
      if (sub) {
        c.strokeStyle = sub;
        c.lineWidth = 1.4;
        c.beginPath();
        c.ellipse(cx, cy + s * 0.03, rx * 1.16, ry * 1.2, 0, 0.12, Math.PI - 0.12);
        c.stroke();
        c.fillStyle = sub;
        for (const a of [0.12, Math.PI - 0.12]) {
          c.beginPath();
          c.arc(cx + Math.cos(a) * rx * 1.16, cy + s * 0.03 + Math.sin(a) * ry * 1.2, 1.5, 0, TAU);
          c.fill();
        }
      }
    });
  }
  function beamSprite(col) {
    return sprite('orbit-beam-' + col, 24, 32, (c, w, h) => {
      const g = c.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, rgba(col, 0.5));
      g.addColorStop(0.5, rgba(col, 0.14));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'destination-in';
      const m = c.createLinearGradient(0, 0, w, 0);
      m.addColorStop(0, 'rgba(0,0,0,0)');
      m.addColorStop(0.5, 'rgba(0,0,0,1)');
      m.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = m;
      c.fillRect(0, 0, w, h);
    });
  }

  // ── HUD 조각 ──
  function label(c, text, x, y, align, col) {
    c.font = `700 8.5px ${NUM}`;
    c.textAlign = align || 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = col || MUTED;
    if ('letterSpacing' in c) c.letterSpacing = '1.6px';
    c.fillText(text, x, y);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  }
  function cell(c, x, y, w, h, k) {
    c.beginPath();
    c.moveTo(x + k, y);
    c.lineTo(x + w + k, y);
    c.lineTo(x + w, y + h);
    c.lineTo(x, y + h);
    c.closePath();
  }

  CX.defineTheme('orbit', {
    name: '궤도 방어',
    desc: '깊은 우주 · 행성 대기권이 방어선 · 생체기계 함선 · 플라스마 폭발 · 가는 빛 선 HUD',
    fonts: ['Oswald', 'Noto Sans KR'],

    // ── 판 ──
    bg(scale) {
      return bgCanvas(scale, (c, w, h) => {
        const R = rng(7);
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#01030A');
        g.addColorStop(0.5, '#030816');
        g.addColorStop(0.8, '#071431');
        g.addColorStop(1, '#071431');
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        // 성운 · 은하 띠 (사선)
        c.save();
        c.translate(170, 170);
        c.rotate(-0.5);
        blob(c, 0, 0, 260, 'rgba(46,52,130,0.2)', 0.28);
        blob(c, -60, 6, 160, 'rgba(40,120,170,0.1)', 0.3);
        blob(c, 90, -8, 140, 'rgba(110,60,150,0.1)', 0.35);
        for (let i = 0; i < 170; i++) {
          const x = (R() - 0.5) * 520;
          const y = (R() + R() + R() - 1.5) * 46;
          c.fillStyle = `rgba(210,225,255,${0.08 + R() * 0.3})`;
          const z = R() > 0.9 ? 1.1 : 0.6;
          c.fillRect(x, y, z, z);
        }
        c.restore();
        blob(c, 320, 330, 150, 'rgba(30,70,140,0.1)');
        // 별
        for (let i = 0; i < 210; i++) {
          const x = R() * w;
          const y = R() * (LINE_Y - 6);
          if (y > limbY(x) - 3) continue;
          const s = R();
          const a = 0.14 + R() * 0.5;
          c.fillStyle = s > 0.93 ? `rgba(255,214,170,${a})` : s > 0.8 ? `rgba(160,210,255,${a})` : `rgba(225,232,255,${a * 0.8})`;
          const z = s > 0.975 ? 1.6 : s > 0.86 ? 1.1 : 0.7;
          c.fillRect(x, y, z, z);
        }
        // 밝은 별 몇 (십자 빛)
        for (let i = 0; i < 5; i++) {
          const x = 20 + R() * (w - 40);
          const y = 20 + R() * 330;
          blob(c, x, y, 6, 'rgba(200,230,255,0.35)');
          c.fillStyle = 'rgba(235,245,255,0.75)';
          c.fillRect(x - 4, y - 0.3, 8, 0.6);
          c.fillRect(x - 0.3, y - 4, 0.6, 8);
          c.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
        }
        // 먼 달: 가는 초승달 빛만 (적과 헷갈리지 않게 몸은 거의 안 보이게)
        {
          const mx = 304;
          const my = 112;
          const mr = 10;
          c.fillStyle = '#050A16';
          c.beginPath();
          c.arc(mx, my, mr, 0, TAU);
          c.fill();
          c.save();
          c.beginPath();
          c.arc(mx, my, mr, 0, TAU);
          c.clip();
          c.fillStyle = 'rgba(190,215,245,0.55)';
          c.beginPath();
          c.arc(mx, my, mr, Math.PI * 0.5, Math.PI * 1.5);
          c.arc(mx + 3.2, my, mr * 0.98, Math.PI * 1.5, Math.PI * 0.5, true);
          c.fill();
          c.restore();
          blob(c, mx - 6, my, 16, 'rgba(150,190,255,0.08)');
        }
        // 궤도 거리 눈금 (오른쪽 가장자리, 글 없이)
        c.fillStyle = 'rgba(134,216,255,0.16)';
        for (let y = 90; y < LINE_Y - 20; y += 16) {
          const long = (LINE_Y - y) % 64 < 16;
          c.fillRect(w - (long ? 9 : 5), y, long ? 6 : 3, 1);
        }
        // 대기권 빛 (곡면을 따라: 행성 중심의 원형 그라디언트)
        const ag = c.createRadialGradient(PCX, PCY, PR - 4, PCX, PCY, PR + 52);
        ag.addColorStop(0, 'rgba(150,225,255,0.5)');
        ag.addColorStop(0.08, 'rgba(80,180,255,0.3)');
        ag.addColorStop(0.35, 'rgba(50,110,230,0.11)');
        ag.addColorStop(1, 'rgba(40,60,200,0)');
        c.fillStyle = ag;
        c.fillRect(0, LINE_Y - 64, w, 80);
        // 행성 (밤 쪽)
        c.save();
        c.beginPath();
        c.arc(PCX, PCY, PR, 0, TAU);
        c.clip();
        const pg = c.createLinearGradient(0, LINE_Y, 0, h);
        pg.addColorStop(0, '#0E2A4C');
        pg.addColorStop(0.1, '#081B36');
        pg.addColorStop(0.45, '#051126');
        pg.addColorStop(1, BOTTOM);
        c.fillStyle = pg;
        c.fillRect(0, LINE_Y - 4, w, h - LINE_Y + 4);
        // 안쪽 가장자리 산란
        const ig = c.createRadialGradient(PCX, PCY, PR - 18, PCX, PCY, PR);
        ig.addColorStop(0, 'rgba(60,160,255,0)');
        ig.addColorStop(0.75, 'rgba(90,190,255,0.16)');
        ig.addColorStop(1, 'rgba(190,240,255,0.55)');
        c.fillStyle = ig;
        c.fillRect(0, LINE_Y - 4, w, 40);
        // 해 쪽 (왼쪽) 은은한 빛
        blob(c, -20, LINE_Y + 18, 170, 'rgba(70,150,210,0.16)', 0.5);
        // 구름 띠 (곡면 따라)
        for (let i = 0; i < 22; i++) {
          const rr = PR - 10 - R() * 86;
          const a0 = -Math.PI / 2 + (R() - 0.5) * 0.15;
          const len = 0.006 + R() * 0.024;
          c.strokeStyle = `rgba(150,195,235,${0.025 + R() * 0.05})`;
          c.lineWidth = 1 + R() * 3.5;
          c.lineCap = 'round';
          c.beginPath();
          c.arc(PCX, PCY, rr, a0 - len, a0 + len);
          c.stroke();
        }
        // 도시 불빛
        for (let k = 0; k < 10; k++) {
          const cx = 14 + R() * (w - 28);
          const cy = LINE_Y + 26 + R() * 74;
          for (let j = 0; j < 12; j++) {
            const x = cx + (R() - 0.5) * 34;
            const y = cy + (R() - 0.5) * 9;
            c.fillStyle = `rgba(255,190,110,${0.12 + R() * 0.3})`;
            c.fillRect(x, y, 0.9, 0.9);
          }
        }
        c.restore();
      });
    },

    sky(c, t) {
      // 판 밖 아래 36px 도 행성 색으로 (두 줄 무기의 레벨 표시 자리)
      c.fillStyle = BOTTOM;
      c.fillRect(0, H - 1, W, CH - HUD - H + 2);
      c.save();
      c.globalCompositeOperation = 'lighter';
      // 대기권 위 오로라 (곡면 위로 흔들리는 빛 커튼)
      const au = auroraSpr();
      for (let i = 0; i < 8; i++) {
        const x = 12 + i * 48 + Math.sin(t * 0.35 + i * 1.7) * 14;
        const a = 0.11 + 0.08 * Math.sin(t * 0.8 + i * 2.3);
        const hh = 24 + 10 * Math.sin(t * 0.55 + i * 1.3);
        c.globalAlpha = Math.max(0, a);
        c.drawImage(au, x - 26, limbY(x) - hh + 1, 52, hh);
      }
      // 반짝이는 별
      for (const s of TW) {
        const a = 0.2 + 0.8 * Math.max(0, Math.sin(t * s.f + s.p));
        c.globalAlpha = a * (s.big ? 0.8 : 0.55);
        c.fillStyle = s.warm ? '#FFD9B0' : '#D6EAFF';
        c.fillRect(s.x - 0.6, s.y - 0.6, 1.2, 1.2);
        if (s.big) {
          c.globalAlpha *= 0.6;
          c.fillRect(s.x - 3, s.y - 0.25, 6, 0.5);
          c.fillRect(s.x - 0.25, s.y - 3, 0.5, 6);
        }
      }
      // 먼지 (천천히 행성 쪽으로)
      c.fillStyle = '#BFD8FF';
      for (const d of DUST) {
        const y = (d.y + t * d.v) % (LINE_Y - 30);
        c.globalAlpha = d.a;
        c.fillRect(d.x, y, d.s, d.s * 2.4);
      }
      c.restore();
    },

    enemy(c, e, t) {
      if (!e.alive && e.flash <= 0) return;
      const kind = e.boss ? 'boss' : SHAPES[e.type] ? e.type : 'normal';
      const r = e.r;
      const S = SHAPES[kind].box * r;
      c.save();
      c.translate(e.x, e.y);
      if (!e.alive) {
        // 사라지는 중: 흰 실루엣이 부풀며 꺼짐
        const k = 1 - e.flash / 0.12;
        c.globalAlpha = Math.max(0, 1 - k);
        c.scale(1 + k * 0.35, 1 + k * 0.35);
        c.drawImage(enSprite(kind, r, 'sil'), -S / 2, -S / 2, S, S);
        c.restore();
        return;
      }
      c.rotate(Math.sin(e.ph * 1.3) * 0.09);
      if (kind === 'charge') {
        const L = r * (2.0 + 0.5 * Math.sin(t * 31 + e.ph * 7));
        c.globalCompositeOperation = 'lighter';
        c.drawImage(plumeSpr(), -r * 0.42, -r * 1.0 - L, r * 0.84, L);
        c.globalCompositeOperation = 'source-over';
      } else if (kind === 'boss') {
        // 꼬리 촉수 넷 (흔들림)
        c.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const bx = (i - 1.5) * r * 0.3;
          const sw = Math.sin(t * 2.2 + i * 1.4) * r * 0.25;
          c.beginPath();
          c.moveTo(bx, -r * 0.8);
          c.quadraticCurveTo(bx * 1.6 + sw, -r * 1.5, bx * 2.1 - sw, -r * (1.9 + (i % 2) * 0.3));
          c.strokeStyle = '#26304A';
          c.lineWidth = 3.4;
          c.stroke();
          c.strokeStyle = 'rgba(56,242,196,0.7)';
          c.lineWidth = 1;
          c.stroke();
        }
      }
      c.drawImage(enSprite(kind, r, 'hull'), -S / 2, -S / 2, S, S);
      const pul = 0.68 + 0.32 * Math.sin(e.ph * 4.2);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = pul;
      c.drawImage(enSprite(kind, r, 'glow'), -S / 2, -S / 2, S, S);
      c.globalCompositeOperation = 'source-over';
      if (e.flash > 0) {
        c.globalAlpha = (e.flash / 0.12) * 0.85;
        c.drawImage(enSprite(kind, r, 'sil'), -S / 2, -S / 2, S, S);
      }
      c.restore();
      // 느려짐: 얼음빛 끊긴 고리
      if (e.slow > 0) {
        c.save();
        c.strokeStyle = 'rgba(170,228,255,0.7)';
        c.lineWidth = 1;
        const rr = r * 1.55;
        const a0 = t * 1.5;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.arc(e.x, e.y, rr, a0 + (i * TAU) / 3, a0 + (i * TAU) / 3 + 1.4);
          c.stroke();
        }
        c.restore();
      }
      // 모함: 방패 고리 + 체력 줄 / 장갑: 맞았으면 체력 줄
      if (kind === 'boss') {
        c.save();
        c.strokeStyle = 'rgba(56,242,196,0.3)';
        c.lineWidth = 1;
        c.setLineDash([3, 6]);
        c.lineDashOffset = -t * 12;
        c.beginPath();
        c.arc(e.x, e.y, r * 1.75, 0, TAU);
        c.stroke();
        c.restore();
      }
      if (kind === 'boss' || (e.type === 'armor' && e.hp < e.max)) {
        const bw = kind === 'boss' ? r * 2.6 : r * 1.7;
        const by = e.y - r * (kind === 'boss' ? 1.95 : 1.45);
        const k = clamp(e.hp / e.max, 0, 1);
        c.fillStyle = 'rgba(2,6,14,0.75)';
        c.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, kind === 'boss' ? 5 : 4);
        c.fillStyle = kind === 'boss' ? HOT : AMB;
        c.fillRect(e.x - bw / 2, by, bw * k, kind === 'boss' ? 3 : 2);
      }
    },

    boom(c, b) {
      const k = b.age / 0.55;
      c.save();
      c.globalCompositeOperation = 'lighter';
      if (b.leak) {
        // 대기권에 박힌 순간: 띠를 따라 붉게 타오름
        const a = 1 - k;
        const ly = limbY(b.x);
        c.globalAlpha = a;
        c.drawImage(redSpr(), b.x - 34 - k * 30, ly - 7, 68 + k * 60, 14);
        c.globalAlpha = a * 0.9;
        c.drawImage(coreSpr(), b.x - 9, ly - 9 - k * 6, 18, 18);
        c.strokeStyle = `rgba(255,90,110,${0.8 * a})`;
        c.lineWidth = 1.2;
        c.beginPath();
        c.ellipse(b.x, ly, 8 + k * 26, 3 + k * 6, 0, Math.PI, TAU);
        c.stroke();
        c.restore();
        return;
      }
      const R = b.r * (b.big ? 1.15 : 1);
      const sd = b.x * 0.731 + b.y * 1.379;
      // 1) 플라스마 번짐: 어긋난 덩이 셋이 부풀며 식는다 (청백 · 보라)
      const pa = Math.pow(1 - k, 1.5) * 0.9;
      for (let i = 0; i < 3; i++) {
        const an = hs(sd + i) * TAU;
        const off = R * 0.3 * ease(k) * (0.6 + hs(sd + i + 9) * 0.8);
        const br = R * (0.42 + ease(k) * 0.72) * (0.75 + 0.35 * hs(sd + i + 3));
        c.globalAlpha = pa;
        c.drawImage(i === 2 ? violetSpr() : haloSpr(), b.x + Math.cos(an) * off - br, b.y + Math.sin(an) * off - br, br * 2, br * 2);
      }
      // 2) 뜨거운 핵 (흰 → 호박), 처음 0.3초
      const ck = clamp(1 - k * 1.8, 0, 1);
      if (ck > 0) {
        const cr = R * (0.32 + ease(k * 2.4) * 0.42);
        c.globalAlpha = ck;
        c.drawImage(coreSpr(), b.x - cr, b.y - cr, cr * 2, cr * 2);
      }
      // 3) 충격파 (가늘게, 빨리 식음)
      c.globalAlpha = 1;
      const rr = R * (0.3 + ease(k * 1.5) * 0.95);
      c.strokeStyle = `rgba(200,240,255,${0.5 * (1 - k) * (1 - k)})`;
      c.lineWidth = 0.5 + 1.1 * (1 - k);
      c.beginPath();
      c.arc(b.x, b.y, rr, 0, TAU);
      c.stroke();
      if (b.big) {
        const r2 = R * (0.2 + ease(clamp((k - 0.1) * 1.6, 0, 1)) * 0.8);
        c.strokeStyle = `rgba(255,181,77,${0.65 * (1 - k) * (1 - k)})`;
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(b.x, b.y, r2, 0, TAU);
        c.stroke();
      }
      // 4) 불티: 제각각 방향 · 속도, 꼬리가 짧아지며 식음
      const n = b.big ? 10 : 7;
      c.strokeStyle = `rgba(255,214,150,${0.95 * (1 - k)})`;
      c.lineWidth = 1.1;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const a = hs(sd + i * 1.7) * TAU;
        const d = R * (0.15 + ease(k) * 1.1 * (0.6 + hs(sd + i * 2.9) * 0.7));
        const d0 = Math.max(0, d - R * 0.34 * (1 - k));
        c.moveTo(b.x + Math.cos(a) * d0, b.y + Math.sin(a) * d0);
        c.lineTo(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d);
      }
      c.stroke();
      c.restore();
    },

    seam(c, s) {
      const k = s.age / 0.3;
      const grow = clamp(s.age / 0.07, 0, 1);
      const dx = (s.x2 - s.x1) * grow;
      const dy = (s.y2 - s.y1) * grow;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      const seed = s.x1 * 0.37 + s.y2 * 0.11;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      for (let j = 1; j < 4; j++) {
        const f = j / 4;
        const off = Math.sin(seed + j * 2.3 + s.age * 46) * 4.5 * (1 - k);
        c.lineTo(s.x1 + dx * f + nx * off, s.y1 + dy * f + ny * off);
      }
      c.lineTo(s.x1 + dx, s.y1 + dy);
      c.strokeStyle = `rgba(90,190,255,${0.4 * (1 - k)})`;
      c.lineWidth = 3.2;
      c.stroke();
      c.strokeStyle = `rgba(230,248,255,${0.95 * (1 - k)})`;
      c.lineWidth = 0.9;
      c.stroke();
      if (grow < 1 || k < 0.4) {
        c.globalAlpha = 1 - k;
        c.drawImage(haloSpr(), s.x1 + dx - 7, s.y1 + dy - 7, 14, 14);
      }
      c.restore();
    },

    num(c, n) {
      const a = n.age > 0.5 ? 1 - (n.age - 0.5) / 0.3 : 1;
      const pop = n.age < 0.12 ? 1 + 0.35 * (1 - n.age / 0.12) : 1;
      const size = n.kind === 2 ? 17 : n.kind === 1 ? 14 : 11;
      c.save();
      c.globalAlpha = clamp(a, 0, 1);
      c.translate(n.x, n.y);
      if (pop !== 1) c.scale(pop, pop);
      c.font = `700 ${size}px ${NUM}`;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.lineJoin = 'round';
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(2,6,16,0.88)';
      const v = String(n.v);
      c.strokeText(v, 0, 0);
      c.fillStyle = n.kind === 2 ? AMB : n.kind === 1 ? VEIN : INK;
      c.fillText(v, 0, 0);
      c.restore();
    },

    line(c, t) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      // 대기권 가장자리: 넓은 빛 + 가는 흰 선
      limbPath(c, PR + 1);
      c.strokeStyle = 'rgba(80,170,255,0.2)';
      c.lineWidth = 6;
      c.stroke();
      c.strokeStyle = 'rgba(205,240,255,0.85)';
      c.lineWidth = 1.1;
      c.stroke();
      // 띠를 따라 흐르는 빛 둘
      const hs = haloSpr();
      for (let i = 0; i < 3; i++) {
        const px = ((t * (38 + i * 9) + i * 151) % (W + 140)) - 70;
        c.globalAlpha = 0.7;
        c.drawImage(hs, px - 46, limbY(px) - 4, 92, 8);
      }
      c.restore();
    },

    chain(c, n, since) {
      const pop = 1 + 0.3 * Math.max(0, 1 - since / 0.16);
      const a = since > 0.8 ? 1 - (since - 0.8) / 0.3 : 1;
      const col = n >= 20 ? HOT : n >= 10 ? AMB : UI;
      c.save();
      c.globalAlpha = clamp(a, 0, 1);
      c.translate(W / 2, CHAIN_Y);
      c.scale(pop, pop);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.font = `700 12px ${KR}`;
      c.fillStyle = col;
      c.fillText('연쇄', 0, -40);
      c.fillRect(-52, -44.5, 30, 1);
      c.fillRect(22, -44.5, 30, 1);
      c.font = `700 54px ${NUM}`;
      c.shadowColor = col;
      c.shadowBlur = 18;
      c.fillStyle = '#FFFFFF';
      c.fillText(String(n), 0, 12);
      c.shadowBlur = 0;
      // 이어 갈 시간 (줄이 줄어든다)
      const k = clamp(1 - since / 1.1, 0, 1);
      c.fillStyle = 'rgba(255,255,255,0.14)';
      c.fillRect(-30, 22, 60, 2);
      c.fillStyle = col;
      c.fillRect(-30, 22, 60 * k, 2);
      c.restore();
    },

    // ── 무기 받침 · 표시 ──
    base(c, w, x, y, s, t) {
      const col = wcol(w.world);
      const sub = w.sub ? wcol(w.subWorld) : null;
      const py = y + s * 0.36;
      c.drawImage(padSprite(col, sub, s), x - s * 0.7, py - s * 0.62 * 0.46, s * 1.4, s * 0.62);
      // 위로 비추는 세계 색 빛 (무기가 바탕에서 떠 보이게)
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.6 + 0.15 * Math.sin((t || 0) * 2 + x * 0.1);
      c.drawImage(beamSprite(col), x - s * 0.3, py - s * 0.82, s * 0.6, s * 0.84);
      // 항법등 (양옆 깜빡)
      const bl = Math.sin((t || 0) * 3 + x * 0.07) > 0.55 ? 1 : 0.3;
      c.globalAlpha = bl;
      c.fillStyle = AMB;
      c.fillRect(x - s * 0.47 - 1, py - 1, 2, 2);
      c.fillStyle = '#9FFFE6';
      c.fillRect(x + s * 0.47 - 1, py - 1, 2, 2);
    },

    pips(c, w, x, y, s) {
      const n = 5;
      const pw = 5;
      const gap = 1.6;
      const tw = n * pw + (n - 1) * gap;
      const py = y + s * 0.62;
      const max = w.lv >= 5;
      for (let i = 0; i < n; i++) {
        c.fillStyle = i < w.lv ? (max ? AMB : UI) : 'rgba(152,180,204,0.26)';
        c.fillRect(x - tw / 2 + i * (pw + gap), py - 1, pw, 2.2);
      }
    },

    pop(c, p) {
      const k = p.age / 1.6;
      const isNew = p.text === 'NEW';
      c.globalAlpha = k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.25);
      c.font = `700 10.5px ${NUM}`;
      if ('letterSpacing' in c) c.letterSpacing = isNew ? '1px' : '0px';
      const tw = c.measureText(p.text).width + 14;
      const x = p.w.x;
      const ty = p.w.y - GUN * 0.8 - ease(Math.min(1, p.age / 0.3)) * 12;
      roundRect(c, x - tw / 2, ty - 8, tw, 16, 8);
      if (isNew) {
        c.fillStyle = AMB;
        c.fill();
      } else {
        c.fillStyle = 'rgba(4,12,26,0.92)';
        c.fill();
        c.strokeStyle = UI;
        c.lineWidth = 1;
        c.stroke();
      }
      c.fillStyle = isNew ? '#1C1100' : INK;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.text, x, ty + 0.5);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
    },

    // ── 실전 판 화면 ──
    hurt(c, run, k) {
      const g = c.createRadialGradient(W / 2, 290, 130, W / 2, 290, 390);
      g.addColorStop(0, 'rgba(255,60,90,0)');
      g.addColorStop(1, `rgba(255,60,90,${0.42 * k})`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, CH - HUD);
      c.globalCompositeOperation = 'lighter';
      const ag = c.createLinearGradient(0, LINE_Y - 34, 0, LINE_Y + 4);
      ag.addColorStop(0, 'rgba(255,70,90,0)');
      ag.addColorStop(1, `rgba(255,70,90,${0.45 * k})`);
      c.fillStyle = ag;
      c.fillRect(0, LINE_Y - 34, W, 44);
    },

    hud(c, run) {
      const H0 = run.oy;
      const g = c.createLinearGradient(0, 0, 0, H0);
      g.addColorStop(0, '#02050C');
      g.addColorStop(1, '#050C1C');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H0);
      // 아래 선 (가운데 밝고 끝은 사라짐)
      const lg = c.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0, ui(0));
      lg.addColorStop(0.5, ui(0.6));
      lg.addColorStop(1, ui(0));
      c.fillStyle = lg;
      c.fillRect(0, H0 - 1, W, 1);
      // 가운데 LV 탭
      const cx = W / 2;
      c.beginPath();
      c.moveTo(cx - 44, 0);
      c.lineTo(cx - 44, 30);
      c.lineTo(cx - 36, 38);
      c.lineTo(cx + 36, 38);
      c.lineTo(cx + 44, 30);
      c.lineTo(cx + 44, 0);
      c.fillStyle = 'rgba(12,30,52,0.92)';
      c.fill();
      c.strokeStyle = ui(0.5);
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = UI;
      c.fillRect(cx - 12, 37.5, 24, 1.5);
      label(c, 'LV', cx, 13, 'center');
      c.font = `700 21px ${NUM}`;
      c.textAlign = 'center';
      c.fillStyle = '#FFFFFF';
      c.fillText(String(run.level), cx, 33);
      // 실드 (목숨 5): 기운 칸
      label(c, 'SHIELD', 16, 16);
      const low = run.hearts <= 2;
      const blink = run.hurt > 0 ? 0.5 + 0.5 * Math.sin(run.t * 40) : 1;
      for (let i = 0; i < 5; i++) {
        const x = 16 + i * 17;
        cell(c, x, 22, 13, 10, 3);
        if (i < run.hearts) {
          const cg = c.createLinearGradient(0, 22, 0, 32);
          cg.addColorStop(0, low ? '#FF9AA6' : '#C8F0FF');
          cg.addColorStop(1, low ? RED : '#4FB8F0');
          c.fillStyle = cg;
          c.fill();
        } else {
          c.fillStyle = i === run.hearts && run.hurt > 0 ? `rgba(255,90,110,${0.7 * blink})` : 'rgba(134,216,255,0.06)';
          c.fill();
          c.strokeStyle = 'rgba(134,216,255,0.32)';
          c.lineWidth = 1;
          c.stroke();
        }
      }
      // 웨이브
      label(c, 'WAVE', W - 16, 16, 'right');
      c.font = `700 21px ${NUM}`;
      c.textAlign = 'right';
      c.fillStyle = '#FFFFFF';
      c.fillText(String(run.wave), W - 16, 34);
      // 경험치
      const k = clamp(run.exp / run.need, 0, 1);
      label(c, 'EXP', 16, 53.5);
      const bx = 44;
      const bw = W - 44 - 64;
      c.fillStyle = ui(0.12);
      c.fillRect(bx, 49, bw, 3);
      const eg = c.createLinearGradient(bx, 0, bx + bw, 0);
      eg.addColorStop(0, '#3A8FE0');
      eg.addColorStop(1, ICE);
      c.fillStyle = eg;
      c.fillRect(bx, 49, Math.max(2, bw * k), 3);
      c.fillStyle = '#050C1C';
      for (let i = 1; i < 10; i++) c.fillRect(bx + (bw * i) / 10, 49, 1, 3);
      c.fillStyle = '#FFFFFF';
      c.fillRect(bx + Math.max(2, bw * k) - 1.5, 47.5, 1.5, 6);
      c.font = `700 9.5px ${NUM}`;
      c.textAlign = 'right';
      c.fillStyle = INK;
      c.fillText(`${run.exp}/${run.need}`, W - 16, 53.5);
    },

    chips(c, run) {
      const m = run.worlds();
      let y = 44;
      for (const k of ORDER) {
        if (!m[k]) continue;
        const wo = CX.wo(k);
        const col = wcol(k);
        chamfer(c, 8, y, 40, 20, 5);
        c.fillStyle = 'rgba(3,9,20,0.8)';
        c.fill();
        c.strokeStyle = 'rgba(150,205,255,0.22)';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = col;
        c.fillRect(8, y + 4, 2, 11);
        c.save();
        wo.crest(c, 13, y + 3, 7);
        c.restore();
        c.fillStyle = INK;
        c.font = `700 11px ${NUM}`;
        c.textAlign = 'right';
        c.textBaseline = 'middle';
        c.fillText(String(m[k]), 43, y + 10.5);
        y += 24;
      }
    },

    gate(c, run) {
      const n = run.cats().size;
      const next = CAT_TH.find((tt) => tt > n) || 15;
      const slots = run.fuseSlots();
      const t1 = `갈래 ${n}/${next}`;
      const t2 = `합성 칸 ${slots}`;
      c.font = `700 10.5px ${KR}`;
      const w1 = c.measureText(t1).width + 16;
      const w2 = c.measureText(t2).width + 16 + (slots > 0 ? 9 : 0);
      const x0 = W - 8 - w1 - w2;
      const y0 = 40;
      const h = 20;
      chamfer(c, x0, y0, w1 + w2, h, 5);
      c.fillStyle = 'rgba(3,9,20,0.8)';
      c.fill();
      c.strokeStyle = slots > 0 ? am(0.65) : 'rgba(150,205,255,0.22)';
      c.lineWidth = 1;
      c.stroke();
      if (slots > 0) {
        c.save();
        chamfer(c, x0, y0, w1 + w2, h, 5);
        c.clip();
        c.fillStyle = am(0.14);
        c.fillRect(x0 + w1, y0, w2, h);
        c.restore();
      }
      c.fillStyle = 'rgba(150,205,255,0.25)';
      c.fillRect(x0 + w1, y0 + 4, 1, h - 8);
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.fillStyle = INK;
      c.fillText(t1, x0 + 8, y0 + h / 2 + 0.5);
      c.fillStyle = slots > 0 ? AMB : MUTED;
      c.fillText(t2, x0 + w1 + 8 + (slots > 0 ? 9 : 0), y0 + h / 2 + 0.5);
      if (slots > 0) {
        c.globalAlpha = 0.55 + 0.45 * Math.sin(run.t * 5);
        c.beginPath();
        c.arc(x0 + w1 + 11, y0 + h / 2, 2.6, 0, TAU);
        c.fill();
        c.globalAlpha = 1;
      }
    },

    banner(c, b) {
      const k = b.age / b.life;
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      c.save();
      c.globalAlpha = Math.max(0, a);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      if (b.wave) {
        const m = /WAVE\s*(\d+)/.exec(b.text);
        const boss = b.text.indexOf('·') >= 0;
        const col = boss ? AMB : UI;
        const y = 140;
        const sp = ease(clamp(b.age / 0.35, 0, 1));
        // 글 뒤 옅은 어둠 띠 (적 위에서도 읽히게)
        const bd = c.createLinearGradient(0, 0, W, 0);
        bd.addColorStop(0, 'rgba(2,6,14,0)');
        bd.addColorStop(0.25, 'rgba(2,6,14,0.55)');
        bd.addColorStop(0.75, 'rgba(2,6,14,0.55)');
        bd.addColorStop(1, 'rgba(2,6,14,0)');
        c.fillStyle = bd;
        c.fillRect(0, y - 46, W, 64);
        const eyebrow = boss ? '모함 접근' : '적 함대 접근';
        c.font = `700 11px ${KR}`;
        if ('letterSpacing' in c) c.letterSpacing = '3px';
        const ew = c.measureText(eyebrow).width / 2 + 12;
        c.fillStyle = col;
        c.fillText(eyebrow, W / 2 + 1.5, y - 26);
        // 가는 선이 글 옆에서 바깥으로
        c.globalAlpha = Math.max(0, a) * 0.8;
        c.fillRect(W / 2 - ew - 70 * sp, y - 30, 70 * sp, 1);
        c.fillRect(W / 2 + ew, y - 30, 70 * sp, 1);
        c.globalAlpha = Math.max(0, a);
        c.font = `700 30px ${NUM}`;
        if ('letterSpacing' in c) c.letterSpacing = '5px';
        c.shadowColor = boss ? 'rgba(255,181,77,0.85)' : 'rgba(134,216,255,0.85)';
        c.shadowBlur = 16;
        c.fillStyle = '#FFFFFF';
        c.fillText(m ? `WAVE ${m[1]}` : b.text, W / 2 + 2.5, y + 4);
        c.shadowBlur = 0;
        if ('letterSpacing' in c) c.letterSpacing = '0px';
      } else {
        const y = 150;
        const x = 26;
        const w = W - 52;
        const h = 64;
        const top = y - 32;
        const g = c.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, 'rgba(8,20,38,0.94)');
        g.addColorStop(1, 'rgba(4,10,22,0.94)');
        chamfer(c, x, top, w, h, 10);
        c.fillStyle = g;
        c.fill();
        c.strokeStyle = am(0.6);
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = AMB;
        c.fillRect(x + 18, top - 1, 40, 2);
        const isFuse = b.text.indexOf('합성 · ') === 0;
        const title = isFuse ? b.text.slice(5) : b.text;
        c.font = `700 10px ${KR}`;
        if ('letterSpacing' in c) c.letterSpacing = '2px';
        c.fillStyle = AMB;
        c.fillText(isFuse ? '합성 완료' : '알림', W / 2, top + 17);
        if ('letterSpacing' in c) c.letterSpacing = '0px';
        c.fillStyle = '#FFFFFF';
        c.font = `900 18px ${KR}`;
        c.fillText(title, W / 2, top + 38, w - 30);
        c.fillStyle = MUTED;
        c.font = `500 11px ${KR}`;
        c.fillText(b.sub || '', W / 2, top + 55, w - 30);
      }
      c.restore();
    },

    offer(c, o, run) {
      const t = o.age;
      c.save();
      c.fillStyle = `rgba(2,5,12,${0.82 * Math.min(1, t / 0.2)})`;
      c.fillRect(0, -run.oy, W, run.ch);
      const ti = ease(clamp(t / 0.3, 0, 1));
      c.globalAlpha = ti;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.font = `700 10px ${NUM}`;
      if ('letterSpacing' in c) c.letterSpacing = '3px';
      c.fillStyle = UI;
      c.fillText('LEVEL UP', W / 2 + 1.5, 78);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      c.fillStyle = '#FFFFFF';
      c.font = `900 25px ${KR}`;
      c.fillText('레벨 업', W / 2, 106);
      c.font = `700 12px ${NUM}`;
      c.fillStyle = MUTED;
      const lv = `LV ${o.from}  →  ${o.from + 1}`;
      c.fillText(lv, W / 2, 126);
      const lw = c.measureText(lv).width / 2 + 10;
      c.fillStyle = ui(0.45);
      c.fillRect(W / 2 - lw - 40 * ti, 122, 40 * ti, 1);
      c.fillRect(W / 2 + lw, 122, 40 * ti, 1);
      c.globalAlpha = 1;
      o.cards.forEach((cd, i) => {
        const y = 140 + i * 112;
        const enter = ease(clamp((t - i * 0.08) / 0.3, 0, 1));
        const picked = o.pick === i;
        const faded = o.pick >= 0 && !picked;
        c.save();
        c.globalAlpha = enter * (faded ? 0.3 : 1);
        c.translate((1 - enter) * 48, 0);
        if (picked) {
          const s = 1 + 0.03 * Math.sin(Math.min(1, (t - o.pickAt) / 0.2) * Math.PI);
          c.translate(W / 2, y + 50);
          c.scale(s, s);
          c.translate(-W / 2, -(y + 50));
        }
        CX.th().card(c, cd, 18, y, W - 36, 100, picked, run);
        c.restore();
      });
      if (!run.auto && o.pick < 0) {
        c.fillStyle = MUTED;
        c.font = `500 11px ${KR}`;
        c.textAlign = 'center';
        c.fillText('카드를 눌러 고른다', W / 2, 140 + 3 * 112 + 4);
      }
      c.restore();
    },

    card(c, cd, x, y, w, h, picked, run) {
      const acc = cd.kind === 'fuse' ? AMB : cd.kind === 'new' ? '#7FF2D2' : UI;
      const g = c.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, 'rgba(14,30,52,0.97)');
      g.addColorStop(1, 'rgba(6,13,27,0.97)');
      chamfer(c, x, y, w, h, 12);
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = picked ? acc : cd.kind === 'fuse' ? am(0.55) : 'rgba(150,205,255,0.22)';
      c.lineWidth = picked ? 1.6 : 1;
      c.stroke();
      if (picked) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.shadowColor = acc;
        c.shadowBlur = 16;
        c.stroke();
        c.restore();
      }
      // 왼쪽 강조 막대 + 무기 자리 (둥근 빛 우물)
      c.fillStyle = acc;
      c.fillRect(x, y + 16, 2, h - 32);
      const vx = x + 50;
      const vy = y + h / 2;
      const vg = c.createRadialGradient(vx, vy + 8, 0, vx, vy + 8, 44);
      vg.addColorStop(0, rgba(acc, 0.16));
      vg.addColorStop(1, rgba(acc, 0));
      c.fillStyle = vg;
      c.fillRect(x + 4, y + 2, 92, h - 4);
      c.strokeStyle = 'rgba(150,205,255,0.1)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(vx, vy, 38, -Math.PI * 0.85, Math.PI * 0.85);
      c.stroke();
      c.fillStyle = 'rgba(150,205,255,0.12)';
      c.fillRect(x + 96, y + 14, 1, h - 28);
      const v = cd.view;
      c.save();
      CX.drawGun(c, v, vx, vy + 10, 50, run.t);
      c.restore();
      const tx = x + 108;
      const tw = w - 118;
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      const wn = (k) => CX.wo(k).name;
      let tag;
      let name;
      let l1;
      let l2 = '';
      if (cd.kind === 'fuse') {
        tag = `합성 · 칸 ${run.fuseSlots()} 중 1 · 등급 ${Math.min(cd.a.lv, cd.b.lv)}`;
        name = v.name;
        l1 = `몸 ${cd.a.name} (${CX.wo(cd.a.world).short}) + 연출 ${cd.b.name} (${CX.wo(cd.b.world).short})`;
        l2 = `반응: ${v.react}`;
      } else if (cd.kind === 'new') {
        const own = run.worlds();
        tag = `새 무기 · ${wn(v.world)} · ${v.catLabel}${own[v.world] ? '' : ' · 새 세계'}`;
        name = v.name;
        const left = (CAT_TH.find((tt) => tt > run.cats().size) || 15) - run.cats().size - 1;
        l1 = run.cats().has(v.cat) ? `${v.catLabel} 갈래 하나 더` : left <= 0 ? '새 갈래 · 이걸로 합성 칸이 열린다' : `새 갈래 · 합성 칸까지 갈래 ${left}`;
      } else {
        tag = `강화 · ${wn(v.world)} · ${v.catLabel}`;
        name = `${v.name}  Lv ${v.lv} → ${v.lv + 1}`;
        l1 = '피해 +28% · 쿨다운 −6%';
      }
      c.fillStyle = acc;
      c.font = `700 10.5px ${KR}`;
      c.fillText(tag, tx, y + 25, tw);
      c.fillStyle = '#FFFFFF';
      c.font = `900 18px ${KR}`;
      c.fillText(name, tx, y + 50, tw);
      c.fillStyle = MUTED;
      c.font = `500 11px ${KR}`;
      c.fillText(l1, tx, y + 70, tw);
      if (l2) {
        c.fillStyle = AMB;
        c.font = `700 11px ${KR}`;
        c.fillText(l2, tx, y + 87, tw);
      } else if (cd.kind === 'up') {
        // 강화: 다섯 칸 중 다음 칸이 깜빡
        for (let i = 0; i < 5; i++) {
          const on = i < v.lv;
          const nx = i === v.lv;
          c.fillStyle = on ? UI : nx ? `rgba(255,255,255,${0.45 + 0.4 * Math.sin(run.t * 6)})` : 'rgba(152,180,204,0.22)';
          c.fillRect(tx + i * 15, y + 81, 12, 3);
        }
      }
    },

    over(c, run) {
      const a = Math.min(1, run.over / 0.4);
      c.save();
      c.fillStyle = `rgba(2,4,10,${0.84 * a})`;
      c.fillRect(0, -run.oy, W, run.ch);
      // 붉게 물든 대기권
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a * (0.7 + 0.3 * Math.sin(run.t * 3));
      const rg = c.createLinearGradient(0, LINE_Y - 60, 0, LINE_Y + 10);
      rg.addColorStop(0, 'rgba(255,60,90,0)');
      rg.addColorStop(1, 'rgba(255,60,90,0.4)');
      c.fillStyle = rg;
      c.fillRect(0, LINE_Y - 60, W, 70);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.font = `700 10.5px ${KR}`;
      if ('letterSpacing' in c) c.letterSpacing = '3px';
      c.fillStyle = RED;
      c.fillText('궤도 방어 실패', W / 2 + 1.5, 180);
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      c.fillStyle = '#FFFFFF';
      c.font = `900 30px ${KR}`;
      c.fillText('대기권 돌파', W / 2, 216);
      c.fillStyle = 'rgba(255,90,110,0.5)';
      c.fillRect(W / 2 - 60, 232, 120, 1);
      // 기록 넷
      const st = [
        ['웨이브', run.wave],
        ['LV', run.level],
        ['연쇄 최고', run.chainPeak],
        ['합성', run.fusedN],
      ];
      const gx = 24;
      const gw = (W - 48 - 18) / 4;
      st.forEach(([k, v], i) => {
        const x = gx + i * (gw + 6);
        chamfer(c, x, 250, gw, 56, 7);
        c.fillStyle = 'rgba(8,18,34,0.92)';
        c.fill();
        c.strokeStyle = 'rgba(150,205,255,0.22)';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = MUTED;
        c.font = `500 10px ${KR}`;
        c.fillText(k, x + gw / 2, 268);
        c.fillStyle = '#FFFFFF';
        c.font = `700 22px ${NUM}`;
        c.fillText(String(v), x + gw / 2, 295);
      });
      // 새 판까지
      const p = clamp((run.over - 0.4) / 3.6, 0, 1);
      c.fillStyle = MUTED;
      c.font = `500 11.5px ${KR}`;
      c.fillText('잠시 뒤 새 판', W / 2, 336);
      c.fillStyle = 'rgba(150,205,255,0.16)';
      c.fillRect(W / 2 - 60, 346, 120, 2);
      c.fillStyle = UI;
      c.fillRect(W / 2 - 60, 346, 120 * p, 2);
      c.restore();
    },
  });
})();
