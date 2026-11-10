import { mount, type Page, type Scene } from '../runtime';

/**
 * 합성 실전: 무기 12개가 한꺼번에 도는 판에서 합성이 읽히는지 (자체 평가 6번).
 * 같은 12개를 합성 없이 / 셋 합침 / 다섯 합침(겹친 것 둘) 으로 나란히. 처음 해낸 짝은 "새 합성 · 이름" 이 뜬다.
 */
const W12 = ['arm_g_carbine', 'arm_dog', 'arm_tr_mines', 'arm_a_bomber', 'arm_f_lava', 'arm_s_guitar', 'arm_sw_mosquito', 'arm_sp_disc', 'arm_laser', 'arm_th_volley', 'arm_cannon', 'arm_sl_fairy'];
const base = { weapons: W12, seconds: 30, keep: 32, hpMul: 7, wide: true } as const;

const scenes: Scene[] = [
  { ...base, title: '무기 12개, 합성 없음', tag: '비교 기준', desc: '갈래 열둘이 따로 싸운다. 아래 두 판과 같은 무기·같은 레벨.', code: 'none' },
  {
    ...base,
    title: '같은 12개, 셋을 합침',
    tag: '합성 3',
    fuse: [['arm_g_carbine', 'arm_dog'], ['arm_tr_mines', 'arm_g_carbine'], ['arm_a_bomber', 'arm_f_lava'], ['arm_s_guitar', 'arm_sw_mosquito']],
    desc: '함정 + (총 + 소환수): 산탄 지뢰의 총탄이 전향탄. 공중 + 장판: 그림자 장판. 음파 + 떼: 떼 고리. 자리에 합친 갈래 색 고리가 겹쳐 보인다.',
    code: 'trap>(gun>summon), air>field, sound>swarm',
  },
  {
    ...base,
    title: '같은 12개, 다섯을 합침',
    tag: '합성 5 · 겹친 둘',
    fuse: [['arm_g_carbine', 'arm_dog'], ['arm_tr_mines', 'arm_g_carbine'], ['arm_a_bomber', 'arm_f_lava'], ['arm_s_guitar', 'arm_sw_mosquito'], ['arm_laser', 'arm_sl_fairy'], ['arm_th_volley', 'arm_sp_disc'], ['arm_cannon', 'arm_th_volley']],
    desc: '위 셋에 광선 + 정령(혼 증폭), 포격 + (투척 + 회전체): 도약탄이 튕기고 끝에서 부메랑. 무기 자리가 열둘에서 다섯 개 줄었다.',
    code: '+ ray>spirit, turret>(throw>spinner)',
  },
];

const page: Page = {
  name: '합성 실전',
  title: '합성 실전: 무기 열둘이 한꺼번에',
  lead: '합성 v2 를 실제 판처럼 무기가 많은 화면에서 본다. 같은 무기 열둘을 합성 없이, 셋 합쳐서, 다섯 합쳐서. 처음 해낸 짝은 화면 위에 "새 합성 · 이름" 이 뜬다 (규칙 문장은 안 보여 줌).',
  notes: ['적은 32마리 유지, 체력 ×7, 30초마다 처음부터. 카드를 누르면 처음부터.'],
  sections: [{ id: 'live', title: '세 판', scenes }],
};

mount(page);
