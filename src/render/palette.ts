/** 어두운 배경 + 네온. 귀여운·파스텔 톤 금지 (기획서 아트 톤) */
export const COLORS = {
  letterbox: '#040508',
  bg: '#07080d',
  grid: 'rgba(110, 130, 255, 0.07)',
  line: '#ff3c6e',
  text: '#e9ecf5',
  dim: '#7a8099',
  charge: '#3cf0e0',
  xp: '#b54dff',
  life: '#ff4d6d',
  boss: '#ff3cc8',
  gold: '#ffd36b',
} as const;

/** 연쇄가 길어질수록 주황 → 분홍 → 보라 → 파랑 → 하양 */
export const CHAIN_COLORS = ['#ffb347', '#ff7a3c', '#ff3c6e', '#ff3cc8', '#b54dff', '#5a7cff', '#3ce0ff', '#e8fbff'] as const;

export function chainColor(kills: number): string {
  return CHAIN_COLORS[Math.min(CHAIN_COLORS.length - 1, Math.floor(kills / 4))];
}

const rgbaCache = new Map<string, string>();

export function rgba(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 100) / 100;
  const key = `${hex}|${a}`;
  let v = rgbaCache.get(key);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    if (rgbaCache.size > 4000) rgbaCache.clear();
    rgbaCache.set(key, v);
  }
  return v;
}
