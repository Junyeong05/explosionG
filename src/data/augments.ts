import { BALANCE } from './balance';
import { TAU } from '../core/math';
import { CHAOS_AUGMENTS } from './chaos';
import type { KillInfo, SimApi } from '../sim/api';
import type { PlayerStats } from '../sim/stats';
import type { Explosion } from '../sim/types';

/**
 * 증강 정의.
 *
 * 증강 하나 = 아래 세 가지의 조합. 새 증강은 이 파일에 객체 하나 추가로 끝나야 한다.
 *   1) modifyStats  : 숫자 강화 (노말 대부분)
 *   2) hooks        : 규칙 추가 (처치 시 / 폭발 시 / 매 스텝)
 *   3) onAcquire    : 얻는 순간 1회 효과
 *
 * 등급 (기획서): 노말(숫자) · 레어(작은 규칙) · 에픽(빌드 방향) · 프리즘(판의 규칙·조작 변경)
 * 수치는 전부 ⚠ 임시값. 기획서 "증강 목록" 탭(120종) 기준으로 채워나간다.
 */

export type Rarity = 'normal' | 'rare' | 'epic' | 'prism';
export type Archetype = 'chain' | 'rapid' | 'burst' | 'zone' | 'lightning';

export const ARCHETYPE_LABEL: Record<Archetype, string> = {
  chain: '연쇄 확장',
  rapid: '연타',
  burst: '한 방',
  zone: '지대 장악',
  lightning: '번개',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  normal: '노말',
  rare: '레어',
  epic: '에픽',
  prism: '프리즘',
};

/** 증강별 판 안 상태 (예: 과부하 처치 카운터). 숫자만 담는다 → 직렬화 쉬움 */
export type AugmentState = Record<string, number>;

export interface AugmentHooks {
  onKill?(api: SimApi, kill: KillInfo, stacks: number, state: AugmentState): void;
  onExplosion?(api: SimApi, ex: Readonly<Explosion>, stacks: number, state: AugmentState): void;
  onTick?(api: SimApi, dt: number, stacks: number, state: AugmentState): void;
}

export interface AugmentDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  archetypes: Archetype[];
  maxStacks: number;
  modifyStats?(s: PlayerStats, stacks: number): void;
  hooks?: AugmentHooks;
  onAcquire?(api: SimApi, stacks: number, state: AugmentState): void;
  /** 진화: requires 를 모두 갖추면 선택지에 75% 확률로 등장, 얻으면 replaces 는 비활성 */
  evolution?: { requires: string[]; replaces: string[] };
  /** 고를 증강이 바닥났을 때만 나오는 대체 선택지 */
  fallback?: boolean;
  /** 카드에 갈래 대신 보일 꼬리표 (도파민 모드 무기: 손공격·포탑·소환수·마법·강화) */
  tag?: string;
  /** 이미 가진 증강의 레벨 업 카드에 보일 설명 (next = 오를 레벨). 없으면 desc */
  levelDesc?(next: number): string;
}

// ─────────────────────────────────────────────────────────────
// 공용 헬퍼
// ─────────────────────────────────────────────────────────────

/** 화면 안 적 count 마리에게 번개. 피해는 폭발 큐로 (훅 규칙) */
function lightningStrike(api: SimApi, count: number, damage: number, radius: number): void {
  const pool = api.aliveEnemies();
  if (pool.length === 0) return;
  const chainId = api.newChain();
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = api.rng.int(pool.length);
    const t = pool[idx];
    pool[idx] = pool[pool.length - 1];
    pool.pop();
    api.emit({ type: 'bolt', kind: 'lightning', x1: t.x + api.rng.range(-20, 20), y1: -10, x2: t.x, y2: t.y });
    api.spawnExplosion({ x: t.x, y: t.y, radius, damage, chainId, source: 'lightning' });
  }
}

const isPrimaryBlast = (ex: Readonly<Explosion>) => ex.source === 'tap' || ex.source === 'chain';

// ─────────────────────────────────────────────────────────────
// 증강 목록
// ─────────────────────────────────────────────────────────────

export const AUGMENTS: readonly AugmentDef[] = [
  // ── 노말: 숫자 강화 ──────────────────────────────────────
  {
    id: 'blast_radius', name: '폭발 반경', rarity: 'normal', archetypes: ['burst'], maxStacks: 5,
    desc: '탭 폭발 반경 +12%',
    modifyStats: (s, n) => { s.tapRadius *= 1 + 0.12 * n; },
  },
  {
    id: 'chain_radius', name: '연쇄 반경', rarity: 'normal', archetypes: ['chain'], maxStacks: 5,
    desc: '연쇄 폭발 반경 +10%',
    modifyStats: (s, n) => { s.chainRadius *= 1 + 0.1 * n; },
  },
  {
    id: 'chain_amp', name: '연쇄 증폭', rarity: 'normal', archetypes: ['chain'], maxStacks: 3,
    desc: '연쇄로 넘어가는 피해 +10%p (기본: 체력을 넘긴 피해의 100%)',
    modifyStats: (s, n) => { s.chainCarry += 0.1 * n; },
  },
  {
    id: 'leftover', name: '잔여 장약', rarity: 'normal', archetypes: ['rapid'], maxStacks: 3,
    desc: '탭한 뒤 게이지 15%가 남음 (중첩당 +15%)',
    modifyStats: (s, n) => { s.gaugeLeftover += 0.15 * n; },
  },
  {
    id: 'fast_charge', name: '고속 충전', rarity: 'normal', archetypes: ['rapid'], maxStacks: 5,
    desc: '게이지 차는 속도 +12%',
    modifyStats: (s, n) => { s.gaugeFillSec /= 1 + 0.12 * n; },
  },
  {
    id: 'high_explosive', name: '고폭 화약', rarity: 'normal', archetypes: ['burst', 'chain'], maxStacks: 5,
    desc: '모든 폭발 피해 +10%',
    modifyStats: (s, n) => { s.tapDamage *= 1 + 0.1 * n; },
  },

  // ── 레어: 작은 규칙 추가 ─────────────────────────────────
  {
    id: 'chain_depth', name: '연쇄 단계', rarity: 'rare', archetypes: ['chain'], maxStacks: 2,
    desc: '연쇄가 한 단계 더 이어진다 (연쇄로 죽은 적도 한 번 더 터짐)',
    modifyStats: (s, n) => { s.chainDepthBonus += n; },
  },
  {
    id: 'chain_reaction', name: '연쇄 반응', rarity: 'rare', archetypes: ['chain'], maxStacks: 1,
    desc: '모든 적이 죽을 때 체력을 넘긴 피해만큼 터진다 (기본은 폭발형만)',
    modifyStats: (s) => { s.chainOnAllKills = true; },
  },
  {
    id: 'overheat_core', name: '과열 코어', rarity: 'rare', archetypes: ['burst'], maxStacks: 3,
    desc: '피해 배율 ×1.15 (중첩마다 곱해짐)',
    modifyStats: (s, n) => { s.damageMult *= Math.pow(1.15, n); },
  },
  {
    id: 'crit', name: '치명타', rarity: 'rare', archetypes: ['burst'], maxStacks: 3,
    desc: '탭 폭발 15% 확률로 피해 2배 (중첩당 +10%p)',
    modifyStats: (s, n) => { s.critChance += 0.15 + 0.1 * (n - 1); },
  },
  {
    id: 'chain_accel', name: '연쇄 가속', rarity: 'rare', archetypes: ['chain'], maxStacks: 3,
    desc: '연쇄 배율 처치당 +3%p (기본 +5%, 폭발형 자기 폭약에 곱함)',
    modifyStats: (s, n) => { s.chainMultiplierPerKill += 0.03 * n; },
  },
  {
    id: 'embers', name: '잔불', rarity: 'rare', archetypes: ['zone'], maxStacks: 3,
    desc: '탭·연쇄 폭발 자리에 1초간 불길이 남음',
    hooks: {
      onExplosion(api, ex, n) {
        if (!isPrimaryBlast(ex)) return;
        api.addZone({
          x: ex.x, y: ex.y,
          radius: ex.radius * 0.6,
          dps: ex.damage * (0.25 + 0.1 * (n - 1)),
          ttl: 1 + 0.3 * (n - 1),
          chainId: ex.chainId,
          source: 'ember',
          depth: ex.depth,
        });
      },
    },
  },
  {
    id: 'shrapnel', name: '파편', rarity: 'rare', archetypes: ['lightning'], maxStacks: 3,
    desc: '처치 시 파편이 주변 적을 맞힘 (중첩당 +1개, 연쇄가 이어짐)',
    hooks: {
      onKill(api, k, n) {
        const near = api.enemiesNear(k.enemy.x, k.enemy.y, 110);
        for (let i = 0; i < n && near.length > 0; i++) {
          const idx = api.rng.int(near.length);
          const t = near[idx];
          near[idx] = near[near.length - 1];
          near.pop();
          api.emit({ type: 'bolt', kind: 'shard', x1: k.enemy.x, y1: k.enemy.y, x2: t.x, y2: t.y });
          api.spawnExplosion({
            x: t.x, y: t.y, radius: 4,
            damage: api.stats.tapDamage * 0.4,
            chainId: k.chainId, source: 'shard', delay: 0.1, depth: k.depth + 1,
          });
        }
      },
    },
  },

  // ── 에픽: 빌드 방향 결정 ────────────────────────────────
  {
    id: 'fission', name: '핵분열', rarity: 'epic', archetypes: ['chain'], maxStacks: 2,
    desc: '연쇄 폭발이 작은 폭발 2개로 분열 (중첩당 +1개)',
    hooks: {
      onExplosion(api, ex, n) {
        if (ex.source !== 'chain') return; // 분열 폭발은 다시 분열하지 않음
        const count = 1 + n;
        const base = api.rng.range(0, TAU);
        for (let i = 0; i < count; i++) {
          const a = base + (TAU * i) / count;
          const d = ex.radius * 0.75;
          api.spawnExplosion({
            x: ex.x + Math.cos(a) * d, y: ex.y + Math.sin(a) * d,
            radius: ex.radius * 0.5, damage: ex.damage * 0.4,
            chainId: ex.chainId, source: 'fission', delay: 0.08, depth: ex.depth,
          });
        }
      },
    },
  },
  {
    id: 'overload', name: '과부하', rarity: 'epic', archetypes: ['lightning'], maxStacks: 3,
    desc: '처치 25회마다 번개가 적 5마리를 강타 (중첩당 주기 -3, 대상 +1)',
    hooks: {
      onKill(api, _k, n, st) {
        st.kills = (st.kills ?? 0) + 1;
        if (st.kills < 25 - 3 * (n - 1)) return;
        st.kills = 0;
        lightningStrike(api, 5 + (n - 1), api.stats.tapDamage * 1.5, 4);
      },
    },
  },
  {
    id: 'resonance', name: '연쇄 공명', rarity: 'epic', archetypes: ['chain'], maxStacks: 1,
    desc: '한 연쇄에서 10마리 잡을 때마다 판 끝까지 피해 배율 ×1.03',
    hooks: {
      onKill(api, k) {
        if (k.chainKills % 10 === 0) api.multiplyRunMult(1.03);
      },
    },
  },
  {
    id: 'mines', name: '유폭 지뢰', rarity: 'epic', archetypes: ['zone'], maxStacks: 3,
    desc: '처치 시 10% 확률로 그 자리에 지뢰 (중첩당 +10%p)',
    hooks: {
      onKill(api, k, n) {
        if (!api.rng.chance(0.1 * n)) return;
        api.addMine({ x: k.enemy.x, y: k.enemy.y, radius: 56, damage: api.stats.tapDamage, ttl: 12 });
      },
    },
  },

  // ── 프리즘: 판의 규칙·조작 변경 (보스 처치 보상에서만, 판당 1개) ──
  {
    id: 'supernova', name: '초신성', rarity: 'prism', archetypes: ['burst'], maxStacks: 1,
    desc: `과충전: 게이지가 100%를 넘어 ${BALANCE.prism.supernova.gaugeMax * 100}%까지 찬다 (넘긴 뒤엔 절반 속도). 클수록 넓고, 200%면 연쇄 3단계·250%면 4단계`,
    modifyStats: (s) => { s.gaugeMax = BALANCE.prism.supernova.gaugeMax; },
  },
  {
    id: 'infinite_chain', name: '무한 연쇄', rarity: 'prism', archetypes: ['rapid'], maxStacks: 1,
    desc: `연쇄가 이어지는 동안 탭하면 게이지를 쓰지 않고 ${BALANCE.prism.infiniteChain.freeTapPower * 100}% 크기로 터짐`,
    modifyStats: (s) => { s.freeTapDuringChain = true; },
  },

  // ── 진화 ───────────────────────────────────────────────
  {
    id: 'storm', name: '폭풍', rarity: 'epic', archetypes: ['lightning'], maxStacks: 1,
    desc: '[진화: 과부하 + 파편] 처치 15회마다 번개 7줄기, 맞은 적마다 폭발',
    evolution: { requires: ['overload', 'shrapnel'], replaces: ['overload'] },
    hooks: {
      onKill(api, _k, _n, st) {
        st.kills = (st.kills ?? 0) + 1;
        if (st.kills < 15) return;
        st.kills = 0;
        lightningStrike(api, 7, api.stats.tapDamage * 1.5, 40);
      },
    },
  },
  // TODO(기획서 진화 제안): 지뢰밭(유폭 지뢰+잔불), 블랙스타(초신성+연쇄 반경), 임계 반응(연쇄 가속+핵분열)
];

/** 고를 게 없을 때 채우는 선택지 */
export const FALLBACK_AUGMENTS: readonly AugmentDef[] = [
  {
    id: 'repair', name: '응급 수리', rarity: 'normal', archetypes: [], maxStacks: Number.POSITIVE_INFINITY,
    desc: 'LIFE 1 회복',
    fallback: true,
    onAcquire: (api) => api.heal(1),
  },
  {
    id: 'overcharge', name: '긴급 충전', rarity: 'normal', archetypes: [], maxStacks: Number.POSITIVE_INFINITY,
    desc: '게이지를 가득 채움',
    fallback: true,
    onAcquire: (api) => api.gainGauge(99),
  },
  {
    id: 'salvage', name: '부품 회수', rarity: 'normal', archetypes: [], maxStacks: Number.POSITIVE_INFINITY,
    desc: '판 종료 시 부품 +10',
    fallback: true,
    onAcquire: (api) => api.addBonusParts(10),
  },
];

const ALL = new Map<string, AugmentDef>([...AUGMENTS, ...FALLBACK_AUGMENTS, ...CHAOS_AUGMENTS].map((a) => [a.id, a]));

export function getAugment(id: string): AugmentDef {
  const a = ALL.get(id);
  if (!a) throw new Error(`알 수 없는 증강: ${id}`);
  return a;
}
