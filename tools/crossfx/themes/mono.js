// 테마 mono — 미니멀 볼드 (11-24): 밝은 회백 종이 판 · 검정 원판 받침 · 빨강 평면 도형 적 · 굵은 숫자 타이포.
// 그림자 없이 여백·정렬·위계로. 색은 셋만: 종이(회백) · 먹(검정) · 빨강. 세계 무기 그림은 검정 원판 위에 서서 묻히지 않는다.
(function () {
  const { W, CH, HUD, FIELD_H, GUN, CAT_TH, ORDER } = CX.runInfo;
  const { LINE_Y } = CX.size;
  const { TAU, clamp, ease, roundRect, bgCanvas } = CX.util;

  const PAPER = '#EEECE7';
  const GROUND = '#E3E0D9';
  const WHITE = '#FFFFFF';
  const INK = '#151515';
  const INK2 = '#34322F';
  const GRAY = '#66635D'; // 종이 위 작은 글자 4.7:1
  const RULE = '#CDC9C1';
  const RED = '#DE3120'; // 흰 글자를 얹어도 4.6:1
  const RED_T = '#C42418'; // 종이 위 작은 빨간 글자 4.8:1
  const TINT = '#F5CBC4';
  const SG = '"Space Grotesk", "Noto Sans KR", sans-serif';
  const BH = '"Black Han Sans", "Noto Sans KR", sans-serif';
  const KR = '"Noto Sans KR", sans-serif';
  /** 지난 프레임의 판 (sky · line 은 판을 받지 않으므로 hud 에서 받아 둔다) */
  const S = { run: null };
  const pad2 = (n) => String(Math.max(0, n)).padStart(2, '0');
  const wcol = (k) => (CX.wo(k).colors || {}).main || INK;

  // 글꼴: 한글 굵은 제목(Black Han Sans)은 쓰는 글자 묶음만 받아 오므로 무기 이름까지 미리
  if (document.fonts && document.fonts.load) {
    const D = CX.data;
    const txt = Object.values(D.weapons).map((w) => w.name + w.catLabel).join('') + Object.values(D.fuse).map((f) => f.name).join('') + '레벨 업방어선 붕괴연쇄합성새 무기강화선택';
    document.fonts.load('20px "Black Han Sans"', txt).catch(() => null);
    for (const wt of [500, 700]) document.fonts.load(`${wt} 12px "Space Grotesk"`, 'WAVE0123456789').catch(() => null);
  }

  /** 작은 대문자 꼬리표 (LIFE · LEVEL · WAVE) */
  function tag(c, text, x, y, align, color, size) {
    c.save();
    c.font = `700 ${size || 9}px ${SG}`;
    c.letterSpacing = '1.6px';
    c.textAlign = align || 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = color || GRAY;
    // 오른쪽 맞춤이면 글자 사이 간격이 끝에 남으니 그만큼 당긴다
    c.fillText(text, align === 'right' ? x + 1.6 : x, y);
    c.restore();
  }

  /** 적 모양 경로 (가운데 0,0) */
  function shape(c, e, r) {
    if (e.type === 'armor') {
      const h = r * 0.86;
      roundRect(c, -h, -h, h * 2, h * 2, e.boss ? 3 : 2);
      return;
    }
    c.beginPath();
    if (e.type === 'charge') {
      c.moveTo(0, r * 1.4);
      c.lineTo(r * 1.05, -r * 0.72);
      c.lineTo(-r * 1.05, -r * 0.72);
      c.closePath();
    } else c.arc(0, 0, r, 0, TAU);
  }

  /** 땅 (방어선 아래): 한 톤 어두운 종이 + 가는 사선 빗금. bg 와 판 아래 여백이 같은 무늬를 쓴다 (x 0 기준으로 이어짐) */
  function ground(c, y0, y1) {
    c.fillStyle = GROUND;
    c.fillRect(0, y0, W, y1 - y0);
    c.save();
    c.beginPath();
    c.rect(0, y0, W, y1 - y0);
    c.clip();
    c.strokeStyle = 'rgba(21,21,21,0.045)';
    c.lineWidth = 1;
    c.beginPath();
    for (let x = -700; x < W + 10; x += 7) {
      c.moveTo(x, 0);
      c.lineTo(x + 700, 700);
    }
    c.stroke();
    c.restore();
  }
  const FOOT = CH - HUD - FIELD_H; // 판 아래 여백 36

  /** 작은 결정적 난수 (폭발 조각 방향이 프레임마다 흔들리지 않게) */
  const hash = (a) => {
    const s = Math.sin(a * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };

  /** 런타임이 save/restore 없이 부르는 것(sky · enemy · boom · seam · num · line · chain)은 스스로 감싼다 */
  const own = (f) =>
    function (c, ...a) {
      c.save();
      try {
        return f.call(this, c, ...a);
      } finally {
        c.restore();
      }
    };
  const def = {
    name: '미니멀 볼드',
    desc: '밝은 회백 종이 · 검정 원판 · 빨강 평면 도형 · 굵은 숫자 (그림자 없이 여백과 정렬로)',
    fonts: ['Space Grotesk', 'Black Han Sans', 'Noto Sans KR'],

    // ── 판 ──
    bg(scale) {
      return bgCanvas(scale, (c, w, h) => {
        c.fillStyle = PAPER;
        c.fillRect(0, 0, w, h);
        ground(c, LINE_Y, h);
        // 점 격자 (판 위 좌표감)
        c.fillStyle = 'rgba(21,21,21,0.14)';
        for (let y = 24; y < LINE_Y - 10; y += 24) for (let x = 12; x < w; x += 24) c.fillRect(x - 0.65, y - 0.65, 1.3, 1.3);
        // 가장자리 눈금 (왼쪽 · 오른쪽): 지도 여백 같은 맛
        c.fillStyle = 'rgba(21,21,21,0.22)';
        for (let y = 24; y < LINE_Y - 10; y += 24) {
          const long = (y / 24) % 4 === 0;
          c.fillRect(0, y - 0.5, long ? 6 : 3, 1);
          c.fillRect(w - (long ? 6 : 3), y - 0.5, long ? 6 : 3, 1);
        }
        // 종이 결 (정해진 난수로 한 번)
        let s = 20261124;
        const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < 3200; i++) {
          c.fillStyle = r() < 0.55 ? `rgba(60,50,40,${0.03 + r() * 0.04})` : `rgba(255,255,255,${0.35 + r() * 0.4})`;
          c.fillRect(r() * w, r() * h, 0.5 + r() * 0.9, 0.5 + r() * 0.9);
        }
        for (let i = 0; i < 70; i++) {
          const x = r() * w;
          const y = r() * h;
          const a = r() * TAU;
          const l = 3 + r() * 7;
          c.strokeStyle = `rgba(80,70,60,${0.04 + r() * 0.04})`;
          c.lineWidth = 0.5;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
          c.stroke();
        }
      });
    },

    /** 바탕 위 움직이는 것: 아주 옅은 큰 웨이브 숫자(포스터처럼) + 곧 내려올 적 자리 표시 */
    sky(c) {
      const run = S.run;
      if (!run) return;
      c.save();
      c.font = `700 220px ${SG}`;
      c.letterSpacing = '-10px';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = 'rgba(21,21,21,0.036)';
      c.fillText(pad2(run.wave), W / 2 - 4, 262);
      c.restore();
      if (run.queue && run.queue.length) {
        c.fillStyle = RED;
        for (const q of run.queue) {
          const d = q.at - run.waveT;
          if (d > 1.2) break;
          const a = clamp(1 - d / 1.2, 0, 1);
          c.globalAlpha = a;
          const x = q.e.x;
          c.beginPath();
          c.moveTo(x - 4, 0);
          c.lineTo(x + 4, 0);
          c.lineTo(x, 5 + a * 2);
          c.closePath();
          c.fill();
        }
        c.globalAlpha = 1;
      }
    },

    /** 적: 빨강 평면 도형. 보통 = 원, 장갑 = 검정 테 네모, 돌격 = 아래로 향한 세모, 군주 = 큰 네모 + 안쪽 마름모. 체력은 위에서부터 빠지는 색 */
    enemy(c, e) {
      const r = e.r;
      c.translate(e.x, e.y);
      if (!e.alive) {
        const k = 1 - e.flash / 0.12;
        c.globalAlpha = 1 - k;
        shape(c, e, r * (1 + k * 0.6));
        c.strokeStyle = INK;
        c.lineWidth = 2;
        c.stroke();
        return;
      }
      if (e.type === 'charge') {
        // 속도 줄 (위로)
        c.fillStyle = INK;
        c.fillRect(-r * 0.5 - 0.75, -r * 2.3, 1.5, r * 1.2);
        c.fillRect(r * 0.5 - 0.75, -r * 2.0, 1.5, r * 0.9);
      }
      const k = clamp(e.hp / e.max, 0, 1);
      shape(c, e, r);
      c.fillStyle = k < 1 ? TINT : RED;
      c.fill();
      if (k < 1 && k > 0) {
        const R = r * 1.5;
        c.save();
        c.beginPath();
        c.rect(-R, R - R * 2 * k, R * 2, R * 2 * k);
        c.clip();
        shape(c, e, r);
        c.fillStyle = RED;
        c.fill();
        c.restore();
      }
      if (e.type === 'armor') {
        shape(c, e, r);
        c.strokeStyle = INK;
        c.lineWidth = e.boss ? 3.5 : 2.4;
        c.stroke();
        if (e.boss) {
          c.save();
          c.rotate(Math.PI / 4);
          c.strokeStyle = INK;
          c.lineWidth = 2;
          c.strokeRect(-r * 0.38, -r * 0.38, r * 0.76, r * 0.76);
          c.restore();
        }
      }
      // 눈: 아래(방어선)를 본다
      c.fillStyle = INK;
      c.beginPath();
      c.arc(0, e.type === 'charge' ? -r * 0.05 : r * 0.2, r * (e.boss ? 0.14 : e.type === 'armor' ? 0.22 : 0.28), 0, TAU);
      c.fill();
      if (e.slow > 0) {
        c.strokeStyle = INK;
        c.lineWidth = 1.2;
        c.setLineDash([2.5, 2.5]);
        c.beginPath();
        c.arc(0, 0, r * 1.5, 0, TAU);
        c.stroke();
        c.setLineDash([]);
      }
      if (e.flash > 0) {
        const f = e.flash / 0.12;
        c.globalAlpha = f * 0.85;
        shape(c, e, r);
        c.fillStyle = WHITE;
        c.fill();
        c.globalAlpha = f;
        c.strokeStyle = INK;
        c.lineWidth = 1.5;
        c.stroke();
        c.globalAlpha = 1;
      }
      if (e.boss) {
        const bw = r * 2.2;
        c.fillStyle = RULE;
        c.fillRect(-bw / 2, -r - 10, bw, 3);
        c.fillStyle = INK;
        c.fillRect(-bw / 2, -r - 10, bw * k, 3);
      }
    },

    /** 연쇄 폭발: 먹 점이 터지고(한 순간) 빨간 고리가 가늘어지며 퍼진다 + 먹 가는 고리 + 네모 조각. 속이 빈 도형이라 적(꽉 찬 빨강)과 섞이지 않는다 */
    boom(c, b) {
      const k = clamp(b.age / 0.55, 0, 1);
      if (b.leak) {
        c.globalAlpha = 1 - k;
        const w = 14 + ease(k) * 46;
        c.fillStyle = RED;
        c.fillRect(b.x - w / 2, LINE_Y - 4, w, 8);
        c.strokeStyle = INK;
        c.lineWidth = 2.5;
        const s = 5 + ease(k) * 2;
        const y = LINE_Y - 18;
        c.beginPath();
        c.moveTo(b.x - s, y - s);
        c.lineTo(b.x + s, y + s);
        c.moveTo(b.x + s, y - s);
        c.lineTo(b.x - s, y + s);
        c.stroke();
        return;
      }
      const R = b.r * (0.45 + ease(k * 1.3) * 0.62);
      // 처음 한 순간: 먹 점이 크게 찍혔다 오그라든다
      if (k < 0.2) {
        const q = k / 0.2;
        c.fillStyle = INK;
        c.beginPath();
        c.arc(b.x, b.y, R * 0.42 * (1 - q * q), 0, TAU);
        c.fill();
      }
      const th = R * 0.34 * Math.pow(1 - k, 1.4);
      if (th > 0.3) {
        c.strokeStyle = RED;
        c.lineWidth = th;
        c.beginPath();
        c.arc(b.x, b.y, Math.max(0.1, R - th / 2), 0, TAU);
        c.stroke();
        if (b.big) {
          c.lineWidth = th * 0.45;
          c.beginPath();
          c.arc(b.x, b.y, R * 0.55, 0, TAU);
          c.stroke();
        }
      }
      // 먹 고리 (조금 늦게, 더 크게)
      const k2 = clamp((k - 0.08) / 0.92, 0, 1);
      c.strokeStyle = INK;
      c.globalAlpha = 1 - k2;
      c.lineWidth = b.big ? 2.2 : 1.5;
      c.beginPath();
      c.arc(b.x, b.y, R * (1.05 + k2 * 0.35), 0, TAU);
      c.stroke();
      // 조각: 먹 · 빨강 네모
      const n = b.big ? 8 : 5;
      const seed = b.x * 0.37 + b.y * 0.11;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + hash(seed + i) * 0.9;
        const d = R * (0.9 + ease(k) * (0.6 + hash(seed - i) * 0.5));
        const sz = (b.big ? 4.2 : 3.2) * (1 - k * 0.7);
        c.save();
        c.translate(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d);
        c.rotate(a + k * 2);
        c.fillStyle = i % 2 ? RED : INK;
        c.fillRect(-sz / 2, -sz / 2, sz, sz);
        c.restore();
      }
      if (b.big) {
        // 큰 것: 십자 먹 선
        c.globalAlpha = 1 - k;
        c.strokeStyle = INK;
        c.lineWidth = 2;
        const L = R * (1.2 + k * 0.4);
        c.beginPath();
        c.moveTo(b.x - L, b.y);
        c.lineTo(b.x - L * 0.7, b.y);
        c.moveTo(b.x + L * 0.7, b.y);
        c.lineTo(b.x + L, b.y);
        c.moveTo(b.x, b.y - L);
        c.lineTo(b.x, b.y - L * 0.7);
        c.moveTo(b.x, b.y + L * 0.7);
        c.lineTo(b.x, b.y + L);
        c.stroke();
      }
      c.globalAlpha = 1;
    },

    /** 연쇄가 옆으로 번지는 줄: 곧은 먹 선이 그어지고 끝에 빨간 점 */
    seam(c, s) {
      const k = clamp(s.age / 0.3, 0, 1);
      const g = ease(Math.min(1, k / 0.45));
      const x2 = s.x1 + (s.x2 - s.x1) * g;
      const y2 = s.y1 + (s.y2 - s.y1) * g;
      c.globalAlpha = k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45;
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(s.x1, s.y1);
      c.lineTo(x2, y2);
      c.stroke();
      c.fillStyle = RED;
      c.beginPath();
      c.arc(x2, y2, 2.8, 0, TAU);
      c.fill();
    },

    /** 피해 숫자: 보통 = 작은 먹 숫자, 반응 = 빨강, 큰 한 방 = 빨간 꼬리표 안 흰 숫자 */
    num(c, n) {
      const a = n.age > 0.5 ? 1 - (n.age - 0.5) / 0.3 : 1;
      const pop = n.age < 0.09 ? 1 + (1 - n.age / 0.09) * 0.45 : 1;
      c.globalAlpha = clamp(a, 0, 1);
      c.translate(n.x, n.y);
      c.scale(pop, pop);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      const txt = String(n.v);
      if (n.kind === 2) {
        c.font = `700 15px ${SG}`;
        const tw = c.measureText(txt).width;
        c.fillStyle = RED;
        c.fillRect(-tw / 2 - 5, -14, tw + 10, 18);
        c.fillStyle = WHITE;
        c.fillText(txt, 0, 0);
        return;
      }
      c.font = `700 ${n.kind ? 14 : 11}px ${SG}`;
      c.lineWidth = 3;
      c.lineJoin = 'round';
      c.strokeStyle = PAPER;
      c.strokeText(txt, 0, 0);
      c.fillStyle = n.kind ? RED_T : INK2;
      c.fillText(txt, 0, 0);
    },

    /** 방어선: 굵은 먹 줄 + 자 눈금. 가까이 온 적 아래는 빨갛게 */
    line(c) {
      // 판 아래 여백(런타임이 어둡게 칠한 36px)도 같은 땅으로 (미리 그려 둔 한 장)
      const foot = CX.util.sprite('mono-foot', W, FOOT + 1, (g) => {
        g.translate(0, -FIELD_H);
        ground(g, FIELD_H, FIELD_H + FOOT + 1);
      });
      c.drawImage(foot, 0, FIELD_H, W, FOOT + 1);
      c.fillStyle = INK;
      c.fillRect(0, LINE_Y - 1.5, W, 3);
      c.fillStyle = 'rgba(21,21,21,0.55)';
      for (let x = 12; x < W; x += 12) {
        const long = x % 60 === 0;
        c.fillRect(x - 0.5, LINE_Y + 1.5, 1, long ? 6 : 3);
      }
      const run = S.run;
      if (run) {
        for (const e of run.enemies) {
          if (!e.alive) continue;
          const d = LINE_Y - e.y;
          if (d > 80 || d < 0) continue;
          const a = 1 - d / 80;
          c.globalAlpha = a;
          c.fillStyle = RED;
          c.fillRect(e.x - e.r - 3, LINE_Y - 1.5 - a * 2, e.r * 2 + 6, 3 + a * 4);
        }
        c.globalAlpha = 1;
      }
      tag(c, 'LINE', W - 10, LINE_Y - 7, 'right', GRAY, 8);
    },

    /** 연쇄 수: 큰 먹 숫자 + 빨간 "연쇄" 꼬리표 */
    chain(c, n, since) {
      const pop = 1 + 0.32 * Math.max(0, 1 - since / 0.16);
      const a = since > 0.8 ? 1 - (since - 0.8) / 0.3 : 1;
      c.save();
      c.globalAlpha = clamp(a, 0, 1);
      c.translate(W / 2, 206);
      c.scale(pop, pop);
      c.textAlign = 'center';
      c.textBaseline = 'alphabetic';
      c.font = `700 66px ${SG}`;
      c.letterSpacing = '-2px';
      c.lineWidth = 8;
      c.lineJoin = 'round';
      c.strokeStyle = PAPER;
      c.strokeText(String(n), 0, 0);
      c.fillStyle = INK;
      c.fillText(String(n), 0, 0);
      c.letterSpacing = '0px';
      c.font = `16px ${BH}`;
      const tw = c.measureText('연쇄').width;
      c.fillStyle = RED;
      c.fillRect(-tw / 2 - 9, -80, tw + 18, 24);
      c.fillStyle = WHITE;
      c.textBaseline = 'middle';
      c.fillText('연쇄', 0, -67);
      c.restore();
    },

    // ── 무기 받침 · 표시 ──
    /** 검정 원판 (무기 그림 바로 밑) + 세계 색 가는 고리. 합친 무기는 고리를 반반 (메인 · 보조) */
    base(c, w, x, y, s) {
      const cy = y - s * 0.16;
      const R = s * 0.5;
      c.fillStyle = INK;
      c.beginPath();
      c.arc(x, cy, R, 0, TAU);
      c.fill();
      const lw = Math.max(1.3, s * 0.035);
      const rr = R - lw / 2 - s * 0.045;
      c.lineWidth = lw;
      if (w.sub) {
        c.strokeStyle = wcol(w.world);
        c.beginPath();
        c.arc(x, cy, rr, Math.PI * 0.5 + 0.12, Math.PI * 1.5 - 0.12);
        c.stroke();
        c.strokeStyle = wcol(w.subWorld);
        c.beginPath();
        c.arc(x, cy, rr, -Math.PI * 0.5 + 0.12, Math.PI * 0.5 - 0.12);
        c.stroke();
        // 합친 무기 표시: 원판 위 빨간 점
        c.fillStyle = RED;
        c.beginPath();
        c.arc(x, cy - R + s * 0.02, s * 0.06, 0, TAU);
        c.fill();
      } else {
        c.strokeStyle = wcol(w.world);
        c.globalAlpha = 0.85;
        c.beginPath();
        c.arc(x, cy, rr, 0, TAU);
        c.stroke();
        c.globalAlpha = 1;
      }
    },

    /** 레벨 1~5: 원판 아래쪽 둘레의 다섯 마디 */
    pips(c, w, x, y, s) {
      // 원판 아래 테에 붙은 다섯 마디 (왼쪽 → 오른쪽): 찬 마디 빨강, 빈 마디 옅은 먹
      const cy = y - s * 0.16;
      const R = s * 0.5 + 1.9;
      const span = 1.75;
      const step = span / 5;
      const a0 = Math.PI * 0.5 + span / 2;
      c.lineWidth = 3.4;
      c.lineCap = 'butt';
      for (let i = 0; i < 5; i++) {
        const a = a0 - i * step;
        c.strokeStyle = i < w.lv ? RED : 'rgba(21,21,21,0.2)';
        c.beginPath();
        c.arc(x, cy, R, a - step + 0.05, a - 0.05, false);
        c.stroke();
      }
    },

    /** 무기 위 잠깐 뜨는 글: NEW 는 빨강, 강화는 먹 */
    pop(c, p) {
      const k = p.age / 1.6;
      c.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      const ty = p.w.y - GUN * 0.95 - ease(Math.min(1, p.age / 0.3)) * 12;
      c.font = `700 10px ${SG}`;
      const tw = c.measureText(p.text).width + 12;
      c.fillStyle = p.text === 'NEW' ? RED : INK;
      c.fillRect(p.w.x - tw / 2, ty - 10, tw, 15);
      c.fillStyle = WHITE;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(p.text, p.w.x, ty - 2.3);
    },

    // ── 실전 판 화면 ──
    hurt(c, run, k) {
      c.globalAlpha = k;
      c.fillStyle = 'rgba(222,49,32,0.10)';
      c.fillRect(0, 0, W, FIELD_H);
      c.strokeStyle = RED;
      c.lineWidth = 4 + 10 * k;
      c.strokeRect(0, 0, W, CH - HUD);
    },

    /** 위 띠: 종이 그대로 + 굵은 숫자. 목숨 = 빨간 네모 다섯, 아래 가장자리 = 경험치 줄 */
    hud(c, run) {
      S.run = run;
      const H = run.oy;
      c.fillStyle = PAPER;
      c.fillRect(0, 0, W, H);
      tag(c, 'LIFE', 16, 22);
      for (let i = 0; i < 5; i++) {
        const x = 16 + i * 15;
        const y = 31;
        if (i < run.hearts) {
          c.fillStyle = RED;
          c.fillRect(x, y, 11, 11);
        } else {
          c.strokeStyle = RULE;
          c.lineWidth = 1.5;
          c.strokeRect(x + 0.75, y + 0.75, 9.5, 9.5);
        }
      }
      tag(c, 'LEVEL', W / 2, 22, 'center');
      tag(c, 'WAVE', W - 16, 22, 'right');
      c.fillStyle = INK;
      c.font = `700 26px ${SG}`;
      c.textBaseline = 'alphabetic';
      c.textAlign = 'center';
      c.fillText(pad2(run.level), W / 2, 46);
      c.textAlign = 'right';
      c.fillText(pad2(run.wave), W - 16, 46);
      // 경험치: 띠 아래 가장자리 전체
      const k = clamp(run.exp / run.need, 0, 1);
      c.fillStyle = RULE;
      c.fillRect(0, H - 4, W, 4);
      c.fillStyle = INK;
      c.fillRect(0, H - 4, W * k, 4);
      c.fillStyle = RED;
      if (k > 0) c.fillRect(Math.max(0, W * k - 4), H - 4, 4, 4);
    },

    /** 왼쪽 세계 칩: 먹 알약 + 세계 문장 + 수 */
    chips(c, run) {
      const m = run.worlds();
      let y = 12;
      for (const k of ORDER) {
        if (!m[k]) continue;
        const wo = CX.wo(k);
        c.fillStyle = INK;
        roundRect(c, 10, y, 40, 20, 3);
        c.fill();
        c.save();
        wo.crest(c, 13.5, y + 3.5, 6.5);
        c.restore();
        c.fillStyle = WHITE;
        c.font = `700 12px ${SG}`;
        c.textAlign = 'right';
        c.textBaseline = 'middle';
        c.fillText(String(m[k]), 44, y + 10.5);
        y += 24;
      }
    },

    /** 오른쪽 위: 갈래 n/다음 · 합성 칸 k (칸이 있으면 빨강) */
    gate(c, run) {
      const n = run.cats().size;
      const next = CAT_TH.find((t) => t > n) || 15;
      const slots = run.fuseSlots();
      const t1 = `갈래 ${n}/${next}`;
      const t2 = `합성 칸 ${slots}`;
      c.font = `700 11px ${SG}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const w1 = c.measureText(t1).width + 16;
      const w2 = c.measureText(t2).width + 16;
      const y = 12;
      const h = 20;
      const x2 = W - 10 - w2;
      const x1 = x2 - 4 - w1;
      c.fillStyle = WHITE;
      c.fillRect(x1, y, w1, h);
      c.strokeStyle = INK;
      c.lineWidth = 1.5;
      c.strokeRect(x1 + 0.75, y + 0.75, w1 - 1.5, h - 1.5);
      c.fillStyle = INK;
      c.fillText(t1, x1 + w1 / 2, y + h / 2 + 0.5);
      if (slots > 0) {
        c.fillStyle = RED;
        c.fillRect(x2, y, w2, h);
        c.fillStyle = WHITE;
      } else {
        c.fillStyle = PAPER;
        c.fillRect(x2, y, w2, h);
        c.strokeStyle = RULE;
        c.strokeRect(x2 + 0.75, y + 0.75, w2 - 1.5, h - 1.5);
        c.fillStyle = GRAY;
      }
      c.fillText(t2, x2 + w2 / 2, y + h / 2 + 0.5);
    },

    /** 웨이브: 먹 띠가 왼쪽에서 열리고 오른쪽으로 닫힌다. 합성: 흰 카드 + 빨간 옆줄 */
    banner(c, b) {
      const k = b.age / b.life;
      if (b.wave) {
        const ik = ease(clamp(k / 0.16, 0, 1));
        const ok = ease(clamp((k - 0.8) / 0.2, 0, 1));
        const y = 112;
        const h = 52;
        const x0 = W * ok;
        const x1 = W * ik;
        if (x1 - x0 < 1) return;
        c.beginPath();
        c.rect(x0, y, x1 - x0, h);
        c.clip();
        c.fillStyle = INK;
        c.fillRect(0, y, W, h);
        c.fillStyle = RED;
        c.fillRect(0, y, 8, h);
        const num = (/WAVE (\d+)/.exec(b.text) || [])[1] || '';
        const boss = b.text.indexOf(' · ') > 0;
        const tx = 24 + (1 - ik) * 20;
        tag(c, 'WAVE', tx, y + 32, 'left', '#B4B0A8', 13);
        c.font = `700 34px ${SG}`;
        c.letterSpacing = '-1px';
        c.fillStyle = WHITE;
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        c.fillText(pad2(Number(num)), tx + 64, y + 39);
        c.letterSpacing = '0px';
        if (boss) {
          const name = b.text.split(' · ')[1];
          c.font = `15px ${BH}`;
          const tw = c.measureText(name).width + 20;
          c.fillStyle = RED;
          c.fillRect(W - 20 - tw, y + 14, tw, 24);
          c.fillStyle = WHITE;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(name, W - 20 - tw / 2, y + 26.5);
        }
        return;
      }
      const a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
      const slide = (1 - ease(clamp(k / 0.15, 0, 1))) * 14;
      c.globalAlpha = clamp(a, 0, 1);
      const x = 20;
      const y = 112 + slide;
      const w = W - 40;
      const h = 70;
      c.fillStyle = WHITE;
      c.fillRect(x, y, w, h);
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.strokeRect(x + 1, y + 1, w - 2, h - 2);
      c.fillStyle = RED;
      c.fillRect(x, y, 8, h);
      const m = /^(.+?) · (.+)$/.exec(b.text);
      const head = m ? m[1] : '';
      const title = m ? m[2] : b.text;
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      if (head) {
        c.font = `700 11px ${SG}`;
        c.fillStyle = RED_T;
        c.fillText(head, x + 22, y + 21);
      }
      c.fillStyle = INK;
      c.font = `21px ${BH}`;
      c.fillText(title, x + 22, y + 45, w - 36);
      c.fillStyle = GRAY;
      c.font = `500 11px ${KR}`;
      c.fillText(b.sub || '', x + 22, y + 61, w - 36);
    },

    /** 레벨 업: 판만 종이로 덮고 (위 띠는 그대로) 왼쪽 맞춘 제목 + 카드 셋 */
    offer(c, o, run) {
      const t = o.age;
      const a = Math.min(1, t / 0.2);
      c.fillStyle = `rgba(238,236,231,${0.975 * a})`;
      c.fillRect(0, 0, W, run.ch - run.oy);
      c.globalAlpha = a;
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
      c.fillStyle = INK;
      c.font = `32px ${BH}`;
      c.fillText('레벨 업', 18, 114);
      c.textAlign = 'right';
      c.font = `700 13px ${SG}`;
      c.fillStyle = GRAY;
      c.fillText(`LV ${pad2(o.from)} → ${pad2(o.from + 1)}`, W - 18, 112);
      c.fillStyle = INK;
      c.fillRect(18, 124, (W - 36) * ease(clamp(t / 0.35, 0, 1)), 2);
      c.globalAlpha = 1;
      o.cards.forEach((cd, i) => {
        const y = 140 + i * 112;
        const enter = ease(clamp((t - i * 0.07) / 0.28, 0, 1));
        const picked = o.pick === i;
        const faded = o.pick >= 0 && !picked;
        c.save();
        c.globalAlpha = enter * (faded ? 0.3 : 1);
        c.translate(0, (1 - enter) * 22);
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
        c.fillStyle = GRAY;
        c.font = `500 11px ${KR}`;
        c.textAlign = 'center';
        c.fillText('카드를 눌러 고른다', W / 2, 140 + 3 * 112 + 6);
      }
    },

    /** 카드: 흰 판 + 먹 테 (합성은 빨강 테). 왼쪽 종이 칸에 원판 위 무기. 고르면 먹으로 뒤집힌다 */
    card(c, cd, x, y, w, h, picked, run) {
      const fuse = cd.kind === 'fuse';
      const fg = picked ? WHITE : INK;
      const sub = picked ? '#BDB9B1' : GRAY;
      c.fillStyle = picked ? INK : WHITE;
      c.fillRect(x, y, w, h);
      c.fillStyle = picked ? '#262523' : PAPER;
      c.fillRect(x, y, 100, h);
      c.strokeStyle = fuse ? RED : INK;
      c.lineWidth = fuse ? 2.5 : 1.5;
      c.strokeRect(x + c.lineWidth / 2, y + c.lineWidth / 2, w - c.lineWidth, h - c.lineWidth);
      const v = cd.view;
      c.save();
      CX.drawGun(c, v, x + 50, y + h / 2 + 10, 50, run.t);
      c.restore();
      const tx = x + 114;
      const tw = w - 126;
      const wn = (k) => CX.wo(k).name;
      let kind;
      let info;
      let name;
      let lv = '';
      let l1;
      let l2 = '';
      if (fuse) {
        kind = '합성';
        info = `칸 ${run.fuseSlots()} 중 1 · 등급 ${Math.min(cd.a.lv, cd.b.lv)}`;
        name = v.name;
        l1 = `몸 ${cd.a.name} (${CX.wo(cd.a.world).short}) + 연출 ${cd.b.name} (${CX.wo(cd.b.world).short})`;
        l2 = `반응 · ${v.react}`;
      } else if (cd.kind === 'new') {
        const own = run.worlds();
        kind = '새 무기';
        info = `${wn(v.world)} · ${v.catLabel}${own[v.world] ? '' : ' · 새 세계'}`;
        name = v.name;
        const left = (CAT_TH.find((tt) => tt > run.cats().size) || 15) - run.cats().size - 1;
        l1 = run.cats().has(v.cat) ? `${v.catLabel} 갈래 하나 더` : left <= 0 ? '새 갈래 · 이걸로 합성 칸이 열린다' : `새 갈래 · 합성 칸까지 갈래 ${left}`;
      } else {
        kind = '강화';
        info = `${wn(v.world)} · ${v.catLabel}`;
        name = v.name;
        lv = `Lv ${v.lv} → ${v.lv + 1}`;
        l1 = '피해 +28% · 쿨다운 −6%';
      }
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      // 종류 꼬리표
      c.font = `700 10px ${KR}`;
      const kw = c.measureText(kind).width + 12;
      if (fuse) c.fillStyle = RED;
      else if (cd.kind === 'new') c.fillStyle = picked ? WHITE : INK;
      else c.fillStyle = 'rgba(0,0,0,0)';
      c.fillRect(tx, y + 14, kw, 17);
      if (cd.kind === 'up') {
        c.strokeStyle = fg;
        c.lineWidth = 1.2;
        c.strokeRect(tx + 0.6, y + 14.6, kw - 1.2, 15.8);
      }
      c.fillStyle = fuse ? WHITE : cd.kind === 'new' ? (picked ? INK : WHITE) : fg;
      c.fillText(kind, tx + 6, y + 23);
      c.fillStyle = sub;
      c.font = `500 10.5px ${KR}`;
      c.fillText(info, tx + kw + 8, y + 23, tw - kw - 8);
      // 고른 카드: 오른쪽 위 "선택"
      if (picked) {
        c.textAlign = 'right';
        c.font = `700 10.5px ${KR}`;
        c.fillStyle = '#FF7A6E';
        c.fillText('선택', x + w - 12, y + 23);
      }
      // 이름
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      c.fillStyle = fg;
      c.font = `21px ${BH}`;
      c.fillText(name, tx, y + 56, tw);
      if (lv) {
        const nw = Math.min(tw, c.measureText(name).width);
        c.font = `700 13px ${SG}`;
        c.fillStyle = picked ? '#FF7A6E' : RED_T;
        c.fillText(lv, tx + nw + 8, y + 55);
      }
      c.fillStyle = sub;
      c.font = `500 11px ${KR}`;
      c.fillText(l1, tx, y + 75, tw);
      if (l2) {
        c.fillStyle = picked ? '#FF7A6E' : RED_T;
        c.font = `700 11px ${KR}`;
        c.fillText(l2, tx, y + 91, tw);
      }
    },

    /** 끝: 종이로 덮고 큰 제목 + 네 칸 기록표 + 새 판까지 줄 */
    over(c, run) {
      const a = Math.min(1, run.over / 0.4);
      c.fillStyle = `rgba(238,236,231,${0.975 * a})`;
      c.fillRect(0, 0, W, run.ch - run.oy);
      c.globalAlpha = a;
      const x = 18;
      const w = W - 36;
      c.fillStyle = RED;
      c.fillRect(x, 146, 44, 8);
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      c.fillStyle = INK;
      c.font = `44px ${BH}`;
      c.fillText('방어선 붕괴', x, 206);
      c.fillStyle = GRAY;
      c.font = `500 12px ${KR}`;
      c.fillText('목숨을 모두 잃었다', x, 230);
      c.fillStyle = INK;
      c.fillRect(x, 256, w, 2);
      const st = [
        ['WAVE', pad2(run.wave)],
        ['LEVEL', pad2(run.level)],
        ['CHAIN', String(run.chainPeak)],
        ['FUSION', String(run.fusedN)],
      ];
      const kr = ['웨이브', '레벨', '연쇄 최고', '합성'];
      st.forEach(([k, v], i) => {
        const cx = x + (w / 4) * i;
        if (i) {
          c.fillStyle = RULE;
          c.fillRect(cx, 266, 1, 66);
        }
        tag(c, k, cx + (i ? 10 : 0), 278);
        c.fillStyle = INK;
        c.font = `700 30px ${SG}`;
        c.textAlign = 'left';
        c.fillText(v, cx + (i ? 10 : 0), 314);
        c.fillStyle = GRAY;
        c.font = `500 10px ${KR}`;
        c.fillText(kr[i], cx + (i ? 10 : 0), 330);
      });
      c.fillStyle = RULE;
      c.fillRect(x, 344, w, 1);
      c.fillStyle = GRAY;
      c.font = `500 11px ${KR}`;
      c.fillText('잠시 뒤 새 판', x, 372);
      c.fillStyle = RULE;
      c.fillRect(x, 382, w, 3);
      c.fillStyle = INK;
      c.fillRect(x, 382, w * clamp(run.over / 4, 0, 1), 3);
    },
  };
  for (const k of ['sky', 'enemy', 'boom', 'seam', 'num', 'line', 'chain']) def[k] = own(def[k]);
  CX.defineTheme('mono', def);
})();
