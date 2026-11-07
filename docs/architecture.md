# 구조

## 한 장 요약

```
 [포인터]──press/move/release──┐
 [증강 카드]──choose/reroll────┤
                               ▼
                         Command 큐 (input/PointerInput)
                               │  고정 스텝 1/60초 (app/GameLoop)
                               ▼
 ┌──────────────── sim/World (결정론, DOM 없음) ────────────────┐
 │ 충전 → 웨이브·스폰 → 적 이동·방어선 → 격자 재구성            │
 │ → 폭발 큐 처리(피해·처치·연쇄 폭발 생성) → 잔불 → 지뢰       │
 │ → 증강 onTick → 정리 → 연쇄 종료 판정 → 승패                 │
 │                                                              │
 │ data/* (수치·적·증강 정의)   AugmentManager (선택지·훅)      │
 └───────────────────────────┬──────────────────────────────────┘
                             │ SimEvent[] (drainEvents)
          ┌──────────┬───────┴─────┬───────────┐
          ▼          ▼             ▼           ▼
       Renderer     Sfx         Haptics     SlowMo ──timeScale──▶ GameLoop
     (그리기·연출) (피치 상승)  (탭·보스)   (30연쇄)
```

- **sim 은 연출을 모른다.** 렌더러·사운드·진동은 sim 상태를 읽거나 이벤트에 반응할 뿐 바꾸지 않는다.
- **배속(×1·×1.5·×2)도 루프의 timeScale 에 곱할 뿐이다.** 한 프레임에 sim 스텝을 더 돌릴 뿐 결과는 같다.
- **슬로모션은 루프의 timeScale 만 바꾼다.** sim 결과는 슬로모션이 있든 없든 같다 → 브라우저와 자동 플레이 결과가 일치한다.
- **입력은 전부 Command.** (스텝 번호, Command) 를 기록하면 리플레이가 된다 (아직 저장 기능은 없음).

## 결정론 규칙

같은 시드 + 같은 Command 열 = 같은 판. 일일 도전, 리플레이, 자동 플레이 검증이 전부 이것에 기댄다.

1. `src/sim`, `src/data` 에서는 `Math.random()`, `Date.now()`, `performance.now()` 금지. 난수는 `World.rng`(전투), 스폰·증강은 각자 스트림.
2. sim 은 항상 `FIXED_DT` 로만 진행한다.
3. 증강·보스 훅은 피해를 즉시 주지 않고 `spawnExplosion` 으로 큐에 넣는다. 한 스텝에서 터진 폭발이 만든 폭발은 다음 스텝 이후에 터진다.
4. 반복 순서가 결과에 영향을 주는 컬렉션은 배열(삽입 순서)로 둔다.

`tests/run.test.ts` 의 "같은 시드 + 같은 입력 = 같은 판" 테스트가 이걸 지킨다.

## 모으는 탭

게이지(`World.gauge`, 1 = 100%)가 `gaugeFillSec`(3초) 동안 차오르고, 탭하면 게이지를 전부 써서 터진다.
축을 나눈다: **게이지 → 크기와 연쇄 단계, 화력(D) → 피해.**
반경 `tapRadiusAt(g)` = R × (0.4 + 0.6g) (꽉 채우면 60), 피해 `tapDamageAt(g)` = D × 1.8 (게이지와 무관). 15% 미만이면 헛탭.
연쇄 단계 `chainDepthAt(g)` = `chainDepthAt` 문턱(100%·130%·200%·250%) 중 넘긴 개수 (+ "연쇄 단계" 증강). 100% 미만이면 0 = 연쇄 없음.
탭 폭발은 가장자리로 갈수록 약하다: 피해 × (1 − 0.5 × 거리/(반경 + 적 반지름)) (`Explosion.edgeMul`). 연쇄·증강 폭발은 균일.
반경이 게이지에 비례하니 넓이는 제곱으로 커진다 → 꽉 채워 쏠수록 무리 처리에 유리.
초신성은 상한을 250%로 올리고(100% 넘은 뒤 절반 속도), 무한 연쇄는 연쇄 중 탭을 게이지 없이 50% 크기로 쏘게 한다.

## 실험 규칙

`RunConfig.rules`(`sim/types.ts` 의 `RULE_IDS`)로 켜고 끄는 플레이테스트용 규칙. 수치는 `balance.ts` 의 `experiment`.
타이틀 칩 → `settings.rules`(세이브) → `createRunConfig`. 일일 도전은 항상 끔.

- **과충전** (기본 규칙, `overchargeOn` 이 항상 참. `rules.overcharge` 는 옛 세이브 호환용): 게이지 상한 150%. 100% 에서 누르면 `World.charging` 이 되고, 누르고 있는 동안만 넘어서 찬다
  (100% 위로 갈수록 가속). 떼면(`release`) 그 크기로 쏘고, 상한에 닿으면 `overload` (게이지 0, `overheat` 동안 헛탭).
  환급·증강으로는 100% 까지만 찬다. 초신성이 있으면 상한 250%, 폭주 없음(기존 방식).
- **쌓이는 바닥** (`pile`): 넘어온 적(최종 보스 빼고)이 LIFE 를 깎는 대신 `pileCols[칸]` 에 블록으로 쌓인다(`landOnPile`, `land` 이벤트).
  한 칸이 `maxRows` 에 닿으면 패배. 블록이 죽으면 `removeFromPile` 로 위 블록이 내려오고, 죽은 블록은 작은 폭발(`source: 'pile'`)을 일으켜
  닿은 블록을 바로 죽인다. 이 폭발은 연쇄 단계 × `stepsPerDepth` 칸까지 이어진다(100% = 3칸, 130% = 6칸).
  이 규칙에선 적 체력에 `enemyHpMul` 를 곱한다. `landingY(x)` 가 칸마다 바닥 높이를 돌려줘서 봇·위험 판정이 쓴다.
- **연쇄 잇기** (`combo`): 처치마다 `combo.kills++`, `windowSec` 동안 처치가 없으면 끊김(`comboEnd`).
  `comboMult()` 를 탭 피해와 폭발형 자기 폭약에 곱한다 (넘친 피해에는 안 곱함).
- **벼랑 끝** (`brink`): 방어선 위 `zone` 안에서 잡으면 게이지 환급 (`brink` 이벤트).

봇은 규칙마다 정책 옵션이 있다 (`overchargeAt`, `holdJitter`, `comboExtend`, `brinkGreed`, `paint`, `pairAware`, `pileClearAt`, `pressDelay`). 자동 플레이 `--rules`, `--bot` 로 비교한다.

## 피해 배율

`stats.damageMult` 는 곱으로 쌓이는 피해 배율이고 `stats.tapDamage`(D)에 이미 곱해져 있다. 그래서 탭·연쇄·증강 폭발이 전부 따라 커진다.
`computeStats(meta, augments, runMult)` 순서: 기본값 → 영구 강화 → 증강(덧셈 강화, 과열 코어 ×1.15) → × runMult → D 에 곱하기.
`World.runMult` 는 판 동안 쌓이는 배율(중간 보스 처치 ×1.1, 연쇄 공명)이고 `multiplyRunMult` 로만 바뀐다 (상한 ×4). 오르면 `mult` 이벤트.

## 연쇄

```
탭 → newChain(chainDepthAt(g)) → 폭발(탭, 단계 0, 피해 tapDamageAt(g), 가장자리 50%)
                     │ 반경 안 적에게 피해
                     ▼
                  처치 → chain.kills++, 넘친 피해 = 맞은 피해 − 남은 체력
                     │   deathBlast 가 있는 적(폭발형·보스) 또는 "연쇄 반응" 증강이고, 단계+1 ≤ 묶음 maxDepth 이면
                     │   연쇄 폭발 생성: 반경 46×radiusMul, 지연 0.07초
                     │   피해 = 넘친 피해 × carry(1) + D × charge × (1 + 5%×kills)
                     ▼
                  (다음 스텝들) 연쇄 폭발 → 처치 → ...  (피해 1 미만이면 연쇄 끝)
```

- **이월**: 연쇄로 넘어가는 건 체력을 넘긴 피해뿐이라 단계마다 체력만큼 깎여 저절로 끊긴다. 크게 쏠수록 멀리 간다.
- 연쇄 배율은 폭발형·보스의 자기 폭약(charge)에만 곱한다. 넘친 피해에 곱하면 단계마다 복리로 불어나 끊기지 않는다.
- HUD 가운데 숫자는 연쇄 폭발이 하나라도 터졌으면 "CHAIN ×배율", 탭이 직접 잡은 것뿐이면 "KILLS" (`Chain.links`).

- 기본으로는 폭발형만 연쇄를 이어간다. 일반 적까지 터지게 하는 건 레어 증강 "연쇄 반응"(`chainOnAllKills`).
- **연쇄 단계**: 폭발마다 `depth`(탭·지뢰·번개 0, 그 폭발로 죽은 적의 폭발 1, ...)가 있고, 묶음(`Chain.maxDepth`)을 넘으면 안 터진다.
  탭은 게이지로, 지뢰·번개는 `otherStartDepth`(1)로 정한다. 잔불·핵분열은 부모 단계, 파편은 죽은 적의 다음 단계.
- **연쇄 환급**: 한 연쇄(탭이 직접 잡은 것 포함)에서 `chainRefundKills`(8)마리 처치할 때마다 게이지 +25% (`refund` 이벤트). 가득이면 없음.
- `Chain.refs` = 아직 안 터진 폭발 + 살아 있는 잔불 지대 수. 0 이 되면 연쇄 종료(`chainEnd` 이벤트, 연쇄 길이 분포 기록).
- 적 정의의 `deathBlast`(폭발형 1.8배/2배), `indirectDamageTakenMul`(장갑 0.5), `shields`(보호막 1회), `splitInto`(분열)가 연쇄에 다르게 반응한다.

## 챕터와 적 구성

어떤 적이 몇 웨이브부터 나오는지는 적 정의가 아니라 챕터의 `roster` 가 정한다 (`data/chapters.ts`).
챕터 1은 일반·폭발형(웨이브 10부터 돌격형)뿐이고, 챕터 2·3·4가 장갑·보호막·분열을 하나씩 더한다.
챕터별 `hpMul` 이 적 체력에 곱해진다. 엔드리스는 전용 구성(`ENDLESS`)으로 3웨이브마다 종류가 하나씩 는다.
해금은 `meta/progression.isChapterUnlocked`: 첫 챕터는 항상, 나머지는 바로 앞 챕터를 한 번 깨면 열린다.
- 레벨업 선택창은 연쇄가 끝날 때까지(최대 2초) 미룬다. 연쇄 도중 멈추면 손맛이 끊기기 때문.

## 무리

적은 한 마리씩이 아니라 무리(`Pack`)로 나온다 (`World.spawnPack`). 무리 간격·크기는 `packInterval(w)`, `packSize(w)`.

- 구성원 종류는 하나씩 따로 뽑는다 → 폭발형(노릴 곳), 장갑·보호막(연쇄를 끊는 곳)이 무리 안에 섞인다.
- 구성원은 무리 중심에서의 위치(`packOx/packOy`)를 유지하고, 무리는 가장 느린 구성원 속도로 내려온다.
- `loner` 가 붙은 적(돌격형)은 무리에 묶이지 않고 자기 속도로 튀어나간다. 분열체·보스 소환물도 혼자 움직인다.

## 증강

| 훅 | 호출 시점 | 예 |
| --- | --- | --- |
| `modifyStats(s, stacks)` | 증강을 얻을 때마다 능력치 전체 재계산 | 폭발 반경, 고속 충전, 연쇄 반응, 초신성(게이지 상한) |
| `onExplosion(api, ex)` | 폭발 하나가 터진 직후 | 잔불, 핵분열 |
| `onKill(api, kill)` | 적 하나가 죽은 직후 | 파편, 과부하, 유폭 지뢰 |
| `onTick(api, dt)` | 매 스텝 | (예: 주기형 증강) |
| `onAcquire(api)` | 얻는 순간 1회 | 응급 수리, 긴급 충전 |

증강별 판 안 상태(카운터 등)는 `state` 객체(숫자만)에 둔다.

선택지 규칙(`sim/augments.ts`): 보스 보상이면 프리즘 1개 보장(판당 최대 1개) → 진화 조건 충족 시 75% 로 진화 1개 → 나머지는 노말:레어:에픽 = 60:30:10 → 모자라면 대체 선택지.

## 성능 상한

후반 동시 폭발 수백 개를 전제로 처음부터 상한을 둔다 (`data/balance.ts` → `limits`, `render/Renderer.ts`).

| 항목 | 상한 | 넘치면 |
| --- | --- | --- |
| 적 | 240 | 무리는 자리가 날 때까지 미룸, 분열체·보스 소환은 생략 |
| 대기 중 폭발 | 900 | 새 폭발 버림 |
| 잔불 지대 / 지뢰 | 64 / 24 | 새로 안 만듦 |
| 파티클 | 1400개, 프레임당 신규 220개 | 가장 오래된 것 재사용 / 생략 |
| 폭발 링 | 280 | 가장 오래된 것 재사용 |
| 피해 숫자 | 48, 26px·0.15초 안은 합침 | 가장 오래된 것 재사용 |

반경 질의는 64px 균일 격자(`core/spatial.ts`)로 한다. 렌더링은 `shadowBlur` 대신 색별 글로우 스프라이트 + 가산 합성을 쓴다.

## 이벤트 (`sim/events.ts`)

`tap`, `dryTap`, `explosion`, `hit`, `shieldBreak`, `kill`, `refund`, `gaugeFull`, `mult`, `chainEnd`, `leak`, `wave`, `bossSpawn`, `bossSummon`, `bossKill`, `levelUp`, `offer`, `augment`, `bolt`, `runEnd`

새 연출이 필요하면 이벤트를 추가하고 `Renderer.consume` / `Sfx.consume` 에서 받는다. 분석 로그(애널리틱스)도 같은 이벤트 흐름에 붙이면 된다.
