import { describe, expect, it } from 'vitest';
import { BALANCE, FIXED_DT } from '../src/data/balance';
import { OFFER5, allReacts, fuseCard, fuseId, parseFuse, reactName } from '../src/data/combineV4';
import { migrate } from '../src/meta/save';
import { GRADE_MUL } from '../src/data/fuseRules';
import { NO_META } from '../src/sim/stats';
import { World } from '../src/sim/World';

/** 게임 안 합성 (도파민 모드 레벨 업 합성 카드, 합성 시험판) */
function lab(seed = 3): World {
  return new World({ seed, mode: 'endless', chapterId: 'endless', meta: NO_META, rules: { chaos: true }, recordEvents: true, fusionLab: true });
}
const stepUntilChoosing = (w: World) => {
  for (let i = 0; i < 600 && w.phase !== 'choosing'; i++) w.step(FIXED_DT, []);
};

describe('게임 안 합성 (도파민 모드)', () => {
  it('합성 시험판: 다른 갈래 무기 여섯을 3레벨로 들고, 첫 레벨 업에 합성 카드 둘', () => {
    const w = lab();
    const ws = w.chaos!.owned().filter((id) => w.chaos!.lv(id) > 0);
    expect(ws.length).toBe(6);
    expect(new Set(ws.map((id) => w.chaos!.lv(id))).size).toBe(1);
    stepUntilChoosing(w);
    expect(w.phase).toBe('choosing');
    const fuse = w.offer!.choices.filter((id) => id.startsWith('fuse:'));
    expect(fuse.length).toBe(2);
    for (const id of fuse) expect(fuseCard(id)?.name.length).toBeGreaterThan(1);
  });

  it('합성 카드를 고르면 B 가 A 안에 들어가 v4 극적 반응으로 돌고, 판이 이어진다', () => {
    const w = lab(5);
    stepUntilChoosing(w);
    const i = w.offer!.choices.findIndex((id) => id.startsWith('fuse:'));
    const [a, b] = w.offer!.choices[i].slice(5).split('>');
    w.step(FIXED_DT, [{ t: 'choose', index: i }]);
    expect(w.chaos!.fusion.mode).toBe(4);
    expect(w.chaos!.fusion.drama).toBe(true);
    expect(w.chaos!.parent.get(b)).toBe(a);
    const ev = w.drainEvents().find((e) => e.type === 'fusion');
    expect(ev).toBeTruthy();
    for (let k = 0; k < 60 * 20 && w.phase !== 'ended'; k++) {
      if (w.phase === 'choosing') w.step(FIXED_DT, [{ t: 'choose', index: 0 }]);
      else w.step(FIXED_DT, []);
    }
    expect(w.chaos!.fusion.active).toBe(true);
  });

  it('보통 도파민 모드: 3레벨 무기 둘이 생기기 전엔 합성 카드가 없다', () => {
    const w = new World({ seed: 9, mode: 'endless', chapterId: 'endless', meta: NO_META, rules: { chaos: true }, recordEvents: false });
    expect(w.chaos!.fuseCandidates().length).toBe(0);
    expect(fuseId('a', 'b')).toBe('fuse:a>b');
  });

  it('후반 체력 상승치는 합성한 판에만 붙는다', () => {
    const C = BALANCE.chaos;
    const a = new World({ seed: 1, mode: 'endless', chapterId: 'endless', meta: NO_META, rules: { chaos: true }, recordEvents: false, sandbox: true });
    const b = lab(1);
    (a as unknown as { wave: number }).wave = 20;
    (b as unknown as { wave: number }).wave = 20;
    const ws = b.chaos!.owned().filter((id) => b.chaos!.lv(id) > 0);
    b.chaos!.fuse4(ws[0], ws[1]);
    const ea = a.spawnEnemy('normal', 100, 100, 1)!;
    const eb = b.spawnEnemy('normal', 100, 100, 1)!;
    const plain = C.enemyHpMul + C.enemyHpPerWave * 19;
    const late = plain + C.enemyHpLatePerWave * (20 - C.enemyHpLateFrom);
    expect(eb.maxHp / ea.maxHp).toBeCloseTo(late / plain, 2);
  });

  it('합성 카드 후보 (11-14): 새 짝 먼저 · 한 몸 무기 셋까지 · 사슬과 몸째는 없음 · 몸에 이미 있는 갈래는 또 안 넣음', () => {
    const w = lab(7);
    const c = w.chaos!;
    const ws = c.owned().filter((id) => c.lv(id) > 0);
    // 몸 하나를 무기 셋으로 채운다
    expect(c.fuse4(ws[0], ws[1])).toBe(true);
    expect(c.fuse4(ws[0], ws[2])).toBe(true);
    expect(c.bodySize(ws[0])).toBe(3);
    const pairs = c.fuseCandidates(500);
    expect(pairs.length).toBeGreaterThan(0);
    for (const [a, b] of pairs) {
      expect(c.parent.has(a)).toBe(false);
      expect(c.parent.has(b)).toBe(false);
      expect(c.fusion.kids.has(b)).toBe(false);
      expect(c.bodySize(a) + 1).toBeLessThanOrEqual(OFFER5.bodyMax);
      expect(a).not.toBe(ws[0]);
    }
  });

  it('합성을 고른 뒤 레벨 업 두 번은 합성 카드를 쉰다 (보통 판)', () => {
    const w = new World({ seed: 4, mode: 'endless', chapterId: 'endless', meta: NO_META, rules: { chaos: true }, recordEvents: false, sandbox: true });
    const c = w.chaos!;
    for (const id of ['arm_cannon', 'arm_dog', 'arm_tr_mines', 'arm_laser']) for (let i = 0; i < 3; i++) w.augments.acquire(id, w);
    expect(c.applyFuse(fuseId('arm_cannon', 'arm_dog'))).toBe(true);
    for (let i = 0; i < OFFER5.rest; i++) expect(c.roll('level').some((id) => id.startsWith('fuse:'))).toBe(false);
    let seen = false;
    for (let i = 0; i < 40 && !seen; i++) seen = c.roll('level').some((id) => id.startsWith('fuse:'));
    expect(seen).toBe(true);
  });

  it('판 끝: 무기별 피해 (합친 무기는 한 몸) · 이번 판 반응, 피해 숫자에 낸 무기', () => {
    const w = lab(5);
    stepUntilChoosing(w);
    const i = w.offer!.choices.findIndex((id) => id.startsWith('fuse:'));
    const [, b] = parseFuse(w.offer!.choices[i])!;
    w.step(FIXED_DT, [{ t: 'choose', index: i }]);
    let srcHits = 0;
    for (let k = 0; k < 60 * 15 && w.phase !== 'ended'; k++) {
      w.step(FIXED_DT, w.phase === 'choosing' ? [{ t: 'choose', index: 0 }] : []);
      for (const e of w.drainEvents()) if (e.type === 'hit' && e.src) srcHits++;
    }
    expect(srcHits).toBeGreaterThan(0);
    const s = w.summary();
    expect(s.weaponDamage!.length).toBeGreaterThan(0);
    expect(s.reacts).toContain(reactName(b));
    expect(allReacts()).toContain(reactName(b));
  });

  it('반응 도감은 세이브에 남고, 옛 세이브는 빈 도감으로', () => {
    expect(migrate({ parts: 3 }).reacts).toEqual([]);
    expect(migrate({ reacts: ['a', 3, 'b'] }).reacts).toEqual(['a', 'b']);
  });
});


describe('합성 문 샘플 (fuseRules.ts)', () => {
  const make = (fuseRule: 'width' | 'count' | 'bowl' | 'breath' | 'now', seed = 4) =>
    new World({ seed, mode: 'endless', chapterId: 'endless', meta: NO_META, rules: { chaos: true }, recordEvents: false, sandbox: true, fuseRule });
  const give = (w: World, id: string, lv: number) => {
    for (let i = 0; i < lv; i++) w.augments.acquire(id, w);
  };
  const fuseIn = (ids: string[]) => ids.filter((x) => x.startsWith('fuse:'));

  it('폭=칸: 갈래 4종이면 칸 1, 칸이 있으면 합성 카드가 꼭 한 장, 다 쓰면 안 뜸', () => {
    const w = make('width');
    const c = w.chaos!;
    for (const id of ['arm_cannon', 'arm_dog', 'arm_tr_mines']) give(w, id, 2);
    expect(c.gateInfo()!.free).toBe(0);
    expect(fuseIn(c.roll('level')).length).toBe(0);
    give(w, 'arm_laser', 2);
    expect(c.gateInfo()).toMatchObject({ unit: '갈래', have: 4, opened: 1, free: 1, next: 7 });
    for (let i = 0; i < 5; i++) expect(fuseIn(c.roll('level')).length).toBe(1);
    const id = fuseIn(c.roll('level'))[0];
    expect(c.applyFuse(id)).toBe(true);
    expect(c.gateInfo()!.free).toBe(0);
    for (let i = 0; i < 10; i++) expect(fuseIn(c.roll('level')).length).toBe(0);
  });

  it('폭=칸: 등급 = 몸 안 재료 중 낮은 레벨, 반응 세기 배율로', () => {
    const w = make('width');
    const c = w.chaos!;
    give(w, 'arm_cannon', 5);
    give(w, 'arm_dog', 2);
    c.fuse4('arm_cannon', 'arm_dog');
    expect(c.gradeOf('arm_cannon')).toBe(2);
    expect(c.gradeMul('arm_cannon')).toBeCloseTo(GRADE_MUL[2]);
    give(w, 'arm_dog', 2);
    expect(c.gradeOf('arm_cannon')).toBe(4);
    expect(c.gradeMul('arm_dog')).toBeCloseTo(GRADE_MUL[4]);
    // 키울수록 세진다
    expect(GRADE_MUL[5]).toBeGreaterThan(GRADE_MUL[4]);
    expect(GRADE_MUL[4]).toBeGreaterThan(GRADE_MUL[3]);
    expect(make('now').chaos!.gradeMul('arm_cannon')).toBe(1);
  });

  it('무기 수=칸 · 표와 그릇: 무기 수로 열리고, 그릇은 용량을 넘는 짝을 안 냄', () => {
    const a = make('count');
    for (const id of ['arm_cannon', 'arm_dog', 'arm_tr_mines', 'arm_laser']) give(a, id, 2);
    expect(a.chaos!.gateInfo()).toMatchObject({ unit: '무기', have: 4, free: 1, next: 8 });
    const b = make('bowl');
    const c = b.chaos!;
    give(b, 'arm_cannon', 1);
    for (const id of ['arm_dog', 'arm_tr_mines', 'arm_laser', 'arm_g_carbine']) give(b, id, 4);
    expect(c.gateInfo()).toMatchObject({ have: 5, free: 1 });
    // 대포 1레벨 → 용량 3: 4레벨 무기는 못 담음
    for (const [x, y] of c.fuseCandidates(500)) if (x === 'arm_cannon') expect(c.bodyLoad(x) + c.lv(y)).toBeLessThanOrEqual(c.bodyCap(x));
    expect(c.fuseCandidates(500).some(([x]) => x === 'arm_cannon')).toBe(false);
  });

  it('호흡: 같은 적을 이어 치면 짝이 차고, 다 차면 그 짝 카드, 넘기면 절반', () => {
    const w = make('breath');
    const c = w.chaos!;
    give(w, 'arm_tr_mines', 2);
    give(w, 'arm_dog', 2);
    const e = w.spawnEnemy('normal', 100, 200, 50)!;
    const t0 = (w as unknown as { time: number }).time;
    for (let i = 0; i < 400; i++) {
      (w as unknown as { time: number }).time = t0 + i * 0.6;
      c.noteHit(e, 'arm_tr_mines');
      (w as unknown as { time: number }).time = t0 + i * 0.6 + 0.2;
      c.noteHit(e, 'arm_dog');
    }
    expect(c.breath.get('arm_tr_mines>arm_dog')!).toBeGreaterThan(c.breathTh('arm_tr_mines'));
    const offer = c.roll('level');
    const fid = fuseIn(offer)[0];
    expect(fid).toBeTruthy();
    const before = Math.max(c.breath.get('arm_tr_mines>arm_dog') ?? 0, c.breath.get('arm_dog>arm_tr_mines') ?? 0);
    c.offerResolved(offer, offer.find((x) => !x.startsWith('fuse:'))!);
    const k = fid.slice(5);
    expect(c.breath.get(k)!).toBeLessThan(before);
  });

  it('규칙마다 판이 예외 없이 돌고 같은 씨앗이면 같은 결과', () => {
    for (const rule of ['width', 'count', 'bowl', 'breath'] as const) {
      const run = () => {
        const w = new World({ seed: 6, mode: 'endless', chapterId: 'endless', meta: NO_META, rules: { chaos: true }, recordEvents: false, fuseRule: rule });
        for (let k = 0; k < 60 * 60 && w.phase !== 'ended'; k++) w.step(FIXED_DT, w.phase === 'choosing' ? [{ t: 'choose', index: 0 }] : []);
        return [w.kills, w.wave, w.chaos!.parent.size];
      };
      expect(run()).toEqual(run());
    }
  }, 60000);
});
