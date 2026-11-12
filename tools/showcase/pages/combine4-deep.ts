import type { InputPattern } from '../../../src/data/combineV2';

/** v4 샘플: 2+2 와 깊은 조합 (미리보기 combine4 와 측정 tools/carry/v4samples.ts 가 같이 쓴다) */
export interface Deep4 {
  title: string;
  tag: string;
  weapons: string[];
  fuse: [string, string][];
  desc: string;
  code: string;
  input?: InputPattern;
}

export const DEEP4: Deep4[] = [
  {
    title: '(함정 + 돌격) + (소환수 + 포격)',
    tag: '2+2',
    weapons: ['arm_tr_mines', 'arm_c_bikers', 'arm_dog', 'arm_cannon'],
    fuse: [['arm_dog', 'arm_cannon'], ['arm_tr_mines', 'arm_c_bikers'], ['arm_tr_mines', 'arm_dog']],
    desc: '덫이 밟은 적을 묶으면 돌격이 가장 많이 늘어선 줄을 꿰뚫고, 짐승은 묶인 적을 돌려세운다. 그 짐승이 문 적(묶임) 위로 포탄이 예고 없이.',
    code: 'trap>[charge, summon>turret]',
  },
  {
    title: '(총 + 주문) + (떼 + 정령)',
    tag: '2+2',
    weapons: ['arm_g_carbine', 'arm_m_timestop', 'arm_sw_mosquito', 'arm_sl_fairy'],
    fuse: [['arm_sw_mosquito', 'arm_sl_fairy'], ['arm_g_carbine', 'arm_m_timestop'], ['arm_g_carbine', 'arm_sw_mosquito']],
    desc: '총탄이 맞힌 자리 근처 무리에 주문이 모였다가 걸리고, 벌레 떼가 무리를 덮는다. 떼가 약하게 만든 적(약점)을 혼불이 거둔다.',
    code: 'gun>[magic, swarm>spirit]',
  },
  {
    title: '(음파 + 장판) + (광선 + 회전체)',
    tag: '2+2',
    weapons: ['arm_s_guitar', 'arm_f_lava', 'arm_laser', 'arm_sp_disc'],
    fuse: [['arm_laser', 'arm_sp_disc'], ['arm_s_guitar', 'arm_f_lava'], ['arm_s_guitar', 'arm_laser']],
    desc: '음파가 울리면 고리를 따라 장판이 깔리고, 멈칫한 적(묶임)에 광선이 이어진다. 광선이 이어진 줄을 따라 톱니가 놓인다.',
    code: 'sound>[field, ray>spinner]',
  },
  {
    title: '(손 + 총) + (함정 + 포격)',
    tag: '2+2 · 손',
    weapons: ['arm_zap', 'arm_g_carbine', 'arm_tr_mines', 'arm_cannon'],
    fuse: [['arm_tr_mines', 'arm_cannon'], ['arm_zap', 'arm_g_carbine'], ['arm_zap', 'arm_tr_mines']],
    input: 'tap',
    desc: '탭한 적에 표식이 붙고 총구가 표식 적을 노린다. 덫이 탭한 자리 근처 묶인 적 발밑에 박히고, 그 덫이 묶은 적 위로 포탄이 바로.',
    code: 'hand>[gun, trap>turret]',
  },
  {
    title: '함정 + (소환수 + (포격 + 장판))',
    tag: '깊이 3',
    weapons: ['arm_tr_mines', 'arm_dog', 'arm_cannon', 'arm_f_lava'],
    fuse: [['arm_cannon', 'arm_f_lava'], ['arm_dog', 'arm_cannon'], ['arm_tr_mines', 'arm_dog']],
    desc: '덫이 묶은 적을 짐승이 돌려세우고, 짐승이 문 적 위로 포탄이 바로 떨어지고, 포탄이 떨어진 자리 근처 묶인 적 밑에 장판이 깔린다.',
    code: 'trap>summon>turret>field',
  },
  {
    title: '(정령 + 투척) + (공중 + 떼)',
    tag: '2+2',
    weapons: ['arm_sl_fairy', 'arm_th_volley', 'arm_a_bomber', 'arm_sw_mosquito'],
    fuse: [['arm_a_bomber', 'arm_sw_mosquito'], ['arm_sl_fairy', 'arm_th_volley'], ['arm_sl_fairy', 'arm_a_bomber']],
    desc: '혼탄이 표식을 남기면 도약탄이 표식 적 사이를 튕기고, 공습이 근처 묶인 적에 떨어진다. 떨어진 자리 무리를 벌레 떼가 덮는다.',
    code: 'spirit>[throw, air>swarm]',
  },
];
