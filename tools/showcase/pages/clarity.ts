import { ARMS, CATEGORY_COLOR, CATEGORY_LABEL } from '../../../src/data/chaos';
import { OFFER5, allReacts, fuseName, reactName } from '../../../src/data/combineV4';
import { BALANCE } from '../../../src/data/balance';
import { mount, type Page, type Scene } from '../runtime';

/**
 * 11-14 플레이 피드백: "합성된 게 다시 또 합성되게 자주 나온다 · 뭐가 뭔 공격을 하는지 딱 안 보인다 ·
 * 엄청 센 거 하나 만들면 또 뭘 만들어야 할지 모르겠다 · 합성이 너무 자주 뜬다".
 * 합성 카드 규칙 (combineV4.ts OFFER5), 피해 숫자 색 · 집중 보기 (chaosDraw.ts), 판 끝 무기별 피해 · 반응 도감.
 */
const N = (id: string) => ARMS[id].name;
const pair = (a: string, b: string, extra: Partial<Scene> = {}): Scene => ({
  title: fuseName(a, b),
  tag: `합성 · ${reactName(b)}`,
  weapons: [a, b],
  fuse: [[a, b]],
  fuse4: true,
  v5: true,
  level: 3,
  desc: `${N(a)} + ${N(b)}.`,
  code: `${a}>${b}`,
  ...extra,
});
const C = (id: string) => `${CATEGORY_LABEL[ARMS[id].cat]} 색 (${CATEGORY_COLOR[ARMS[id].cat]})`;

const page: Page = {
  name: '합성 정리',
  title: '합성 카드 정리 · 무슨 공격인지 보이게',
  lead: '플레이 피드백 넷을 고쳤다: 합친 무기가 또 합쳐지는 카드가 자주 뜸 · 합성 카드가 너무 자주 뜸 · 무엇이 어느 무기 공격인지 안 보임 · 센 것 하나 만들면 다음에 뭘 만들지 모름. 카드는 실제 게임 코드로 돈다.',
  notes: ['게임(플레이 빌드)에도 같이 들어가 있다: 무기 자리를 누르면 집중 보기, 판이 끝나면 무기별 피해와 반응 도감.'],
  sections: [
    {
      id: 'offer',
      title: '합성 카드',
      lead: '봇 8판 (보통 도파민 모드). 새 짝 = 아직 아무것도 안 합친 무기 둘, 몸에 더함 = 합친 무기에 하나 더, 사슬 = 다른 무기 안에 든 무기에 또, 몸째 = 합친 무기를 통째로 다른 무기 안에.',
      table: [
        ['', '전', '후'],
        ['합성 카드가 낀 레벨 업', '16%', '9%'],
        ['합성 카드 중 새 짝', '19%', '70%'],
        ['몸에 더함 / 사슬 / 몸째', '19% / 51% / 12%', '30% / 0 / 0'],
        ['한 몸에 든 무기 (판 끝)', '10~12개 하나', `2~3개 여럿 (최대 ${OFFER5.bodyMax})`],
      ],
      list: [
        `확률: 레벨 업마다 60% → ${Math.round(OFFER5.chance * 100)}%, 합성을 고른 뒤 레벨 업 ${OFFER5.rest}번은 합성 카드 쉼`,
        `새 짝이 몸에 더하는 것보다 ${OFFER5.freshWt}배 자주. 한 몸은 무기 ${OFFER5.bodyMax}개까지, 몸에 이미 있는 갈래는 또 안 넣음. 사슬·몸째는 카드로 안 나옴`,
        '카드 아래 줄: "새 합성 무기 · 무기 2/3" 또는 "몸에 더함 · 무기 3/3". 레벨 업 카드도 그 무기가 어느 합친 무기 안에 있는지 적음',
        `처음 보는 반응이면 카드 오른쪽 위에 "새 반응!". 반응 도감 (세이브에 남음): 전체 ${allReacts().length}가지, 타이틀 합성 시험판 버튼과 판 끝 화면에 본 수`,
        `판이 짧아진 만큼 합성한 판의 후반 체력 상승치 +2.4 → +${BALANCE.chaos.enemyHpLatePerWave}/웨이브 (봇 웨이브 21.7 → 25.2)`,
      ],
      scenes: [],
    },
    {
      id: 'color',
      title: '피해 숫자 색',
      lead: '피해 숫자가 낸 무기의 갈래 색이다 (흰색과 섞어 읽히게). 합친 무기는 몸의 공격과 안에 든 무기의 반응이 다른 색으로 뜬다.',
      scenes: [
        pair('arm_tr_mines', 'arm_dog', { desc: `지뢰밭(${C('arm_tr_mines')}) 이 터진 피해와, 군견(${C('arm_dog')}) 반응의 피해가 다른 색.` }),
        pair('arm_g_carbine', 'arm_cannon', { desc: `카빈(${C('arm_g_carbine')}) 총알과 대포(${C('arm_cannon')}) 반응 포탄이 다른 색.` }),
      ],
    },
    {
      id: 'focus',
      title: '무기를 누르면 집중 보기',
      lead: '무기 자리를 누르면 3초 동안 그 무기(합친 무기면 안에 든 무기까지)가 낸 것만 밝게, 나머지는 어둡게. 정보창에 합친 이름 · 안에 든 무기와 레벨 · 반응.',
      scenes: [
        {
          title: '무기 셋, 아무것도 안 누름',
          tag: '비교',
          weapons: ['arm_tr_mines', 'arm_dog', 'arm_laser'],
          fuse: [['arm_tr_mines', 'arm_dog']],
          fuse4: true,
          v5: true,
          level: 3,
          desc: '군견 지뢰밭 + 레이저 소총. 무엇이 누구 것인지 섞여 보인다.',
        },
        {
          title: '군견 지뢰밭을 누름',
          tag: '집중 보기',
          weapons: ['arm_tr_mines', 'arm_dog', 'arm_laser'],
          fuse: [['arm_tr_mines', 'arm_dog']],
          fuse4: true,
          v5: true,
          level: 3,
          select: 'arm_tr_mines',
          desc: '지뢰·군견만 밝고 레이저는 어둡다.',
        },
      ],
    },
  ],
};

mount(page);
