import { describe, expect, it } from 'vitest';
import { BALANCE, FIXED_DT } from '../src/data/balance';
import { ARMS, ARSENAL, ATTACK_CATEGORIES, FUSE_LEVEL, FUSIONS, MAX_LEVEL, WEAPON_SLOTS, WEAPONS, effective } from '../src/data/chaos';
import { defaultSave } from '../src/meta/save';
import { createRunConfig } from '../src/meta/progression';
import { Bot } from '../src/sim/bot';
import { World } from '../src/sim/World';
import { freeze, sandbox, stepFor, tap } from './helpers';

const C = BALANCE.chaos;

/** 적을 화면 가운데쯤 여러 마리 깔아 둔 도파민 모드 샌드박스. 시작 무기 고르기는 건너뛴다 (무기는 테스트가 직접 줌) */
function arena(): World {
  const w = sandbox({ rules: { chaos: true } });
  (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
  // 사거리 안 (방어선 위 200px 안쪽)에 깔아 둔다
  for (let i = 0; i < 24; i++) w.spawnEnemy('normal', 40 + (i % 8) * 40, 360 + Math.floor(i / 8) * 60);
  freeze(w);
  return w;
}

const fresh = arena;

describe('도파민 모드: 카테고리 무기고', () => {
  it('판은 시작 무기 고르기로 시작하고, 서로 다른 갈래에서 3장이 나온다', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const w = sandbox({ seed, rules: { chaos: true } });
      w.step(FIXED_DT);
      expect(w.phase).toBe('choosing');
      expect(w.offer?.kind).toBe('starter');
      const cats = w.offer!.choices.map((id) => ARMS[id].cat);
      expect(cats).toHaveLength(3);
      expect(new Set(cats).size).toBe(3);
      expect(w.offer!.choices.every((id) => ARMS[id].starter)).toBe(true);
    }
  });

  it('폭탄 탭이 없으면 탭은 폭발을 만들지 않고, 번개 손이 있으면 번개가 나간다', () => {
    const w = fresh();
    w.augments.acquire('arm_cannon', w);
    w.drainEvents();
    tap(w, 100, 420);
    expect(w.drainEvents().some((e) => e.type === 'tap')).toBe(false);
    w.augments.acquire('arm_zap', w);
    tap(w, 100, 420);
    const evs = w.drainEvents();
    expect(evs.some((e) => e.type === 'bolt')).toBe(true);
    expect(evs.some((e) => e.type === 'tap')).toBe(false);
  });

  it('무기마다 혼자서 적에게 피해를 준다 (손공격은 탭, 나머지는 저절로)', () => {
    for (const d of ARSENAL) {
      const info = ARMS[d.id];
      if (info.cat === 'passive' || info.kind === 'spell') continue;
      const w = fresh();
      w.augments.acquire(d.id, w);
      // 함정은 적이 걸어와 밟아야 터진다
      if (info.cat === 'trap') for (const e of w.enemies) e.speed = e.def.speed;
      const hurt = () => w.kills > 0 || w.enemies.some((e) => e.hp < e.maxHp);
      for (let i = 0; i < 40 && !hurt(); i++) {
        if (info.cat === 'hand') {
          w.gauge = 1;
          tap(w, 160, 420);
        }
        stepFor(w, info.cat === 'hand' ? 0.6 : 1);
      }
      expect(hurt(), d.name).toBe(true);
    }
  });

  it('무기 칸이 다 차면 새 무기는 안 나오고, 최대 레벨 무기는 다시 안 나온다', () => {
    const w = fresh();
    const weapons = ARSENAL.filter((d) => ARMS[d.id].cat !== 'passive').slice(0, WEAPON_SLOTS);
    for (const d of weapons) for (let i = 0; i < MAX_LEVEL; i++) w.augments.acquire(d.id, w);
    for (let k = 0; k < 30; k++) {
      for (const id of w.chaos!.roll('level')) {
        const info = ARMS[id];
        if (!info) continue;
        expect(info.cat === 'passive' || weapons.some((d) => d.id === id)).toBe(true);
        expect(w.augments.stacks(id)).toBeLessThan(MAX_LEVEL);
      }
    }
  });

  it('자동 무기는 사거리 밖의 적은 쏘지 않는다', () => {
    const w = sandbox({ rules: { chaos: true } });
    (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
    const far = w.spawnEnemy('normal', 180, 60)!;
    freeze(w);
    w.augments.acquire('arm_pistol', w);
    stepFor(w, 3);
    expect(far.hp).toBe(far.maxHp);
    far.y = 420;
    stepFor(w, 3);
    expect(far.dead || far.hp < far.maxHp).toBe(true);
  });

  it('무기마다 레벨 업 효과가 다르다 (산탄총은 산탄, 저격총은 관통, 병사는 마릿수, 로켓은 연발)', () => {
    expect(effective(ARMS.arm_shotgun, 2).p.count).toBe(9);
    expect(effective(ARMS.arm_shotgun, 4).p.count).toBe(12);
    expect(effective(ARMS.arm_sniper, 2).p.pierce).toBe(3);
    expect(effective(ARMS.arm_soldier, 5).p.count).toBe(4);
    expect(effective(ARMS.arm_rocket, 4).p.burst).toBe(2);
    expect(effective(ARMS.arm_minigun, 2).cd).toBeLessThan(1);
    expect(effective(ARMS.arm_pistol, 1)).toEqual({ p: ARMS.arm_pistol.p, dmg: 1, cd: 1 });
    // 강화 말고는 전부 Lv2~5 효과 네 개, 카드에 다음 레벨 효과가 보인다
    for (const wpn of WEAPONS) {
      if (wpn.cat === 'passive') continue;
      expect(wpn.up, wpn.name).toHaveLength(4);
    }
    const shotgunCard = ARSENAL.find((d) => d.id === 'arm_shotgun')!;
    expect(shotgunCard.levelDesc?.(2)).toBe('레벨 업: 산탄 +2');
  });

  it('소환수·마법은 사거리 없이 화면 어디든 간다 (총·포탑만 사거리)', () => {
    const w = sandbox({ rules: { chaos: true } });
    (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
    const far = w.spawnEnemy('normal', 180, 80)!;
    far.hp = far.maxHp = 1e6;
    freeze(w);
    w.augments.acquire('arm_meteor', w);
    w.augments.acquire('arm_cat', w);
    stepFor(w, 6);
    expect(far.hp).toBeLessThan(far.maxHp);
  });

  it('무기를 누르면 정보·사거리가 뜨고 그 탭은 공격하지 않는다, 다시 누르면 닫힌다', () => {
    const w = arena();
    w.augments.acquire('arm_pistol', w);
    w.augments.acquire('arm_zap', w);
    stepFor(w, 0.05);
    const m = w.chaos!.mountOf('arm_pistol')!;
    expect(m).toBeDefined();
    w.drainEvents();
    tap(w, m.x, m.y);
    expect(w.chaos!.selected?.id).toBe('arm_pistol');
    expect(w.drainEvents().some((e) => e.type === 'bolt' && e.kind === 'lightning')).toBe(false);
    tap(w, m.x, m.y);
    expect(w.chaos!.selected).toBeNull();
  });

  it('무기는 방어선 뒤 한 줄에 가운데부터 좌우로 놓인다 (손공격·강화는 자리 없음)', () => {
    const w = arena();
    for (const id of ['arm_pistol', 'arm_dog', 'arm_sheep', 'arm_meteor', 'arm_cannon', 'arm_zap', 'arm_power']) w.augments.acquire(id, w);
    stepFor(w, 0.05);
    const xs = ['arm_pistol', 'arm_dog', 'arm_sheep', 'arm_meteor'].map((id) => w.chaos!.mountOf(id)!.x);
    const ys = ['arm_pistol', 'arm_dog', 'arm_sheep', 'arm_meteor'].map((id) => w.chaos!.mountOf(id)!.y);
    expect(new Set(ys).size).toBe(1);
    expect(w.chaos!.mountOf('arm_cannon')!.y).toBe(ys[0]);
    expect(Math.abs(xs[0] - w.field.width / 2)).toBeLessThan(25);
    expect(xs[1]).toBeLessThan(xs[0]);
    expect(xs[2]).toBeGreaterThan(xs[0]);
    expect(w.chaos!.mountOf('arm_zap')).toBeUndefined();
    expect(w.chaos!.mountOf('arm_power')).toBeUndefined();
  });

  it('융합: 재료 둘을 FUSE_LEVEL 까지 올리면 융합 카드가 꼭 나오고, 얻으면 재료는 그대로 두고 무기가 하나 더 생긴다', () => {
    const w = arena();
    for (let i = 0; i < FUSE_LEVEL; i++) {
      w.augments.acquire('arm_cannon', w);
      if (i < FUSE_LEVEL - 1) expect(w.chaos!.fusable()).toEqual([]);
      w.augments.acquire('arm_mortar', w);
    }
    expect(w.chaos!.fusable()).toEqual(['fus_barrage']);
    for (let k = 0; k < 10; k++) expect(w.chaos!.roll('level')[0]).toBe('fus_barrage');
    w.augments.acquire('fus_barrage', w);
    const owned = w.chaos!.owned();
    expect(owned).toContain('arm_cannon');
    expect(owned).toContain('arm_mortar');
    expect(owned).toContain('fus_barrage');
    expect(w.chaos!.fusable()).toEqual([]);
    stepFor(w, 0.05);
    expect(w.chaos!.mountOf('fus_barrage')).toBeDefined();
  });

  it('융합 무기는 재료가 정해져 있고, 재료는 전부 있는 무기다', () => {
    expect(FUSIONS.length).toBeGreaterThanOrEqual(12);
    for (const f of FUSIONS) {
      expect(f.fusion).toHaveLength(2);
      for (const id of f.fusion!) expect(ARMS[id], `${f.name} 재료 ${id}`).toBeDefined();
      expect(ARSENAL.find((d) => d.id === f.id)?.rarity).toBe('prism');
    }
  });

  it('도파민 모드에선 적이 죽어도 저절로 터지지 않는다 (폭발형도)', () => {
    const w = arena();
    const bomb = w.spawnEnemy('explosive', 180, 300)!;
    freeze(w);
    w.augments.acquire('arm_pistol', w);
    w.drainEvents();
    bomb.hp = 1;
    w.hitFromExp(bomb, 5, w.newChain(1), 0);
    stepFor(w, 0.3);
    expect(bomb.dead).toBe(true);
    expect(w.drainEvents().some((e) => e.type === 'explosion' && e.source === 'chain')).toBe(false);
  });

  it('황금 쿠키를 누르면 그 탭은 쏘지 않고 버프를 받는다', () => {
    const w = arena();
    w.chaos!.startEvent('cookie');
    const cookie = w.chaos!.actors.find((a) => a.kind === 'cookie')!;
    w.drainEvents();
    w.gauge = 1;
    w.step(FIXED_DT, [{ t: 'press', x: cookie.x, y: cookie.y }, { t: 'release', x: cookie.x, y: cookie.y }]);
    const evs = w.drainEvents();
    expect(evs.some((e) => e.type === 'cookie')).toBe(true);
    expect(evs.some((e) => e.type === 'tap')).toBe(false);
  });

  it('짧은 시간에 많이 잡으면 피버, 피버 중 폭탄 탭은 두 배', () => {
    const w = arena();
    w.chaos!.heat = C.feverThreshold + 1;
    stepFor(w, 0.05);
    expect(w.chaos!.fever).toBeGreaterThan(0);
    const shot = { x: 0, y: 0, power: 1, radius: 60, damage: 10, depth: 1, delay: 0, tag: {}, cancel: false };
    w.chaos!.onFire(shot);
    expect(shot.damage).toBeCloseTo(10 * C.feverDamage);
    expect(shot.depth).toBe(2);
  });

  it('곱하기 게이트를 지난 포탄은 늘어난다', () => {
    const w = arena();
    w.augments.acquire('arm_gate', w);
    stepFor(w, 0.05);
    const g = w.chaos!.gate!;
    expect(g.mult).toBe(2);
    (w.chaos as unknown as { lob(k: string, x: number, y: number, tx: number, ty: number, s: number): void }).lob('shell', g.x, g.y + 40, g.x, g.y - 120, 400);
    stepFor(w, 0.2);
    expect(w.chaos!.actors.filter((a) => a.kind === 'shell').length).toBe(2);
  });

  it('무기 정의마다 카테고리·이모지가 있고 레벨은 5까지', () => {
    for (const d of ARSENAL) {
      expect(ARMS[d.id], d.id).toBeDefined();
      expect(d.maxStacks).toBe(MAX_LEVEL);
      expect(d.tag).toBeTruthy();
    }
  });

  it('갈래는 15개고, 갈래마다 시작 무기가 있고, 시작 3장은 그중 세 갈래에서 나온다 (11-08 확장)', () => {
    expect(ATTACK_CATEGORIES).toHaveLength(15);
    // 주문은 피해를 주지 않고, 포격은 가까운 적을 못 쳐서 혼자 못 싸운다: 시작 무기가 없다
    const support = new Set(['magic', 'turret']);
    for (const cat of ATTACK_CATEGORIES) expect(WEAPONS.some((w) => w.cat === cat && w.starter), cat).toBe(!support.has(cat));
    expect(WEAPONS.filter((w) => w.cat !== 'passive').length).toBeGreaterThanOrEqual(300);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const w = sandbox({ seed, rules: { chaos: true } });
      w.step(FIXED_DT);
      for (const id of w.offer!.choices) seen.add(ARMS[id].cat);
    }
    // 판마다 세 갈래를 뽑으니 60판이면 거의 다 한 번씩은 나온다
    expect(seen.size).toBeGreaterThanOrEqual(11);
    expect(seen.has('magic') || seen.has('turret')).toBe(false);
  });

  it('함정은 자리에서 던져져 적이 올 길에 깔리고, 밟히면 터진다', () => {
    const w = arena();
    for (const e of w.enemies) e.speed = e.def.speed;
    w.augments.acquire('arm_tr_mines', w);
    stepFor(w, 0.85);
    const traps = w.chaos!.actors.filter((a) => a.kind === 'trap');
    expect(traps.length).toBeGreaterThan(0);
    // 깔린 자리는 적보다 아래 (적이 걸어올 길)
    for (const t of traps) expect(t.y).toBeGreaterThan(Math.min(...w.enemies.map((e) => e.y)));
    stepFor(w, 0.9);
    const before = w.enemies.filter((e) => e.hp < e.maxHp || e.dead).length;
    stepFor(w, 1.5);
    expect(w.enemies.filter((e) => e.hp < e.maxHp || e.dead).length + w.kills).toBeGreaterThan(before);
  });

  it('정령(떠다니는 무기)이 여럿이면 무기마다 제 몫을 띄운다', () => {
    const w = arena();
    w.augments.acquire('arm_sl_fairy', w);
    w.augments.acquire('arm_sl_ghost', w);
    stepFor(w, 0.2);
    const drones = w.chaos!.actors.filter((a) => a.kind === 'drone');
    expect(drones.filter((a) => a.src === 'arm_sl_fairy')).toHaveLength(1);
    expect(drones.filter((a) => a.src === 'arm_sl_ghost')).toHaveLength(1);
  });

  it('갈래마다 행동이 다르다: 마법은 마법진 뒤 발동, 투척은 튕겨 여럿을 맞힘, 떼는 구름, 광선은 이어진 줄기', () => {
    const w = arena();
    w.augments.acquire('arm_m_poly', w);
    let cast = false;
    for (let i = 0; i < 360 && !cast; i++) {
      stepFor(w, 1 / 60);
      cast = w.chaos!.actors.some((a) => a.kind === 'cast');
    }
    expect(cast).toBe(true);
    stepFor(w, 1);
    expect(w.chaos!.actors.some((a) => a.kind === 'cast')).toBe(false);

    const t = arena();
    t.augments.acquire('arm_th_melon', t);
    stepFor(t, 3);
    // 약한 적은 한 방에 죽어 목록에서 빠진다: 처치 수 + 다친 적
    expect(t.kills + t.enemies.filter((e) => e.hp < e.maxHp).length).toBeGreaterThanOrEqual(2);

    const s = arena();
    s.augments.acquire('arm_sw_mosquito', s);
    stepFor(s, 1.2);
    expect(s.chaos!.actors.filter((a) => a.kind === 'swarm')).toHaveLength(1);

    const r = arena();
    r.augments.acquire('arm_r_rainbow', r);
    stepFor(r, 0.9);
    const ray = r.chaos!.actors.find((a) => a.kind === 'ray');
    expect(ray).toBeDefined();
    expect(ray!.target).not.toBeNull();
  });

  it('소환수는 방어선 여기저기서 나와 각자 다른 적을 맡는다', () => {
    const w = arena();
    w.augments.acquire('arm_su_wolf', w);
    stepFor(w, 0.9);
    const walkers = w.chaos!.actors.filter((a) => a.kind === 'walker');
    expect(walkers.length).toBe(3);
    stepFor(w, 0.1);
    const targets = new Set(walkers.map((a) => a.target?.id));
    expect(targets.size).toBe(3);
    expect(new Set(walkers.map((a) => Math.round(a.x))).size).toBe(3);
  });

  it('정령은 처치한 적의 혼을 모으고, 다 모으면 터진다', () => {
    const w = arena();
    w.augments.acquire('arm_sl_fairy', w);
    stepFor(w, 0.2);
    const fairy = w.chaos!.actors.find((a) => a.kind === 'drone')!;
    const souls = () => w.chaos!.actors.filter((a) => a.kind === 'soul').length;
    const before = souls();
    for (const e of w.enemies.slice(0, 3)) w.chaos!.onKill(e);
    expect(souls()).toBe(before + 3);
    stepFor(w, 2);
    expect(fairy.left).toBeGreaterThanOrEqual(3);
    fairy.left = 10;
    const bullets = w.chaos!.actors.filter((a) => a.kind === 'bullet').length;
    stepFor(w, 1 / 60);
    expect(fairy.left).toBe(0);
    expect(w.chaos!.actors.filter((a) => a.kind === 'bullet').length).toBeGreaterThanOrEqual(bullets + 16);
  });

  it('함정은 적이 없어도 깔리고, 밟은 적은 묶인다', () => {
    const w = sandbox({ rules: { chaos: true } });
    (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
    w.augments.acquire('arm_tr_bear', w);
    stepFor(w, 1.5);
    const traps = w.chaos!.actors.filter((a) => a.kind === 'trap');
    expect(traps.length).toBeGreaterThan(0);
    const t = traps[0];
    const e = w.spawnEnemy('armored', t.tx, t.ty - 2, 50)!;
    e.speed = 0;
    stepFor(w, 0.1);
    expect(e.held).toBeGreaterThan(0.5);
  });

  it('광선은 한 적에 오래 붙을수록 세진다', () => {
    const w = sandbox({ rules: { chaos: true } });
    (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
    const e = w.spawnEnemy('armored', 180, 420, 500)!;
    e.speed = 0;
    w.augments.acquire('arm_r_flashlight', w);
    stepFor(w, 0.5);
    const a = e.maxHp - e.hp;
    stepFor(w, 3);
    const b = e.maxHp - e.hp;
    stepFor(w, 0.5);
    const c = e.maxHp - e.hp;
    // 처음 0.5초보다 3.5초 뒤 0.5초 동안 훨씬 많이 깎는다
    expect(c - b).toBeGreaterThan(a * 2.5);
  });

  it('떼가 덮은 적은 느려지고 모든 피해를 1.5배 받는다', () => {
    const w = sandbox({ rules: { chaos: true } });
    (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
    const e = w.spawnEnemy('armored', 180, 300, 50)!;
    const before = e.hp;
    w.hitFromExp(e, 2, w.newChain(1), 0);
    const plain = before - e.hp;
    e.infest = 1;
    const mid = e.hp;
    w.hitFromExp(e, 2, w.newChain(1), 0);
    expect(mid - e.hp).toBeCloseTo(plain * BALANCE.chaos.infestDamageMul);
    const y0 = e.y;
    e.infest = 5;
    stepFor(w, 1);
    const slowMove = e.y - y0;
    e.infest = 0;
    const y1 = e.y;
    stepFor(w, 1);
    expect(slowMove).toBeLessThan((e.y - y1) * 0.7);
  });

  it('포격은 방어선 가까이 온 적은 못 치고 먼 무리를 친다', () => {
    const w = sandbox({ rules: { chaos: true } });
    (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
    w.augments.acquire('arm_cannon', w);
    stepFor(w, 0.05);
    const m = w.chaos!.mountOf('arm_cannon')!;
    const near = w.spawnEnemy('armored', m.x, m.y - 60, 50)!;
    near.speed = 0;
    stepFor(w, 2);
    expect(w.chaos!.actors.some((a) => a.kind === 'thrown')).toBe(false);
    const far = w.spawnEnemy('armored', m.x, m.y - 260, 50)!;
    far.speed = 0;
    const shells: { tx: number; ty: number }[] = [];
    for (let i = 0; i < 90; i++) {
      stepFor(w, 1 / 60);
      for (const a of w.chaos!.actors) if (a.kind === 'thrown') shells.push({ tx: a.tx, ty: a.ty });
    }
    expect(shells.length).toBeGreaterThan(0);
    for (const sh of shells) expect(Math.hypot(sh.tx - m.x, sh.ty - m.y)).toBeGreaterThanOrEqual(BALANCE.chaos.artyMinRange);
  });

  it('주문은 피해 대신 규칙을 바꾼다: 시간 정지·변이·되돌리기·분신·매혹·가속', () => {
    const make = () => {
      const w = sandbox({ rules: { chaos: true } });
      (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
      for (let i = 0; i < 8; i++) w.spawnEnemy('normal', 40 + i * 40, 420, 50);
      return w;
    };
    const castAll = (w: World, id: string) => {
      w.augments.acquire(id, w);
      stepFor(w, 0.8 + 0.75);
    };
    let w = make();
    castAll(w, 'arm_m_timestop');
    expect(w.enemies.filter((e) => e.held > 1).length).toBe(8);
    w = make();
    castAll(w, 'arm_m_poly');
    expect(w.enemies.filter((e) => e.poly > 0).length).toBe(4);
    const e = w.enemies.find((x) => x.poly > 0)!;
    const hp = e.hp;
    w.hitFromExp(e, 1, w.newChain(1), 0);
    expect(hp - e.hp).toBeCloseTo(BALANCE.chaos.polyDamageMul);
    w = make();
    castAll(w, 'arm_m_recall');
    expect(w.enemies.filter((x) => x.y < 130).length).toBe(5);
    w = make();
    w.augments.acquire('arm_pistol', w);
    castAll(w, 'arm_m_clone');
    expect((w.chaos!.cloned.get('arm_pistol') ?? 0) > w.time).toBe(true);
    w = make();
    castAll(w, 'arm_m_charm');
    const charmed = w.enemies.filter((x) => x.charm > 0);
    expect(charmed.length).toBe(3);
    // 우리 편은 맞지 않는다
    const c0 = charmed[0].hp;
    w.hitFromExp(charmed[0], 5, w.newChain(1), 0);
    expect(charmed[0].hp).toBe(c0);
    w = make();
    w.augments.acquire('arm_pistol', w);
    const cd = w.chaos!.cooldownOf('arm_pistol');
    castAll(w, 'arm_m_haste');
    expect(w.chaos!.cooldownOf('arm_pistol')).toBeCloseTo(cd * 0.6);
  });

  it('봇이 도파민 모드 엔드리스 한 판을 끝까지 돌려도 터지지 않고, 판 끝엔 무기가 여럿이다', () => {
    const w = new World({ ...createRunConfig(defaultSave(), 'endless', 5), rules: { chaos: true }, recordEvents: false });
    const bot = new Bot({ seed: 5 });
    for (let i = 0; i < 60 * 60 * 15 && w.phase !== 'ended'; i++) w.step(FIXED_DT, bot.think(w, FIXED_DT));
    expect(w.phase).toBe('ended');
    expect(w.chaos!.owned().filter((id) => ARMS[id].cat !== 'passive').length).toBeGreaterThanOrEqual(4);
  });
});
