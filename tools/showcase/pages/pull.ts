import { ARMS } from '../../../src/data/chaos';
import { BALANCE } from '../../../src/data/balance';
import { mount, type Page, type Scene } from '../runtime';

/**
 * 끌어모으기 너프 + 적끼리 가운데 충돌 (11-14 플레이 피드백:
 * "중력으로 모으는 게 너무 세다, 전체적으로 너프" · "겹치는 게 없으니 뭉치면 완전히 하나가 돼서 광역기가 사기, 몹들 중앙에 작게라도 충돌").
 * BALANCE.chaos.pullMul · pullRadiusMul · sepCore · sepPush (src/sim/World.ts separateEnemies).
 */
const C = BALANCE.chaos;
const card = (id: string, desc: string, opt: Partial<Scene> = {}): Scene => ({
  title: ARMS[id].name,
  tag: ARMS[id].desc,
  weapons: [id],
  level: 3,
  keep: 18,
  desc,
  code: id,
  ...opt,
});

const page: Page = {
  name: '끌어모으기 너프',
  title: '끌어모으기 너프 + 적끼리 충돌',
  lead: `끌어모으는 것 전부: 끄는 빠르기 ×${C.pullMul}, 소용돌이 범위 ×${C.pullRadiusMul}. 적끼리는 가운데에 작은 몸(반경의 ${Math.round(C.sepCore * 100)}%)이 있어, 모아도 한 점으로 겹치지 않고 둘레에 동그랗게 붙는다. 카드는 실제 게임 코드로 돈다.`,
  notes: [
    '실험장 (적 24마리, 8초, 무기 하나 3레벨): 한 점에 겹친 적 최대 16~23 → 0, 반경 30px 안 적 24 → 12~15, 처치 약 78%.',
    '보스·무리 대형은 안 밀린다. 블랙홀 건 구슬은 끌고 가다 사거리 끝에서 헛터지지 않게, 적에 닿으면 그 자리에서 터진다.',
  ],
  sections: [
    {
      id: 'hand',
      title: '손 (탭)',
      lead: '앞줄을 자동으로 탭한다.',
      scenes: [
        card('arm_h_gravity', '탭한 자리로 끌어모았다가 터진다. 모인 적이 동그랗게 붙는다.', { taps: true }),
        card('arm_hole', '좁게 빨아들였다가 쾅.', { taps: true }),
      ],
    },
    {
      id: 'auto',
      title: '저절로',
      scenes: [
        card('arm_magnet', '몰린 곳에 소용돌이, 모았다가 쾅.'),
        card('arm_t_blacktower', '넓게 모았다가 쾅.'),
        card('arm_f_whirlpool', '넓게 빨아들인다.'),
        card('arm_f_gravity', '자주 모은다.'),
        card('arm_blackhole', '한 점으로 빨아들였다가 대폭발 (쿨다운 24초라 한 판에 한두 번).', { seconds: 30 }),
        card('arm_orbgun', '느린 구슬이 둘레를 끌다가 적에 닿으면 터진다.'),
      ],
    },
  ],
};

mount(page);
