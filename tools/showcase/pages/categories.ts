// 도파민 모드 갈래 15개 연출 미리보기 (11-09). 빌드: node tools/showcase/build.mjs categories
import { mount, type Scene } from '../runtime';

const CATS: Scene[] = [
  {
    title: '👆 손공격', tag: '탭한 자리에', taps: true,
    weapons: ['arm_zap', 'arm_flame', 'arm_h_rocks'],
    desc: '탭한 자리에서 터진다. 번개 손은 근처 셋에 번개, 화염 손은 불바다, 바위 손은 바위 넷. 이 카드는 앞줄 적을 0.45초마다 자동으로 탭한다.',
  },
  {
    title: '🔫 총', tag: '탄을 쏜다',
    weapons: ['arm_shotgun', 'arm_minigun', 'arm_rocket'],
    desc: '벽에 붙어 사거리 안의 적을 쏜다. 산탄총은 가까이서 부채꼴, 미니건은 쉬지 않고, 로켓은 쫓아가서 크게 터진다.',
  },
  {
    title: '🏰 포탑', tag: '자리에서 포탄·전기',
    weapons: ['arm_cannon', 'arm_mortar', 'arm_tesla'],
    desc: '아래 칸에 서서 쏜다. 대포·박격포는 몰린 곳에 포탄, 테슬라 코일은 셋을 지진다.',
  },
  {
    title: '🐕 소환수', tag: '걸어가서 싸운다',
    weapons: ['arm_dog', 'arm_sheep', 'arm_su_wolf'],
    desc: '방어선에서 걸어 나가 싸운다. 강아지는 여섯 번 물고 돌아오고, 양은 박치기하고 터지고, 늑대는 셋이 몰려가 문다.',
  },
  {
    title: '☄️ 마법', tag: '화면 전체에 한 방',
    weapons: ['arm_meteor', 'arm_tornado', 'arm_storm'],
    desc: '쿨다운마다 화면 전체에 큰 판 하나. 운석우, 빨아들였다 터지는 토네이도, 4초 동안 벼락. 쿨다운이 길어서 한 판(18초)에 한두 번씩.',
  },
  {
    title: '🪤 함정', tag: '깔아 둔다',
    weapons: ['arm_tr_mines', 'arm_tr_bear', 'arm_tr_spring'],
    desc: '적이 올 바로 앞 발밑에 깔아 두고, 밟히면 터진다. 덫은 붙잡아 멈추고, 스프링 판은 날려 보낸다.',
  },
  {
    title: '🛫 공중', tag: '떨어뜨린다',
    weapons: ['arm_a_bomber', 'arm_a_piano', 'arm_a_thundercloud'],
    desc: '하늘에서 떨어뜨린다. 폭격기는 폭탄 여덟 개, 피아노는 몰린 곳에 한 방, 뇌운은 벼락 셋.',
  },
  {
    title: '🏍️ 돌격', tag: '가로지른다',
    weapons: ['arm_c_bikers', 'arm_c_tractor', 'arm_c_dozer'],
    desc: '탈것이 화면을 가로지르며 들이받는다. 폭주족은 옆으로 셋, 트랙터는 아래에서 위로 천천히, 불도저는 화면 전체를 밀어 올린다.',
  },
  {
    title: '🔊 음파', tag: '둥글게 퍼진다',
    weapons: ['arm_s_speaker', 'arm_s_drum', 'arm_s_howl'],
    desc: '자기 자리에서 둥글게 퍼진다. 스피커는 밀어내고, 북은 멈칫하게, 마이크 하울링은 불을 붙인다. 가까이 와야 맞는다.',
  },
  {
    title: '🪃 회전체', tag: '튕겨 다닌다',
    weapons: ['arm_sp_boomerang', 'arm_sp_soccer', 'arm_sp_firewheel'],
    desc: '날아다니며 벽에 튕기고 지나가는 적을 썬다. 오래 남아서 화면을 휘젓는다. 불바퀴는 태운다.',
  },
  {
    title: '🟧 장판', tag: '바닥에 깔린다',
    weapons: ['arm_f_lava', 'arm_f_ice', 'arm_f_quicksand'],
    desc: '몰린 곳 바닥에 깔린다. 용암 웅덩이는 지지고, 빙판은 얼리고, 모래늪은 빨아들였다 터진다.',
  },
  {
    title: '🔦 광선', tag: '한 줄로 꿴다',
    weapons: ['arm_r_flashlight', 'arm_r_freeze', 'arm_r_rainbow'],
    desc: '자리에서 한 줄로 꿴다. 손전등은 둘, 무지개 광선은 넷을 꿰고, 냉동 광선은 꿰며 얼린다.',
  },
  {
    title: '🍉 투척', tag: '던진다',
    weapons: ['arm_th_melon', 'arm_th_molotov', 'arm_th_snowball'],
    desc: '자리에서 포물선으로 던져 떨어진 자리에서 터진다. 수박은 크게, 화염병은 불, 눈덩이는 얼린다. (지금은 포탑 포탄과 행동이 같다: 재배치안에서 "튀어 구른다"를 붙일 곳)',
  },
  {
    title: '🦟 떼', tag: '쫓아가는 작은 것들',
    weapons: ['arm_sw_mosquito', 'arm_sw_ants', 'arm_sw_jelly'],
    desc: '작은 것들이 떼로 날아가거나 기어가서 쫓는다. 모기는 셋씩 쫓아 물고, 개미는 여덟 마리가 기어가고, 해파리는 옮겨 가며 지진다.',
  },
  {
    title: '🧚 정령', tag: '떠다니며 쏜다',
    weapons: ['arm_sl_fairy', 'arm_sl_ghost', 'arm_sl_imp'],
    desc: '방어선 위를 떠다니며 쏜다. 요정은 빛, 유령은 꿰뚫는 혼, 꼬마 악마는 불씨.',
  },
];

const MIX: Scene = {
  title: '🌈 15갈래에서 하나씩', tag: '섞으면', taps: true, wide: true, keep: 34, hpMul: 6,
  weapons: [
    'arm_zap', 'arm_shotgun', 'arm_cannon', 'arm_dog', 'arm_meteor', 'arm_tr_mines', 'arm_a_bomber', 'arm_c_bikers',
    'arm_s_drum', 'arm_sp_boomerang', 'arm_f_lava', 'arm_r_rainbow', 'arm_th_melon', 'arm_sw_mosquito', 'arm_sl_fairy',
  ],
  desc: '갈래마다 대표 무기 하나씩, 15개를 3레벨로. 적은 늘 34마리, 체력 ×6. 한 판 후반쯤 화면이 이렇게 된다.',
};

mount({
  title: '도파민 모드 갈래 15개 연출 — 실제 게임 화면',
  lead: '실제 게임 규칙(src/sim)과 그리기(src/render)를 그대로 돌린 화면이다. 카드마다 그 갈래 무기 셋을 3레벨로 들고, 같은 적 무리(화면에 늘 14마리, 체력 ×3, 일반·장갑·돌격형)를 상대한다. 빨리 보려고 적은 위쪽 절반에서 바로 나타난다 (실제 게임은 화면 위에서 걸어 내려온다). 18초마다, 또는 캔버스를 누르면 처음부터.',
  notes: [
    '11-09 기준, 갈래 재배치 전. 포탑·소환수·마법에는 아직 다른 갈래와 행동이 같은 무기가 섞여 있다 (예: 소환수의 공룡은 돌격과 같은 행동).',
    '실어 나르기(갈래끼리 잇는 연결)는 아직 구현 전이라 이 화면에 없다. 구현하면 같은 형식으로 연결별 카드를 만든다.',
  ],
  sections: [
    { id: 'cats', title: '갈래 15개', lead: '갈래마다 "어떻게 때리나"가 다르다. 꼬리표가 그 갈래의 동사.', scenes: CATS },
    { id: 'mix', title: '섞으면', scenes: [MIX] },
  ],
});
