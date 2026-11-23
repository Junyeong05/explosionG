// 잉크 코믹 세계 (comic): 만화 도시 히어로. 망점 · 집중선 · 효과음 글자 · 흰 외곽선.
// 판이 어두운 균열 허공이라 먹선만으로는 묻힌다 → 모든 물건은 "흰 외곽선 → 먹선 → 색" 세 겹 (먹선 밖에 흰 테 한 겹 더).
// 강철(주황 불꽃)과 헷갈리지 않게: 불·연기 없이 노랑 별 터짐 · 망점 · 크림 집중선 · 글자로만 터진다.
(function () {
  const { TAU, clamp, rnd, lerp } = CX.util;
  const sprite = CX.util.sprite;
  const rrect = CX.util.roundRect;

  const INK = '#141210';
  const CREAM = '#EFE6D2';
  const YEL = '#F5C518';
  const RED = '#D7352B';
  const RIM = '#FFFFFF';
  const MEGA = 'arm_s_megaphone';
  const PUNCH = 'arm_punch';
  const PAN = 'arm_th_pan';
  const FONT = '"Black Han Sans", "Noto Sans KR", sans-serif';
  const WORDS = {
    [MEGA]: ['왕!', '와앙!', '웅!'],
    [PUNCH]: ['퍽!', '팍!', '빡!'],
    [PAN]: ['쾅!', '깡!', '탕!'],
    def: ['팍!', '쾅!'],
  };

  // 한글 글꼴은 글자 조각(unicode-range)마다 따로 받으므로 쓸 글자를 미리 부른다
  const CHARS = '와아앙웅왕퍽팍빡쾅깡탕퍼버벅콰날려보내기얼음손짓폭발연타표식사냥합성반응!·0123456789';
  try {
    if (document.fonts && document.fonts.load) {
      document.fonts.load('20px "Black Han Sans"', CHARS).catch(() => null);
      document.fonts.load('900 12px "Gothic A1"', '합성반응').catch(() => null);
    }
  } catch (_) {
    /* 글꼴 API 없음 */
  }
  const okSet = new Set();
  function fontOk(s) {
    if (okSet.has(s)) return true;
    let ok = true;
    try {
      ok = !document.fonts || document.fonts.check('20px "Black Han Sans"', s);
    } catch (_) {
      ok = true;
    }
    if (ok) okSet.add(s);
    return ok;
  }

  // ── 작은 도우미 ──
  /** 튀어나옴 (넘쳤다 돌아옴) */
  const pop = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2));
  /** k 가 a 를 넘으면 1→0 */
  const fade = (k, a) => (k < a ? 1 : Math.max(0, 1 - (k - a) / (1 - a)));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function seeded(seed) {
    let s = Math.floor(seed * 9973) % 2147483647 || 7;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }
  function starPath(c, n, r1, r2, seed) {
    const r = seeded(seed);
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU + (r() - 0.5) * 0.16;
      const rr = i % 2 ? r2 * (0.85 + r() * 0.3) : r1 * (0.78 + r() * 0.36);
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
  }
  /** 먹선 고리: 흰 테 → 먹 → 색 */
  function inkArc(c, x, y, r, a0, a1, col, lw) {
    c.beginPath();
    c.arc(x, y, r, a0, a1);
    c.strokeStyle = INK;
    c.lineWidth = lw + 3;
    c.stroke();
    c.strokeStyle = col;
    c.lineWidth = lw;
    c.stroke();
  }
  /** 집중선: 바깥에서 안으로 가늘어지는 쐐기들 (한 번에 채움) */
  function focusLines(c, x, y, ro, ri, n, seed, a, col) {
    if (a <= 0) return;
    const r = seeded(seed);
    c.save();
    c.globalAlpha *= a;
    c.fillStyle = col || CREAM;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + r() * 0.3;
      const w = 0.016 + r() * 0.03;
      const rin = ri * (0.8 + r() * 0.5);
      const rout = ro * (0.9 + r() * 0.2);
      c.moveTo(x + Math.cos(an - w) * rout, y + Math.sin(an - w) * rout);
      c.lineTo(x + Math.cos(an) * rin, y + Math.sin(an) * rin);
      c.lineTo(x + Math.cos(an + w) * rout, y + Math.sin(an + w) * rout);
      c.closePath();
    }
    c.fill();
    c.restore();
  }

  // ── 미리 그려 두는 그림 ──
  /** 별 터짐 (Y 노랑·크림 / R 빨강·노랑). 반지름 30 기준, 72칸 */
  function burstSpr(v) {
    return sprite('cm-burst-' + v, 72, 72, (c) => {
      c.translate(36, 36);
      c.lineJoin = 'round';
      starPath(c, 11, 31, 16, v === 'R' ? 3 : 7);
      c.strokeStyle = RIM;
      c.lineWidth = 6.5;
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 3.4;
      c.stroke();
      c.fillStyle = v === 'R' ? RED : v === 'W' ? CREAM : YEL;
      c.fill();
      starPath(c, 9, 19, 10.5, v === 'R' ? 11 : 13);
      c.fillStyle = v === 'R' || v === 'W' ? YEL : CREAM;
      c.fill();
      if (v === 'R' || v === 'W') {
        starPath(c, 7, 9.5, 5.5, 5);
        c.fillStyle = v === 'W' ? RIM : CREAM;
        c.fill();
      }
      if (v === 'W') {
        // 바깥 별에 빨강 망점 몇 알
        c.fillStyle = RED;
        c.beginPath();
        for (let i = 0; i < 11; i++) {
          const a = (i / 11) * TAU + 0.3;
          const x = Math.cos(a) * 20.5;
          const y = Math.sin(a) * 20.5;
          c.moveTo(x + 1.5, y);
          c.arc(x, y, 1.5, 0, TAU);
        }
        c.fill();
      }
    });
  }
  function drawBurst(c, x, y, r, rot, v) {
    if (r <= 0.3) return;
    const s = burstSpr(v || 'Y');
    const d = (72 * r) / 30;
    c.save();
    c.translate(x, y);
    c.rotate(rot || 0);
    c.drawImage(s, -d / 2, -d / 2, d, d);
    c.restore();
  }

  /** 효과음 글자: 흰 테 + 먹선 + 그림자(어긋난 판) + 색. 40px 기준 */
  const SFXS = 40;
  const meas = document.createElement('canvas').getContext('2d');
  const sfxMeta = {};
  function sfxSpr(word, fill, shade) {
    const key = `cm-sfx|${word}|${fill}|${shade}|${fontOk(word) ? 1 : 0}`;
    let m = sfxMeta[key];
    if (!m) {
      meas.font = `${SFXS}px ${FONT}`;
      const tw = meas.measureText(word).width;
      const w = Math.ceil(tw + 28);
      const h = Math.ceil(SFXS * 1.3 + 22);
      const cv = sprite(key, w, h, (c) => {
        c.font = `${SFXS}px ${FONT}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineJoin = 'round';
        const x = w / 2 - 2;
        const y = h / 2 - 1;
        const o = 3.5;
        c.strokeStyle = RIM;
        c.lineWidth = 12;
        c.strokeText(word, x + o, y + o);
        c.strokeText(word, x, y);
        c.strokeStyle = INK;
        c.lineWidth = 7;
        c.strokeText(word, x + o, y + o);
        c.fillStyle = shade;
        c.fillText(word, x + o, y + o);
        c.strokeText(word, x, y);
        c.fillStyle = fill;
        c.fillText(word, x, y);
      });
      m = sfxMeta[key] = { cv, w, h };
    }
    return m;
  }
  function drawSfx(c, word, x, y, size, rot, fill, shade, alpha) {
    if (size <= 0.5 || alpha === 0) return;
    const m = sfxSpr(word, fill || YEL, shade || RED);
    const s = size / SFXS;
    c.save();
    if (alpha != null) c.globalAlpha *= alpha;
    c.translate(x, y);
    c.rotate(rot || 0);
    c.drawImage(m.cv, (-m.w * s) / 2, (-m.h * s) / 2, m.w * s, m.h * s);
    c.restore();
  }

  /** 망점 뭉치 (가운데 굵고 가장자리 가늚). 64칸, 반지름 30 */
  function dotsSpr(col) {
    return sprite('cm-dots-' + col, 64, 64, (c) => {
      c.fillStyle = col;
      c.beginPath();
      for (let j = -8; j <= 8; j++) {
        for (let i = -8; i <= 8; i++) {
          const x = 32 + i * 4.2 + (j & 1 ? 2.1 : 0);
          const y = 32 + j * 3.7;
          const d = Math.hypot(x - 32, y - 32) / 30;
          if (d >= 1) continue;
          const r = 1.85 * Math.pow(1 - d, 0.6);
          if (r < 0.3) continue;
          c.moveTo(x + r, y);
          c.arc(x, y, r, 0, TAU);
        }
      }
      c.fill();
    });
  }
  function drawDots(c, col, x, y, rx, ry) {
    c.drawImage(dotsSpr(col), x - (rx * 64) / 60, y - ((ry || rx) * 64) / 60, (rx * 128) / 60, ((ry || rx) * 128) / 60);
  }

  /** 확성기 망점 원뿔 (오른쪽을 향함, 꼭짓점 (2, CONE_H)) */
  const CONE_L = 240;
  const CONE_A = 0.3;
  const CONE_H = Math.ceil(CONE_L * Math.tan(CONE_A)) + 6;
  function coneSpr() {
    return sprite('cm-cone', CONE_L + 4, CONE_H * 2, (c) => {
      c.translate(2, CONE_H);
      c.save();
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, CONE_L, -CONE_A, CONE_A);
      c.closePath();
      c.clip();
      const g = c.createLinearGradient(0, 0, CONE_L, 0);
      g.addColorStop(0, 'rgba(245,197,24,0.34)');
      g.addColorStop(1, 'rgba(245,197,24,0.03)');
      c.fillStyle = g;
      c.fillRect(0, -CONE_H, CONE_L, CONE_H * 2);
      // 망점: 멀수록 굵어진다 (소리가 퍼진다)
      for (const [from, to, a] of [
        [0, 0.45, 0.95],
        [0.45, 0.8, 0.75],
        [0.8, 1.01, 0.45],
      ]) {
        c.fillStyle = `rgba(245,197,24,${a})`;
        c.beginPath();
        for (let x = 8; x < CONE_L; x += 6.6) {
          const f = x / CONE_L;
          if (f < from || f >= to) continue;
          const row = Math.round(x / 6.6);
          const r = 0.55 + 2.0 * f;
          for (let y = -CONE_H; y < CONE_H; y += 6.6) {
            const yy = y + (row & 1 ? 3.3 : 0);
            c.moveTo(x + r, yy);
            c.arc(x, yy, r, 0, TAU);
          }
        }
        c.fill();
      }
      c.restore();
      c.strokeStyle = 'rgba(239,230,210,0.8)';
      c.lineWidth = 1.3;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(CONE_A) * CONE_L, -Math.sin(CONE_A) * CONE_L);
      c.moveTo(0, 0);
      c.lineTo(Math.cos(CONE_A) * CONE_L, Math.sin(CONE_A) * CONE_L);
      c.stroke();
    });
  }

  /** 여러 조각 그림: 흰 테 한 번 → 조각마다 색 + 먹선 */
  function inked(c, parts, rim, ink) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = RIM;
    c.lineWidth = rim;
    for (const [p] of parts) {
      p(c);
      c.stroke();
    }
    for (const [p, col] of parts) {
      p(c);
      c.fillStyle = col;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = ink;
      c.stroke();
    }
  }
  function dotsIn(c, clipPath, x0, y0, x1, y1, col, step, rmax, dir) {
    c.save();
    clipPath(c);
    c.clip();
    c.fillStyle = col;
    c.beginPath();
    for (let y = y0; y <= y1; y += step) {
      const row = Math.round((y - y0) / step);
      for (let x = x0; x <= x1; x += step) {
        const xx = x + (row & 1 ? step / 2 : 0);
        const f = dir === 'y' ? (y - y0) / (y1 - y0) : (xx - x0) / (x1 - x0);
        const r = rmax * f;
        if (r < 0.2) continue;
        c.moveTo(xx + r, y);
        c.arc(xx, y, r, 0, TAU);
      }
    }
    c.fill();
    c.restore();
  }

  /** 만화 주먹 (오른쪽을 향함). 64×48, 가운데 (32,24), 주먹 끝 x≈57 */
  function fistSpr() {
    return sprite('cm-fist', 64, 48, (c) => {
      const body = (q) => rrect(q, 15, 6, 27, 36, 9);
      const parts = [
        [(q) => rrect(q, 3, 10, 15, 28, 3), RED],
        [body, CREAM],
        [(q) => rrect(q, 33, 5, 23, 10.5, 5.2), CREAM],
        [(q) => rrect(q, 35, 14.5, 23, 10.5, 5.2), CREAM],
        [(q) => rrect(q, 35, 24, 22, 10.5, 5.2), CREAM],
        [(q) => rrect(q, 33, 33, 20, 9.5, 4.7), CREAM],
        [
          (q) => {
            q.beginPath();
            q.moveTo(22, 29);
            q.bezierCurveTo(30, 25.5, 44, 26, 49, 30);
            q.quadraticCurveTo(51.5, 35, 45, 36.5);
            q.bezierCurveTo(37, 37.5, 28, 38.5, 21, 37);
            q.closePath();
          },
          CREAM,
        ],
      ];
      inked(c, parts, 5.5, 2.1);
      // 손등 망점 그림자
      dotsIn(c, body, 16, 22, 42, 42, 'rgba(20,18,16,0.38)', 3.2, 1.2, 'y');
      // 소매 노랑 띠
      c.fillStyle = YEL;
      c.fillRect(9.5, 11, 3.2, 26);
      c.strokeStyle = INK;
      c.lineWidth = 1;
      c.strokeRect(9.5, 11, 3.2, 26);
      // 마디 주름
      c.strokeStyle = INK;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(40, 8.5);
      c.lineTo(43, 8.5);
      c.moveTo(42, 18);
      c.lineTo(45, 18);
      c.moveTo(42, 27.5);
      c.lineTo(45, 27.5);
      c.stroke();
    });
  }

  /** 철판 (납작한 강판 + 네 귀 리벳 + 사선 광). 34×24, 판은 x 4~30 · y 6~18 */
  function plateSpr() {
    return sprite('cm-plate2', 34, 24, (c) => {
      c.lineJoin = 'round';
      const body = (q) => rrect(q, 4, 6, 26, 12, 1.6);
      body(c);
      c.strokeStyle = RIM;
      c.lineWidth = 4.4;
      c.stroke();
      const g = c.createLinearGradient(0, 6, 0, 18);
      g.addColorStop(0, '#C9D3DE');
      g.addColorStop(0.45, '#8494A8');
      g.addColorStop(1, '#46556A');
      c.fillStyle = g;
      c.fill();
      // 사선 광 두 줄
      c.save();
      body(c);
      c.clip();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath();
      c.moveTo(11, 6);
      c.lineTo(15, 6);
      c.lineTo(10, 18);
      c.lineTo(6, 18);
      c.closePath();
      c.moveTo(17, 6);
      c.lineTo(18.6, 6);
      c.lineTo(13.6, 18);
      c.lineTo(12, 18);
      c.closePath();
      c.fill();
      c.restore();
      body(c);
      c.strokeStyle = INK;
      c.lineWidth = 1.9;
      c.stroke();
      // 아래 두께 (먹)
      c.strokeStyle = INK;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(6, 16.2);
      c.lineTo(28, 16.2);
      c.stroke();
      c.fillStyle = INK;
      for (const [x, y] of [
        [7, 9],
        [27, 9],
        [7, 13.4],
        [27, 13.4],
      ]) {
        c.beginPath();
        c.arc(x, y, 1.05, 0, TAU);
        c.fill();
      }
    });
  }

  /** 확성기 (오른쪽을 향함). 40×40, 가운데 (20,20) */
  function megaSpr() {
    return sprite('cm-mega', 40, 40, (c) => {
      const bell = (q) => {
        q.beginPath();
        q.moveTo(11, 16);
        q.lineTo(26, 7);
        q.lineTo(26, 34);
        q.lineTo(11, 25);
        q.closePath();
      };
      const parts = [
        [
          (q) => {
            q.beginPath();
            q.moveTo(12, 23);
            q.lineTo(10, 33);
            q.lineTo(15, 33);
            q.lineTo(16.5, 23);
            q.closePath();
          },
          INK,
        ],
        [(q) => rrect(q, 4, 15, 8, 11, 2.5), RED],
        [bell, YEL],
        [
          (q) => {
            q.beginPath();
            q.ellipse(26, 20.5, 3.6, 13.5, 0, 0, TAU);
          },
          CREAM,
        ],
      ];
      inked(c, parts, 4.5, 1.9);
      dotsIn(c, bell, 12, 21, 26, 34, 'rgba(215,53,43,0.75)', 2.6, 1.05, 'y');
      bell(c);
      c.strokeStyle = INK;
      c.lineWidth = 1.9;
      c.stroke();
      c.fillStyle = RED;
      c.beginPath();
      c.moveTo(15, 13.6);
      c.lineTo(17.6, 12.1);
      c.lineTo(17.6, 28.9);
      c.lineTo(15, 27.4);
      c.closePath();
      c.fill();
      // 소리 결
      c.lineCap = 'round';
      for (const r of [7.5, 12]) {
        c.beginPath();
        c.arc(27, 20.5, r, -0.72, 0.72);
        c.strokeStyle = RIM;
        c.lineWidth = 4.4;
        c.stroke();
        c.strokeStyle = INK;
        c.lineWidth = 2.1;
        c.stroke();
      }
    });
  }

  /** 무기 아이콘 (40×40 칸) */
  function iconSpr(id) {
    return sprite('cm-icon-' + id, 40, 40, (c) => {
      if (id === MEGA) {
        c.translate(20, 20);
        c.rotate(-0.22);
        c.drawImage(megaSpr(), -21, -21, 42, 42);
        return;
      }
      if (id === PUNCH) {
        // 속도선 (뒤) + 주먹 + 맞는 별
        c.lineCap = 'round';
        for (const [y, l] of [
          [13, 8],
          [20, 10],
          [27, 7],
        ]) {
          c.beginPath();
          c.moveTo(1.5, y);
          c.lineTo(1.5 + l, y);
          c.strokeStyle = RIM;
          c.lineWidth = 3.6;
          c.stroke();
          c.strokeStyle = INK;
          c.lineWidth = 1.7;
          c.stroke();
        }
        c.save();
        c.translate(33.5, 20.5);
        c.drawImage(burstSpr('Y'), -9, -9, 18, 18);
        c.restore();
        c.drawImage(fistSpr(), 4, 7.5, 33, 24.75);
        return;
      }
      if (id === PAN) {
        c.lineCap = 'round';
        // 빨강 휘두름 호 + 속도선
        c.beginPath();
        c.arc(23, 23, 15, Math.PI * 0.92, Math.PI * 1.55);
        c.strokeStyle = RIM;
        c.lineWidth = 6.4;
        c.stroke();
        c.strokeStyle = INK;
        c.lineWidth = 4.4;
        c.stroke();
        c.strokeStyle = RED;
        c.lineWidth = 2.2;
        c.stroke();
        for (const [x, y, l] of [
          [3, 31, 9],
          [5, 36, 7],
        ]) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + l, y - l * 0.55);
          c.strokeStyle = RIM;
          c.lineWidth = 3.4;
          c.stroke();
          c.strokeStyle = INK;
          c.lineWidth = 1.6;
          c.stroke();
        }
        c.translate(23, 22);
        c.rotate(-0.5);
        c.drawImage(plateSpr(), -18.7, -13.2, 37.4, 26.4);
        return;
      }
      // 다른 무기: 노랑 별 + 이름 첫 글자
      c.translate(20, 20);
      c.drawImage(burstSpr('Y'), -19, -19, 38, 38);
      c.font = `15px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = INK;
      c.fillText((CX.data.weapons[id] || { name: '?' }).name.slice(0, 1), 0, 1);
    });
  }

  /** 유물함 안: 망점 종이 컷 칸 */
  function boxSpr(w, h) {
    return sprite(`cm-box-${w}x${h}`, w, h, (c) => {
      c.fillStyle = CREAM;
      c.fillRect(0, 0, w, h);
      // 옅은 먹 망점 전체
      c.fillStyle = 'rgba(20,18,16,0.13)';
      c.beginPath();
      for (let y = 1.5; y < h; y += 3.4) {
        const row = Math.round(y / 3.4);
        for (let x = 1.5; x < w; x += 3.4) {
          const xx = x + (row & 1 ? 1.7 : 0);
          c.moveTo(xx + 0.5, y);
          c.arc(xx, y, 0.5, 0, TAU);
        }
      }
      c.fill();
      // 오른쪽 아래로 짙어지는 빨강 망점
      c.fillStyle = 'rgba(215,53,43,0.5)';
      c.beginPath();
      for (let y = 2; y < h; y += 4.2) {
        const row = Math.round(y / 4.2);
        for (let x = 2; x < w; x += 4.2) {
          const xx = x + (row & 1 ? 2.1 : 0);
          const f = (xx / w + y / h) / 2;
          const r = Math.max(0, (f - 0.45) * 3.2);
          if (r < 0.25) continue;
          c.moveTo(xx + r, y);
          c.arc(xx, y, r, 0, TAU);
        }
      }
      c.fill();
      // 컷 칸 먹선 (오른쪽 위 모서리)
      c.strokeStyle = 'rgba(20,18,16,0.55)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(w * 0.62, 0);
      c.lineTo(w, h * 0.3);
      c.stroke();
    });
  }

  function crestSpr() {
    return sprite('cm-crest', 20, 20, (c) => {
      c.translate(10, 10);
      c.lineJoin = 'round';
      starPath(c, 8, 9.6, 6.2, 17);
      c.fillStyle = YEL;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 1.4;
      c.stroke();
      c.fillStyle = INK;
      c.beginPath();
      c.moveTo(-1.5, -5.4);
      c.lineTo(1.5, -5.4);
      c.lineTo(0.8, 1.6);
      c.lineTo(-0.8, 1.6);
      c.closePath();
      c.fill();
      c.beginPath();
      c.arc(0, 4.1, 1.3, 0, TAU);
      c.fill();
    });
  }

  /** 과녁 표식 (철판 반응) */
  function drawTarget(c, x, y, s, rot, a) {
    c.save();
    c.globalAlpha *= a;
    c.translate(x, y);
    c.rotate(rot);
    c.scale(s, s);
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, 14, 0, TAU);
    c.strokeStyle = RIM;
    c.lineWidth = 7.5;
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.stroke();
    c.strokeStyle = RED;
    c.lineWidth = 2.6;
    c.stroke();
    inkArc(c, 0, 0, 7.5, 0, TAU, YEL, 1.8);
    for (let i = 0; i < 4; i++) {
      const an = (i / 4) * TAU;
      c.beginPath();
      c.moveTo(Math.cos(an) * 18, Math.sin(an) * 18);
      c.lineTo(Math.cos(an) * 25, Math.sin(an) * 25);
      c.strokeStyle = INK;
      c.lineWidth = 4.4;
      c.stroke();
      c.strokeStyle = CREAM;
      c.lineWidth = 2;
      c.stroke();
    }
    c.fillStyle = RED;
    c.beginPath();
    c.arc(0, 0, 2.4, 0, TAU);
    c.fill();
    c.restore();
  }

  /** 얼음 덩이 (확성기 반응: 날려 보내기 · 얼음). 먹선 얼음 결정 + 고드름 */
  function drawIce(c, x, y, r, seed, a) {
    const q = seeded(seed);
    c.save();
    c.globalAlpha *= a;
    c.translate(x, y);
    c.lineJoin = 'round';
    c.beginPath();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU + q() * 0.3;
      const rr = r * (0.88 + q() * 0.3);
      i ? c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : c.moveTo(Math.cos(an) * rr, Math.sin(an) * rr);
    }
    c.closePath();
    c.strokeStyle = RIM;
    c.lineWidth = 4.6;
    c.stroke();
    c.fillStyle = 'rgba(196,236,255,0.38)';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.stroke();
    // 빛 결
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-r * 0.55, -r * 0.2);
    c.lineTo(-r * 0.2, -r * 0.6);
    c.moveTo(-r * 0.45, r * 0.12);
    c.lineTo(-r * 0.05, -r * 0.3);
    c.stroke();
    // 고드름
    c.beginPath();
    for (const [dx, l] of [
      [-0.45, 0.55],
      [0.05, 0.8],
      [0.5, 0.45],
    ]) {
      c.moveTo(r * dx - 3, r * 0.82);
      c.lineTo(r * dx, r * (0.82 + l * 0.6));
      c.lineTo(r * dx + 3, r * 0.82);
    }
    c.fillStyle = '#E8F7FF';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 1.3;
    c.stroke();
    c.restore();
  }

  // ── 무기 셋 ──
  /** 확성기 (음파): 상자 위로 확성기가 솟아 → 망점 원뿔 + 먹선 음파 고리 + 커지는 "와 아 앙!" */
  function fireMega(api, w, tg) {
    const mx = w.x;
    const my = w.y - 60;
    const ang = Math.atan2(tg.y - my, tg.x - mx);
    const ox = mx + Math.cos(ang) * 9;
    const oy = my + Math.sin(ang) * 9;
    const dist = Math.hypot(tg.x - ox, tg.y - oy);
    const range = clamp(dist + 46, 160, 380);
    const SPD = 600;
    const hitSet = new Set();
    const flip = Math.cos(ang) < 0;
    const sideSign = Math.random() < 0.5 ? -1 : 1;
    const words = [
      ['와', 18, CREAM, RED, 0.24, -14 * sideSign, -0.14],
      ['아', 24, CREAM, RED, 0.52, 14 * sideSign, 0.1],
      ['앙!', 34, YEL, RED, 0.84, -10 * sideSign, -0.16],
    ];
    const fx = {
      x: ox,
      y: oy,
      vx: Math.cos(ang) * SPD,
      vy: Math.sin(ang) * SPD,
      life: 0.95,
      z: 1,
      update(dt, a) {
        const f = Math.min(range, this.age * SPD);
        this.x = ox + Math.cos(ang) * f;
        this.y = oy + Math.sin(ang) * f;
        if (f >= range) this.vx = this.vy = 0;
        for (const e of a.enemies) {
          if (!e.alive || hitSet.has(e)) continue;
          const dx = e.x - ox;
          const dy = e.y - oy;
          const d = Math.hypot(dx, dy);
          if (d > f + e.r) continue;
          let da = Math.atan2(dy, dx) - ang;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) > CONE_A + e.r / Math.max(d, 1)) continue;
          hitSet.add(e);
          a.hit(w, e, 3, e.x, e.y, { push: 7 });
        }
      },
      draw(c) {
        const age = this.age;
        const front = age * SPD;
        const f = Math.min(range, front);
        const al = age < 0.42 ? 1 : Math.max(0, 1 - (age - 0.42) / 0.5);
        // 원뿔
        c.save();
        c.globalAlpha = al * 0.95;
        c.translate(ox, oy);
        c.rotate(ang);
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, f + 2, -CONE_A - 0.05, CONE_A + 0.05);
        c.closePath();
        c.clip();
        const s = range / CONE_L;
        c.drawImage(coneSpr(), -2 * s, -CONE_H * s, (CONE_L + 4) * s, CONE_H * 2 * s);
        c.restore();
        // 음파 고리 (먹 + 노랑·크림 번갈아)
        c.save();
        c.translate(ox, oy);
        c.rotate(ang);
        c.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const d = front - i * 32;
          if (d < 14 || d > range + 24) continue;
          const ra = Math.min(1, (range + 24 - d) / 50) * al;
          c.globalAlpha = ra;
          const sp = CONE_A * 0.92;
          inkArc(c, 0, 0, d, -sp, sp, i % 2 ? CREAM : YEL, 2.6 + (d / range) * 1.4);
        }
        c.restore();
        // 효과음 글자: 앞머리가 지나갈 때 하나씩 튀어나오며 커진다
        for (const [wd, size, fill, shade, at, perp, rot] of words) {
          const d = at * range;
          if (front < d) continue;
          const t = (front - d) / SPD;
          const k = pop(t / 0.13);
          const wx = ox + Math.cos(ang) * d - Math.sin(ang) * perp;
          const wy = oy + Math.sin(ang) * d + Math.cos(ang) * perp;
          drawSfx(c, wd, wx, wy - t * 10, size * k, rot, fill, shade, al);
        }
        // 확성기 본체 (상자 위로 솟음, 쏠 때 흔들림)
        const kick = age < 0.18 ? Math.sin((age / 0.18) * Math.PI) : 0;
        const ma = age < 0.6 ? 1 : Math.max(0, 1 - (age - 0.6) / 0.3);
        const rise = Math.min(1, age / 0.08);
        c.save();
        c.globalAlpha = ma;
        c.translate(mx - Math.cos(ang) * kick * 4, my + (1 - rise) * 26 - Math.sin(ang) * kick * 4);
        c.rotate(ang + Math.sin(age * 70) * 0.06 * (1 - Math.min(1, age / 0.4)));
        if (flip) c.scale(1, -1);
        const sc = 0.92 + kick * 0.14;
        c.scale(sc, sc);
        c.drawImage(megaSpr(), -20, -20, 40, 40);
        c.restore();
        // 상자에서 튀어 오른 자국
        if (age < 0.3) {
          c.save();
          c.globalAlpha = 1 - age / 0.3;
          c.strokeStyle = CREAM;
          c.lineWidth = 1.5;
          c.lineCap = 'round';
          c.beginPath();
          for (const o of [-8, 0, 8]) {
            c.moveTo(mx + o, my + 16);
            c.lineTo(mx + o * 1.2, my + 30);
          }
          c.stroke();
          c.restore();
        }
        // 확성기 입 앞 짧은 집중선
        if (age < 0.25) focusLines(c, ox, oy, 26, 12, 9, 3, (1 - age / 0.25) * 0.9, CREAM);
      },
    };
    api.add(fx, w);
    return 1.35;
  }

  /** 충격 타격 (손공격): 표적에 집중선·망점 그림자 → 하늘에서 거대한 만화 주먹이 내리꽂힘 → 별 터짐 "퍽!" */
  function firePunch(api, w, tg) {
    const T = 0.27;
    let tx = tg.x;
    let ty = tg.y;
    const side = rnd(18, 34) * (Math.random() < 0.5 ? -1 : 1);
    const y0 = Math.max(-40, tg.y - 240);
    const dirA = Math.atan2(240, -side);
    const seed = rnd(1, 999);
    const S = 1.5;
    const reach = 25 * S; // 가운데 → 주먹 끝
    let done = false;
    const fx = {
      x: tx + side,
      y: y0,
      vx: 0,
      vy: 0,
      life: 0.85,
      z: 1,
      update(dt, a) {
        if (!done && tg.alive) {
          tx = tg.x;
          ty = tg.y;
        }
        const px = this.x;
        const py = this.y;
        const ex = tx - Math.cos(dirA) * reach;
        const ey = ty - 4 - Math.sin(dirA) * reach;
        if (this.age < T) {
          const k = this.age / T;
          const kk = k * k * k;
          this.x = lerp(tx + side, ex, kk);
          this.y = lerp(y0, ey, kk);
        } else {
          if (!done) {
            done = true;
            impact(a);
          }
          const q = this.age - T;
          this.x = ex;
          this.y = ey - (q > 0.2 ? (q - 0.2) * 220 : 0);
        }
        this.vx = (this.x - px) / Math.max(dt, 1e-4);
        this.vy = (this.y - py) / Math.max(dt, 1e-4);
      },
      draw(c) {
        const k = clamp(this.age / T, 0, 1);
        const q = this.age - T;
        // 맞을 자리: 집중선이 조여 들고 망점 그림자가 커진다
        if (q < 0.1) {
          const a = q < 0 ? 0.3 + 0.7 * k : 1 - q / 0.1;
          focusLines(c, tx, ty, 100, 32 + 38 * (1 - k), 22, seed, a * 0.85, CREAM);
          c.save();
          c.globalAlpha = a * 0.95;
          drawDots(c, YEL, tx, ty + 3, 9 + 18 * k, (9 + 18 * k) * 0.5);
          c.restore();
        }
        const al = q > 0.2 ? Math.max(0, 1 - (q - 0.2) / 0.32) : 1;
        if (al <= 0) return;
        c.globalAlpha = al;
        // 내려오는 속도선
        if (q < 0.05) {
          c.strokeStyle = CREAM;
          c.lineCap = 'round';
          const len = 26 + 60 * k;
          const ux = Math.cos(dirA);
          const uy = Math.sin(dirA);
          for (const [o, lw] of [
            [-13, 1.6],
            [-4, 2.4],
            [6, 1.8],
            [14, 1.2],
          ]) {
            const bx = this.x - ux * 30 - uy * o;
            const by = this.y - uy * 30 + ux * o;
            c.lineWidth = lw;
            c.beginPath();
            c.moveTo(bx, by);
            c.lineTo(bx - ux * len, by - uy * len);
            c.stroke();
          }
        }
        const sq = q > 0 && q < 0.1 ? 1 - 0.16 * (1 - q / 0.1) : 1;
        c.translate(this.x, this.y);
        c.rotate(dirA);
        c.scale(S * sq, S * (2 - sq));
        c.drawImage(fistSpr(), -32, -24, 64, 48);
      },
    };
    function impact(a) {
      w.mem.cmW = a.t;
      a.shake(2.8);
      const hs = a.near(tx, ty, 32);
      for (const e of hs) a.hit(w, e, e === tg ? 6 : 3, e.x, e.y, { push: e === tg ? 5 : 9 });
      if (!hs.length) {
        CX.wo(w.world).hit(a, tx, ty, w, false, null);
        if (w.sub) CX.wo(w.subWorld).hit(a, tx, ty, w, true, null);
      }
      const rot = rnd(0, TAU);
      const x = tx;
      const y = ty;
      // 별 터짐은 주먹 뒤 (z 0), 글자는 맨 위 (z 1)
      CX.mark(
        a,
        x,
        y,
        0.5,
        (c, kk) => {
          const s = pop(kk / 0.22);
          c.globalAlpha = fade(kk, 0.5);
          inkArc(c, x, y, 18 + 50 * kk, 0, TAU, RIM, 2.2 * (1 - kk) + 0.4);
          drawBurst(c, x, y, 31 * s, rot, 'Y');
          focusLines(c, x, y, 58 + 20 * kk, 36 + 10 * kk, 10, rot, 1 - kk, RIM);
        },
        0,
      );
      const sx = x + (side > 0 ? -36 : 36);
      CX.mark(a, x, y, 0.62, (c, kk) => {
        drawSfx(c, '퍽!', sx, y - 30 - kk * 8, 40 * pop(kk / 0.2), side > 0 ? -0.24 : 0.2, YEL, RED, fade(kk, 0.6));
      });
    }
    api.add(fx, w);
    return 1.5;
  }

  /** 철판 투척 (투척): 빙글 뒤집히는 철판이 포물선 → "쾅!" → 가까운 적에게 한 번 더 튕겨 "탕!" */
  function firePan(api, w, tg) {
    launchPan(api, w, tg, w.x, w.y - 22, 1.4, true);
    return 1.45;
  }
  function launchPan(api, w, tg, x, y, scale, first) {
    const spin = rnd(12, 16) * (Math.random() < 0.5 ? -1 : 1);
    CX.shoot(api, w, tg, {
      x,
      y,
      speed: first ? 285 : 240,
      arc: first ? 72 : 36,
      splash: first ? 30 : 22,
      dmg: first ? 5 : 3,
      r: 8,
      z: 1,
      draw(c, p) {
        drawPanFlying(c, p, scale, spin);
      },
      onLand(a, p, hitAny) {
        const px = p.x;
        const py = p.y;
        a.shake(first ? 2.4 : 1.4);
        const rot = rnd(0, TAU);
        const wob = rnd(0.6, 1) * (spin > 0 ? 1 : -1);
        CX.mark(
          a,
          px,
          py,
          0.5,
          (c, kk) => {
            const s = pop(kk / 0.2);
            c.globalAlpha = fade(kk, 0.45);
            drawDots(c, YEL, px, py, (first ? 34 : 22) * (0.6 + 0.6 * kk), (first ? 34 : 22) * (0.6 + 0.6 * kk));
            drawBurst(c, px, py, (first ? 28 : 19) * s, rot, 'W');
            // 바닥에 떨어져 덜덜 떠는 철판
            c.translate(px, py + 2);
            c.rotate(Math.sin(kk * 34) * (1 - kk) * 0.5 * wob);
            c.scale(scale, scale * 0.7);
            c.drawImage(plateSpr(), -17, -12, 34, 24);
          },
          0,
        );
        const word = first ? '쾅!' : '탕!';
        const wx = px + (px > CX.size.W / 2 ? -1 : 1) * rnd(26, 32);
        CX.mark(a, px, py, 0.6, (c, kk) => {
          drawSfx(c, word, wx, py - 22 - kk * 8, (first ? 32 : 22) * pop(kk / 0.2), rnd(-0.05, 0.05) + (first ? -0.14 : 0.12), first ? YEL : CREAM, RED, fade(kk, 0.6));
        });
        if (!first) return;
        // 한 번 튕겨 가까운 다른 적에게
        let best = null;
        let bd = 1e9;
        for (const e of a.enemies) {
          if (!e.alive || e.y > CX.size.LINE_Y - 30 || hitAny.includes(e)) continue;
          const d = Math.hypot(e.x - px, e.y - py);
          if (d > 28 && d < 130 && d < bd) (bd = d), (best = e);
        }
        if (best) {
          const nb = best;
          a.later(0.04, (a2) => nb.alive && launchPan(a2, w, nb, px, py - 6, 1.05, false));
        }
      },
    });
  }
  function drawPanFlying(c, p, scale, spin) {
    const sp = Math.hypot(p.vx, p.vy);
    const dir = sp > 1 ? Math.atan2(p.vy, p.vx) : -Math.PI / 2;
    const ux = Math.cos(dir);
    const uy = Math.sin(dir);
    // 속도선 (뒤로)
    c.strokeStyle = CREAM;
    c.lineCap = 'round';
    for (const [o, l, lw] of [
      [-6, 18, 1.3],
      [0, 28, 1.9],
      [6, 20, 1.3],
    ]) {
      const bx = p.x - ux * 12 * scale - uy * o * scale;
      const by = p.y - uy * 12 * scale + ux * o * scale;
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(bx, by);
      c.lineTo(bx - ux * l * scale, by - uy * l * scale);
      c.stroke();
    }
    // 빨강 휘두름 호
    c.lineCap = 'round';
    inkArc(c, p.x, p.y, 14 * scale, dir + Math.PI - 1.3, dir + Math.PI + 0.25, RED, 2.2);
    // 철판: 돌며 뒤집힌다
    c.translate(p.x, p.y);
    c.rotate(p.age * spin);
    c.scale(scale, scale * (0.45 + 0.55 * Math.abs(Math.cos(p.age * 9))));
    c.drawImage(plateSpr(), -17, -12, 34, 24);
  }

  // ── 반응 (코믹이 보조일 때의 큰 한 방) ──
  /** 날려 보내기 · 얼음: 망점 충격파 + 먹선 음파 고리로 둘레를 날려 보내고, 날아간 적은 먹선 얼음 덩이에 갇힌다 */
  function reactMega(api, e, w) {
    const x = e.x;
    const y = e.y;
    api.shake(3.5);
    const got = [];
    for (const n of api.near(x, y, 86)) got.push({ n, ox: n.x, oy: n.y, seed: rnd(1, 99) });
    for (const g of got) api.hit(w, g.n, 4, g.n.x, g.n.y, { isReact: true, push: 34, slow: 2.6 });
    const seed = rnd(1, 999);
    CX.mark(api, x, y, 0.8, (c, k) => {
      const R = 18 + 84 * (1 - Math.pow(1 - Math.min(1, k * 1.5), 3));
      c.globalAlpha = 0.9 * (1 - k);
      drawDots(c, YEL, x, y, R, R);
      c.globalAlpha = 1 - k;
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const rr = R * (1 - i * 0.24);
        if (rr < 6) continue;
        for (let s = 0; s < 6; s++) {
          const a0 = (s / 6) * TAU + i * 0.4 + k * 0.6;
          inkArc(c, x, y, rr, a0, a0 + 0.62, i === 1 ? CREAM : YEL, 3.2 - i * 0.6);
        }
      }
      focusLines(c, x, y, R * 1.25, R * 0.75, 16, seed, 1 - k, CREAM);
    });
    for (const g of got) {
      // 날아간 자국: 처음 자리 → 지금 자리
      CX.mark(api, g.ox, g.oy, 0.4, (c, k) => {
        const n = g.n;
        c.globalAlpha = 1 - k;
        c.strokeStyle = CREAM;
        c.lineCap = 'round';
        for (const [o, lw] of [
          [-7, 1.4],
          [0, 2.2],
          [7, 1.4],
        ]) {
          c.lineWidth = lw;
          c.beginPath();
          c.moveTo(g.ox + o, g.oy + 4);
          c.lineTo(n.x + o * 0.6, n.y + n.r + 2);
          c.stroke();
        }
      });
      // 얼음 덩이 (적을 따라감)
      CX.mark(api, g.n.x, g.n.y, 2.2, (c, k) => {
        const n = g.n;
        if (!n.alive) return;
        const s = pop((k * 2.2) / 0.16);
        drawIce(c, n.x, n.y, n.r * 1.6 * s, g.seed, fade(k, 0.8));
      });
    }
  }

  /** 손짓 폭발 · 연타: 사방에서 작은 주먹이 다다다 꽂히고, 마지막에 큰 별 터짐 */
  function reactPunch(api, e, w) {
    const x0 = e.x;
    const y0 = e.y;
    const pool = api.near(x0, y0, 84).sort((a, b) => Math.hypot(a.x - x0, a.y - y0) - Math.hypot(b.x - x0, b.y - y0));
    const N = 6;
    const base = rnd(0, TAU);
    for (let i = 0; i < N; i++) {
      api.later(i * 0.075, (a) => {
        const alive = pool.filter((n) => n.alive);
        const tg = alive.length ? alive[i % alive.length] : null;
        const tx = tg ? tg.x + rnd(-4, 4) : x0 + rnd(-26, 26);
        const ty = tg ? tg.y + rnd(-4, 4) : y0 + rnd(-26, 26);
        const ang = base + i * 2.4;
        miniFist(a, tx, ty, ang, i);
        if (tg) a.hit(w, tg, 2, tx, ty, { isReact: true, noMark: true });
      });
    }
    api.later(N * 0.075 + 0.05, (a) => {
      a.shake(4.5);
      const rot = rnd(0, TAU);
      const seed = rnd(1, 999);
      CX.mark(
        a,
        x0,
        y0,
        0.6,
        (c, k) => {
          const s = pop(k / 0.2);
          c.globalAlpha = fade(k, 0.45);
          drawDots(c, YEL, x0, y0, 34 + 54 * k, 34 + 54 * k);
          inkArc(c, x0, y0, 26 + 60 * k, 0, TAU, RIM, 3 * (1 - k) + 0.5);
          drawBurst(c, x0, y0, 48 * s, rot, 'Y');
          drawBurst(c, x0, y0, 22 * s, -rot, 'W');
          focusLines(c, x0, y0, 92, 52 + 16 * k, 18, seed, 1 - k, RIM);
        },
        0,
      );
      for (const n of a.near(x0, y0, 62)) a.hit(w, n, 5, n.x, n.y, { isReact: true });
    });
  }
  function miniFist(api, tx, ty, ang, i) {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const word = i === 1 ? '퍽!' : i === 3 ? '퍼벅!' : i === 5 ? '퍼버벅!' : null;
    const wrot = rnd(-0.25, 0.2);
    CX.mark(api, tx, ty, 0.32, (c, k) => {
      const age = k * 0.32;
      const m = Math.min(1, age / 0.06);
      const back = age < 0.06 ? 50 * (1 - m * m) + 16 : 16 + Math.max(0, age - 0.12) * 120;
      const al = fade(k, 0.45);
      c.globalAlpha = al;
      if (age >= 0.055) drawBurst(c, tx, ty, 13 * pop((age - 0.055) / 0.08) * (1 - Math.max(0, k - 0.6)), ang * 3, 'Y');
      // 속도선
      c.strokeStyle = CREAM;
      c.lineWidth = 1.4;
      c.lineCap = 'round';
      const fx = tx - ux * back;
      const fy = ty - uy * back;
      if (age < 0.1) {
        c.beginPath();
        for (const o of [-6, 0, 6]) {
          c.moveTo(fx - ux * 14 - uy * o, fy - uy * 14 + ux * o);
          c.lineTo(fx - ux * 34 - uy * o, fy - uy * 34 + ux * o);
        }
        c.stroke();
      }
      c.save();
      c.translate(fx, fy);
      c.rotate(ang);
      c.scale(0.6, 0.6);
      c.drawImage(fistSpr(), -32, -24, 64, 48);
      c.restore();
      if (word && age >= 0.06) drawSfx(c, word, tx + uy * 18, ty - 20, (14 + i * 2.5) * pop((age - 0.06) / 0.1), wrot, i === 5 ? YEL : CREAM, RED, al);
    });
  }

  /** 표식 사냥 · 폭발: 둘레 적에 과녁이 박히고, 하늘에서 철판이 하나씩 떨어져 "쾅!" */
  function reactPan(api, e, w) {
    const x0 = e.x;
    const y0 = e.y;
    const list = api
      .near(x0, y0, 120)
      .sort((a, b) => Math.hypot(a.x - x0, a.y - y0) - Math.hypot(b.x - x0, b.y - y0))
      .slice(0, 4);
    if (!list.length) return;
    list.forEach((n, i) => {
      const life = 0.34 + i * 0.09;
      const rot0 = rnd(0, TAU);
      CX.mark(api, n.x, n.y, life + 0.05, (c, k) => {
        const age = k * (life + 0.05);
        const s = age < 0.14 ? 2.4 - 1.4 * pop(age / 0.14) : 1 + Math.sin(age * 30) * 0.04;
        drawTarget(c, n.x, n.y, s * (n.r / 11) * 0.9, rot0 + age * 3, Math.min(1, age / 0.08));
      });
      api.later(life - 0.12, (a) => dropPlate(a, w, n, i));
    });
  }
  function dropPlate(api, w, n, i) {
    const D = 0.14;
    const sx = n.x + 46 * (i % 2 ? -1 : 1);
    const sy = n.y - 170;
    let tx = n.x;
    let ty = n.y;
    let done = false;
    const spin = rnd(16, 22) * (i % 2 ? 1 : -1);
    api.add({
      x: sx,
      y: sy,
      vx: 0,
      vy: 0,
      life: D + 0.02,
      z: 1,
      noTrail: true,
      update(dt, a) {
        if (n.alive) {
          tx = n.x;
          ty = n.y;
        }
        const k = Math.min(1, this.age / D);
        this.x = lerp(sx, tx, k * k);
        this.y = lerp(sy, ty - 4, k * k);
        if (k >= 1 && !done) {
          done = true;
          a.shake(2.2);
          if (n.alive) a.hit(w, n, 6, tx, ty, { isReact: true });
          for (const o of a.near(tx, ty, 30)) if (o !== n) a.hit(w, o, 3, o.x, o.y, { isReact: true, noMark: true });
          const rot = rnd(0, TAU);
          const X = tx;
          const Y = ty;
          CX.mark(
            a,
            X,
            Y,
            0.5,
            (c, kk) => {
              c.globalAlpha = fade(kk, 0.45);
              drawBurst(c, X, Y, 26 * pop(kk / 0.2), rot, 'W');
              c.translate(X, Y + 2);
              c.rotate(Math.sin(kk * 30) * (1 - kk) * 0.45);
              c.scale(1.1, 0.75);
              c.drawImage(plateSpr(), -17, -12, 34, 24);
            },
            0,
          );
          CX.mark(a, X, Y, 0.55, (c, kk) => {
            drawSfx(c, '쾅!', X + (i % 2 ? 26 : -26), Y - 24 - kk * 6, (i === 0 ? 30 : 21) * pop(kk / 0.2), i % 2 ? 0.16 : -0.16, YEL, RED, fade(kk, 0.6));
          });
          return false;
        }
        return true;
      },
      draw(c) {
        const k = Math.min(1, this.age / D);
        c.strokeStyle = CREAM;
        c.lineWidth = 1.6;
        c.lineCap = 'round';
        const dx = tx - sx;
        const dy = ty - sy;
        const d = Math.hypot(dx, dy) || 1;
        c.beginPath();
        for (const o of [-7, 0, 7]) {
          c.moveTo(this.x - (dx / d) * 14 - (dy / d) * o, this.y - (dy / d) * 14 + (dx / d) * o);
          c.lineTo(this.x - (dx / d) * (34 + 30 * k) - (dy / d) * o, this.y - (dy / d) * (34 + 30 * k) + (dx / d) * o);
        }
        c.stroke();
        c.translate(this.x, this.y);
        c.rotate(this.age * spin);
        c.scale(1.15, 1.15 * (0.5 + 0.5 * Math.abs(Math.cos(this.age * 14))));
        c.drawImage(plateSpr(), -17, -12, 34, 24);
      },
    });
  }

  // ── 보조 궤적 층 ──
  function trailBeam(c, e, t, id) {
    const dx = e.x2 - e.x1;
    const dy = e.y2 - e.y1;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const end = Math.min(d, Math.hypot(e.x - e.x1, e.y - e.y1) || d);
    const n = Math.min(26, Math.floor(end / 13));
    const sh = Math.floor(t * 14) % 2;
    c.fillStyle = YEL;
    c.beginPath();
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const s = (i + sh) % 2 ? 1 : -1;
      const off = s * (5 + f * 3);
      const x = e.x1 + ux * f * end - uy * off;
      const y = e.y1 + uy * f * end + ux * off;
      const r = 0.7 + f * 1.8;
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, TAU);
    }
    c.fill();
    const hx = e.x1 + ux * end;
    const hy = e.y1 + uy * end;
    focusLines(c, hx, hy, 24, 13, 8, Math.floor(t * 10), 0.9, CREAM);
    if (id === MEGA) {
      const ph = (t * 2.6) % 1;
      c.globalAlpha = 1 - ph;
      inkArc(c, hx, hy, 10 + ph * 12, Math.atan2(uy, ux) - 0.7, Math.atan2(uy, ux) + 0.7, YEL, 1.8);
    }
  }
  function trailStill(c, e, t, id) {
    const R = e.r && e.r > 16 ? Math.min(60, e.r) : 13;
    const rot = t * 0.8;
    // 망점 고리
    c.beginPath();
    const n = R > 20 ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rot;
      const x = e.x + Math.cos(a) * R * 0.95;
      const y = e.y + Math.sin(a) * R * 0.95;
      const r = i % 2 ? 1.1 : 2;
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, TAU);
    }
    c.fillStyle = YEL;
    c.fill();
    // 안으로 향한 집중 눈금
    c.strokeStyle = CREAM;
    c.lineWidth = 1.4;
    c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - rot * 0.6;
      c.moveTo(e.x + Math.cos(a) * (R + 12), e.y + Math.sin(a) * (R + 12));
      c.lineTo(e.x + Math.cos(a) * (R + 5), e.y + Math.sin(a) * (R + 5));
    }
    c.stroke();
    if (id === MEGA) {
      const ph = (t * 2.2) % 1;
      c.globalAlpha = 1 - ph;
      inkArc(c, e.x, e.y, R + 4 + ph * 14, -0.6, 0.6, YEL, 1.8);
      inkArc(c, e.x, e.y, R + 4 + ph * 14, Math.PI - 0.6, Math.PI + 0.6, YEL, 1.8);
    }
  }
  function trailMove(c, e, t, id, ux, uy, L) {
    const px = -uy;
    const py = ux;
    const h = e.hist;
    const np = h.length / 2;
    // 망점 꼬리: 두 줄, 오래될수록 작게
    c.fillStyle = YEL;
    c.beginPath();
    for (let j = 0; j < np - 1; j += 2) {
      const f = (j + 1) / np;
      const x = h[j * 2];
      const y = h[j * 2 + 1];
      const r = 0.5 + 2.1 * f;
      const s = j % 4 ? 1 : -1;
      const off = 4.5 * s;
      c.moveTo(x + px * off + r, y + py * off);
      c.arc(x + px * off, y + py * off, r, 0, TAU);
    }
    c.fill();
    // 속도선 (머리 뒤)
    c.strokeStyle = CREAM;
    c.lineCap = 'round';
    for (const [o, l, lw] of [
      [-6.5, 0.7, 1.2],
      [0, 1, 1.8],
      [6.5, 0.8, 1.2],
    ]) {
      const bx = e.x - ux * 7 + px * o;
      const by = e.y - uy * 7 + py * o;
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(bx, by);
      c.lineTo(bx - ux * L * l, by - uy * L * l);
      c.stroke();
    }
    const dir = Math.atan2(uy, ux);
    if (id === MEGA) {
      // 앞으로 퍼지는 음파 결
      for (let i = 0; i < 2; i++) {
        const ph = (t * 3 + i * 0.5) % 1;
        c.globalAlpha = 1 - ph;
        inkArc(c, e.x, e.y, 9 + ph * 12, dir - 0.65, dir + 0.65, YEL, 1.7);
      }
    } else if (id === PAN) {
      // 빨강 휘두름 호
      inkArc(c, e.x, e.y, 11, dir + Math.PI - 1.2 + Math.sin(t * 9) * 0.2, dir + Math.PI + 0.35, RED, 1.9);
    } else {
      // 충격 타격: 옆으로 튀는 강조 눈금 (깜빡)
      if (Math.floor(t * 14) % 2 === 0) {
        c.strokeStyle = CREAM;
        c.lineWidth = 1.6;
        c.beginPath();
        for (const sgn of [-1, 1]) {
          for (const da of [-0.35, 0, 0.35]) {
            const a = dir + sgn * (Math.PI / 2) + da;
            c.moveTo(e.x + Math.cos(a) * 9, e.y + Math.sin(a) * 9);
            c.lineTo(e.x + Math.cos(a) * 15, e.y + Math.sin(a) * 15);
          }
        }
        c.stroke();
      }
    }
  }

  // ── 등록 ──
  CX.world('comic', {
    name: '잉크 코믹',
    short: '코믹',
    desc: '만화 도시 히어로. 망점 음파 원뿔 · 하늘에서 내리꽂는 만화 주먹 · 튕기는 철판. 맞으면 흰 테 노랑 별 터짐과 효과음 글자',
    colors: { main: YEL, soft: '#4A3A0C' },
    fonts: ['Black Han Sans', 'Gothic A1'],

    box(c, x, y, w, h) {
      c.drawImage(boxSpr(w, h), x, y, w, h);
    },

    crest(c, x, y, r) {
      c.drawImage(crestSpr(), x, y, r * 2, r * 2);
    },

    icon(c, id, x, y, s) {
      c.drawImage(iconSpr(id), x - s / 2, y - s / 2, s, s);
    },

    fire(api, w, tg) {
      const id = w.id;
      if (id === MEGA || (id !== PUNCH && id !== PAN && w.cat === 'sound')) return fireMega(api, w, tg);
      if (id === PUNCH || w.cat === 'hand') return firePunch(api, w, tg);
      return firePan(api, w, tg);
    },

    tick: null,

    trail(c, e, t, w) {
      const id = w && w.sub;
      if (e.x1 != null && e.x2 != null) return trailBeam(c, e, t, id);
      const h = e.hist || [];
      const n = h.length;
      let dx = 0;
      let dy = 0;
      if (n >= 8) {
        dx = e.x - h[n - 8];
        dy = e.y - h[n - 7];
      }
      const d = Math.hypot(dx, dy);
      if (d < 1.5) return trailStill(c, e, t, id);
      trailMove(c, e, t, id, dx / d, dy / d, clamp(d * 2.4, 14, 34));
    },

    hit(api, x, y, w, asSub) {
      const id = asSub ? w.sub : w.id;
      const r = asSub ? 9 : 15;
      const rot = rnd(0, TAU);
      const v = id === PAN ? 'W' : 'Y';
      CX.mark(api, x, y, asSub ? 0.22 : 0.3, (c, k) => {
        c.globalAlpha = fade(k, 0.55);
        drawBurst(c, x, y, r * pop(k / 0.35), rot, v);
      });
      // 효과음 (너무 잦지 않게 무기마다 간격)
      // 메인은 쏘는 효과가 제 효과음을 크게 띄우므로 별 터짐만. 같은 세계 합성이면 보조 글자는 생략
      if (!asSub && (id === MEGA || id === PUNCH || id === PAN)) return;
      if (asSub && w.world === 'comic') return;
      const key = asSub ? 'cmSubW' : 'cmW';
      const gap = asSub ? 0.6 : 0.45;
      const m = w.mem || (w.mem = {});
      if (api.t - (m[key] == null ? -9 : m[key]) < gap) return;
      m[key] = api.t;
      const word = pick(WORDS[id] || WORDS.def);
      const size = asSub ? 16 : 20;
      const sgn = Math.random() < 0.5 ? -1 : 1;
      const wx = x + rnd(18, 26) * sgn;
      const wr = sgn * rnd(0.08, 0.24);
      CX.mark(api, x, y, 0.55, (c, k) => {
        drawSfx(c, word, wx, y - 14 - k * 9, size * pop(k / 0.22), wr, asSub ? CREAM : YEL, RED, fade(k, 0.6));
      });
    },

    react(api, e, w) {
      const id = w.sub;
      if (id === MEGA) return reactMega(api, e, w);
      if (id === PAN) return reactPan(api, e, w);
      return reactPunch(api, e, w);
    },

    label(c, text, x, y, age, life) {
      const parts = String(text).split(' · ');
      const cap = parts[0];
      const sfx = parts.length > 1 ? parts.slice(1).join(' ') + '!' : '';
      const kin = clamp(age / 0.16, 0, 1);
      const out = clamp((age - (life - 0.26)) / 0.26, 0, 1);
      c.font = `21px ${FONT}`;
      const tw = Math.min(200, c.measureText(cap).width);
      const bw = tw + 26;
      const bh = 34;
      // 반응 연출을 덜 가리게 조금 위로, 효과음이 오른쪽으로 넘치는 만큼 왼쪽으로
      const cx = sfx ? -28 : 0;
      const cy = sfx ? -18 : -8;
      c.translate(x, y);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineJoin = 'round';
      // 노랑 캡션 상자: 왼쪽에서 휙 들어와 기울어 박힘
      c.save();
      c.globalAlpha = 1 - out;
      c.translate(cx + (1 - pop(kin)) * -30 + out * 20, cy - out * 6);
      c.rotate(-0.07 - (1 - kin) * 0.22 + out * 0.08);
      const sc = 0.75 + 0.25 * pop(kin);
      c.scale(sc, sc);
      c.fillStyle = RED;
      c.fillRect(-bw / 2 + 5, -bh / 2 + 5, bw, bh);
      c.strokeStyle = INK;
      c.lineWidth = 2.4;
      c.strokeRect(-bw / 2 + 5, -bh / 2 + 5, bw, bh);
      c.strokeStyle = RIM;
      c.lineWidth = 6;
      c.strokeRect(-bw / 2, -bh / 2, bw, bh);
      c.fillStyle = YEL;
      c.fillRect(-bw / 2, -bh / 2, bw, bh);
      c.strokeStyle = INK;
      c.lineWidth = 2.6;
      c.strokeRect(-bw / 2, -bh / 2, bw, bh);
      // 작은 먹 꼬리표
      c.font = '900 9.5px "Gothic A1", "Noto Sans KR", sans-serif';
      const tg = '합성 반응';
      const tgw = c.measureText(tg).width + 10;
      c.fillStyle = INK;
      c.fillRect(-bw / 2 + 6, -bh / 2 - 9, tgw, 14);
      c.strokeStyle = RIM;
      c.lineWidth = 1;
      c.strokeRect(-bw / 2 + 6, -bh / 2 - 9, tgw, 14);
      c.fillStyle = YEL;
      c.fillText(tg, -bw / 2 + 6 + tgw / 2, -bh / 2 - 1.6);
      c.font = `21px ${FONT}`;
      c.fillStyle = INK;
      c.fillText(cap, 0, 2, 200);
      c.restore();
      if (!sfx) return;
      // 빨강 효과음: 상자 모서리를 넘쳐 튀어나옴
      const ks = clamp((age - 0.09) / 0.2, 0, 1);
      if (ks <= 0) return;
      c.save();
      c.globalAlpha = 1 - out;
      const jit = age > 0.32 && out === 0 ? Math.sin(age * 47) * 0.7 : 0;
      c.translate(cx + bw / 2 - 6 + jit, cy + bh / 2 + 6 - out * 10);
      c.rotate(-0.15 - (1 - pop(ks)) * 0.5 + out * 0.15);
      const s2 = pop(ks) * (1 + out * 0.35);
      c.scale(s2, s2);
      c.font = `36px ${FONT}`;
      const sw = Math.min(190, c.measureText(sfx).width);
      // 강조 눈금
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(sw / 2 + 4, -17);
      c.lineTo(sw / 2 + 10, -25);
      c.moveTo(sw / 2 + 8, -8);
      c.lineTo(sw / 2 + 16, -11);
      c.moveTo(sw / 2 + 0, -23);
      c.lineTo(sw / 2 + 1, -32);
      c.strokeStyle = RIM;
      c.lineWidth = 5.5;
      c.stroke();
      c.strokeStyle = INK;
      c.lineWidth = 2.6;
      c.stroke();
      c.strokeStyle = RIM;
      c.lineWidth = 10;
      c.strokeText(sfx, 3, 3, 190);
      c.strokeText(sfx, 0, 0, 190);
      c.strokeStyle = INK;
      c.lineWidth = 6;
      c.strokeText(sfx, 3, 3, 190);
      c.fillStyle = INK;
      c.fillText(sfx, 3, 3, 190);
      c.strokeText(sfx, 0, 0, 190);
      c.fillStyle = RED;
      c.fillText(sfx, 0, 0, 190);
      c.restore();
    },
  });
})();
