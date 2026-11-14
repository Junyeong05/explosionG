import { ARCHETYPE_LABEL, RARITY_LABEL, getAugment } from '../data/augments';
import { allReacts, fuseCard } from '../data/combineV4';
import { CHAPTERS, getChapter, newEnemiesIn } from '../data/chapters';
import { ENEMIES } from '../data/enemies';
import { EXPERIMENTS, EXPERIMENT_SETS, experimentInfo } from '../data/experiments';
import { UPGRADES, type UpgradeId } from '../data/upgrades';
import { canBuy, isChapterUnlocked, upgradeCost, upgradeLevel } from '../meta/progression';
import type { SaveData } from '../meta/save';
import type { Offer, RuleId, RunSummary } from '../sim/types';
import { h } from './dom';

/**
 * 화면 = 데이터 + 콜백을 받아 DOM 을 돌려주는 함수. 상태는 App 이 가진다.
 * 기획서 "화면 흐름" 탭이 정해지면 여기에 화면을 추가한다 (상점, 기폭 장치, 시즌 패스 ...).
 */

const OFFER_TITLE: Record<Offer['kind'], string> = {
  level: '레벨 업',
  boss: '보스 처치 보상',
  start: '선행 증강',
  starter: '시작 무기 고르기',
};

const RESULT_TITLE = {
  victory: '방어 성공',
  defeat: '방어선 붕괴',
  quit: '작전 중단',
} as const;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 켜 둔 실험 규칙 (번호 순). 과충전은 기본 규칙, 벼랑 끝은 탈락이라 목록에 없음 */
export function activeExperiments(rules: Partial<Record<RuleId, boolean>>): string[] {
  return EXPERIMENTS.filter((x) => rules[x.id]).map((x) => `${x.no}. ${x.name}`);
}

export interface TitleProps {
  save: SaveData;
  onExperiments(): void;
  /** 도파민 모드로 고른 챕터 바로 시작 */
  onDopamine(): void;
  /** 합성 시험판: 무기 여섯을 3레벨로 들고 시작, 레벨 업마다 합성 카드 둘 */
  onFusionLab(): void;
  today: string;
  /** 고른 챕터 id */
  chapterId: string;
  onSelectChapter(id: string): void;
  onChapter(): void;
  onEndless(): void;
  onDaily(): void;
  onUpgrades(): void;
  onToggleSound(): void;
  onToggleHaptics(): void;
  onExport(): void;
}

/** 챕터 시작 버튼 아래 한 줄: 웨이브 수 + 이 챕터에서 처음 나오는 적 */
function chapterLine(id: string): string {
  const ch = getChapter(id);
  const fresh = newEnemiesIn(id).map((k) => ENEMIES[k].name);
  return `${ch.waves}웨이브 + 최종 보스 · ${CHAPTERS[0].id === id ? '적' : '새 적'} ${fresh.join('·')}`;
}

export function titleScreen(p: TitleProps): HTMLElement {
  const r = p.save.records;
  const selected = getChapter(p.chapterId);
  return h('div', { class: 'overlay clear' },
    h('div', { class: 'panel' },
      h('h1', { class: 'title', text: '연쇄 폭발' }),
      h('div', { class: 'subtitle', text: 'CHAIN  DETONATION' }),
      h('div', { class: 'records' },
        h('span', null, '부품 ', h('b', { class: 'parts', text: String(p.save.parts) })),
        h('span', null, '최고 웨이브 ', h('b', { text: String(r.bestWave) })),
        h('span', null, '최고 연쇄 ', h('b', { text: String(r.bestChain) })),
      ),
      h('div', { class: 'chapters' },
        ...CHAPTERS.map((c, i) => {
          const open = isChapterUnlocked(p.save, c.id);
          const cleared = (r.chapterClears[c.id] ?? 0) > 0;
          return h('button', {
            class: `chip${c.id === p.chapterId ? ' on' : ''}${cleared ? ' cleared' : ''}`,
            disabled: !open,
            ariaLabel: open ? `${c.name}${cleared ? ' (클리어)' : ''}` : `${c.name}: ${CHAPTERS[i - 1]?.name ?? ''} 클리어 시 열림`,
            onClick: () => p.onSelectChapter(c.id),
            text: `챕터 ${i + 1}`,
          });
        }),
      ),
      h('button', { class: 'btn primary', onClick: p.onChapter }, selected.name, h('small', { text: chapterLine(selected.id) })),
      h('button', { class: 'btn dopamine', onClick: p.onDopamine }, '🔥 도파민 모드', h('small', { text: '엔드리스 · 무기 하나로 시작해서 끝없이 늘려 간다 · 3레벨 무기 둘이면 합성 카드' })),
      h('button', { class: 'btn dopamine fuse-lab', onClick: p.onFusionLab }, '🧪 합성 시험판', h('small', { text: `다른 갈래 무기 여섯을 3레벨로 들고 시작 · 레벨 업마다 합성 카드 둘 · 반응 도감 ${p.save.reacts.length}/${allReacts().length}` })),
      (() => {
        const on = activeExperiments(p.save.settings.rules);
        return h('button', { class: `btn exp-btn${on.length ? ' on' : ''}`, onClick: p.onExperiments },
          `실험실 · ${EXPERIMENTS.length}개`, h('small', { text: on.length ? on.join(' · ') : '꺼짐 · 골라서 켜기' }));
      })(),
      h('button', { class: 'btn', onClick: p.onEndless }, '엔드리스', h('small', { text: '끝없이' })),
      h('button', { class: 'btn', onClick: p.onDaily }, '일일 도전', h('small', { text: `${p.today} · 영구 강화 미적용` })),
      h('button', { class: 'btn', onClick: p.onUpgrades }, '영구 강화', h('small', { class: 'parts', text: `부품 ${p.save.parts}` })),
      h('div', { class: 'toggles' },
        h('button', { class: `chip${p.save.settings.sound ? ' on' : ''}`, onClick: p.onToggleSound, text: `사운드 ${p.save.settings.sound ? 'ON' : 'OFF'}` }),
        h('button', { class: `chip${p.save.settings.haptics ? ' on' : ''}`, onClick: p.onToggleHaptics, text: `진동 ${p.save.settings.haptics ? 'ON' : 'OFF'}` }),
      ),
      h('div', { class: 'foot' },
        h('button', { class: 'link', onClick: p.onExport, text: `플레이 기록 내보내기 (${p.save.history.length}판)` }),
        h('span', { class: 'ver', text: `proto v3 · ${__BUILD_ID__}` }),
      ),
    ),
  );
}

export interface ExperimentsProps {
  rules: Partial<Record<RuleId, boolean>>;
  chapterName: string;
  /** 판 중에 열었나 (돌아가기 = 이어서 하기, ▶ = 이 판을 버리고 새로 시작) */
  inRun: boolean;
  onToggle(id: RuleId): void;
  /** 이것들만 켜고 바로 시작 */
  onTry(ids: readonly RuleId[]): void;
  onClear(): void;
  onBack(): void;
}

export function experimentsScreen(p: ExperimentsProps): HTMLElement {
  const no = (id: RuleId) => experimentInfo(id)?.no ?? 0;
  const row = (x: (typeof EXPERIMENTS)[number]) => {
    const on = !!p.rules[x.id];
    return h('div', { class: `exp${on ? ' on' : ''}` },
      h('button', { class: 'exp-main', onClick: () => p.onToggle(x.id) },
        h('div', { class: 'exp-name' },
          h('span', { class: 'exp-no', text: String(x.no).padStart(2, '0') }), x.name,
          x.old ? h('span', { class: 'exp-old', text: '지난' }) : null,
          on ? h('span', { class: 'exp-on', text: 'ON' }) : null),
        h('div', { class: 'exp-desc', text: x.desc }),
      ),
      h('button', { class: 'exp-try', onClick: () => p.onTry([x.id]), ariaLabel: `${x.name}만 켜고 시작`, text: '▶' }),
    );
  };
  const same = (ids: readonly RuleId[]) => EXPERIMENTS.every((x) => !!p.rules[x.id] === ids.includes(x.id));
  const setRow = (set: (typeof EXPERIMENT_SETS)[number]) =>
    h('div', { class: `exp set${same(set.rules) ? ' on' : ''}` },
      h('div', { class: 'exp-main' },
        h('div', { class: 'exp-name' }, set.name, h('span', { class: 'exp-no', text: set.rules.map((r) => no(r)).join(' + ') })),
        h('div', { class: 'exp-desc', text: set.pitch }),
      ),
      h('button', { class: 'exp-try', onClick: () => p.onTry(set.rules), ariaLabel: `${set.name} 시작`, text: '▶' }),
    );
  return h('div', { class: 'overlay top' },
    h('div', { class: 'panel' },
      h('h2', { class: 'heading', text: '실험실' }),
      h('div', { class: 'rule-desc', text: `▶ = 그것만 켜고 ${p.chapterName} 바로 시작${p.inRun ? ' (지금 판은 버림)' : ''}. 이름을 누르면 켜고 끄기` }),
      h('div', { class: 'exp-list' },
        h('div', { class: 'rules-label exp-sep', text: '메인 후보 묶음' }),
        ...EXPERIMENT_SETS.map(setRow),
        h('div', { class: 'rules-label exp-sep', text: '메인 재료 · 판이나 탭을 바꾸는 것' }),
        ...EXPERIMENTS.filter((x) => x.core).map(row),
        h('div', { class: 'rules-label exp-sep', text: '곁들이 기믹' }),
        ...EXPERIMENTS.filter((x) => !x.core).map(row),
      ),
      h('div', { class: 'row exp-foot' },
        h('button', { class: 'btn', onClick: p.onClear, text: '모두 끄기' }),
        h('button', { class: 'btn primary', onClick: p.onBack, text: p.inRun ? '이어서 하기' : '돌아가기' }),
      ),
    ),
  );
}

/** 켜면 같이 못 켜는 규칙을 끈다 */
export function toggleExperiment(rules: Record<RuleId, boolean>, id: RuleId): void {
  rules[id] = !rules[id];
  if (rules[id]) for (const c of experimentInfo(id)?.conflicts ?? []) rules[c] = false;
}

export interface UpgradeProps {
  save: SaveData;
  onBuy(id: UpgradeId): void;
  onBack(): void;
}

export function upgradeScreen(p: UpgradeProps): HTMLElement {
  return h('div', { class: 'overlay' },
    h('div', { class: 'panel' },
      h('h2', { class: 'heading', text: '영구 강화' }),
      h('div', { class: 'center parts', text: `부품 ${p.save.parts}` }),
      ...UPGRADES.map((u) => {
        const lvl = upgradeLevel(p.save, u.id);
        const cost = upgradeCost(p.save, u.id);
        return h('div', { class: 'upgrade' },
          h('div', null,
            h('div', { class: 'name' }, u.name, h('span', { class: 'lvl', text: ` Lv ${lvl}/${u.maxLevel}` })),
            h('div', { class: 'desc', text: u.desc }),
          ),
          h('button', {
            class: 'btn buy',
            disabled: !canBuy(p.save, u.id),
            onClick: () => p.onBuy(u.id),
            text: cost === null ? 'MAX' : `▲ ${cost}`,
          }),
        );
      }),
      h('button', { class: 'btn', onClick: p.onBack, text: '돌아가기' }),
    ),
  );
}

export interface PickerProps {
  offer: Offer;
  stacks: (id: string) => number;
  rerollsLeft: number;
  /** 카드 아래 한 줄 (도파민 모드: 새 합성 무기 / 몸에 더함 / 합친 무기 안) */
  note?: (id: string) => string | null;
  /** 합성 카드가 처음 보는 반응인가 (반응 도감) */
  newReact?: (id: string) => boolean;
  onPick(index: number): void;
  onReroll(): void;
}

export function augmentPicker(p: PickerProps): HTMLElement {
  let locked = false;
  const pick = (i: number) => {
    if (locked) return;
    locked = true;
    p.onPick(i);
  };
  return h('div', { class: 'overlay' },
    h('div', { class: 'panel' },
      h('h2', { class: 'heading', text: OFFER_TITLE[p.offer.kind] }),
      h('div', { class: 'cards' },
        ...p.offer.choices.map((id, i) => {
          // 갈래 합성 카드: B 를 A 안에 (극적 반응)
          const fc = fuseCard(id);
          if (fc) {
            const fresh = p.newReact?.(id) ?? false;
            const note = p.note?.(id);
            return h('button', { class: 'card fuse', dataset: { rarity: 'fuse' }, onClick: () => pick(i) },
              h('div', { class: 'meta' }, h('span', { text: fc.tag }), h('span', { class: fresh ? 'new-react' : '', text: fresh ? '새 반응!' : '합성' })),
              h('div', { class: 'name', text: fc.name }),
              h('div', { class: 'fuse-sub', text: note ? `${fc.sub} · ${note}` : fc.sub }),
              h('div', { class: 'desc', text: fc.desc }),
            );
          }
          const def = getAugment(id);
          const n = p.stacks(id);
          const tags = def.tag ?? def.archetypes.map((a) => ARCHETYPE_LABEL[a]).join(' · ');
          const level = def.fallback ? '' : n === 0 ? 'NEW' : `Lv ${n} → ${n + 1}`;
          return h('button', { class: 'card', dataset: { rarity: def.rarity }, onClick: () => pick(i) },
            h('div', { class: 'meta' },
              h('span', { text: def.tag ? def.tag : `${def.evolution ? '진화 · ' : ''}${RARITY_LABEL[def.rarity]}${tags ? ` · ${tags}` : ''}` }),
              h('span', { text: level }),
            ),
            h('div', { class: 'name', text: def.name }),
            p.note?.(id) ? h('div', { class: 'fuse-sub', text: p.note(id)! }) : null,
            h('div', { class: 'desc', text: n > 0 && def.levelDesc ? def.levelDesc(n + 1) : def.desc }),
          );
        }),
      ),
      h('button', {
        class: 'btn reroll',
        disabled: p.rerollsLeft <= 0,
        onClick: () => !locked && p.onReroll(),
      }, '리롤', h('small', { text: p.rerollsLeft > 0 ? `${p.rerollsLeft}회 남음` : '영구 강화로 획득' })),
    ),
  );
}

export interface PauseProps {
  onResume(): void;
  onLab(): void;
  onQuit(): void;
}

export function pauseScreen(p: PauseProps): HTMLElement {
  return h('div', { class: 'overlay' },
    h('div', { class: 'panel' },
      h('h2', { class: 'heading', text: '일시정지' }),
      h('button', { class: 'btn primary', onClick: p.onResume, text: '계속' }),
      h('button', { class: 'btn', onClick: p.onLab }, '실험실', h('small', { text: '다른 실험으로 바로 바꾸기' })),
      h('button', { class: 'btn', onClick: p.onQuit }, '포기', h('small', { text: '지금까지 보상은 받음' })),
    ),
  );
}

export interface ResultProps {
  summary: RunSummary;
  totalParts: number;
  /** 이번 판으로 새로 열린 챕터 이름 */
  unlocked?: string;
  /** 반응 도감 (도파민 모드에서 합성했을 때): 이번 판 처음 본 반응 · 본 수 · 전체 */
  reacts?: { fresh: string[]; seen: number; total: number };
  onRetry(): void;
  onLab(): void;
  onTitle(): void;
}

export function resultScreen(p: ResultProps): HTMLElement {
  const s = p.summary;
  const stat = (k: string, v: string) => [h('dt', { text: k }), h('dd', { text: v })];
  return h('div', { class: 'overlay' },
    h('div', { class: 'panel' },
      h('h2', { class: `heading result-${s.result}`, text: RESULT_TITLE[s.result] }),
      (s.rules?.length ?? 0) > 0
        ? h('div', { class: 'center rule-desc', text: `실험: ${activeExperiments(Object.fromEntries((s.rules ?? []).map((r) => [r, true]))).join(' · ') || '없음'}` })
        : null,
      h('dl', { class: 'stats' },
        ...stat('웨이브', String(s.wave)),
        ...stat('처치', String(s.kills)),
        ...stat('최대 연쇄', String(s.maxChain)),
        ...stat('레벨', String(s.level)),
        ...(s.damageMult !== undefined ? stat('피해 배율', `×${s.damageMult.toFixed(2)}`) : []),
        ...stat('시간', fmtTime(s.durationSec)),
        ...stat('획득 부품', `+${s.partsEarned}`),
      ),
      // 도파민 모드: 무기별 피해 (합친 무기는 한 몸으로)
      p.reacts
        ? h('div', { class: 'center react-book', text: `반응 도감 ${p.reacts.seen} / ${p.reacts.total}${p.reacts.fresh.length ? ` · 새로 본 반응 ${p.reacts.fresh.join(', ')}` : ''}` })
        : null,
      (s.weaponDamage?.length ?? 0) > 0
        ? h('div', { class: 'wdmg' },
            h('div', { class: 'wdmg-title', text: '무기별 피해' }),
            ...s.weaponDamage!.map((r) => {
              const top = s.weaponDamage![0].dmg || 1;
              const total = s.weaponDamage!.reduce((t, x) => t + x.dmg, 0) || 1;
              return h('div', { class: 'wdmg-row' },
                h('span', { class: 'wdmg-name', text: `${r.icons} ${r.name}` }),
                h('span', { class: 'wdmg-bar' }, h('i', { style: `width:${Math.round((r.dmg / top) * 100)}%` })),
                h('span', { class: 'wdmg-pct', text: `${Math.round((r.dmg / total) * 100)}%` }),
              );
            }),
          )
        : null,
      s.picks.length > 0 &&
        h('div', { class: 'picks' }, ...s.picks.map((id) => h('span', { class: 'pick', dataset: { rarity: getAugment(id).rarity }, text: getAugment(id).name }))),
      h('div', { class: 'center parts', text: `보유 부품 ${p.totalParts}` }),
      p.unlocked ? h('div', { class: 'center unlocked', text: `${p.unlocked} 열림` }) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onClick: p.onRetry, text: '다시' }),
        h('button', { class: 'btn', onClick: p.onLab, text: '실험실' }),
        h('button', { class: 'btn', onClick: p.onTitle, text: '타이틀' }),
      ),
    ),
  );
}
