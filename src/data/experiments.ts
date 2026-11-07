import type { RuleId } from '../sim/types';

/**
 * 실험 규칙 목록 (타이틀 → 실험 규칙 화면). 번호는 플레이 후 코멘트용 ("7번 좋음").
 * 규칙 동작은 sim/exp.ts, 수치는 balance.ts 의 experiment.
 */
export interface ExperimentInfo {
  id: RuleId;
  no: number;
  name: string;
  desc: string;
  /** 같이 켤 수 없는 규칙 (둘 다 "넘어온 적" 처리를 바꿈) */
  conflicts?: readonly RuleId[];
  /** 지난 묶음 (이미 한 번 해본 것) */
  old?: boolean;
  /** 판 구조나 탭 자체를 바꾸는 것 (메인 재료). 아니면 덧붙이는 기믹 */
  core?: boolean;
}

export const EXPERIMENTS: readonly ExperimentInfo[] = [
  { id: 'freeze', no: 1, name: '얼리고 깨기', desc: '100% 전에 쏘면 피해 대신 얼린다(3초 멈춤). 언 적은 피해 2.5배, 죽으면 깨지며 터진다', core: true },
  { id: 'burn', no: 2, name: '번지는 불', desc: '탭에 맞고 산 적에 불이 붙고, 붙어 있는 옆 적으로 계속 번진다' },
  { id: 'scorch', no: 3, name: '불바다', desc: '탭 자리에 불바다가 남아 지나가는 적을 태운다. 많이 모을수록 오래 탄다' },
  { id: 'knockback', no: 4, name: '밀어내기', desc: '폭발이 적을 밖으로 날려 보낸다. 무리가 흩어지고, 위로 밀면 시간을 번다' },
  { id: 'magnet', no: 5, name: '자석 폭발형', desc: '폭발형이 주변 적을 천천히 끌어모은다. 기다릴수록 뭉치지만 그만큼 내려온다' },
  { id: 'beat', no: 6, name: '박자', desc: '아래에서 박자가 뛴다. 박자에 맞춰 쏘면(떼면) 피해 2배·연쇄 +1, 엇박은 약해짐' },
  { id: 'colors', no: 7, name: '색 맞추기', desc: '적마다 색이 있고, 탭 색은 쏠 때마다 바뀐다(게이지 옆 표시). 같은 색 1.8배, 다른 색 0.55배' },
  { id: 'core', no: 8, name: '가운데 지키기', desc: '적이 위·옆에서 화면 가운데 코어로 몰려온다. 코어에 닿으면 LIFE 감소', conflicts: ['pile'], core: true },
  { id: 'launcher', no: 9, name: '발사대', desc: '탭하면 아래 발사대에서 탄이 날아가 도착해야 터진다. 앞을 보고 쏴야 한다', core: true },
  { id: 'mines', no: 10, name: '지뢰 심기', desc: '탭하면 그 자리에 지뢰가 박히고, 적이 밟으면 터진다 (최대 6개, 12초)', core: true },
  { id: 'seeds', no: 11, name: '씨앗 심기', desc: '100% 전에 탭하면 게이지 30%로 씨앗을 심는다. 폭발이 씨앗에 닿으면 씨앗도 터져 연쇄를 멀리 잇는다', core: true },
  { id: 'row', no: 12, name: '가로 베기', desc: '탭 폭발이 화면 가로 전체를 가르는 띠. 많이 모을수록 두꺼워진다', core: true },
  { id: 'bouncer', no: 13, name: '튕기는 불덩이', desc: '폭발형이 터지면 불덩이가 튀어나가 벽에 튕기다 적에 닿으면 터진다' },
  { id: 'ripen', no: 14, name: '익는 폭발형', desc: '폭발형은 오래 살아 있을수록 크게 터진다 (10초에 4배). 기다릴수록 방어선이 가깝다' },
  { id: 'sweet', no: 15, name: '명당 띠', desc: '금색 띠가 위아래로 오간다. 띠 안에서 쏘면 피해 2배·연쇄 +1' },
  { id: 'stopTime', no: 16, name: '누를 때만 시간', desc: '손을 떼면 시간이 거의 멈춘다. 누르는 동안만 흐르며 게이지가 차고, 떼면 발사', core: true },
  { id: 'inflate', no: 17, name: '풍선', desc: '맞고 산 적은 부풀고, 부푼 적은 죽을 때 터진다. 많이 부풀수록 크게' },
  { id: 'fog', no: 18, name: '안개', desc: '방어선 근처와 폭발이 난 자리만 보인다' },
  { id: 'echo', no: 19, name: '메아리', desc: '탭 폭발이 0.9초 뒤 같은 자리에서 한 번 더 터진다 (70%)' },
  { id: 'wind', no: 20, name: '바람', desc: '바람이 무리를 좌우로 민다. 방향은 8초마다 바뀐다(위쪽 화살표)' },
  { id: 'golden', no: 21, name: '황금 적', desc: '가끔 황금 적이 섞인다. 연쇄로 잡으면 즉시 레벨 업 + 게이지 가득, 탭으로 직접 잡으면 꽝' },
  { id: 'pile', no: 22, name: '쌓이는 바닥', desc: '넘어온 적은 LIFE 대신 바닥에 블록으로 쌓이고, 한계선까지 차면 끝. 100% 이상으로 블록을 터뜨리면 줄줄이 무너진다', conflicts: ['core'], old: true, core: true },
  { id: 'combo', no: 23, name: '연쇄 잇기', desc: '0.6초 안에 계속 잡으면 콤보 배율이 쌓인다 (처치당 +3%, 최대 ×3)', old: true },
  { id: 'paint', no: 24, name: '불씨 칠하기', desc: '100%에서 꾹 누른 채 끌면 손끝이 지나간 적에 불씨. 불씨 붙은 적은 죽을 때 터진다', old: true },
  { id: 'pairs', no: 25, name: '짝 폭발형', desc: '같은 색 테두리 폭발형 둘은 짝. 하나가 터지면 멀리 있는 짝도 같이 터진다', old: true },
];

/**
 * 메인 후보 묶음: 기믹 하나가 아니라 판 전체를 이루도록 몇 개를 묶은 것 (플레이 피드백:
 * "메인은 괜찮은 걸 뽑아야지, 기믹 하나를 들고 오면 별로일 것 같다").
 */
export interface ExperimentSet {
  id: string;
  name: string;
  pitch: string;
  rules: readonly RuleId[];
}

export const EXPERIMENT_SETS: readonly ExperimentSet[] = [
  { id: 'stackCut', name: '쌓고 베기', pitch: '넘어온 적은 바닥에 블록으로 쌓이고, 탭은 화면 가로를 가르는 띠. 한 줄을 통째로 베어 더미를 무너뜨린다', rules: ['pile', 'row'] },
  { id: 'planner', name: '멈춘 화면 설계', pitch: '손을 떼면 시간이 멈춘다. 멈춘 화면에서 씨앗으로 길을 깔고, 꾹 눌러 한 방에 잇는다', rules: ['stopTime', 'seeds'] },
  { id: 'siege', name: '포위 방어', pitch: '위·옆에서 코어로 몰려오는 적을 터뜨려 밀어낸다. 밀린 적끼리 뭉치면 다음 한 방 재료', rules: ['core', 'knockback'] },
  { id: 'trapper', name: '덫 사냥', pitch: '탭은 지뢰. 폭발형이 적을 끌어모으고 익을 때까지 기다렸다가 길목에서 터뜨린다', rules: ['mines', 'magnet', 'ripen'] },
  { id: 'elements', name: '얼음과 불', pitch: '덜 모아 쏘면 얼리고, 꽉 채워 쏘면 불이 붙어 번진다. 언 무리에 불을 붙이면 깨지며 터진다', rules: ['freeze', 'burn'] },
  { id: 'artillery', name: '포격', pitch: '아래 발사대에서 쏘고, 탄이 떨어진 자리에 불바다가 남는다. 앞을 보고 길목을 태운다', rules: ['launcher', 'scorch'] },
];

export function experimentInfo(id: RuleId): ExperimentInfo | undefined {
  return EXPERIMENTS.find((x) => x.id === id);
}
