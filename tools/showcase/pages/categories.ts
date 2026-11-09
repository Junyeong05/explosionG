// 도파민 모드 갈래 15개 연출 미리보기 (11-09: 포격·주문으로 다시 자름, 이모지 대신 벡터 그림). 빌드: npm run showcase -- categories
import { ATTACK_CATEGORIES, CATEGORY_LABEL, type ArmCategory } from '../../../src/data/chaos';
import { LINK_PIECES, allLinks } from '../../../src/data/links';
import { mount, type Scene } from '../runtime';

const CATS: Scene[] = [
  {
    title: '손공격', tag: '내가 고른 곳', taps: true,
    weapons: ['arm_zap', 'arm_flame', 'arm_h_rocks'],
    desc: '탭한 자리에서 터진다. 이 카드는 앞줄 적을 0.45초마다 자동으로 탭한다.',
  },
  {
    title: '총', tag: '가까운 앞줄을 빠르게',
    weapons: ['arm_shotgun', 'arm_minigun', 'arm_rocket'],
    desc: '방어선 뒤에서 곧게 쏜다. 한 발 한 발이 작고 빠르다. 가장 앞의 적부터 정리한다.',
  },
  {
    title: '포격', tag: '먼 뒷줄만',
    weapons: ['arm_cannon', 'arm_mortar', 'arm_t_incendiary', 'arm_pistol'],
    desc: '자리에서 150 안쪽(방어선 가까이 온 적)은 못 치고, 먼 뒷줄 무리에 포탄을 높이 떨군다. 떨어질 자리에 조준 표시가 조여 든다. 총이 앞줄, 포격이 뒷줄. 가까이 온 적은 권총이 맡게 같이 넣었다.',
  },
  {
    title: '소환수', tag: '하나씩 맡는다',
    weapons: ['arm_dog', 'arm_su_wolf', 'arm_bear'],
    desc: '방어선 여기저기에서 한 마리씩 나와, 다른 소환수가 안 맡은 적을 하나씩 맡아 붙잡고 싸운다.',
  },
  {
    title: '주문 (변이·되돌리기·매혹)', tag: '규칙을 바꾼다',
    weapons: ['arm_m_poly', 'arm_m_recall', 'arm_m_charm', 'arm_minigun'],
    desc: '피해를 주지 않는다. 변이: 앞줄 넷이 보라 덩어리가 되어 아주 느리고 받는 피해 ×2. 되돌리기: 앞줄 다섯을 화면 위로 순간이동. 매혹: 앞줄 셋이 분홍 테두리로 우리 편이 되어 거슬러 올라가며 부딪친 적을 친다. 효과가 보이게 미니건을 같이 넣었다.',
  },
  {
    title: '주문 (시간 정지·분신·가속)', tag: '규칙을 바꾼다',
    weapons: ['arm_m_timestop', 'arm_m_clone', 'arm_m_haste', 'arm_shotgun'],
    desc: '시간 정지: 적 전부 2.5초 멈춤. 분신: 내 무기 하나가 5초 동안 두 배로 쏜다(무기 자리에 겹친 빛). 가속: 4초 동안 모든 무기 쿨다운 ×0.6(화면 테두리가 빛남).',
  },
  {
    title: '함정', tag: '미리 깔고 묶는다', keep: 6,
    weapons: ['arm_tr_mines', 'arm_tr_spikes', 'arm_tr_spring'],
    desc: '적이 없어도 계속 깔아 30초 동안 쌓아 둔다. 밟으면 터지고 근처 적은 1초 묶인다. 이 카드는 적을 6마리만 둬서 쌓이는 게 보이게 했다.',
  },
  {
    title: '공중', tag: '하늘에서 떨어진다',
    weapons: ['arm_a_bomber', 'arm_meteor', 'arm_whale'],
    desc: '떨어질 자리에 그림자가 먼저 생기고 짙어진다. 넓게 흩어진 적을 친다.',
  },
  {
    title: '돌격', tag: '가로지른다',
    weapons: ['arm_c_bikers', 'arm_c_tractor', 'arm_dino'],
    desc: '화면 끝에서 끝까지 달리며 길 위의 적을 들이받는다. 한 줄을 통째로 관통한다.',
  },
  {
    title: '음파', tag: '둥글게 퍼진다',
    weapons: ['arm_s_speaker', 'arm_s_drum', 'arm_bell'],
    desc: '자기 자리에서 고리가 퍼져 가까이 온 적을 한꺼번에 밀고 멈칫하게 한다.',
  },
  {
    title: '회전체', tag: '튕겨 다닌다',
    weapons: ['arm_sp_boomerang', 'arm_sp_soccer', 'arm_saw'],
    desc: '날아다니며 벽에 튕기고 지나가는 길의 적을 썬다. 오래 남아 화면을 휘젓는다.',
  },
  {
    title: '장판', tag: '바닥에 깔린다',
    weapons: ['arm_f_lava', 'arm_f_ice', 'arm_gas'],
    desc: '몰린 곳 바닥에 깔려 그 위에 있는 동안 계속 지진다. 구역을 막는다.',
  },
  {
    title: '광선', tag: '붙어서 녹인다', hpMul: 8,
    weapons: ['arm_r_flashlight', 'arm_r_rainbow', 'arm_tesla'],
    desc: '줄기가 늘 이어져 있다. 빛은 가장 단단한 적 하나에, 번개는 여러 적에 붙고, 오래 붙을수록 세진다(최대 ×4). 이 카드는 적 체력 ×8.',
  },
  {
    title: '투척', tag: '통통 옮겨 간다',
    weapons: ['arm_th_melon', 'arm_th_molotov', 'arm_monkey'],
    desc: '던진 것이 적에 맞고 가까운 다음 적으로 세 번까지 튕긴다. 흩어진 여러 적을 차례로.',
  },
  {
    title: '떼', tag: '덮어서 약하게',
    weapons: ['arm_sw_mosquito', 'arm_sw_ants', 'arm_sw_jelly', 'arm_pistol'],
    desc: '구름이 몰린 곳을 덮는다. 덮인 적은 느려지고 모든 피해를 ×1.5 받는다(연두 점). 다른 무기를 돕는 갈래라 권총을 같이 넣었다.',
  },
  {
    title: '정령', tag: '혼을 모아 터진다',
    weapons: ['arm_sl_fairy', 'arm_sl_ghost', 'arm_sl_imp'],
    desc: '떠다니며 약하게 쏜다. 적이 죽으면 혼이 정령에게 빨려 가고, 열 개가 차면 사방으로 혼탄 열여섯 발.',
  },
];

const MIX: Scene = {
  title: '15갈래에서 하나씩', tag: '섞으면', taps: true, wide: true, keep: 34, hpMul: 6,
  weapons: [
    'arm_zap', 'arm_shotgun', 'arm_cannon', 'arm_dog', 'arm_m_poly', 'arm_tr_mines', 'arm_a_bomber', 'arm_c_bikers',
    'arm_s_drum', 'arm_sp_boomerang', 'arm_f_lava', 'arm_r_rainbow', 'arm_th_melon', 'arm_sw_mosquito', 'arm_sl_fairy',
  ],
  desc: '갈래마다 대표 무기 하나씩, 15개를 3레벨로. 적은 늘 34마리, 체력 ×6. 한 판 후반쯤 화면이 이렇게 된다.',
};

const ROWS = (ATTACK_CATEGORIES as readonly Exclude<ArmCategory, 'passive'>[]).map((c) => [CATEGORY_LABEL[c], LINK_PIECES[c].role, LINK_PIECES[c].carry, LINK_PIECES[c].payload]);
const TABLE = [['갈래', '하는 일 (기능)', '나를 때 (A)', '실릴 때 (B)'], ...ROWS];
const PREDICT = allLinks().filter((l) => l.name).slice(0, 10).map((l) => `${l.title} · ${l.name}: ${l.text}`);

mount({
  name: '도파민 모드 갈래 15개',
  title: '도파민 모드 갈래 15개',
  lead: '실제 게임 규칙(src/sim)과 그리기(src/render)를 그대로 돌린 화면이다. 카드마다 그 갈래 무기를 3레벨로 들고, 같은 적 무리(화면에 늘 14마리, 체력 ×3)를 상대한다. 빨리 보려고 적은 위쪽 절반에서 바로 나타난다 (실제 게임은 화면 위에서 걸어 내려온다). 18초마다, 또는 캔버스를 누르면 처음부터.',
  notes: [
    '11-09 다시 자름: 포탑 → 포격(먼 뒷줄만), 마법 → 주문(피해 말고 규칙을 바꾸는 것). 터지는 마법은 공중(운석우·핵·번개 폭풍)과 돌격(드래곤·기관차·토네이도)으로 갔다. 포격·주문은 혼자 싸우기 어려워 시작 무기가 없다.',
    '그림: 이모지 대신 갈래마다 같은 모양 언어의 네온 벡터 그림 (포격=포신, 소환수=화살촉, 주문=문양, 함정=육각, 공중=폭탄, 돌격=쐐기, 음파=울림통, 회전체=날, 장판=통풍구, 광선=프리즘, 투척=파편, 떼=점, 정령=빛 구슬). 무기 이름도 장난감·음식 같은 것은 바꿨다.',
    '갈래끼리 잇는 210가지 조합은 "실어 나르기 210" 페이지에 따로 있다.',
  ],
  sections: [
    { id: 'table', title: '갈래 한눈에', lead: '하는 일과 실어 나르기 두 조각.', table: TABLE, scenes: [] },
    { id: 'predict', title: '섞으면 이렇게 (대표 조합)', list: PREDICT, scenes: [] },
    { id: 'cats', title: '갈래 15개', lead: '꼬리표가 그 갈래가 하는 일.', scenes: CATS },
    { id: 'mix', title: '15갈래 섞은 판', scenes: [MIX] },
  ],
});
