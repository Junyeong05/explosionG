// 테마 city: 비 오는 네온 도시 (11-24)
// 위에서 내려다본 젖은 아스팔트 도로 · 차선 · 빗줄기 · 물 반사, 양옆 건물 옥상과 간판 빛.
// 적 = 검은 실루엣에 RGB 어긋남 · 글리치. 폭발 = 색수차 고리 + 글리치 조각. 방어선 = 청록 레이저 차단선 + 노랑 경고 띠.
// HUD · 카드 = 날카로운 사선(깎은 모서리 · 평행사변형) + 남흑 판 + 핫핑크 · 전기 청록 · 경고 노랑.
// 색의 말: 청록 = 우리 편(장벽·경험치·반응), 핑크 = 적·위험(목숨·적 눈), 노랑 = 주목(강화·합성 칸·큰 한 방).
(function () {
  const { W, GUN, CAT_TH, ORDER } = CX.runInfo;
  const { LINE_Y } = CX.size;
  const { TAU, clamp, ease, roundRect, bgCanvas, sprite } = CX.util;
  void roundRect;

  const PINK = '#FF2E88';
  const CYAN = '#19E6FF';
  const YEL = '#FFD84A';
  const INK = '#07080F';
  const TXT = '#F2F4FF';
  const MUT = '#A7AFD3';
  const NUM = '"Oswald", "Noto Sans KR", sans-serif';
  const KOR = '"Gothic A1", "Noto Sans KR", sans-serif';
  const BODY = '"Noto Sans KR", sans-serif';
  const FH = 540;
  const RL = 34; // 도로 왼쪽 연석
  const RR = 326; // 도로 오른쪽 연석

  if (document.fonts && document.fonts.load) {
    for (const f of ['700 24px "Oswald"', '500 12px "Oswald"', '900 20px "Gothic A1"', '700 14px "Gothic A1"']) document.fonts.load(f, 'WAVE 0123456789 레벨 업 연쇄 합성 차단선 돌파 보스 접근').catch(() => null);
  }

  // ── 작은 도구 ──
  /** 고정 난수 (바탕이 다시 그려져도 같은 그림) */
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
  /** 0~1 해시 (프레임마다 같은 값: 폭발 조각 · 글리치 자리) */
  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  /** 깎은 모서리 사각형: tl tr br bl = 모서리마다 깎는 길이 */
  function cut(c, x, y, w, h, tl, tr, br, bl) {
    c.beginPath();
    c.moveTo(x + tl, y);
    c.lineTo(x + w - tr, y);
    c.lineTo(x + w, y + tr);
    c.lineTo(x + w, y + h - br);
    c.lineTo(x + w - br, y + h);
    c.lineTo(x + bl, y + h);
    c.lineTo(x, y + h - bl);
    c.lineTo(x, y + tl);
    c.closePath();
  }
  /** 평행사변형 (오른쪽으로 기운 사선): sk = 기울기 폭 */
  function para(c, x, y, w, h, sk) {
    c.beginPath();
    c.moveTo(x + sk, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w - sk, y + h);
    c.lineTo(x, y + h);
    c.closePath();
  }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const wcol = (k) => ((CX.wo(k) || {}).colors || {}).main || CYAN;
  /** 글자 색수차: 핑크·청록 겹을 어긋나게 깔고 위에 본 글자 */
  function rgbText(c, text, x, y, d, main, maxW) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha *= 0.85;
    c.fillStyle = PINK;
    c.fillText(text, x - d, y, maxW);
    c.fillStyle = CYAN;
    c.fillText(text, x + d, y, maxW);
    c.restore();
    c.fillStyle = main;
    c.fillText(text, x, y, maxW);
  }
  /** 조각 글리치: 가로 띠 몇 개를 옆으로 밀어 다시 그린다 (draw 를 띠마다 clip 해서) */
  function sliced(c, x0, y0, w, h, n, amp, seed, draw) {
    const bh = h / n;
    for (let i = 0; i < n; i++) {
      const off = (hash(seed + i * 3.7) - 0.5) * 2 * amp;
      c.save();
      c.beginPath();
      c.rect(x0 - 40, y0 + i * bh, w + 80, bh + 0.4);
      c.clip();
      c.translate(off, 0);
      draw();
      c.restore();
    }
  }
  let scanPat = null;
  function scanlines(c) {
    if (!scanPat) {
      const cv = document.createElement('canvas');
      cv.width = 4;
      cv.height = 3;
      const x = cv.getContext('2d');
      x.fillStyle = 'rgba(255,255,255,0.05)';
      x.fillRect(0, 0, 4, 1);
      scanPat = c.createPattern(cv, 'repeat');
    }
    return scanPat;
  }

  // ── 적 그림 (미리 그려 둔 실루엣) ──
  function shape(kind, r) {
    if (kind === 'boss')
      // 보스: 넓은 날개의 운반선 (아래로 머리)
      return [
        [0, r * 0.95],
        [r * 0.38, r * 0.72],
        [r * 1.28, r * 0.22],
        [r * 1.12, -r * 0.12],
        [r * 0.72, -r * 0.24],
        [r * 0.66, -r * 0.72],
        [r * 0.26, -r * 0.52],
        [0, -r * 0.92],
        [-r * 0.26, -r * 0.52],
        [-r * 0.66, -r * 0.72],
        [-r * 0.72, -r * 0.24],
        [-r * 1.12, -r * 0.12],
        [-r * 1.28, r * 0.22],
        [-r * 0.38, r * 0.72],
      ];
    if (kind === 'armor')
      return [
        [-r * 1.05, -r * 0.5],
        [-r * 0.6, -r * 1.0],
        [r * 0.6, -r * 1.0],
        [r * 1.05, -r * 0.5],
        [r * 0.92, r * 0.55],
        [r * 0.38, r * 1.05],
        [-r * 0.38, r * 1.05],
        [-r * 0.92, r * 0.55],
      ];
    if (kind === 'charge')
      return [
        [0, r * 1.75],
        [r * 0.62, r * 0.15],
        [r * 0.38, -r * 1.15],
        [0, -r * 0.75],
        [-r * 0.38, -r * 1.15],
        [-r * 0.62, r * 0.15],
      ];
    // 보통: 아래(방어선 쪽)로 머리를 둔 삼각 날개 드론
    return [
      [0, r * 1.2],
      [r * 1.05, -r * 0.5],
      [r * 0.55, -r * 0.62],
      [r * 0.3, -r * 0.22],
      [0, -r * 0.72],
      [-r * 0.3, -r * 0.22],
      [-r * 0.55, -r * 0.62],
      [-r * 1.05, -r * 0.5],
    ];
  }
  function trace(c, pts, dx, dy) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy)));
    c.closePath();
  }
  /** 적 한 종류의 그림 세 장: 몸(색수차 포함) · 흰 번쩍 · 청록(느려짐) */
  function enemySpr(e) {
    const kind = e.boss ? 'boss' : e.type;
    const r = e.r;
    const pad = Math.ceil(r * 1.9 + 8);
    const sz = pad * 2;
    const pts = shape(kind, r);
    const key = `city-en-${kind}-${r}`;
    const d = Math.max(1.2, r * 0.1);
    const body = sprite(key, sz, sz, (c) => {
      c.translate(pad, pad);
      // 바닥 그림자 (젖은 도로 위)
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.85)';
      c.shadowBlur = 6 * 3;
      c.shadowOffsetX = 2 * 3;
      c.shadowOffsetY = 4 * 3;
      c.fillStyle = '#000';
      trace(c, pts, 0, 0);
      c.fill();
      c.restore();
      // 색수차 겹 (핑크 왼쪽 · 청록 오른쪽) + 핑크 번짐
      c.save();
      c.shadowColor = 'rgba(255,46,136,0.42)';
      c.shadowBlur = 7 * 3;
      c.globalAlpha = 0.82;
      c.fillStyle = PINK;
      trace(c, pts, -d, -d * 0.3);
      c.fill();
      c.restore();
      c.globalAlpha = 0.74;
      c.fillStyle = CYAN;
      trace(c, pts, d, d * 0.3);
      c.fill();
      c.globalAlpha = 1;
      // 몸: 검은 실루엣 (위쪽만 살짝 밝게)
      const g = c.createLinearGradient(0, -r * 1.1, 0, r * 1.2);
      g.addColorStop(0, '#262A3E');
      g.addColorStop(0.45, '#0C0D16');
      g.addColorStop(1, '#030308');
      c.fillStyle = g;
      trace(c, pts, 0, 0);
      c.fill();
      // 판 이음
      c.strokeStyle = 'rgba(255,255,255,0.09)';
      c.lineWidth = 0.7;
      c.beginPath();
      if (kind === 'armor') {
        c.moveTo(-r * 0.7, -r * 0.45);
        c.lineTo(r * 0.7, -r * 0.45);
        c.moveTo(-r * 0.55, r * 0.55);
        c.lineTo(r * 0.55, r * 0.55);
        c.moveTo(0, -r * 0.45);
        c.lineTo(0, -r * 0.95);
      } else if (kind === 'boss') {
        c.moveTo(0, -r * 0.8);
        c.lineTo(0, r * 0.1);
        c.moveTo(-r * 0.42, r * 0.02);
        c.lineTo(-r * 1.05, r * 0.08);
        c.moveTo(r * 0.42, r * 0.02);
        c.lineTo(r * 1.05, r * 0.08);
        c.moveTo(-r * 0.3, -r * 0.3);
        c.lineTo(-r * 0.55, -r * 0.62);
        c.moveTo(r * 0.3, -r * 0.3);
        c.lineTo(r * 0.55, -r * 0.62);
      } else {
        c.moveTo(0, -r * 0.55);
        c.lineTo(0, r * 0.05);
      }
      c.stroke();
      // 앞날 하이라이트 (빛은 위 왼쪽에서)
      c.strokeStyle = 'rgba(220,230,255,0.26)';
      c.lineWidth = 0.8;
      c.beginPath();
      if (kind === 'armor') {
        c.moveTo(pts[0][0], pts[0][1]);
        c.lineTo(pts[1][0], pts[1][1]);
        c.lineTo(pts[2][0], pts[2][1]);
        c.lineTo(pts[3][0], pts[3][1]);
      } else {
        const L = pts[pts.length - 1];
        c.moveTo(L[0], L[1]);
        c.lineTo(pts[0][0], pts[0][1]);
      }
      c.stroke();
    });
    const flat = (col) => (c) => {
      c.translate(pad, pad);
      c.fillStyle = col;
      trace(c, pts, 0, 0);
      c.fill();
    };
    return {
      body,
      white: sprite(key + '-w', sz, sz, flat('#FFFFFF')),
      cyan: sprite(key + '-c', sz, sz, flat(CYAN)),
      pad,
      sz,
    };
  }

  // ── 바탕 ──
  const SIGNS = [
    { x: 22, y: 92, len: 40, col: PINK, v: 1 },
    { x: 22, y: 206, len: 14, col: YEL, v: 0 },
    { x: 22, y: 292, len: 46, col: CYAN, v: 1 },
    { x: 22, y: 398, len: 16, col: PINK, v: 0 },
    { x: 338, y: 140, len: 16, col: CYAN, v: 0 },
    { x: 338, y: 236, len: 44, col: PINK, v: 1 },
    { x: 338, y: 352, len: 30, col: YEL, v: 1 },
  ];
  function drawSign(c, s, a) {
    const L = s.x < W / 2;
    if (s.v) {
      // 벽면 세로 간판 (옥상 끝을 따라)
      const x = L ? s.x - 3 : s.x;
      c.fillStyle = '#05060A';
      c.fillRect(x - 1, s.y - s.len / 2 - 1, 5, s.len + 2);
      c.fillStyle = rgba(s.col, 0.95 * a);
      for (let yy = s.y - s.len / 2; yy < s.y + s.len / 2 - 1; yy += 5) c.fillRect(x + 0.5, yy, 2, 3.6);
      c.fillStyle = `rgba(255,255,255,${0.7 * a})`;
      for (let yy = s.y - s.len / 2; yy < s.y + s.len / 2 - 1; yy += 5) c.fillRect(x + 1.2, yy + 0.6, 0.6, 2.4);
    } else {
      // 보도 위로 튀어나온 가로 간판
      const x0 = L ? s.x - 4 : s.x - 10;
      c.fillStyle = '#05060A';
      c.fillRect(x0 - 1, s.y - 2.5, s.len + 2, 5);
      c.fillStyle = rgba(s.col, 0.95 * a);
      c.fillRect(x0, s.y - 1.5, s.len, 3);
      c.fillStyle = `rgba(255,255,255,${0.75 * a})`;
      c.fillRect(x0 + 1, s.y - 0.4, s.len - 2, 0.8);
    }
  }

  function drawBg(c) {
    const R = rng(2411);
    c.fillStyle = '#08090F';
    c.fillRect(0, 0, W, FH);
    // 도로 (아스팔트)
    const g = c.createLinearGradient(RL, 0, RR, 0);
    g.addColorStop(0, '#0C0E17');
    g.addColorStop(0.5, '#13151F');
    g.addColorStop(1, '#0C0E17');
    c.fillStyle = g;
    c.fillRect(RL, 0, RR - RL, LINE_Y);
    // 바퀴 자국 (차로마다 두 줄, 젖은 길에서 더 어둡다)
    for (const lc of [70.5, 143.5, 216.5, 289.5]) {
      for (const o of [-17, 17]) {
        const tg = c.createLinearGradient(lc + o - 7, 0, lc + o + 7, 0);
        tg.addColorStop(0, 'rgba(0,0,0,0)');
        tg.addColorStop(0.5, 'rgba(0,0,0,0.2)');
        tg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = tg;
        c.fillRect(lc + o - 7, 0, 14, LINE_Y);
      }
    }
    // 가로등 빛 웅덩이 (연석 쪽)
    for (const [lx, ly] of [
      [RL + 6, 168],
      [RR - 6, 58],
      [RR - 6, 300],
      [RL + 6, 372],
    ]) {
      c.save();
      c.translate(lx, ly);
      c.scale(1.25, 1);
      const pg = c.createRadialGradient(0, 0, 0, 0, 0, 62);
      pg.addColorStop(0, 'rgba(200,220,255,0.075)');
      pg.addColorStop(0.6, 'rgba(160,190,255,0.03)');
      pg.addColorStop(1, 'rgba(160,190,255,0)');
      c.fillStyle = pg;
      c.fillRect(-62, -62, 124, 124);
      c.restore();
    }
    // 아스팔트 결
    for (let i = 0; i < 2200; i++) {
      c.fillStyle = R() < 0.5 ? `rgba(200,210,255,${0.02 + R() * 0.04})` : `rgba(0,0,0,${0.2 + R() * 0.25})`;
      c.fillRect(RL + R() * (RR - RL), R() * LINE_Y, 1, 1);
    }
    // 금
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      let x = RL + 20 + R() * (RR - RL - 40);
      let y = 20 + R() * 380;
      c.beginPath();
      c.moveTo(x, y);
      for (let j = 0; j < 6; j++) c.lineTo((x += (R() - 0.5) * 14), (y += 4 + R() * 7));
      c.stroke();
    }
    // 차선: 가운데 노랑 겹선 · 흰 점선 · 가장자리 실선
    c.fillStyle = 'rgba(255,216,74,0.2)';
    c.fillRect(177.4, 0, 1.4, LINE_Y);
    c.fillRect(181.2, 0, 1.4, LINE_Y);
    c.fillStyle = 'rgba(230,236,255,0.15)';
    for (const lx of [107, 253]) for (let y = -6; y < 392; y += 34) c.fillRect(lx - 0.8, y, 1.6, 18);
    c.fillStyle = 'rgba(230,236,255,0.11)';
    c.fillRect(RL + 4, 0, 1.4, LINE_Y);
    c.fillRect(RR - 5.4, 0, 1.4, LINE_Y);
    // 진행 방향 화살표 (아래로)
    c.fillStyle = 'rgba(230,236,255,0.07)';
    for (const ax of [143.5, 216.5]) {
      c.fillRect(ax - 1.6, 236, 3.2, 26);
      c.beginPath();
      c.moveTo(ax - 7, 260);
      c.lineTo(ax + 7, 260);
      c.lineTo(ax, 274);
      c.closePath();
      c.fill();
    }
    // 횡단보도 (차단선 바로 위)
    c.fillStyle = 'rgba(230,236,255,0.06)';
    for (let x = RL + 10; x < RR - 12; x += 18) c.fillRect(x, 404, 9, 30);
    c.fillStyle = 'rgba(230,236,255,0.10)';
    c.fillRect(RL + 4, 398, RR - RL - 8, 2);
    // 맨홀
    c.fillStyle = '#0A0B11';
    c.beginPath();
    c.arc(258, 162, 9, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(150,165,210,0.12)';
    c.lineWidth = 1;
    c.stroke();
    c.beginPath();
    for (let k = -6; k <= 6; k += 3) {
      const hw = Math.sqrt(64 - k * k);
      c.moveTo(258 - hw, 162 + k);
      c.lineTo(258 + hw, 162 + k);
    }
    c.lineWidth = 0.6;
    c.strokeStyle = 'rgba(150,165,210,0.07)';
    c.stroke();
    // 물웅덩이 (젖은 빛)
    for (const [px, py, pr] of [
      [92, 128, 20],
      [236, 300, 24],
      [70, 352, 16],
      [292, 74, 14],
      [170, 196, 12],
    ]) {
      c.save();
      c.translate(px, py);
      c.scale(1.7, 1);
      const rg = c.createRadialGradient(0, 0, 0, 0, 0, pr);
      rg.addColorStop(0, 'rgba(70,90,150,0.16)');
      rg.addColorStop(0.75, 'rgba(50,64,110,0.10)');
      rg.addColorStop(1, 'rgba(40,50,90,0)');
      c.fillStyle = rg;
      c.beginPath();
      c.arc(0, 0, pr, 0, TAU);
      c.arc(pr * 0.6, pr * 0.35, pr * 0.6, 0, TAU);
      c.fill();
      c.restore();
    }
    // 보도 + 연석
    for (const [x0, x1] of [
      [21, RL],
      [RR, 339],
    ]) {
      c.fillStyle = '#111320';
      c.fillRect(x0, 0, x1 - x0, LINE_Y);
      c.fillStyle = 'rgba(255,255,255,0.035)';
      for (let y = 0; y < LINE_Y; y += 13) c.fillRect(x0, y, x1 - x0, 0.7);
    }
    c.fillStyle = 'rgba(190,205,255,0.16)';
    c.fillRect(RL - 1, 0, 1, LINE_Y);
    c.fillRect(RR, 0, 1, LINE_Y);
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(RL, 0, 2.5, LINE_Y);
    c.fillRect(RR - 2.5, 0, 2.5, LINE_Y);
    // 건물 옥상 (양옆): 화면 밖으로 이어지는 건물의 도로 쪽 끝만 보인다
    for (const [x0, w0, L] of [
      [0, 21, true],
      [339, 21, false],
    ]) {
      // 골목 (건물 사이) 바탕
      c.fillStyle = '#040509';
      c.fillRect(x0, 0, w0, LINE_Y);
      let y = -12 - R() * 30;
      while (y < LINE_Y) {
        const bh = 56 + R() * 92;
        const ww = w0 - R() * 6;
        const bx = L ? x0 : x0 + (w0 - ww);
        const by = y + 1.5;
        const hh = bh - 3;
        const shade = ['#10121D', '#131624', '#0F111B', '#151828'][Math.floor(R() * 4)];
        c.fillStyle = shade;
        c.fillRect(bx, by, ww, hh);
        // 자갈 결
        for (let i = 0; i < hh * ww * 0.25; i++) {
          c.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.3)';
          c.fillRect(bx + R() * ww, by + R() * hh, 0.8, 0.8);
        }
        // 난간 (도로 쪽 · 위 · 아래 테) + 안쪽 그늘
        const ex = L ? bx + ww - 1.6 : bx;
        c.fillStyle = 'rgba(200,210,255,0.13)';
        c.fillRect(ex, by, 1.6, hh);
        c.fillRect(bx, by, ww, 1.4);
        c.fillRect(bx, by + hh - 1.4, ww, 1.4);
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(L ? ex - 2 : ex + 1.6, by + 1.4, 2, hh - 2.8);
        c.fillRect(bx, by + 1.4, ww, 2);
        // 옥상 물건: 실외기 · 물탱크 · 환기구 · 천창
        const n = 1 + Math.floor(R() * 3);
        for (let i = 0; i < n; i++) {
          const oy = by + 8 + (i + R() * 0.6) * ((hh - 22) / n);
          const ox = bx + 2 + R() * Math.max(1, ww - 13);
          const k = R();
          if (k < 0.38) {
            c.fillStyle = 'rgba(0,0,0,0.5)';
            c.fillRect(ox + 1.5, oy + 1.5, 9, 7);
            c.fillStyle = '#1E2232';
            c.fillRect(ox, oy, 9, 7);
            c.fillStyle = 'rgba(255,255,255,0.10)';
            c.fillRect(ox, oy, 9, 0.8);
            c.strokeStyle = 'rgba(255,255,255,0.14)';
            c.lineWidth = 0.6;
            c.beginPath();
            c.arc(ox + 4.5, oy + 3.6, 2.4, 0, TAU);
            c.moveTo(ox + 2.6, oy + 3.6);
            c.lineTo(ox + 6.4, oy + 3.6);
            c.stroke();
          } else if (k < 0.62) {
            c.fillStyle = 'rgba(0,0,0,0.5)';
            c.beginPath();
            c.arc(ox + 5.5, oy + 5.5, 4.2, 0, TAU);
            c.fill();
            c.fillStyle = '#1A1E2D';
            c.beginPath();
            c.arc(ox + 4.5, oy + 4.5, 4.2, 0, TAU);
            c.fill();
            c.strokeStyle = 'rgba(255,255,255,0.12)';
            c.lineWidth = 0.6;
            c.stroke();
            c.beginPath();
            c.arc(ox + 4.5, oy + 4.5, 2, 0, TAU);
            c.stroke();
          } else if (k < 0.82) {
            // 천창: 아래층 불빛이 새어 나온다
            c.fillStyle = '#05060A';
            c.fillRect(ox, oy, 8, 10);
            c.fillStyle = R() < 0.5 ? 'rgba(255,216,74,0.22)' : 'rgba(25,230,255,0.18)';
            c.fillRect(ox + 1, oy + 1, 2.6, 3.6);
            c.fillRect(ox + 4.4, oy + 1, 2.6, 3.6);
            c.fillRect(ox + 1, oy + 5.4, 2.6, 3.6);
            c.fillRect(ox + 4.4, oy + 5.4, 2.6, 3.6);
          } else {
            c.fillStyle = '#0A0C14';
            c.fillRect(ox, oy, 5, 5);
            c.fillStyle = 'rgba(255,255,255,0.1)';
            c.fillRect(ox, oy, 5, 0.8);
          }
        }
        y += bh;
      }
      // 건물 그림자가 보도에 떨어진다
      const sx = L ? x0 + w0 : x0 - 6;
      const sg = c.createLinearGradient(sx, 0, sx + 6, 0);
      sg.addColorStop(L ? 0 : 1, 'rgba(0,0,0,0.55)');
      sg.addColorStop(L ? 1 : 0, 'rgba(0,0,0,0)');
      c.fillStyle = sg;
      c.fillRect(sx, 0, 6, LINE_Y);
    }
    // 간판 빛 번짐 + 젖은 도로 위 세로 반사
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const s of SIGNS) {
      const L = s.x < W / 2;
      const rg = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, 54 + s.len * 0.4);
      rg.addColorStop(0, rgba(s.col, 0.2));
      rg.addColorStop(1, rgba(s.col, 0));
      c.fillStyle = rg;
      c.fillRect(s.x - 90, s.y - 90, 180, 180);
      // 반사: 도로 안쪽으로 길게 늘어진 빛
      const rx = L ? RL + 16 + s.len * 0.2 : RR - 16 - s.len * 0.2;
      c.save();
      c.translate(rx, s.y + 18);
      c.scale(1, 5.5);
      const rg2 = c.createRadialGradient(0, 0, 0, 0, 0, 14);
      rg2.addColorStop(0, rgba(s.col, 0.13));
      rg2.addColorStop(1, rgba(s.col, 0));
      c.fillStyle = rg2;
      c.fillRect(-14, -14, 28, 28);
      c.restore();
      // 반사 속 잔물결
      c.fillStyle = rgba(s.col, 0.12);
      for (let i = 0; i < 6; i++) c.fillRect(rx - 6 + R() * 6, s.y - 30 + i * 13 + R() * 6, 4 + R() * 8, 0.8);
    }
    c.restore();
    for (const s of SIGNS) drawSign(c, s, 1);
    // 위는 어둡게 (적이 어둠에서 나온다) · 양옆도 살짝
    const tv = c.createLinearGradient(0, 0, 0, 110);
    tv.addColorStop(0, 'rgba(4,5,9,0.8)');
    tv.addColorStop(1, 'rgba(4,5,9,0)');
    c.fillStyle = tv;
    c.fillRect(0, 0, W, 110);
    // 차단선 위 도로에 비친 청록 빛
    const lg = c.createLinearGradient(0, 380, 0, LINE_Y);
    lg.addColorStop(0, 'rgba(25,230,255,0)');
    lg.addColorStop(1, 'rgba(25,230,255,0.07)');
    c.fillStyle = lg;
    c.fillRect(0, 380, W, LINE_Y - 380);
    // ── 차단선 아래: 무기를 놓은 광장 (젖은 보도블록) ──
    plaza(c, LINE_Y, FH);
    // 경고 띠 (노랑·검정 사선)
    c.save();
    c.beginPath();
    c.rect(0, LINE_Y + 3, W, 5);
    c.clip();
    c.fillStyle = '#0A0A0C';
    c.fillRect(0, LINE_Y + 3, W, 5);
    c.fillStyle = 'rgba(255,216,74,0.62)';
    for (let x = -10; x < W + 10; x += 12) {
      c.beginPath();
      c.moveTo(x, LINE_Y + 8);
      c.lineTo(x + 5, LINE_Y + 3);
      c.lineTo(x + 11, LINE_Y + 3);
      c.lineTo(x + 6, LINE_Y + 8);
      c.closePath();
      c.fill();
    }
    c.restore();
    // 광장에 비친 차단선 빛
    const pg = c.createLinearGradient(0, LINE_Y + 8, 0, LINE_Y + 60);
    pg.addColorStop(0, 'rgba(25,230,255,0.10)');
    pg.addColorStop(1, 'rgba(25,230,255,0)');
    c.fillStyle = pg;
    c.fillRect(0, LINE_Y + 8, W, 52);
  }
  function plaza(c, y0, y1) {
    c.fillStyle = '#0A0B12';
    c.fillRect(0, y0, W, y1 - y0);
    c.strokeStyle = 'rgba(150,170,230,0.055)';
    c.lineWidth = 0.8;
    c.beginPath();
    for (let x = 6; x < W; x += 24) {
      c.moveTo(x, Math.max(y0 + 8, y0));
      c.lineTo(x, y1);
    }
    for (let y = LINE_Y + 20; y < y1; y += 24) {
      c.moveTo(0, y);
      c.lineTo(W, y);
    }
    c.stroke();
  }

  // ── 비 ──
  const DROPS = [];
  {
    const R = rng(77);
    for (let i = 0; i < 110; i++) DROPS.push({ x: R() * (W + 60), y: R() * FH, v: 420 + R() * 260, l: 6 + R() * 10, hi: i % 6 === 0 });
  }

  CX.defineTheme('city', {
    name: '네온 도시',
    desc: '비 오는 밤 도로 · 네온 반사 · 글리치 실루엣 · 사선 HUD',
    fonts: ['Oswald', 'Gothic A1', 'Noto Sans KR'],

    bg(scale) {
      return bgCanvas(scale, (c) => drawBg(c));
    },

    sky(c, t) {
      c.save();
      // 빗줄기 (바람에 살짝 기움)
      const slant = 0.14;
      for (const hi of [false, true]) {
        c.strokeStyle = hi ? 'rgba(200,225,255,0.34)' : 'rgba(160,190,240,0.17)';
        c.lineWidth = hi ? 1 : 0.8;
        c.beginPath();
        for (const d of DROPS) {
          if (d.hi !== hi) continue;
          const yy = (d.y + t * d.v) % (FH + 30);
          const xx = (((d.x - (t * d.v) * slant) % (W + 60)) + W + 60) % (W + 60) - 30;
          c.moveTo(xx, yy);
          c.lineTo(xx + d.l * slant, yy - d.l);
        }
        c.stroke();
      }
      // 빗방울 파문 (자리가 바뀌며)
      c.lineWidth = 0.7;
      for (let i = 0; i < 18; i++) {
        const p = 0.8 + hash(i) * 0.9;
        const tt = t + hash(i + 40) * p;
        const n = Math.floor(tt / p);
        const ph = (tt % p) / p;
        if (ph > 0.55) continue;
        const k = ph / 0.55;
        const x = 12 + hash(n * 7.1 + i * 13.3) * (W - 24);
        const y = 30 + hash(n * 3.3 + i * 5.7) * (FH - 40);
        c.strokeStyle = `rgba(190,215,255,${0.32 * (1 - k)})`;
        c.beginPath();
        c.ellipse(x, y, 1 + k * 6, 0.5 + k * 2.6, 0, 0, TAU);
        c.stroke();
      }
      // 깜빡이는 간판 (하나는 끊기고, 하나는 숨쉬듯)
      const f = Math.sin(t * 23) * Math.sin(t * 3.1 + 1) > 0.55 || (t % 4.1) < 0.12;
      if (f) {
        c.globalAlpha = 0.85;
        const s = SIGNS[5];
        c.fillStyle = '#05060A';
        c.fillRect(s.x - 1, s.y - s.len / 2 - 1, 5, s.len + 2);
        c.globalAlpha = 1;
      }
      c.globalCompositeOperation = 'lighter';
      // 옥상 항공 경고등 (느리게 깜빡)
      for (const [lx, ly, o] of [
        [9, 128, 0],
        [12, 338, 0.7],
        [350, 196, 0.35],
        [348, 418, 1.1],
      ]) {
        const on = (t + o) % 1.8 < 0.22;
        c.fillStyle = on ? 'rgba(255,60,110,0.35)' : 'rgba(255,60,110,0.06)';
        c.fillRect(lx - 3.5, ly - 3.5, 7, 7);
        c.fillStyle = on ? '#FF8FB8' : 'rgba(255,46,136,0.35)';
        c.fillRect(lx - 1, ly - 1, 2, 2);
      }
      const s2 = SIGNS[2];
      c.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.7);
      drawSign(c, s2, 1);
      c.restore();
    },

    enemy(c, e, t) {
      if (!e.alive && e.flash <= 0) return;
      const S = enemySpr(e);
      const r = e.r;
      const x0 = e.x - S.pad;
      const y0 = e.y - S.pad;
      c.save();
      if (!e.alive) {
        // 사라짐: 띠로 갈라져 옆으로 흩어지며 꺼진다
        const k = clamp(e.flash / 0.12, 0, 1);
        const n = 5;
        const bh = S.sz / n;
        c.globalAlpha = k;
        for (let i = 0; i < n; i++) {
          const off = (hash(e.ph * 10 + i) - 0.5) * 2 * (1 - k) * 16;
          c.drawImage(S.body, 0, i * bh * 3, S.sz * 3, bh * 3, x0 + off, y0 + i * bh, S.sz, bh);
        }
        c.globalAlpha = k * 0.9;
        c.drawImage(S.white, x0, y0, S.sz, S.sz);
        c.restore();
        return;
      }
      // 돌격: 뒤로 끌리는 색 줄
      if (e.type === 'charge') {
        c.globalCompositeOperation = 'lighter';
        c.lineWidth = 1.2;
        c.strokeStyle = 'rgba(255,46,136,0.5)';
        c.beginPath();
        c.moveTo(e.x - r * 0.35, e.y - r * 0.9);
        c.lineTo(e.x - r * 0.35, e.y - r * 3.6);
        c.stroke();
        c.strokeStyle = 'rgba(25,230,255,0.45)';
        c.beginPath();
        c.moveTo(e.x + r * 0.35, e.y - r * 0.9);
        c.lineTo(e.x + r * 0.35, e.y - r * 2.8);
        c.stroke();
        c.globalCompositeOperation = 'source-over';
      }
      if (e.boss) {
        // 보스: 발밑 경고 고리
        const p = (t * 0.8) % 1;
        c.strokeStyle = `rgba(255,46,136,${0.55 * (1 - p)})`;
        c.lineWidth = 1.4;
        c.beginPath();
        c.ellipse(e.x, e.y + 4, r * (1.3 + p * 0.6), r * (0.9 + p * 0.4), 0, 0, TAU);
        c.stroke();
      }
      // 글리치: 가끔 몸이 가로 띠로 어긋난다 (맞을 때는 꼭)
      const gl = Math.sin(t * 5.3 + e.ph * 7.7) * Math.sin(t * 1.9 + e.ph) > 0.82 || e.flash > 0.07;
      if (gl) {
        const n = 3;
        const bh = S.sz / n;
        const seed = Math.floor(t * 18) + e.ph * 31;
        for (let i = 0; i < n; i++) {
          const off = (hash(seed + i) - 0.5) * (e.flash > 0.07 ? 7 : 5);
          c.drawImage(S.body, 0, i * bh * 3, S.sz * 3, bh * 3, x0 + off, y0 + i * bh, S.sz, bh);
        }
      } else c.drawImage(S.body, x0, y0, S.sz, S.sz);
      // 눈
      const pul = 0.75 + Math.sin(t * 6 + e.ph) * 0.25;
      c.globalCompositeOperation = 'lighter';
      if (e.boss) {
        // 넓은 눈가리개 하나 + 날개 끝 불빛 둘
        c.fillStyle = `rgba(255,46,136,${0.5 * pul})`;
        c.fillRect(e.x - r * 0.5 - 2, e.y + r * 0.36 - 2.6, r + 4, 5.2);
        c.fillStyle = `rgba(255,214,232,${pul})`;
        c.fillRect(e.x - r * 0.5, e.y + r * 0.36 - 1, r, 2);
        for (const sx of [-1, 1]) {
          c.fillStyle = `rgba(255,216,74,${0.4 + 0.6 * pul})`;
          c.fillRect(e.x + sx * r * 1.0 - 1.5, e.y + r * 0.12 - 1.5, 3, 3);
        }
      } else {
        const ew = e.type === 'armor' ? r * 1.05 : e.type === 'charge' ? r * 0.5 : r * 0.72;
        const ey = e.type === 'armor' ? r * 0.08 : e.type === 'charge' ? r * 0.5 : r * 0.18;
        c.fillStyle = `rgba(255,46,136,${0.55 * pul})`;
        c.fillRect(e.x - ew / 2 - 1.5, e.y + ey - 1.9, ew + 3, 3.8);
        c.fillStyle = `rgba(255,214,232,${0.95 * pul})`;
        c.fillRect(e.x - ew / 2, e.y + ey - 0.7, ew, 1.4);
      }
      c.globalCompositeOperation = 'source-over';
      if (e.slow > 0) {
        c.globalAlpha = 0.32;
        c.drawImage(S.cyan, x0, y0, S.sz, S.sz);
        c.globalAlpha = 1;
        c.strokeStyle = 'rgba(25,230,255,0.75)';
        c.lineWidth = 1;
        c.setLineDash([3, 3]);
        c.beginPath();
        c.arc(e.x, e.y, r * 1.45, 0, TAU);
        c.stroke();
        c.setLineDash([]);
      }
      if (e.flash > 0) {
        c.globalAlpha = (e.flash / 0.12) * 0.85;
        c.drawImage(S.white, x0, y0, S.sz, S.sz);
        c.globalAlpha = 1;
      }
      if (e.boss) {
        // 체력 줄 (사선 끝)
        const bw = r * 2.4;
        const k = clamp(e.hp / e.max, 0, 1);
        const by = e.y - r * 1.4 - 10;
        c.fillStyle = 'rgba(5,6,12,0.85)';
        para(c, e.x - bw / 2 - 2, by - 2, bw + 4, 7, 3);
        c.fill();
        c.fillStyle = PINK;
        para(c, e.x - bw / 2, by, Math.max(4, bw * k), 3, 2);
        c.fill();
      }
      c.restore();
    },

    boom(c, b) {
      const k = b.age / 0.55;
      const a = 1 - k;
      c.save();
      c.globalCompositeOperation = 'lighter';
      if (b.leak) {
        // 뚫림: 차단선 위 핑크 찢김 + 위로 솟는 경고 꺾쇠
        const w = 28 + k * 40;
        c.fillStyle = `rgba(255,46,136,${0.9 * a})`;
        c.fillRect(b.x - w, b.y - 1.5, w * 2, 3);
        c.fillStyle = `rgba(25,230,255,${0.6 * a})`;
        c.fillRect(b.x - w * 0.7 + 4, b.y - 5, w * 1.4, 1.4);
        c.strokeStyle = `rgba(255,216,74,${a})`;
        c.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          const yy = b.y - 8 - k * 18 - i * 7;
          c.beginPath();
          c.moveTo(b.x - 8, yy + 5);
          c.lineTo(b.x, yy);
          c.lineTo(b.x + 8, yy + 5);
          c.stroke();
        }
        c.restore();
        return;
      }
      const r = b.r * (0.35 + ease(k * 1.6) * 0.75);
      // 속 섬광
      if (k < 0.45) {
        const fa = 1 - k / 0.45;
        const rg = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 0.95);
        rg.addColorStop(0, `rgba(255,255,255,${0.95 * fa})`);
        rg.addColorStop(0.35, `rgba(255,120,190,${0.55 * fa})`);
        rg.addColorStop(1, 'rgba(255,46,136,0)');
        c.fillStyle = rg;
        c.beginPath();
        c.arc(b.x, b.y, r * 0.95, 0, TAU);
        c.fill();
      }
      // 색수차 고리: 핑크 왼쪽 · 청록 오른쪽 · 흰 가운데
      const d = 1.5 + k * 5;
      c.lineWidth = 2.2 * a + 0.4;
      c.strokeStyle = `rgba(255,46,136,${0.85 * a})`;
      c.beginPath();
      c.arc(b.x - d, b.y, r, 0, TAU);
      c.stroke();
      c.strokeStyle = `rgba(25,230,255,${0.85 * a})`;
      c.beginPath();
      c.arc(b.x + d, b.y, r, 0, TAU);
      c.stroke();
      c.lineWidth = 1;
      c.strokeStyle = `rgba(255,255,255,${0.75 * a})`;
      c.beginPath();
      c.arc(b.x, b.y, r, 0, TAU);
      c.stroke();
      if (b.big) {
        c.strokeStyle = `rgba(255,216,74,${0.8 * a})`;
        c.lineWidth = 1.6;
        c.beginPath();
        c.arc(b.x, b.y, r * 1.28, 0, TAU);
        c.stroke();
      }
      // 글리치 조각 (네모 픽셀 조각이 흩어진다)
      const seed = Math.floor(b.x * 13.7 + b.y * 7.3);
      const n = b.big ? 12 : 8;
      const cols = ['255,46,136', '25,230,255', '255,255,255', '255,216,74'];
      for (let i = 0; i < n; i++) {
        const an = hash(seed + i) * TAU;
        const dist = r * (0.45 + hash(seed + i + 50) * 0.7) * (0.6 + k * 0.9);
        const sw = 2 + hash(seed + i + 90) * 7;
        const sh = 1.2 + hash(seed + i + 130) * 2.2;
        c.fillStyle = `rgba(${cols[i % 4]},${(i % 4 === 3 && !b.big ? 0.6 : 0.95) * a})`;
        c.fillRect(b.x + Math.cos(an) * dist - sw / 2, b.y + Math.sin(an) * dist - sh / 2, sw, sh);
      }
      // 가로 찢김 줄 (처음 반)
      if (k < 0.5) {
        const ta = 1 - k / 0.5;
        const oy = (hash(seed + 7) - 0.5) * r * 0.8;
        c.fillStyle = `rgba(25,230,255,${0.5 * ta})`;
        c.fillRect(b.x - r * 1.5, b.y + oy - 0.7, r * 3, 1.4);
        c.fillStyle = `rgba(255,46,136,${0.45 * ta})`;
        c.fillRect(b.x - r * 1.1 + 6, b.y + oy + 3, r * 2.2, 1);
      }
      c.restore();
    },

    seam(c, s) {
      // 회로처럼 꺾인 길 (45° 먼저, 그다음 곧게) 위로 빛 알갱이가 달린다
      const k = s.age / 0.3;
      const a = 1 - k;
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const m = Math.min(Math.abs(dx), Math.abs(dy));
      const mx = s.x1 + Math.sign(dx) * m;
      const my = s.y1 + Math.sign(dy) * m;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineJoin = 'miter';
      c.lineWidth = 1;
      c.strokeStyle = `rgba(255,46,136,${0.7 * a})`;
      c.beginPath();
      c.moveTo(s.x1 - 1.5, s.y1);
      c.lineTo(mx - 1.5, my);
      c.lineTo(s.x2 - 1.5, s.y2);
      c.stroke();
      c.lineWidth = 1.8;
      c.strokeStyle = `rgba(25,230,255,${0.95 * a})`;
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.lineTo(mx, my);
      c.lineTo(s.x2, s.y2);
      c.stroke();
      // 알갱이
      const l1 = Math.hypot(mx - s.x1, my - s.y1);
      const l2 = Math.hypot(s.x2 - mx, s.y2 - my);
      const p = ease(Math.min(1, k * 1.6)) * (l1 + l2);
      const px = p < l1 ? s.x1 + ((mx - s.x1) * p) / (l1 || 1) : mx + ((s.x2 - mx) * (p - l1)) / (l2 || 1);
      const py = p < l1 ? s.y1 + ((my - s.y1) * p) / (l1 || 1) : my + ((s.y2 - my) * (p - l1)) / (l2 || 1);
      c.fillStyle = `rgba(255,255,255,${a})`;
      c.fillRect(px - 2, py - 2, 4, 4);
      c.restore();
    },

    num(c, n) {
      const a = n.age > 0.5 ? 1 - (n.age - 0.5) / 0.3 : 1;
      const pop = n.age < 0.08 ? 1 + (1 - n.age / 0.08) * 0.4 : 1;
      const size = n.kind === 2 ? 20 : n.kind === 1 ? 15 : 12;
      const v = String(n.v);
      c.save();
      c.globalAlpha = Math.max(0, a);
      c.translate(n.x, n.y);
      c.transform(1, 0, -0.18, 1, 0, 0);
      c.scale(pop, pop);
      c.font = `700 ${size}px ${NUM}`;
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.lineJoin = 'round';
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(4,5,10,0.92)';
      c.strokeText(v, 0, 0);
      if (n.kind === 2) {
        c.fillStyle = PINK;
        c.fillText(v, -1.6, 0);
        c.fillStyle = CYAN;
        c.fillText(v, 1.6, 0);
      }
      c.fillStyle = n.kind === 2 ? YEL : n.kind === 1 ? '#7CF4FF' : '#FFFFFF';
      c.fillText(v, 0, 0);
      c.restore();
    },

    line(c, t) {
      c.save();
      // 판 아래 남는 자리(540~)까지 광장을 잇는다 (두 줄일 때 레벨 표시가 걸치는 곳)
      plaza(c, FH, FH + 40);
      c.globalCompositeOperation = 'lighter';
      const fl = 0.86 + 0.14 * Math.sin(t * 29) * Math.sin(t * 6.7);
      const g = c.createLinearGradient(0, LINE_Y - 9, 0, LINE_Y + 9);
      g.addColorStop(0, 'rgba(25,230,255,0)');
      g.addColorStop(0.5, `rgba(25,230,255,${0.3 * fl})`);
      g.addColorStop(1, 'rgba(25,230,255,0)');
      c.fillStyle = g;
      c.fillRect(0, LINE_Y - 9, W, 18);
      c.fillStyle = `rgba(25,230,255,${0.95 * fl})`;
      c.fillRect(0, LINE_Y - 1, W, 2);
      c.fillStyle = 'rgba(225,252,255,0.9)';
      c.fillRect(0, LINE_Y - 0.35, W, 0.7);
      // 훑고 지나가는 밝은 마디
      const sx = ((t * 150) % (W + 160)) - 80;
      const sg = c.createLinearGradient(sx - 60, 0, sx + 60, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0.75)');
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = sg;
      c.fillRect(sx - 60, LINE_Y - 1.5, 120, 3);
      // 발생기 (차단선을 만드는 기둥)
      c.globalCompositeOperation = 'source-over';
      for (let x = 30; x < W; x += 60) {
        c.fillStyle = '#161927';
        cut(c, x - 5, LINE_Y - 3.5, 10, 7, 2, 2, 2, 2);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.18)';
        c.lineWidth = 0.6;
        c.stroke();
        const p = 0.5 + 0.5 * Math.sin(t * 3 + x * 0.1);
        c.fillStyle = `rgba(25,230,255,${0.6 + 0.4 * p})`;
        c.fillRect(x - 2, LINE_Y - 0.8, 4, 1.6);
      }
      c.restore();
    },

    chain(c, n, since) {
      // 오른쪽 연쇄 계기: 가운데(웨이브 · 합성 알림)를 비워 두고 옆에서 센다
      const pop = 1 + 0.3 * Math.max(0, 1 - since / 0.18);
      const a = since > 0.8 ? 1 - (since - 0.8) / 0.3 : 1;
      const v = String(n);
      c.save();
      c.globalAlpha = Math.max(0, a);
      c.translate(W - 14, 136);
      c.scale(pop, pop);
      // 꼬리표: 노랑 사선 띠 '연쇄'
      c.fillStyle = YEL;
      para(c, -50, -64, 50, 16, 5);
      c.fill();
      c.fillStyle = INK;
      c.font = `900 11.5px ${KOR}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('연쇄', -25, -55.5);
      // 이어 갈 시간 (1.3초 안에 다음 폭발이 나야 이어진다)
      const k = clamp(1 - since / 1.3, 0, 1);
      c.fillStyle = 'rgba(255,255,255,0.14)';
      para(c, -64, 6, 64, 3, 2);
      c.fill();
      c.fillStyle = CYAN;
      para(c, -64 * k, 6, 64 * k, 3, 2);
      c.fill();
      // 숫자: 기울인 굵은 숫자 + 색수차
      c.transform(1, 0, -0.16, 1, 0, 0);
      c.textAlign = 'right';
      c.textBaseline = 'alphabetic';
      c.font = `700 54px ${NUM}`;
      const d = 2 + Math.max(0, 1 - since / 0.25) * 4;
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,46,136,0.9)';
      c.fillText(v, -d, 0);
      c.fillStyle = 'rgba(25,230,255,0.9)';
      c.fillText(v, d, 0);
      c.restore();
      c.shadowColor = 'rgba(255,46,136,0.75)';
      c.shadowBlur = 14;
      c.fillStyle = '#FFFFFF';
      c.fillText(v, 0, 0);
      c.restore();
    },

    // ── 무기 받침: 젖은 바닥 위 금속 포대 + 세계 색 바닥 조명 ──
    base(c, w, x, y, s, t) {
      const col = wcol(w.world);
      const sub = w.sub ? wcol(w.subWorld) : null;
      const cy = y + s * 0.3;
      const hw = s * 0.46;
      const hh = s * 0.14;
      const ext = s * 0.08;
      // 바닥 조명 (젖은 바닥에 번진 색)
      c.save();
      c.globalCompositeOperation = 'lighter';
      const gl = sprite('city-glow-' + col, 60, 20, (g) => {
        const rg = g.createRadialGradient(30, 10, 0, 30, 10, 30);
        rg.addColorStop(0, rgba(col, 0.55));
        rg.addColorStop(0.5, rgba(col, 0.16));
        rg.addColorStop(1, rgba(col, 0));
        g.save();
        g.translate(30, 10);
        g.scale(1, 1 / 3);
        g.translate(-30, -10);
        g.fillStyle = rg;
        g.fillRect(0, -20, 60, 60);
        g.restore();
      });
      c.globalAlpha = 0.75;
      c.drawImage(gl, x - s * 0.95, cy + ext - s * 0.18, s * 1.9, s * 0.63);
      c.restore();
      // 그림자
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.beginPath();
      c.ellipse(x + 1.5, cy + ext + 2, hw * 1.05, hh * 1.15, 0, 0, TAU);
      c.fill();
      const oct = (oy, k) => {
        const H = hh * k;
        const X = hw * k;
        c.beginPath();
        c.moveTo(x - X, cy + oy - H * 0.35);
        c.lineTo(x - X * 0.6, cy + oy - H);
        c.lineTo(x + X * 0.6, cy + oy - H);
        c.lineTo(x + X, cy + oy - H * 0.35);
        c.lineTo(x + X, cy + oy + H * 0.35);
        c.lineTo(x + X * 0.6, cy + oy + H);
        c.lineTo(x - X * 0.6, cy + oy + H);
        c.lineTo(x - X, cy + oy + H * 0.35);
        c.closePath();
      };
      // 옆면 (두께)
      c.fillStyle = '#06070C';
      for (let o = ext; o > 0; o -= 1.2) {
        oct(o, 1);
        c.fill();
      }
      // 윗면
      const g = c.createLinearGradient(0, cy - hh, 0, cy + hh);
      g.addColorStop(0, '#2C3144');
      g.addColorStop(1, '#141724');
      c.fillStyle = g;
      oct(0, 1);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.16)';
      c.lineWidth = 0.7;
      c.stroke();
      // 회전 고리 (총이 앉는 자리)
      c.strokeStyle = 'rgba(255,255,255,0.10)';
      c.beginPath();
      c.ellipse(x, cy, hw * 0.58, hh * 0.62, 0, 0, TAU);
      c.stroke();
      // 앞쪽 네온 줄 (세계 색, 합친 무기는 오른쪽 반이 보조 세계 색)
      const front = (from, to, cc) => {
        c.strokeStyle = cc;
        c.lineWidth = 1.5;
        c.beginPath();
        const P = [
          [x - hw, cy + hh * 0.35],
          [x - hw * 0.6, cy + hh],
          [x, cy + hh],
          [x + hw * 0.6, cy + hh],
          [x + hw, cy + hh * 0.35],
        ].slice(from, to + 1);
        P.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
        c.stroke();
      };
      if (sub) {
        front(0, 2, col);
        front(2, 4, sub);
      } else front(0, 4, col);
      // 같은 세계끼리 합친 무기 = 공명: 바닥 고리가 퍼져 나간다
      if (w.sub && w.world === w.subWorld) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          const p = (t * 0.9 + i * 0.5) % 1;
          c.globalAlpha = 0.7 * (1 - p);
          c.strokeStyle = col;
          c.lineWidth = 1.3;
          oct(0, 1.08 + p * 0.45);
          c.stroke();
        }
        c.restore();
      }
    },

    pips(c, w, x, y, s) {
      const py = y + s * 0.62;
      for (let i = 0; i < 5; i++) {
        const px = x - 14.5 + i * 6;
        c.fillStyle = i < w.lv ? YEL : 'rgba(255,255,255,0.16)';
        para(c, px, py - 1.6, 5, 3.2, 1.4);
        c.fill();
      }
    },

    pop(c, p) {
      const k = p.age / 1.6;
      c.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const isNew = p.text === 'NEW';
      c.font = `700 11.5px ${NUM}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const ty = p.w.y - GUN * 0.78 - ease(Math.min(1, p.age / 0.3)) * 14;
      const tw = c.measureText(p.text).width + 16;
      c.fillStyle = isNew ? PINK : YEL;
      para(c, p.w.x - tw / 2, ty - 8, tw, 16, 4);
      c.fill();
      c.fillStyle = isNew ? '#FFFFFF' : INK;
      c.fillText(p.text, p.w.x, ty + 0.5);
    },

    hurt(c, run, k) {
      // 화면 가장자리 핑크 + 가로 글리치 띠
      const g = c.createRadialGradient(W / 2, 260, 150, W / 2, 260, 400);
      g.addColorStop(0, 'rgba(255,46,136,0)');
      g.addColorStop(1, `rgba(255,46,136,${0.42 * k})`);
      c.fillStyle = g;
      c.fillRect(0, -run.oy, W, run.ch);
      c.globalCompositeOperation = 'lighter';
      const seed = Math.floor(run.t * 24);
      for (let i = 0; i < 5; i++) {
        const y = -run.oy + hash(seed + i) * run.ch;
        const h = 1 + hash(seed + i + 9) * 5;
        c.fillStyle = i % 2 ? `rgba(25,230,255,${0.22 * k})` : `rgba(255,46,136,${0.3 * k})`;
        c.fillRect(0, y, W, h);
      }
    },

    hud(c, run) {
      const H = run.oy;
      const hurt = run.hurt > 0 ? run.hurt / 0.6 : 0;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0B0D18');
      g.addColorStop(1, '#06070D');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      // 오른쪽 위 가는 사선 결
      c.save();
      c.beginPath();
      c.rect(W - 120, 0, 120, 44);
      c.clip();
      c.strokeStyle = 'rgba(255,255,255,0.035)';
      c.lineWidth = 1;
      c.beginPath();
      for (let x = W - 140; x < W + 40; x += 7) {
        c.moveTo(x, 44);
        c.lineTo(x + 44, 0);
      }
      c.stroke();
      c.restore();
      // 가운데 LV 탭 (아래로 깎은 모서리)
      c.fillStyle = '#111426';
      c.beginPath();
      c.moveTo(W / 2 - 36, 0);
      c.lineTo(W / 2 + 36, 0);
      c.lineTo(W / 2 + 36, 34);
      c.lineTo(W / 2 + 27, 43);
      c.lineTo(W / 2 - 27, 43);
      c.lineTo(W / 2 - 36, 34);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(25,230,255,0.35)';
      c.lineWidth = 1;
      c.stroke();
      const jit = hurt ? (hash(Math.floor(run.t * 30)) - 0.5) * 6 * hurt : 0;
      const gl = hurt > 0 || run.t % 5.3 < 0.09;
      c.textBaseline = 'alphabetic';
      // 목숨: 핑크 사선 칸 다섯
      c.save();
      c.translate(jit, 0);
      c.font = `500 10px ${NUM}`;
      c.textAlign = 'left';
      c.fillStyle = MUT;
      c.letterSpacing = '1.5px';
      c.fillText('LIFE', 16, 18);
      c.letterSpacing = '0px';
      for (let i = 0; i < 5; i++) {
        const x = 16 + i * 16;
        para(c, x, 24, 13, 13, 4);
        if (i < run.hearts) {
          const cg = c.createLinearGradient(0, 24, 0, 37);
          cg.addColorStop(0, '#FF6FAE');
          cg.addColorStop(1, PINK);
          c.fillStyle = cg;
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.45)';
          para(c, x + 3.4, 25, 8.5, 1.4, 0.5);
          c.fill();
        } else {
          c.strokeStyle = 'rgba(255,46,136,0.45)';
          c.lineWidth = 1;
          c.stroke();
        }
      }
      c.restore();
      // LV
      c.textAlign = 'center';
      c.font = `500 10px ${NUM}`;
      c.fillStyle = CYAN;
      c.letterSpacing = '2px';
      c.fillText('LV', W / 2 + 1, 13);
      c.letterSpacing = '0px';
      c.font = `700 25px ${NUM}`;
      if (gl) rgbText(c, String(run.level), W / 2 + jit, 38, 1.6 + hurt * 2, TXT);
      else {
        c.fillStyle = TXT;
        c.fillText(String(run.level), W / 2, 38);
      }
      // WAVE
      c.textAlign = 'right';
      c.font = `500 10px ${NUM}`;
      c.fillStyle = MUT;
      c.letterSpacing = '1.5px';
      c.fillText('WAVE', W - 15, 18);
      c.letterSpacing = '0px';
      c.font = `700 25px ${NUM}`;
      if (gl) rgbText(c, String(run.wave), W - 16 + jit, 41, 1.6 + hurt * 2, TXT);
      else {
        c.fillStyle = TXT;
        c.fillText(String(run.wave), W - 16, 41);
      }
      // 경험치: 사선 끝 막대 + 눈금
      const k = clamp(run.exp / run.need, 0, 1);
      const bx = 16;
      const bw = W - 32;
      const by = 50;
      c.fillStyle = 'rgba(255,255,255,0.08)';
      para(c, bx, by, bw, 5, 4);
      c.fill();
      if (k > 0) {
        const eg = c.createLinearGradient(bx, 0, bx + bw, 0);
        eg.addColorStop(0, '#0A9FC0');
        eg.addColorStop(1, CYAN);
        c.fillStyle = eg;
        para(c, bx, by, Math.max(6, bw * k), 5, 4);
        c.fill();
        c.fillStyle = '#E9FDFF';
        para(c, bx + Math.max(6, bw * k) - 6, by, 6, 5, 4);
        c.fill();
      }
      c.fillStyle = '#06070D';
      for (let i = 1; i < 10; i++) c.fillRect(bx + (bw * i) / 10 - 0.5, by, 1.2, 5);
      // 아래 테: 핑크 → 청록, 왼쪽 노랑 마디
      const lg = c.createLinearGradient(0, 0, W, 0);
      lg.addColorStop(0, 'rgba(255,46,136,0.7)');
      lg.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      lg.addColorStop(1, 'rgba(25,230,255,0.7)');
      c.fillStyle = lg;
      c.fillRect(0, H - 1, W, 1);
      c.fillStyle = YEL;
      para(c, 0, H - 3, 46, 3, 3);
      c.fill();
    },

    chips(c, run) {
      const m = run.worlds();
      let y = 44;
      for (const k of ORDER) {
        if (!m[k]) continue;
        const wo = CX.wo(k);
        const col = wcol(k);
        c.fillStyle = 'rgba(6,7,13,0.88)';
        cut(c, 6, y, 42, 19, 0, 0, 6, 0);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.12)';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = col;
        c.fillRect(6, y, 2.5, 19);
        c.save();
        wo.crest(c, 12, y + 3, 6.5);
        c.restore();
        c.fillStyle = TXT;
        c.font = `700 12.5px ${NUM}`;
        c.textAlign = 'right';
        c.textBaseline = 'middle';
        c.fillText(String(m[k]), 42, y + 10);
        y += 23;
      }
    },

    gate(c, run) {
      const n = run.cats().size;
      const next = CAT_TH.find((t) => t > n) || 15;
      const slots = run.fuseSlots();
      const ta = `갈래 ${n}/${next}`;
      const tb = `합성 칸 ${slots}`;
      c.font = `700 10.5px ${BODY}`;
      const wa = c.measureText(ta).width;
      const wb = c.measureText(tb).width;
      const h = 20;
      const total = 10 + wa + 12 + wb + 14;
      const x0 = W - 8 - total;
      const y0 = 40;
      c.fillStyle = 'rgba(6,7,13,0.88)';
      cut(c, x0, y0, total, h, 6, 0, 0, 0);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      c.lineWidth = 1;
      c.stroke();
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.fillStyle = TXT;
      c.fillText(ta, x0 + 10, y0 + h / 2 + 0.5);
      // 사선 칸막이 + 합성 칸 (열렸으면 노랑 띠)
      const bx = x0 + 10 + wa + 6;
      if (slots > 0) {
        c.fillStyle = YEL;
        para(c, bx, y0 + 2, wb + 16, h - 4, 5);
        c.fill();
        c.fillStyle = INK;
      } else {
        c.strokeStyle = 'rgba(255,255,255,0.28)';
        c.beginPath();
        c.moveTo(bx + 4, y0 + h - 4);
        c.lineTo(bx + 8, y0 + 4);
        c.stroke();
        c.fillStyle = MUT;
      }
      c.fillText(tb, bx + 8, y0 + h / 2 + 0.5);
    },

    banner(c, b, run) {
      const k = b.age / b.life;
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
      const enter = clamp(b.age / 0.3, 0, 1);
      c.save();
      c.globalAlpha = Math.max(0, a);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (b.wave) {
        const parts = b.text.split(' · ');
        const y = 140;
        c.font = `700 36px ${NUM}`;
        const tw = c.measureText(parts[0]).width;
        // 양옆 가는 줄이 밖으로 뻗는다
        const L = ease(enter) * 70;
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.fillRect(W / 2 - tw / 2 - 14 - L, y - 0.5, L, 1);
        c.fillRect(W / 2 + tw / 2 + 14, y - 0.5, L, 1);
        c.fillStyle = CYAN;
        c.fillRect(W / 2 - tw / 2 - 14 - 4, y - 2, 4, 4);
        c.fillRect(W / 2 + tw / 2 + 14, y - 2, 4, 4);
        c.font = `500 10px ${NUM}`;
        c.letterSpacing = '4px';
        c.fillStyle = MUT;
        c.fillText('INCOMING', W / 2 + 2, y - 30);
        c.letterSpacing = '0px';
        const draw = () => {
          c.save();
          c.translate(W / 2, y);
          c.transform(1, 0, -0.14, 1, 0, 0);
          c.font = `700 36px ${NUM}`;
          c.shadowColor = 'rgba(255,46,136,0.6)';
          c.shadowBlur = 12;
          rgbText(c, parts[0], 0, 2, 1.5 + (1 - enter) * 6, '#FFFFFF');
          c.restore();
        };
        if (enter < 1) sliced(c, 0, y - 22, W, 44, 4, (1 - enter) * 14, Math.floor(b.age * 30), draw);
        else draw();
        if (parts[1]) {
          // 보스 웨이브: 노랑 경고 띠
          c.font = `900 12.5px ${KOR}`;
          const lw = c.measureText('보스 접근').width + 30;
          c.fillStyle = YEL;
          para(c, W / 2 - lw / 2, y + 26, lw, 20, 6);
          c.fill();
          c.fillStyle = INK;
          c.fillText('보스 접근', W / 2, y + 36.5);
        }
      } else {
        // 합성 알림: 깎은 판 + 핑크→청록 테
        const y = 150;
        const sh = (1 - ease(enter)) * 24;
        c.translate(sh, 0);
        c.fillStyle = 'rgba(6,7,13,0.92)';
        cut(c, 24, y - 31, W - 48, 62, 10, 0, 10, 0);
        c.fill();
        const bg = c.createLinearGradient(24, 0, W - 24, 0);
        bg.addColorStop(0, PINK);
        bg.addColorStop(1, CYAN);
        c.strokeStyle = bg;
        c.lineWidth = 1.5;
        c.stroke();
        c.fillStyle = PINK;
        para(c, 24, y - 31, 64, 13, 4);
        c.fill();
        c.fillStyle = '#FFFFFF';
        c.font = `700 9px ${NUM}`;
        c.letterSpacing = '2px';
        c.fillText('FUSION', 56, y - 24);
        c.letterSpacing = '0px';
        c.font = `900 19px ${KOR}`;
        rgbText(c, b.text, W / 2, y - 3, 1 + (1 - enter) * 4, '#FFFFFF', W - 76);
        c.fillStyle = MUT;
        c.font = `500 11px ${BODY}`;
        c.fillText(b.sub, W / 2, y + 18, W - 76);
      }
      c.restore();
    },

    offer(c, o, run) {
      const t = o.age;
      const fade = Math.min(1, t / 0.2);
      c.save();
      c.fillStyle = `rgba(4,5,10,${0.84 * fade})`;
      c.fillRect(0, -run.oy, W, run.ch);
      c.globalAlpha = fade;
      c.fillStyle = scanlines(c);
      c.fillRect(0, -run.oy, W, run.ch);
      c.globalAlpha = 1;
      // 제목
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.font = `900 28px ${KOR}`;
      c.globalAlpha = fade;
      rgbText(c, '레벨 업', W / 2, 104, 1.5 + Math.max(0, 1 - t / 0.3) * 5, '#FFFFFF');
      c.font = `600 12px ${NUM}`;
      c.letterSpacing = '1.5px';
      const lv = `LV ${o.from}  →  ${o.from + 1}`;
      c.fillStyle = CYAN;
      c.fillText(lv, W / 2, 124);
      c.letterSpacing = '0px';
      // 제목 양옆 가는 줄 + 끝 마디
      const L = ease(Math.min(1, t / 0.35)) * 54;
      c.fillStyle = 'rgba(255,255,255,0.32)';
      c.fillRect(W / 2 - 64 - L, 94, L, 1);
      c.fillRect(W / 2 + 64, 94, L, 1);
      c.fillStyle = CYAN;
      c.fillRect(W / 2 - 64, 92.5, 4, 4);
      c.fillRect(W / 2 + 60, 92.5, 4, 4);
      c.globalAlpha = 1;
      o.cards.forEach((cd, i) => {
        const y = 140 + i * 112;
        const enter = ease(clamp((t - i * 0.08) / 0.3, 0, 1));
        const picked = o.pick === i;
        const faded = o.pick >= 0 && !picked;
        c.save();
        c.globalAlpha = enter * (faded ? 0.32 : 1);
        c.translate((1 - enter) * 60, 0);
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
        c.fillStyle = MUT;
        c.font = `500 11px ${BODY}`;
        c.textAlign = 'center';
        c.fillText('카드를 눌러 고른다', W / 2, 140 + 3 * 112 + 4);
      }
      c.restore();
    },

    card(c, cd, x, y, w, h, picked, run) {
      const v = cd.view;
      const KC = cd.kind === 'fuse' ? PINK : cd.kind === 'new' ? CYAN : YEL;
      // 판: 깎은 모서리 (오른쪽 위 · 왼쪽 아래)
      const g = c.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, '#141829');
      g.addColorStop(1, '#0A0C16');
      c.fillStyle = g;
      cut(c, x, y, w, h, 0, 14, 0, 14);
      c.fill();
      if (picked) {
        c.save();
        c.shadowColor = rgba(KC, 0.9);
        c.shadowBlur = 18;
        c.strokeStyle = KC;
        c.lineWidth = 2.2;
        c.stroke();
        c.restore();
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.lineWidth = 1;
        c.strokeStyle = 'rgba(255,46,136,0.7)';
        c.translate(-2.5, 0);
        cut(c, x, y, w, h, 0, 14, 0, 14);
        c.stroke();
        c.strokeStyle = 'rgba(25,230,255,0.7)';
        c.translate(5, 0);
        cut(c, x, y, w, h, 0, 14, 0, 14);
        c.stroke();
        c.restore();
      } else {
        c.strokeStyle = cd.kind === 'fuse' ? rgba(PINK, 0.75) : 'rgba(255,255,255,0.13)';
        c.lineWidth = cd.kind === 'fuse' ? 1.4 : 1;
        c.stroke();
      }
      // 왼쪽 종류 색 띠
      c.fillStyle = KC;
      c.fillRect(x, y + 10, 3, h - 34);
      // 무기 자리: 어두운 진열칸 + 바닥 격자 + 세계 색 빛
      const wx = x + 10;
      const wy = y + 8;
      const ww = 82;
      const wh = h - 16;
      c.save();
      cut(c, wx, wy, ww, wh, 6, 0, 6, 0);
      c.fillStyle = '#05060B';
      c.fill();
      c.clip();
      const col = wcol(v.world);
      const rg = c.createRadialGradient(wx + ww / 2, wy + wh * 0.5, 2, wx + ww / 2, wy + wh * 0.5, ww * 0.62);
      rg.addColorStop(0, rgba(col, 0.2));
      rg.addColorStop(1, rgba(col, 0));
      c.fillStyle = rg;
      c.fillRect(wx, wy, ww, wh);
      c.strokeStyle = 'rgba(150,170,230,0.08)';
      c.lineWidth = 0.7;
      c.beginPath();
      for (let i = 0; i < 7; i++) {
        const yy = wy + wh * 0.62 + i * i * 1.3;
        c.moveTo(wx, yy);
        c.lineTo(wx + ww, yy);
      }
      for (let i = -4; i <= 4; i++) {
        c.moveTo(wx + ww / 2 + i * 7, wy + wh * 0.62);
        c.lineTo(wx + ww / 2 + i * 16, wy + wh);
      }
      c.stroke();
      c.restore();
      c.strokeStyle = 'rgba(255,255,255,0.1)';
      c.lineWidth = 1;
      cut(c, wx, wy, ww, wh, 6, 0, 6, 0);
      c.stroke();
      c.save();
      CX.drawGun(c, v, x + 51, y + h / 2 + 8, 50, run.t);
      c.restore();
      // 글
      const tx = x + 104;
      const tw = w - 116;
      const wn = (k) => CX.wo(k).name;
      let label;
      let tag;
      let name;
      let lvl = '';
      let l1;
      let l2 = '';
      if (cd.kind === 'fuse') {
        label = '합성';
        tag = `칸 ${run.fuseSlots()} 중 1 · 등급 ${Math.min(cd.a.lv, cd.b.lv)}`;
        name = v.name;
        l1 = `몸 ${cd.a.name} (${CX.wo(cd.a.world).short}) + 연출 ${cd.b.name} (${CX.wo(cd.b.world).short})`;
        l2 = `반응: ${v.react}`;
      } else if (cd.kind === 'new') {
        const own = run.worlds();
        label = '새 무기';
        tag = `${wn(v.world)} · ${v.catLabel}${own[v.world] ? '' : ' · 새 세계'}`;
        name = v.name;
        const left = (CAT_TH.find((tt) => tt > run.cats().size) || 15) - run.cats().size - 1;
        l1 = run.cats().has(v.cat) ? `${v.catLabel} 갈래 하나 더` : left <= 0 ? '새 갈래 · 이걸로 합성 칸이 열린다' : `새 갈래 · 합성 칸까지 갈래 ${left}`;
      } else {
        label = '강화';
        tag = `${wn(v.world)} · ${v.catLabel}`;
        name = v.name;
        lvl = `Lv ${v.lv} → ${v.lv + 1}`;
        l1 = '피해 +28% · 쿨다운 −6%';
      }
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.font = `900 10.5px ${KOR}`;
      const lw = c.measureText(label).width + 16;
      c.fillStyle = KC;
      para(c, tx, y + 13, lw, 16, 4);
      c.fill();
      c.fillStyle = cd.kind === 'fuse' ? '#FFFFFF' : INK;
      c.fillText(label, tx + 8, y + 21.5);
      c.fillStyle = MUT;
      c.font = `500 10.5px ${BODY}`;
      c.fillText(tag, tx + lw + 6, y + 21.5, tw - lw - 6);
      c.textBaseline = 'alphabetic';
      c.fillStyle = '#FFFFFF';
      c.font = `900 18px ${KOR}`;
      c.fillText(name, tx, y + 52, tw);
      if (lvl) {
        const nw = Math.min(tw, c.measureText(name).width);
        c.font = `700 14px ${NUM}`;
        c.fillStyle = YEL;
        c.fillText(lvl, tx + nw + 8, y + 51, Math.max(20, tw - nw - 8));
      }
      c.fillStyle = MUT;
      c.font = `500 11px ${BODY}`;
      c.fillText(l1, tx, y + 72, tw);
      if (l2) {
        c.fillStyle = '#FF8CC0';
        c.font = `700 11px ${BODY}`;
        c.fillText(l2, tx, y + 89, tw);
      }
    },

    over(c, run) {
      const a = Math.min(1, run.over / 0.4);
      const enter = clamp(run.over / 0.5, 0, 1);
      c.save();
      c.fillStyle = `rgba(4,5,10,${0.86 * a})`;
      c.fillRect(0, -run.oy, W, run.ch);
      c.fillStyle = scanlines(c);
      c.fillRect(0, -run.oy, W, run.ch);
      c.globalAlpha = a;
      // 노랑·검정 경고 띠 두 줄
      for (const yy of [168, 318]) {
        c.save();
        c.beginPath();
        c.rect(0, yy, W, 8);
        c.clip();
        c.fillStyle = '#0A0A0C';
        c.fillRect(0, yy, W, 8);
        c.fillStyle = 'rgba(255,216,74,0.85)';
        const sh = (run.t * 20) % 16;
        for (let x = -20 + sh; x < W + 20; x += 16) {
          c.beginPath();
          c.moveTo(x, yy + 8);
          c.lineTo(x + 8, yy);
          c.lineTo(x + 15, yy);
          c.lineTo(x + 7, yy + 8);
          c.closePath();
          c.fill();
        }
        c.restore();
      }
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.font = `500 11px ${NUM}`;
      c.letterSpacing = '4px';
      c.fillStyle = PINK;
      c.fillText('GAME OVER', W / 2 + 2, 200);
      c.letterSpacing = '0px';
      const draw = () => {
        c.font = `900 32px ${KOR}`;
        rgbText(c, '차단선 돌파', W / 2, 236, 2 + (1 - enter) * 6, '#FFFFFF');
      };
      if (enter < 1) sliced(c, 0, 208, W, 36, 4, (1 - enter) * 18, Math.floor(run.over * 30), draw);
      else draw();
      // 기록 네 칸
      const stats = [
        ['WAVE', run.wave],
        ['LV', run.level],
        ['최고 연쇄', run.chainPeak],
        ['합성', run.fusedN],
      ];
      const cw = 74;
      const x0 = W / 2 - (cw * 4 + 6 * 3) / 2;
      stats.forEach(([lb, v], i) => {
        const x = x0 + i * (cw + 6);
        c.fillStyle = 'rgba(255,255,255,0.05)';
        cut(c, x, 254, cw, 50, 0, 8, 0, 0);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.12)';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = MUT;
        c.font = `700 10px ${BODY}`;
        c.fillText(lb, x + cw / 2, 271);
        c.fillStyle = i === 2 ? YEL : TXT;
        c.font = `700 21px ${NUM}`;
        c.fillText(String(v), x + cw / 2, 296);
      });
      c.fillStyle = MUT;
      c.font = `500 12px ${BODY}`;
      c.fillText('잠시 뒤 새 판', W / 2, 352);
      c.restore();
    },
  });
})();
