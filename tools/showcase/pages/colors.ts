import { ARMS } from '../../../src/data/chaos';
import { fuseName } from '../../../src/data/combineV4';
import { WEAPON_PALETTE } from '../../../src/render/weaponColors';
import { mount, type Page, type Scene, type Section } from '../runtime';

/**
 * 무기마다 고유 색 (11-28 유저: "합성이 돼도 똑같아서 어떤 건지 전혀 구분이 안 된다. 무기마다 main source 색을 하나씩, 얻을 때마다.
 * 합성되면 메인인 애가 가진 색만 유지. 그 무기에서 생성된 애들도 그 톤을 띄게 → 저건 이 무기로 생겨서 이렇게 팍팍 되는구나").
 * 같은 장면을 왼쪽 지금(갈래 색) · 오른쪽 고유 색으로 나란히. 규칙 · 난수는 같고 그리는 것만 다르다.
 */
const N = (id: string) => ARMS[id]?.name ?? id;

const pair = (base: Omit<Scene, 'title' | 'colors' | 'desc'>, title: string, descOff: string, descOn: string): Scene[] => [
  { ...base, title: `${title} · 지금`, tag: '갈래 색', desc: descOff },
  { ...base, title: `${title} · 고유 색`, tag: '무기마다 한 색', desc: descOn, colors: true },
];

// 1. 무기 열 개 난전 (같은 갈래 둘씩 섞음: 총 둘 · 광선 둘 · 포격 둘)
const ten = ['arm_smg', 'arm_shotgun', 'arm_laser', 'arm_tesla', 'arm_cannon', 'arm_mortar', 'arm_sw_mosquito', 'arm_sp_disc', 'arm_sl_ghost', 'arm_tr_mines'];
// 2. 같은 갈래 셋
const guns = ['arm_pistol', 'arm_smg', 'arm_shotgun'];
// 3. 합성
const f11: [string, string][] = [['arm_tr_mines', 'arm_sheep']];
const f21: [string, string][] = [['arm_cannon', 'arm_sw_mosquito'], ['arm_cannon', 'arm_sl_frost']];
const f22: [string, string][] = [['arm_laser', 'arm_cat'], ['arm_sp_disc', 'arm_bell'], ['arm_laser', 'arm_sp_disc']];

const sections: Section[] = [
  {
    id: 'rule',
    title: '규칙',
    list: [
      `얻은 순서대로 색 하나씩: 하늘 · 금 · 연두 · 보라 · 주황 · 자홍 · 민트 · 파랑 · 노랑연두 · 살구 · 청록 · 흰 (${WEAPON_PALETTE.length}색, 앞에서부터 서로 가장 멀리 떨어진 순서)`,
      '그 무기가 낸 것은 모두 그 색 톤: 탄 · 소환수 · 함정 둘레 빛, 연쇄 폭발 고리, 피해 숫자, 반응 이름, 받침 고리, 위쪽 무기 아이콘',
      '합성하면 메인(몸) 색만 남는다. 안에 든 무기의 반응도 메인 색 (안에 든 무기 수 = 받침 겹고리 수). 안에 든 무기의 색은 풀려서 다음에 얻는 무기가 쓴다',
      '연쇄 폭발의 파편 색은 그대로 (주황 → 분홍 → 보라 → 하양 = 연쇄 길이). 고리만 무기 색',
      '그리는 것만 바뀐다 (판 규칙 · 난수 그대로). 괜찮으면 플레이 빌드에 켠다',
    ],
    scenes: [],
  },
  {
    id: 'ten',
    title: '무기 열 개 난전',
    lead: `같은 갈래가 둘씩 있다 (기관단총 · 산탄총, 레이저 · 테슬라, 대포 · 박격포). 지금은 같은 갈래끼리 색이 같아 어느 쪽이 낸 건지 안 갈린다.`,
    scenes: pair(
      { weapons: ten, keep: 20, seconds: 24, wide: false },
      '열 개',
      `${ten.map(N).join(' · ')}. 갈래 색이라 총 둘 · 광선 둘 · 포격 둘이 같은 색.`,
      '받침 고리 색 = 그 무기. 판 위 같은 색 빛 · 고리 · 숫자는 그 무기가 낸 것.',
    ),
  },
  {
    id: 'same',
    title: '같은 갈래 셋 (총)',
    lead: '권총 · 기관단총 · 산탄총. 지금은 셋 다 총 색 하나.',
    scenes: pair({ weapons: guns, keep: 14 }, '총 셋', '셋 다 같은 노랑: 숫자만 봐선 누가 쏜 건지 모른다.', '세 색: 탄 둘레 빛과 숫자로 어느 총인지 갈린다.'),
  },
  {
    id: 'fuse',
    title: '합성: 메인 색만 남는다',
    lead: '합친 무기는 몸(메인)의 색 하나. 안에 든 무기가 낸 반응까지 같은 색이라 "이 몸이 이렇게 터뜨렸다"가 보인다. 겹고리 수 = 안에 든 무기 수.',
    scenes: [
      ...pair(
        { weapons: ['arm_tr_mines', 'arm_sheep', 'arm_smg'], fuse: f11, fuse4: true, v5: true },
        `1+1 ${fuseName('arm_tr_mines', 'arm_sheep')} + 기관단총`,
        '합친 무기는 안에 든 갈래 색(소환수), 기관단총은 총 색.',
        '합친 무기는 지뢰밭(메인) 색 하나, 기관단총은 제 색.',
      ),
      ...pair(
        { weapons: ['arm_cannon', 'arm_sw_mosquito', 'arm_sl_frost', 'arm_mortar'], fuse: f21, fuse4: true, v5: true },
        `2+1 ${fuseName('arm_cannon', 'arm_sw_mosquito')} +1 + 박격포`,
        '대포 몸에 모기 떼 · 얼음 정령. 옆 박격포도 포격이라 지금은 색이 겹친다.',
        '대포(메인) 색 하나로 모기 · 얼음 반응까지. 박격포는 다른 색.',
      ),
      ...pair(
        { weapons: ['arm_laser', 'arm_cat', 'arm_sp_disc', 'arm_bell'], fuse: f22, fuse4: true, v5: true },
        `2+2 ${fuseName('arm_laser', 'arm_cat')} +2`,
        '레이저 + 화염 술사, 원반 + 종탑을 다시 합친 넷.',
        '넷이 한 몸 = 레이저(메인) 색 하나. 안에 든 넷의 반응이 모두 같은 색.',
      ),
    ],
  },
];

const page: Page = {
  name: '무기 고유 색',
  title: '무기 고유 색: 얻을 때 한 색, 합치면 메인 색',
  lead: '왼쪽 지금(갈래 색), 오른쪽 고유 색. 같은 장면 · 같은 규칙이고 그리는 것만 다르다.',
  notes: ['괜찮으면 플레이 빌드에 켠다. 색이 너무 세거나 약하면 (빛 크기 · 진하기) 말해 주면 맞춘다.'],
  sections,
};

mount(page);
