import { ARMS, CATEGORY_COLOR, type ArmCategory } from '../data/chaos';

/**
 * 도파민 모드 무기·물체 그림 (11-09 "유아틱하다" 피드백으로 이모지 대신).
 * 게임 화면의 네온 톤에 맞춰 어두운 몸 + 갈래 색 테두리 + 빛. 갈래마다 같은 모양 언어를 쓴다:
 * 포격=포신, 소환수=화살촉 몸, 주문=문양, 함정=육각 지뢰, 공중=폭탄, 돌격=쐐기, 음파=울림통, 회전체=날,
 * 장판=통풍구, 광선=프리즘, 투척=파편, 떼=작은 점, 정령=빛 구슬.
 * 데이터의 emoji 는 "어떤 그림을 쓸지" 찾는 열쇠로만 쓴다 (화면에 이모지를 그리지 않는다).
 */
export type GlyphShape =
  | 'spark' | 'cannon' | 'beast' | 'brute' | 'sigil' | 'mine' | 'bomb' | 'vehicle' | 'speaker' | 'blade'
  | 'vent' | 'emitter' | 'shard' | 'hive' | 'mote' | 'wisp' | 'drone' | 'orb' | 'saucer' | 'plane'
  | 'serpent' | 'crate' | 'star' | 'cloud';

export interface Glyph {
  shape: GlyphShape;
  color: string;
}

const MOUNT: Record<ArmCategory, GlyphShape> = {
  hand: 'spark', gun: 'shard', turret: 'cannon', summon: 'beast', magic: 'sigil', trap: 'mine', air: 'bomb',
  charge: 'vehicle', sound: 'speaker', spinner: 'blade', field: 'vent', ray: 'emitter', throw: 'shard',
  swarm: 'hive', spirit: 'wisp', passive: 'orb',
};
/** 날아가거나 걸어가는 것 (p.emoji) 의 그림 */
const PROJ: Record<ArmCategory, GlyphShape> = {
  hand: 'shard', gun: 'shard', turret: 'bomb', summon: 'beast', magic: 'orb', trap: 'mine', air: 'bomb',
  charge: 'vehicle', sound: 'orb', spinner: 'blade', field: 'orb', ray: 'orb', throw: 'shard',
  swarm: 'mote', spirit: 'wisp', passive: 'orb',
};

/** 난입 물체·잭팟·쿠키 등 무기 데이터에 없는 그림 */
const EXTRA: Record<string, Glyph> = {
  '☄️': { shape: 'bomb', color: '#ff8a3c' },
  '🦖': { shape: 'brute', color: '#7dff9a' },
  '🐄': { shape: 'brute', color: '#e8e8f0' },
  '🐑': { shape: 'beast', color: '#e8e8f0' },
  '🍌': { shape: 'shard', color: '#ffe08a' },
  '🐴': { shape: 'crate', color: '#a7a291' },
  '🚂': { shape: 'vehicle', color: '#ff6b6b' },
  '🐉': { shape: 'serpent', color: '#ff5a2a' },
  '🛸': { shape: 'saucer', color: '#7dffd0' },
  '✈️': { shape: 'plane', color: '#9fd8ff' },
  '🎅': { shape: 'plane', color: '#ff6b6b' },
  '💣': { shape: 'bomb', color: '#ffb347' },
  '🍪': { shape: 'orb', color: '#ffd36b' },
  '7️⃣': { shape: 'star', color: '#ffd36b' },
  '⛈️': { shape: 'cloud', color: '#9fd8ff' },
  '🚁': { shape: 'drone', color: '#9fe8ff' },
  '⚙️': { shape: 'blade', color: '#e8e8f0' },
  '💂': { shape: 'beast', color: '#7dff9a' },
  '🔨': { shape: 'crate', color: '#c8d0e8' },
  '🌊': { shape: 'vehicle', color: '#4dd2ff' },
  '🎳': { shape: 'orb', color: '#e8e8f0' },
  '🪤': { shape: 'mine', color: '#ff8a3c' },
  '🔥': { shape: 'orb', color: '#ff8a3c' },
  '💧': { shape: 'orb', color: '#4dd2ff' },
  '🪨': { shape: 'crate', color: '#a7a291' },
};

const table = new Map<string, Glyph>();
(function build() {
  for (const w of Object.values(ARMS)) {
    const col = w.p.color ?? CATEGORY_COLOR[w.cat];
    if (!table.has(w.emoji)) {
      let shape = MOUNT[w.cat];
      if (w.cat === 'summon' && (w.p.size ?? 0) >= 26) shape = 'brute';
      if (w.kind === 'drone' && w.emoji === '🚁') shape = 'drone';
      if (w.p.event === 'ufo') shape = 'saucer';
      table.set(w.emoji, { shape, color: col });
    }
    const pe = w.p.emoji;
    if (pe && !table.has(pe)) {
      let shape = PROJ[w.cat];
      if (w.cat === 'summon' && (w.p.size ?? 0) >= 26) shape = 'brute';
      if (w.cat === 'charge' && w.kind === 'stamp' && (w.p.size ?? 0) >= 26) shape = 'brute';
      table.set(pe, { shape, color: col });
    }
  }
  for (const [k, g] of Object.entries(EXTRA)) if (!table.has(k)) table.set(k, g);
})();

export function glyphFor(key: string): Glyph {
  return table.get(key) ?? { shape: 'orb', color: '#c8d0e8' };
}

/** 72×72 캔버스 가운데에 그린다 */
export function paintGlyph(g: CanvasRenderingContext2D, gl: Glyph): void {
  const c = gl.color;
  g.save();
  g.translate(36, 36);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const body = 'rgba(12, 14, 24, 0.82)';
  const line = (w = 4) => {
    g.shadowColor = c;
    g.shadowBlur = 10;
    g.strokeStyle = c;
    g.lineWidth = w;
    g.stroke();
    g.shadowBlur = 0;
  };
  const fill = (col = body) => {
    g.fillStyle = col;
    g.fill();
  };
  const core = (r: number, x = 0, y = 0) => {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.shadowColor = c;
    g.shadowBlur = 14;
    g.fillStyle = '#ffffff';
    g.fill();
    g.shadowBlur = 0;
  };
  const poly = (pts: [number, number][]) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  switch (gl.shape) {
    case 'spark':
      poly([[0, -26], [6, -6], [26, 0], [6, 6], [0, 26], [-6, 6], [-26, 0], [-6, -6]]);
      fill();
      line(3);
      core(5);
      break;
    case 'cannon':
      g.beginPath();
      g.arc(0, 10, 18, Math.PI, 0);
      g.closePath();
      fill();
      line(3);
      g.save();
      g.rotate(-0.6);
      g.beginPath();
      g.rect(-6, -30, 12, 30);
      fill();
      line(3);
      g.restore();
      core(4, 0, 6);
      break;
    case 'beast':
      poly([[0, -26], [18, 18], [0, 8], [-18, 18]]);
      fill();
      line(3.5);
      core(3.5, 0, -6);
      break;
    case 'brute':
      poly([[0, -24], [26, 4], [18, 24], [0, 14], [-18, 24], [-26, 4]]);
      fill();
      line(4);
      core(3.5, -7, -2);
      core(3.5, 7, -2);
      break;
    case 'sigil':
      g.beginPath();
      g.arc(0, 0, 24, 0, Math.PI * 2);
      fill();
      line(3);
      poly([[0, -18], [16, 10], [-16, 10]]);
      line(2.5);
      core(4);
      break;
    case 'mine': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 6; i++) pts.push([Math.cos((i / 6) * Math.PI * 2) * 24, Math.sin((i / 6) * Math.PI * 2) * 24]);
      poly(pts);
      fill();
      line(3.5);
      core(7);
      break;
    }
    case 'bomb':
      g.beginPath();
      g.arc(0, 4, 20, 0, Math.PI * 2);
      fill();
      line(3.5);
      g.beginPath();
      g.moveTo(-8, -20);
      g.lineTo(0, -12);
      g.lineTo(8, -20);
      line(3);
      core(4, -6, -2);
      break;
    case 'vehicle':
      poly([[0, -26], [22, 14], [10, 22], [-10, 22], [-22, 14]]);
      fill();
      line(3.5);
      g.beginPath();
      g.moveTo(-6, 4);
      g.lineTo(6, 4);
      g.moveTo(-9, 12);
      g.lineTo(9, 12);
      line(2.5);
      break;
    case 'speaker':
      g.beginPath();
      g.arc(0, 6, 12, 0, Math.PI * 2);
      fill();
      line(3);
      for (const r of [20, 28]) {
        g.beginPath();
        g.arc(0, 6, r, -Math.PI * 0.85, -Math.PI * 0.15);
        line(2.5);
      }
      core(4, 0, 6);
      break;
    case 'blade': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 ? 9 : 27;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      poly(pts);
      fill();
      line(3);
      core(4);
      break;
    }
    case 'vent':
      g.beginPath();
      g.roundRect(-22, -22, 44, 44, 8);
      fill();
      line(3);
      g.beginPath();
      for (const y of [-9, 0, 9]) {
        g.moveTo(-12, y);
        g.lineTo(12, y);
      }
      line(2.5);
      break;
    case 'emitter':
      poly([[0, -26], [18, 0], [0, 26], [-18, 0]]);
      fill();
      line(3);
      core(6);
      g.beginPath();
      g.moveTo(0, -26);
      g.lineTo(0, -34);
      line(2);
      break;
    case 'shard':
      g.rotate(Math.PI / 4);
      poly([[-14, -14], [14, -14], [14, 14], [-14, 14]]);
      fill();
      line(3.5);
      g.rotate(-Math.PI / 4);
      core(4);
      break;
    case 'hive':
      for (const [x, y] of [[-10, 6], [10, 6], [0, -10]] as [number, number][]) {
        g.beginPath();
        g.arc(x, y, 10, 0, Math.PI * 2);
        fill();
        line(2.5);
        core(2.5, x, y);
      }
      break;
    case 'mote':
      g.beginPath();
      g.arc(0, 0, 14, 0, Math.PI * 2);
      g.shadowColor = c;
      g.shadowBlur = 16;
      g.fillStyle = c;
      g.fill();
      g.shadowBlur = 0;
      core(5);
      break;
    case 'wisp':
      g.beginPath();
      g.ellipse(0, 0, 28, 10, -0.4, 0, Math.PI * 2);
      line(2.5);
      g.beginPath();
      g.arc(0, 0, 14, 0, Math.PI * 2);
      g.shadowColor = c;
      g.shadowBlur = 18;
      g.fillStyle = c;
      g.globalAlpha = 0.55;
      g.fill();
      g.globalAlpha = 1;
      g.shadowBlur = 0;
      core(7);
      break;
    case 'drone':
      g.beginPath();
      g.moveTo(-18, -18);
      g.lineTo(18, 18);
      g.moveTo(18, -18);
      g.lineTo(-18, 18);
      line(3);
      for (const [x, y] of [[-18, -18], [18, -18], [-18, 18], [18, 18]] as [number, number][]) {
        g.beginPath();
        g.arc(x, y, 7, 0, Math.PI * 2);
        fill();
        line(2);
      }
      core(4);
      break;
    case 'saucer':
      g.beginPath();
      g.ellipse(0, 6, 30, 10, 0, 0, Math.PI * 2);
      fill();
      line(3);
      g.beginPath();
      g.arc(0, 0, 12, Math.PI, 0);
      line(2.5);
      core(3, -12, 7);
      core(3, 12, 7);
      break;
    case 'plane':
      poly([[0, -28], [6, -6], [28, 8], [6, 6], [4, 22], [0, 18], [-4, 22], [-6, 6], [-28, 8], [-6, -6]]);
      fill();
      line(3);
      break;
    case 'serpent':
      g.beginPath();
      g.moveTo(-24, 20);
      g.bezierCurveTo(-24, -6, 0, 14, 0, -6);
      g.bezierCurveTo(0, -20, 18, -22, 24, -12);
      g.lineWidth = 12;
      g.strokeStyle = body;
      g.stroke();
      line(4);
      core(4, 22, -12);
      break;
    case 'crate':
      g.beginPath();
      g.rect(-20, -20, 40, 40);
      fill();
      line(3.5);
      g.beginPath();
      g.moveTo(-20, -20);
      g.lineTo(20, 20);
      g.moveTo(20, -20);
      g.lineTo(-20, 20);
      line(2);
      break;
    case 'star': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 ? 11 : 26;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      poly(pts);
      fill();
      line(3);
      break;
    }
    case 'cloud':
      g.beginPath();
      g.arc(-12, 4, 14, 0, Math.PI * 2);
      g.arc(10, 2, 16, 0, Math.PI * 2);
      g.arc(0, -8, 14, 0, Math.PI * 2);
      fill('rgba(30, 34, 52, 0.9)');
      line(2.5);
      break;
    default:
      g.beginPath();
      g.arc(0, 0, 20, 0, Math.PI * 2);
      fill();
      line(3);
      core(6);
  }
  g.restore();
}
