/**
 * 헤드리스 자동 플레이 — 밸런스 검증용.
 *
 *   npm run autoplay -- --runs 200 --mode chapter --chapter ch2 --upgrades firepower=3,durability=1
 *   npm run autoplay -- --runs 50 --mode endless --max-min 15 --json autoplay-endless.json
 *
 * 기획서 "프로토 단계에서 볼 것": 판당 최대 연쇄 분포, 많이 고르는 증강, 많이 죽는 웨이브.
 * 봇은 사람이 아니라 기준선이다. 수치를 바꾼 뒤 "전보다 쉬워졌나/어려워졌나"를 비교하는 데 쓴다.
 */
import { writeFileSync } from 'node:fs';
import { FIXED_DT } from '../src/data/balance';
import { UPGRADES, type UpgradeId } from '../src/data/upgrades';
import { getAugment } from '../src/data/augments';
import { defaultSave } from '../src/meta/save';
import { createRunConfig } from '../src/meta/progression';
import { Bot, type PickStrategy } from '../src/sim/bot';
import { World } from '../src/sim/World';
import { CHAIN_BUCKET_LABELS, type RunMode, type RunSummary } from '../src/sim/types';

interface Args {
  runs: number;
  mode: RunMode;
  chapter: string;
  seed: number;
  maxMin: number;
  pick: PickStrategy;
  reaction: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  json?: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { runs: 100, mode: 'chapter', chapter: 'ch1', seed: 1, maxMin: 20, pick: 'rarity', reaction: 0.3, upgrades: {} };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--runs': a.runs = Number(v); i++; break;
      case '--mode': a.mode = v as RunMode; i++; break;
      case '--chapter': a.chapter = v; i++; break;
      case '--seed': a.seed = Number(v); i++; break;
      case '--max-min': a.maxMin = Number(v); i++; break;
      case '--pick': a.pick = v as PickStrategy; i++; break;
      case '--reaction': a.reaction = Number(v); i++; break;
      case '--json': a.json = v; i++; break;
      case '--upgrades':
        for (const part of (v ?? '').split(',').filter(Boolean)) {
          const [id, lvl] = part.split('=');
          if (!UPGRADES.some((u) => u.id === id)) throw new Error(`모르는 영구 강화: ${id}`);
          a.upgrades[id as UpgradeId] = Number(lvl);
        }
        i++;
        break;
      default:
        if (k.startsWith('--')) throw new Error(`모르는 옵션: ${k}`);
    }
  }
  return a;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
}

function runOne(args: Args, seed: number): RunSummary {
  const save = defaultSave();
  save.upgrades = { ...args.upgrades };
  const config = { ...createRunConfig(save, args.mode, seed, args.chapter), recordEvents: false };
  const world = new World(config);
  const bot = new Bot({ seed, pick: args.pick, reactionSec: args.reaction });
  const maxSec = args.maxMin * 60;
  let steps = 0;
  const maxSteps = Math.ceil(maxSec / FIXED_DT) * 2;
  while (world.phase !== 'ended' && world.time < maxSec && steps < maxSteps) {
    world.step(FIXED_DT, bot.think(world, FIXED_DT));
    steps++;
  }
  if (world.phase !== 'ended') world.quit();
  return world.summary();
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const t0 = performance.now();
  const runs: RunSummary[] = [];
  for (let i = 0; i < args.runs; i++) runs.push(runOne(args, args.seed + i));
  const elapsed = (performance.now() - t0) / 1000;

  const n = runs.length;
  const victories = runs.filter((r) => r.result === 'victory').length;
  const durations = runs.map((r) => r.durationSec / 60).sort((a, b) => a - b);
  const maxChains = runs.map((r) => r.maxChain).sort((a, b) => a - b);
  const waves = runs.map((r) => r.wave);

  const deathWaves = new Map<number, number>();
  for (const r of runs) if (r.result === 'defeat') deathWaves.set(r.wave, (deathWaves.get(r.wave) ?? 0) + 1);

  const pickCounts = new Map<string, number>();
  for (const r of runs) for (const id of r.picks) pickCounts.set(id, (pickCounts.get(id) ?? 0) + 1);

  const hist = CHAIN_BUCKET_LABELS.map(() => 0);
  for (const r of runs) r.chainHistogram.forEach((c, i) => (hist[i] += c));
  const histTotal = hist.reduce((a, b) => a + b, 0) || 1;

  const fmt = (x: number, d = 1) => x.toFixed(d);
  const bar = (frac: number) => '█'.repeat(Math.round(frac * 30));

  console.log(`\n자동 플레이 ${n}판 (${args.mode === 'endless' ? 'endless' : args.chapter}, 시드 ${args.seed}~${args.seed + n - 1}, 픽 ${args.pick}, 반응 ${args.reaction}s) — ${fmt(elapsed, 1)}초`);
  if (Object.keys(args.upgrades).length) console.log(`영구 강화: ${JSON.stringify(args.upgrades)}`);
  console.log('');
  console.log(`클리어율        ${fmt((victories / n) * 100)}%`);
  console.log(`판 길이(분)     p10 ${fmt(percentile(durations, 0.1))} · 중앙 ${fmt(percentile(durations, 0.5))} · p90 ${fmt(percentile(durations, 0.9))}   (목표 5~8분)`);
  console.log(`도달 웨이브     평균 ${fmt(waves.reduce((a, b) => a + b, 0) / n)} · 최고 ${Math.max(...waves)}`);
  console.log(`판당 최대 연쇄  중앙 ${percentile(maxChains, 0.5)} · p90 ${percentile(maxChains, 0.9)} · 최고 ${maxChains[maxChains.length - 1]}`);
  const sum = (f: (r: RunSummary) => number) => runs.reduce((a, r) => a + f(r), 0);
  console.log(`평균 처치       ${fmt(sum((r) => r.kills) / n, 0)} · 탭 ${fmt(sum((r) => r.taps ?? 0) / n, 0)} · 탭당 처치 ${fmt(sum((r) => r.kills) / Math.max(1, sum((r) => r.taps ?? 0)), 2)} · 환급 ${fmt(sum((r) => r.refunds ?? 0) / n, 0)}`);
  console.log(`평균 레벨       ${fmt(runs.reduce((a, r) => a + r.level, 0) / n)}`);
  console.log(`평균 부품       ${fmt(runs.reduce((a, r) => a + r.partsEarned, 0) / n)}`);

  console.log('\n연쇄 길이 분포 (전체 연쇄 기준)');
  CHAIN_BUCKET_LABELS.forEach((label, i) => {
    console.log(`  ${label.padStart(5)}  ${fmt((hist[i] / histTotal) * 100).padStart(5)}%  ${bar(hist[i] / histTotal)}`);
  });

  if (deathWaves.size) {
    console.log('\n사망 웨이브');
    const maxD = Math.max(...deathWaves.values());
    [...deathWaves.entries()].sort((a, b) => a[0] - b[0]).forEach(([w, c]) => {
      console.log(`  W${String(w).padStart(2)}  ${String(c).padStart(4)}  ${bar(c / maxD)}`);
    });
  }

  console.log('\n증강 선택 (판당 평균 횟수)');
  [...pickCounts.entries()].sort((a, b) => b[1] - a[1]).forEach(([id, c]) => {
    const def = getAugment(id);
    console.log(`  ${def.name.padEnd(8)} ${def.rarity.padEnd(6)} ${fmt(c / n, 2)}`);
  });

  if (args.json) {
    writeFileSync(args.json, JSON.stringify({ args, runs }, null, 2));
    console.log(`\n→ ${args.json}`);
  }
}

main();
