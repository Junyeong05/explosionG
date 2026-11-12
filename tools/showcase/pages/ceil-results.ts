// npx tsx tools/carry/ceil.ts --write 로 만든 측정값: [v3 처치 ÷ 따로, 천장 처치 ÷ 따로, 천장이 해낸 횟수] (18초 두 판)
export const CEIL_RESULTS: Record<string, [number, number, number]> = {
  'trap>charge': [1.50, 1.98, 42],
  'trap>spinner': [1.72, 1.65, 12],
  'trap>summon': [1.86, 1.98, 12],
  'summon>turret': [2.74, 2.14, 18],
  'gun>magic': [1.71, 2.10, 11],
  'sound>field': [0.83, 0.87, 6],
};
