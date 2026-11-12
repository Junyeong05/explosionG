# 좋은 합성은 상대의 빈틈을 메운다 (리서치, 2026-11-11)

> 유저 11-11: "함정 + 소환수는 폭발 위치에서 소환수가 나온다… 굳이? … 한번 이런 규칙이 있는 게임들 리서치부터 싹 해 보자." 여섯 갈래(서바이버류 진화·트리거·짝 시너지·원소 반응·디펜스 콤보·설계 이론)로 조사해 묶은 보고서. 이어서 만든 천장 후보: [`combine-ceil.md`](combine-ceil.md).

합성·융합·시너지가 "확 좋아졌다"로 느껴지는 게임들은 거의 예외 없이 **한쪽이 다른 쪽의 고질적인 빈틈(언제·어디·얼마나 오래·몇 명에게)을 없애 주고**, 그 결과를 **부모 둘이 다 보이는 새 동작과 새 이름**으로 내놓는다. Vampire Survivors 진화는 발사 지연을 0으로, 지속시간을 상시로, 관통 제한을 무제한으로 바꾼다. Noita·Path of Exile·FF7의 트리거 조합은 "제때 못 쓰던 강한 것"을 정확한 순간에 배달한다. Orcs Must Die!·Kingdom Rush의 콤보는 "적 상태를 바꾸는 조각 + 그 상태에서 세지는 조각"이다. 반대로 둘이 나란히 쏘거나(병렬), 효과를 묽게 섞거나(희석), 원래 알아서 적에게 가는 것을 다른 데서 꺼내기만 하면(자리 옮기기) 맥이 빠진다. 또 조사한 어느 게임도 재료가 많을 때 모든 짝을 같은 무게로 만들지 않았다. 신 8명인 Hades는 28짝을 다 썼지만 짝마다 한 줄짜리 규칙이었고, 재료가 많은 게임은 일부 짝만 특별하게 만들고(Gungeon은 가능한 짝의 1% 미만, Ball x Pit은 진화 42개) 나머지는 일반 규칙으로 받친다. 유저 반응도 이 틀에 그대로 맞는다. 덫+주문은 "때를 못 잡던 주문에 때를 준" 정답형이고, 덫+소환수·돌격·회전체는 둘 다 스스로 배달하는 무기라 덫이 채워 줄 빈틈이 없다. 특히 explosionG v3 측정에서 처치 수가 **매복(덫+소환수) ×1.86, 덫 주문(덫+주문) ×1.19로 체감과 정반대**였다. "확 좋아짐"은 처치 수가 아니라 "이미 느끼던 한계가 눈앞에서 풀리는 것"에서 온다는 뜻이다. 그래서 제안의 핵심은 짝 210개를 하나씩 쓰는 것이 아니다. **갈래 15개마다 "주는 것 / 목마른 것"을 한 줄로 정한 빈틈 표**를 만들고, 그 표로 210짝에 점수를 매겨 맞물리는 20~30짝만 손으로 짠 대박 합성(천장)으로 만들고, 나머지는 지금 같은 일반 규칙(바닥)으로 둔다.

> **조사 한계.** 여섯 묶음의 조사 노트는 모두 웹 검색 결과 요약에서 나왔다. 세션 네트워크가 대부분 위키(Vampire Survivors·HoloCure·Hades·Noita·PoE·Genshin·Warframe 등)의 원문 열람을 막아서, 원문과 직접 대조하지 못했다. 출처끼리 엇갈리거나 원문 확인이 안 된 숫자는 **(미검증)**으로 적었다. explosionG 측정값은 저장소 문서([combine-v3-eval.md](combine-v3-eval.md), [combine-210-v3.md](combine-210-v3.md))에서 가져왔다. **"추론"·"제안"이라고 적은 부분은 출처 사실이 아니라 이 보고서의 해석이다.**

## 여섯 갈래 게임이 같은 답을 낸다: 합치면 "못 하던 것"이 풀린다

조사한 합성 체계는 여섯 묶음으로 나뉜다. 겉모양은 진화, 트리거, 짝 시너지, 원소 반응, 디펜스 콤보로 다르다. 하지만 잘 된 사례가 바꾸는 것은 놀랄 만큼 비슷하다.

| 묶음 (대표 게임) | 합치면 무엇이 바뀌나 | 배울 점 |
|---|---|---|
| 서바이버류 진화·유니온·콜라보 (Vampire Survivors, HoloCure, Ball x Pit, Survivor.io) | 최대 레벨 무기 + 열쇠 → 부모의 약점 하나가 사라진 새 무기 | 빈틈 제거, 새 이름, 상자 같은 사건 |
| 트리거 + 페이로드 (Noita, Path of Exile, FF7 마테리아) | "맞을 때·맞았을 때·쓰러질 때" 뒤의 주문을 대신 쏜다 | 페이로드에 없는 축을 채울 때만 값이 있다 |
| 짝 전용 시너지 (Hades Duo, Gungeon, MMBN Program Advance, Isaac) | 한쪽의 사건이 다른 쪽 피해를 **같은 적에게** 터뜨린다, 약한 동작을 다시 쓴다 | 이름 있는 짝, 조건부 등장, 표시 |
| 원소 반응·상태 (Genshin, Warframe, DOS2, BotW) | 깔린 상태 + 발동 = 제3의 반응 | 순서 있는 짝, ×1.5~×3, 부모는 사라진다 |
| 디펜스·함정 콤보 (Orcs Must Die!, Kingdom Rush, Element TD, GemCraft) | 상태를 바꾸는 조각이 다른 조각의 명중·체류 시간을 곱한다 | 피해 0인 조각이 최고 평가를 받는다 |
| 설계 이론 (Rosewater, LocalThunk, McMillen, Nintendo) | 시너지 = "둘 중 누구도 혼자 못 하는 것" | 핵심 수치를 건드리는 짧은 규칙 |

### 서바이버류: 진화는 숫자가 아니라 빈틈 하나를 없앤다

Vampire Survivors 진화는 **무기 최대 레벨 + 지정 패시브 + 10분 이후 보스 상자**라는 세 조건으로 열린다 ([PC Gamer](https://www.pcgamer.com/vampire-survivors-evolve-weapons-evolutions-guide/)). 바뀌는 것은 대개 수치가 아니라 빈틈 하나다. Thousand Edge와 Holy Wand는 **발사 지연이 없어지고**, Hellfire와 Death Spiral은 **적을 관통하며**, Soul Eater는 **회복**을 얻고, King Bible은 돌다 사라지던 성경이 진화 후 **끊김 없이 계속 돈다** ([Prima Games](https://primagames.com/gaming/vampire-survivors-weapon-evolution-guide)). 열쇠 패시브도 그 약점과 뜻이 맞닿는다(Spellbinder=지속시간 → 성경이 상시, Bracer=투사체 속도 → 칼 연사). 다만 이 짝짓기 논리는 개발자 발언이 아니라 결과를 보고 한 추론이다.

HoloCure 콜라보 BL Fujoshi는 BL Book과 Psycho Axe를 합쳐 **책 고리와 도끼 고리가 함께 영구히 도는** 무기가 된다 ([HoloCure wiki.gg](https://holocure.wiki.gg/wiki/BL_Fujoshi)). 두 부모의 모양이 한 패턴 안에 동시에 보이니 "이게 합쳐졌구나"가 바로 읽힌다. 동시에 "영구"라는 질적 변화로 세졌다는 것도 보인다.

Ball x Pit은 이 차이를 시스템으로 갈라 놓았다. 레시피가 없는 두 공은 **두 능력을 다 가진 공 하나**로 융합되고, 레시피가 있는 짝은 융합이 막히고 진화가 강제된다 ([Ball x Pit fandom](https://ballxpit.fandom.com/wiki/Fission,_Fusion,_and_Evolution)). 커뮤니티의 평은 분명하다. "융합한 공은 기존 두 무브셋을 섞을 뿐이고, 진화한 공은 완전히 새 무브셋을 받으며 보통 재료 어느 쪽보다도 강하다" ([Blueprinted Gaming](https://blueprintedgaming.com/docs/ball-x-pit/ball-fusion-reference)). 최고 평가인 Satan은 활성 중 **화면의 모든 적**에게 화상을 걸고 광폭화시킨다 ([Game Rant](https://gamerant.com/ball-x-pit-evolutions-tier-list-best-balls/)). "맞은 적"이 "모든 적"으로 바뀌는 규칙 변경이다.

### 트리거: 강하지만 제때 못 쓰는 것을 배달한다

Noita의 트리거 주문은 맞거나 시간이 다 되거나 사라질 때 그 자리에서 뒤에 넣은 주문(페이로드)을 쏜다 ([Noita Wiki: Trigger](https://noita.wiki.gg/wiki/Trigger)). 플레이어들이 권하는 조합은 빠른 Spark Bolt에 트리거를 달아 Dropper Bolt·Magic Missile을 배달하는 것이다. 이유는 그 주문들이 **"느리게 날아가거나 가까이서 쏘기엔 너무 위험해서"**다 ([Steam](https://steamcommunity.com/app/881100/discussions/0/2958293022028902453)). 덤으로 **트리거 페이로드 안의 주문은 cast delay를 아예 무시한다** ([Noita Wiki: Wand Mechanics](https://noita.wiki.gg/wiki/Guide:_Wand_Mechanics)). 자리만 옮기는 게 아니라 같은 주문을 더 싸게 쏘는 셈이다.

Path of Exile에서 Cast when Damage Taken과 가장 흔히 짝짓는 것은 **잠깐 무적이 되는 Immortal Call**이다 ([FragMeta](https://fragmeta.com/understanding-the-path-of-exile-cast-when-damage-taken-mechanics/)). FF7에서 가장 많이 권하는 Final Attack 짝은 **Phoenix·Revive**다 ([Steam FF7 가이드](https://steamcommunity.com/sharedfiles/filedetails/?id=2213433849)). 둘 다 페이로드의 가치가 전적으로 "언제"에 달려 있고, 트리거 조건이 바로 그 순간이다.

### 짝 시너지: 페이로드는 "이미 닿은 그 적"에서 터진다

Hades Duo 중 평이 좋은 것들은 한 신의 **전달 사건**이 다른 신의 **피해·상태**를 같은 적에게 터뜨린다. Sea Storm은 "밀쳐낸 적에게 번개"를 떨어뜨리고, Merciful End는 튕겨내기로 Doom을 **즉시** 터뜨려 Doom의 약점인 지연을 없앤다. Vengeful Mood는 맞아야 발동하던 Revenge 효과를 **맞지 않아도 주기적으로** 발동시킨다 ([Twinfinite](https://twinfinite.net/guides/hades-duo-boons-list-how-work/)). 가장 사랑받는 시너지들은 약한 것을 강하게 바꾼다. Hunting Blades는 "Ares의 Cast를 쓸 만하게 만드는" Duo로 불리고 ([Steam 가이드](https://steamcommunity.com/sharedfiles/filedetails/?id=2578318639)), Gungeon의 Great Queen Ant는 "평범한 무기를 최상급 청소 기계로" 바꾼다 ([Gamers Decide](https://www.gamersdecide.com/articles/enter-the-gungeon-best-synergies)).

Isaac의 Brimstone + Tammy's Head는 한쪽이 다른 쪽 공격의 **배달 모양**을 바꾸는 좋은 예다. Tammy's Head가 내 공격 종류를 사방으로 퍼뜨리니, Brimstone 광선 **열 줄기가 사방으로** 나간다 ([Isaac Wiki](https://bindingofisaacrebirth.wiki.gg/wiki/Tammy's_Head)). 두 줄기를 나란히 쏘는 것이 아니라, 한 공격에 두 성질이 겹친다.

### 디펜스와 원소: 상태를 깔고, 그 위에서 터뜨린다

Orcs Must Die! 3은 지난 2초 동안 적에게 걸린 **서로 다른 효과의 수**로 콤보를 세고, 최소 3개부터 친다 ([OMD Wiki](https://orcsmustdie.fandom.com/wiki/Combo_(OMD3))). 이 시리즈에서 최고 평가를 받는 Barricade는 **피해도 상태 이상도 주지 않는다**. 길만 막아 몰아넣는다 ([Prodigy Gamers](https://prodigygamers.com/?p=15278)). Kingdom Rush 가이드도 같은 원리를 말한다. **"적을 막아 세우면 근처의 모든 딜 타워가 공격할 시간을 더 얻는다"** ([ProGameGuides](https://progameguides.com/tier-lists/kingdom-rush-6-tower-tier-list-best-towers/)). Element TD는 Light 타워에 Fire를 더하면 이름이 다른 **Lightning Tower**가 된다 ([Element TD forums](https://forums.eletd.com/topic/945-basics-of-element-td)).

Genshin은 먼저 묻은 원소(aura) 위에 다른 원소가 닿으면 반응이 터지고, **순서에 따라 배율이 다르다**(Hydro가 Pyro 위에 닿으면 ×2, 반대면 ×1.5) ([Genshin Fandom](https://genshin-impact.fandom.com/wiki/Vaporize)). Warframe은 두 원소를 합치면 **원래 두 원소는 피해도 상태도 내지 않는다** ([Warframe Today](https://warframe.today/warframe-damage-types-enemy-weakness-damage-combinations/)). 합성 결과가 A도 B도 아닌 하나의 새 것이 된다.

### 다섯 가지 레버로 정리하면

| 레버 | 무엇이 바뀌나 | 대표 사례 |
|---|---|---|
| 빈틈 제거 | B가 못 하던 것(지연·지속·관통·전제 조건)이 사라진다 | Thousand Edge, Unholy Vespers, Merciful End, Vengeful Mood |
| 배달 | 강하지만 맞히기 어려운 것을 정확한 때·자리에 | Noita 트리거, CwDT + Immortal Call, Final Attack + Phoenix |
| 새 동작 | 부모 둘과 다른 무브셋, 새 이름 | Ball x Pit 진화, Element TD 듀얼, MMBN Program Advance |
| 범주 변화 | 유한 → 상시, 맞은 적 → 모든 적, 피해 → 즉사 | Satan, Black Hole, BL Fujoshi |
| 깔고 터뜨리기 | A가 적 상태를 바꾸고, B가 그 상태에서 세진다 | OMD 타르 + Brimstone, Kingdom Rush 막기 + 포격, Genshin Freeze → Shatter |

이 표의 바탕은 Mark Rosewater의 시너지 정의다. A를 B와 함께 쓰면 **"둘 중 어느 쪽도 혼자서는 할 수 없는 더 강한 무언가"**가 생긴다 ([Living in Synergy, WotC](https://magic.wizards.com/en/news/making-magic/living-synergy-2013-02-25)). 다섯 레버는 모두 이 "혼자 못 하는 것"을 만드는 서로 다른 길이다.

## 맥 빠지는 합성은 같이 쏘기, 묽히기, 자리 옮기기 세 꼴이다

실패 사례도 모양이 정해져 있다. 가장 흔한 것은 **둘이 각자 원래 하던 일을 동시에 하는 병렬**이다. Ball x Pit의 융합이 "섞을 뿐"이라는 평을 받는 이유이고 ([Blueprinted Gaming](https://blueprintedgaming.com/docs/ball-x-pit/ball-fusion-reference)), 칸 제한이 없는 게임에서는 이것이 그냥 "둘 다 가진 것"과 같다.

**희석**은 더 나쁘다. GemCraft는 색을 섞은 듀얼·트리플 젬이 스탯은 오르지만 **두 특수 효과를 약해진 채로** 가진다. 그래서 플레이어들은 1등급에서만 섞고 그 뒤로는 순수 색으로 키우는 요령을 만들어 합성을 피해 간다 ([Armor Games 가이드](https://armorgames.com/guide/gemcraft-labyrinth-strategy-guide)). 무작위 결과도 같은 불만을 낳는다. Rush Royale은 같은 유닛 둘을 합치면 무작위 유닛이 나와서 높은 등급에서 오히려 피해가 줄 수 있다 ([TouchTapPlay](https://www.touchtapplay.com/how-does-merging-work-in-rush-royale/)).

**자리 옮기기**를 직접 다룬 디자이너 발언은 찾지 못했다. 하지만 가장 가까운 증거가 두 가지 있다. 하나는 Isaac의 덮어쓰기다. Mom's Knife는 Brimstone보다 우선해서 Brimstone이 거의 기여하지 못하게 되고 ([Isaac Wiki](https://bindingofisaacrebirth.wiki.gg/wiki/Brimstone)), 플레이어들은 Mom's Knife를 **"게임 최대의 시너지 킬러"**라고 부른다 ([Steam](https://steamcommunity.com/sharedfiles/filedetails/comments/2903016019)). 둘 다 완결된 배달 방식이면 한쪽이 지워진다. 다른 하나는 Noita다. 자리를 옮겨 주는 트리거가 값을 갖는 것은 페이로드가 "느리거나 위험해서" 혼자 전달이 어려울 때뿐이었다.

트리거가 **엇나간 때**에 터져도 맥이 빠진다. PoE1의 Cast on Death는 내가 죽었을 때 발동해서 "가장 쓸모없는 젬" 중 하나로 불린다 ([Steam](https://steamcommunity.com/app/238960/discussions/0/1678064284160617513)). FF7 플레이어들은 Ruby Weapon전에서 Phoenix 발동이 오히려 시간 낭비라 Revive로 바꿔 낀다 ([GameFAQs](https://gamefaqs.gamespot.com/ps/197341-final-fantasy-vii/faqs/2388)). 조건과 페이로드가 어긋나면 없는 것보다 못하다.

마지막으로, **새 모양이 곧 강함은 아니다**. Survivor.io의 Death Ray는 레이저가 화면 가장자리에서 나선을 그리며 모이는, 부모와 완전히 다른 패턴이다. 그런데 평가는 D티어부터 "Decent"까지 갈린다 ([BlueStacks](https://www.bluestacks.com/blog/game-guides/survivor-io/sio-tier-list-en.html); [Clashiverse](https://clashiverse.com/survivor-io-evo-tier-list-guide/)). Hades의 Curse of Drowning도 동작을 다시 썼지만 한 플레이어 티어 목록에서 최하위였다 ([Steam](https://steamcommunity.com/app/1145360/discussions/0/2245552086113211446)). 새 동작은 실제로 더 잘 싸워야 한다.

| 실패 꼴 | 사례 | 왜 맥이 빠지나 |
|---|---|---|
| 병렬 (같이 쏘기) | Ball x Pit 융합 | 칸 제한이 없으면 둘 다 가진 것과 같다 |
| 희석 | GemCraft 듀얼 젬 | 두 효과가 다 약해져 플레이어가 피해 간다 |
| 덮어쓰기 / 자리 옮기기 | Isaac Mom's Knife > Brimstone | 완결된 배달 둘이 만나면 한쪽이 지워진다 |
| 엇나간 때 | PoE Cast on Death, FF7 Ruby전 Phoenix | 페이로드가 가장 쓸모없을 때 터진다 |
| 작은 조건부 배율 | "약화된 적에게 +X%" 류 | 비용 대비 보상이 작다 (Rosewater의 payoff 불만, 플레이어 평 자료는 없음: 추론) |
| 무작위 결과 | Rush Royale, Random Dice | 합치면 오히려 약해질 수 있다 |
| 새 모양, 약한 성능 | Survivor.io Death Ray | 화려해도 실전 평가는 낮다 |

Rosewater는 "payoff(보상)"라는 말이 주로 **보상이 비용에 비해 너무 작게 느껴질 때** 쓰인다고 설명한다 ([WotC](https://magic.wizards.com/en/news/making-magic/even-more-words-rd-2022-01-10)). 칸 제한이 없는 explosionG에서 합성의 비용은 "두 무기를 따로 가질 수 있었던 기회"다. 그 비용을 넘지 못하는 합성은 모두 위 표의 어느 칸에 들어간다.

## "확 세졌다"는 ×2 이상이거나 범주가 바뀔 때 온다, 처치 수만으로는 안 보인다

보상 숫자는 두 층으로 나뉜다. 표식·취약 계열은 **+20%~+50%**이고, 반응·폭발 계열은 **×1.5~×3 이상**이다. "확 세졌다"는 체감은 후자의 크기에서 나온다. 전자는 다른 효과와 곱해질 때 빛난다는 것이 노트의 추론이다.

| 종류 | 숫자 | 출처 |
|---|---|---|
| 취약·표식 | Slay the Spire Vulnerable +50%, Diablo 4 Vulnerable ×1.2, PoE1 Shock 최대 +50% | [StS Wiki](https://slay-the-spire.fandom.com/wiki/Vulnerable), [icy-veins](https://www.icy-veins.com/d4/news/simple-critical-vulnerable-and-overpower-damage-diablo-4-season-2-changes-explanation-and-example/), [poewiki](https://www.poewiki.net/wiki/Shock) |
| 증폭 반응 | Genshin Vaporize·Melt ×2 / ×1.5 (순서에 따라) | [Genshin Fandom](https://genshin-impact.fandom.com/wiki/Vaporize) |
| 변환·2단 반응 | Overloaded ×2.75, Shatter ×3 (5.2 이후), Hyperbloom·Burgeon ×3 | [Sportskeeda](https://www.sportskeeda.com/esports/every-elemental-reaction-damage-buff-genshin-impact-5-2), [HoYoWiki](https://wiki.hoyolab.com/pc/genshin/entry/5206?lang=en-us) |
| 쌓이는 상태 | Warframe Viral 체력 피해 +100% → 최대 +325% | [1v9.gg](https://1v9.gg/blog/warframe-all-damage-elements-types-explained) |
| 체류 시간 | 50% 감속 ≈ 그 범위 모든 타워 피해 2배 (원 출처 불확실, 미검증) | [goblinwars 가이드](https://goblinwars-com.pages.dev/tower-defense-strategy-guide/) |
| 콤보 수 | OMD2 타르 중심 콤보 "x10 훨씬 넘게" (Steam 글 하나, 미검증) | [Steam](https://steamcommunity.com/app/201790/discussions/0/412448158163444508) |

강한 트리거는 반드시 묶어야 한다는 증거도 숫자로 남아 있다. PoE1 Cast on Critical Strike는 발동 주문에 **0.15초 쿨다운**이 붙었다 ([poewiki](https://www.poewiki.net/wiki/Cast_on_Crit)). 3.17에서는 발동 주문 피해 보정이 보너스에서 감소로 뒤집혀, 1레벨 기준 20% more가 **19% less**가 됐다 ([poewiki](https://www.poewiki.net/wiki/Cast_on_Crit)). Cast when Damage Taken으로 발동한 주문은 **피해가 25% 줄었다** ([PoE Fandom](https://pathofexile.fandom.com/wiki/Cast_when_Damage_Taken_Support)). PoE2는 아예 공식으로 만들었다. **시전 시간이 긴 주문일수록 채워야 할 Energy가 많다** ([Eloking](https://eloking.com/blog/how-meta-skills-work-in-poe-2)). GGG는 상태 이상으로 너무 쉽게 트리거를 채우던 문제를 막으려고 적의 강함(Monster Power)을 Energy에 반영했다 ([PCGamesN](https://www.pcgamesn.com/path-of-exile-2/patch-notes-trigger-skills)). Risk of Rain 2는 연쇄를 proc coefficient로 줄인다. Ukulele 번개(계수 0.2)가 AtG를 터뜨릴 확률은 약 2%뿐이다 ([RoR2 wiki.gg](https://riskofrain2.wiki.gg/wiki/Proc_Coefficient); [Rogue Ranker](https://rogueranker.com/risk-of-rain-2-ukulele/)).

배율보다 **발동이 꾸준한지**가 더 중요하다는 신호도 있다(추론). Genshin 5.2에서 Superconduct 배율은 0.5에서 1.5로 **세 배**가 됐지만, 같은 기사에서도 실전성은 여전히 낮게 평가된다 ([Sportskeeda](https://www.sportskeeda.com/esports/every-elemental-reaction-damage-buff-genshin-impact-5-2)). 숫자를 올려도 체감은 따라오지 않을 수 있다.

### explosionG의 측정이 이것을 그대로 보여 준다

v3 일반 규칙은 숫자로는 성공했다. 같은 두 무기를 따로 가진 판 대비 **처치 가운데값 ×1.72**였고, **210짝 중 192짝**이 따로보다 많이 잡았다 ([combine-v3-eval.md](combine-v3-eval.md)). 그런데 유저는 "확 좋아진다는 맛이 별로 없다"고 했다. 덫 짝만 놓고 보면 숫자와 체감이 거의 반대다 ([combine-210-v3.md](combine-210-v3.md)).

| v3 짝 | 처치 (따로 대비) | 유저 체감 |
|---|---|---|
| 함정 + 소환수 (매복) | ×1.86 | "굳이?" |
| 함정 + 회전체 (톱날 덫) | ×1.72 | 소환 위치만 바뀜 |
| 함정 + 돌격 (도화선) | ×1.50 | 소환 위치만 바뀜 |
| 함정 + 주문 (덫 주문) | ×1.19 | "밟으면 나가는구나" 맛이 있음 |
| 함정 + 공중 (표식 덫) | ×0.60 (210짝 중 최하위) | 그나마 그런 맛 |

이 표는 처치 비율이 "확 좋아짐"을 재는 잣대가 아니라는 강한 증거다(추론). 비평가 분석은 파워 판타지가 **"플레이어가 화면을 힐끗 보고 5분 전보다 얼마나 강해졌는지 알 수 있을 때"** 저절로 팔린다고 말한다 ([Kokutech](https://www.kokutech.com/blog/gamedev/design-patterns/power-fantasy/vampire-survivors)). 덫 주문은 처치를 조금 더 하지만, 플레이어가 이미 겪은 문제("주문을 제때 못 쓴다")가 풀리는 장면이 보인다. 매복은 처치를 많이 하지만, 화면에는 "짐승이 다른 데서 나왔다"만 보인다.

## 기대감은 보이는 가능성, 늦게 오는 사건, 새 이름이 만든다

"이거랑 이거 섞으면?"이라는 기대는 세 장치에서 나온다. 첫째는 **진입 장벽**이다. VS는 최대 레벨 + 열쇠 패시브 + 10분 이후 상자를 요구하고 ([PC Gamer](https://www.pcgamer.com/vampire-survivors-evolve-weapons-evolutions-guide/)), 진화는 "오래 살아남아야 도달하는 장기 목표"라 그 기다림이 긴장을 만든다 ([Now Loading](https://nowloading.co/vampire-survivors-weapons)). HoloCure는 슈퍼 콜라보를 레벨 50 또는 콜라보 3회 뒤에 나오는 Golden Hammer로 한 번 더 잠근다 ([PC Invasion](https://www.pcinvasion.com/all-collabs-and-super-collabs-in-holocure-full-list/)). Magic Survival은 캐릭터 레벨 25·50·75에서만 합성을 열고, 팬 위키 기준으로 합성하면 **보조 주문이 사라진다** ([Magic Survival fandom](https://magic-survival-rpg.fandom.com/wiki/Magic_Combination)). 재료를 잃는 대가가 "합보다 커야 한다"는 기대를 키운다.

둘째는 **가능성의 표시**다. Gungeon은 새로 주운 것이 가진 것과 시너지가 있으면 캐릭터 머리 위에 **파란 화살표**를 띄운다 ([Gungeon 공식 위키](https://enterthegungeon.wiki.gg/wiki/Synergies)). 또 "synergy factor"로 **지금 가진 것과 시너지가 나는 아이템의 등장 확률을 올린다** ([Gungeon Wiki](https://enterthegungeon.fandom.com/wiki/Synergies)). Hades Duo는 두 신의 축복을 모두 가졌을 때만 후보가 되지만 그래도 보장은 아니다 ([Prima Games](https://primagames.com/gaming/hades-guide-legendary-heroic-duo-boons)). 그래서 "다음 방에 Duo가 뜰까"를 기다리게 된다.

셋째는 **사건과 이름**이다. VS 상자 연출은 개발자의 도박 기계 업계 경력에서 나온 화려한 그래픽을 쓴다 ([Wikipedia](https://en.wikipedia.org/wiki/Vampire_Survivors)). Hades Duo는 획득할 때 **두 신의 대화**가 나오고 ([Hades Wiki](https://hades.fandom.com/wiki/Boons)), MMBN은 칩 3개 이상을 정해진 순서로 넣으면 **이름 있는 슈퍼 칩 하나로 합쳐진다** ([MMKB](https://megaman.miraheze.org/wiki/Program_Advance)). OMD는 x3 이상부터 콤보를 화면에 띄우고 점수·코인·경험치를 더 준다 ([OMD Unchained Wiki](https://orcsmustdieunchained.gamepedia.com/Combos)).

발견에는 상한이 있다. Isaac 원작은 아이템 설명을 숨겨 실험을 강제했다. McMillen은 나중에 그것을 "아마 가장 큰 결함"이라 부르며 **"아이템이 700개를 넘으니 이 아이디어는 전혀 통하지 않는다"**고 했다 ([GamesRadar](https://www.gamesradar.com/the-creator-of-one-of-the-most-popular-roguelikes-of-all-time-is-using-his-new-project-to-right-11-year-old-wrongs/)). 반대로 Slay the Spire의 Giovannetti는 새 조합을 찾을 때마다 **"천재가 된 느낌"**이 드는 것이 핵심 재미라고 했다 ([Uppercut](https://uppercutcrit.com/?p=2349)). LocalThunk(Balatro)는 짧게 설명되는 효과일수록 시너지 폭이 넓다고 본다. 그래서 설명이 길면 버리고, 특정 조커를 지목하는 시너지는 풀이 크면 **"답답할 만큼 드물어진다"**고 피한다 ([r/balatro 개발자 글 미러](https://lr.sudovanilla.org/r/balatro/comments/1czo9g0/guidelines_for_joker_design)). Noita는 연금술 레시피 두 개만 판(시드)마다 재료를 무작위로 바꾸고 나머지 반응은 고정해서, 다 외운 뒤에도 찾을 거리를 남긴다 ([Noita Wiki](https://noita.fandom.com/wiki/Lively_Concoction)). 정리하면 힌트는 주고, 결과는 처음 볼 때 놀랍게 만든다.

### 특별한 짝은 언제나 일부다: "모든 짝"은 재료가 적을 때만 된다

| 게임 | 재료 | 특별한 짝 |
|---|---|---|
| Warframe | 기본 원소 4 | 조합 원소 6 = 모든 짝 ([Warframe Wiki](https://wiki.warframe.com/w/Damage)) |
| Hades I | Duo를 주는 신 8 | 28 = 8C2, 가능한 짝 수와 같음 ([Hades Wiki](https://hades.fandom.com/wiki/Duo_Boons)) |
| Hades II | 신 여럿 | 37 (두 출처 일치) ([RogueRanker](https://rogueranker.com/hades-2-duo-boons/)) |
| Vampire Survivors, Survivor.io | 무기마다 | 대체로 무기 1개당 결과 1개 ([PC Gamer](https://www.pcgamer.com/vampire-survivors-evolve-weapons-evolutions-guide/); [Gamer Digest](https://gamerdigest.com/survivor-io-weapon-evolutions/)) |
| Ball x Pit | 공 여럿 | 공 진화 42 + 패시브 진화 8, 나머지 짝은 일반 융합 (집계에 따라 69·95+, 미검증) ([Screen Rant](https://screenrant.com/ball-x-pit-evolution-list-balls-passives-combos/)) |
| Ballionaire | 트리거 여럿 | 트리거 하나가 평균 1.94개와 시너지, 다른 트리거의 약 6% (초기 빌드) ([개발 일지](https://newobject.itch.io/ballionaire/devlog/620660/build-3-released)) |
| Enter the Gungeon | 총 243 + 아이템 271 | "수백", 한 업데이트 홍보로 "500개 넘게" → 약 13만 짝의 1% 미만 ([Gungeon Wiki](https://enterthegungeon.wiki.gg/wiki/Item); [PlayStation Blog](https://blog.playstation.com/?p=202877)) |
| **explosionG** | **갈래 15** | **105짝 (순서 있으면 210)**, 지금 210 모두 같은 무게 |

모든 짝을 다 만든 게임(Warframe 6, Hades 28)은 재료가 8개 이하이고, 각 짝이 이미 있는 동작에 거는 **한 줄짜리 규칙**이다. explosionG의 105짝은 Hades I의 거의 네 배다. Nintendo도 조합 폭발을 피했다. BotW 화학 엔진은 "재질은 서로의 상태를 바꿀 수 없다"는 규칙으로 일부 짝을 아예 상호작용에서 뺐다 ([GamesBeat](https://gamesbeat.com/the-legend-of-zelda-breath-of-the-wild-makes-chemistry-just-as-important-as-physics/)). TotK Fuse는 조합마다 어떻게 보이고·들리고·동작할지 정하기가 너무 많아 **두 개만, 방향 없이** 붙이게 줄였다 ([Zelda Dungeon](https://www.zeldadungeon.net/tears-of-the-kingdoms-fuse-ability-was-originally-more-ambitious-director-shares/)).

큰 풀에서 짝을 적게 쓰고도 넓게 덮는 요령도 있다. Gungeon Great Queen Ant는 Gungeon Ant + **왕관류 아이템 아무거나**로 열린다 ([Gamers Decide](https://www.gamersdecide.com/articles/enter-the-gungeon-best-synergies)). "A + 어떤 묶음 중 하나"로 효과 하나가 여러 짝을 덮는 구조다. McMillen도 "2~3개 아이템 콤보보다 **효과 유형 사이의 일반적 시너지**"를 설계한다고 말한다 ([McMillen, X](https://x.com/edmundmcmillen/status/1846779101488861391)).

## 유저 반응은 사례와 정확히 겹친다: 덫+주문은 배달, 덫+소환수는 배달+배달

아래 표의 "판정" 칸은 사례에 비춰 본 이 보고서의 해석이다.

| 유저 반응 | 사례에서 닮은 것 | 판정 |
|---|---|---|
| 덫 + 주문: "제때 못 쓰던 주문이 밟으면 나간다" | CwDT + Immortal Call, Final Attack + Phoenix, Noita 트리거 → 느린 페이로드 | 맞음. 주문의 빈틈(때·자리)을 덫이 정확히 채운다 |
| 덫 + 공중: "그나마 그런 맛" | Hades Sea Storm (전달 사건 → 같은 적에 피해) | 절반 맞음. 덫이 때를 주지만 그림자 예고 지연은 그대로라 덜 맞는다 (×0.60) |
| 덫 + 소환수: "폭발 위치에서 소환수가… 굳이?" | Isaac 덮어쓰기, OMD에 칭찬받는 "딜러 + 딜러" 짝 없음 | 맞음. 소환수는 원래 알아서 적에게 가서 덫이 줄 것이 없다 |
| 덫 + 돌격, 회전체: "소환 위치만 바뀜" | 같음 | 맞음. 돌격의 본질은 줄 쓸기, 회전체의 본질은 머물기. 덫은 둘 다 건드리지 않는다 |
| v2: "둘이 같이 쏠 뿐" | Ball x Pit 융합, GemCraft 희석 | 맞음. v2는 A 자체가 바뀌는 짝이 210 중 31개뿐이었다 ([combine-210-v3.md](combine-210-v3.md)) |
| v3: "B가 다른 위치에서 나올 뿐" | Noita: 자리 옮기기는 B가 배달 문제를 가질 때만 값 | 맞음. 일반 규칙이 건드린 축이 "위치"였고, 위치는 대부분 갈래에게 핵심 수치가 아니다 |

덫+주문이 맛있었던 이유는 이 보고서 전체의 핵심과 같다. 주문은 드물고 크며, 언제 어디에 쏠지가 가장 큰 문제다. 덫은 "적이 바로 여기 있다"는 순간을 공짜로 준다. Rosewater 용어로 덫은 enabler(조건을 만들어 주는 쪽), 주문은 payoff(조건이 맞으면 크게 보상하는 쪽)이다. 반대로 덫+소환수는 둘 다 배달형이다. 소환수는 이미 스스로 적을 찾아가고 붙잡는다. 덫이 출발점을 바꿔도 소환수가 하는 일이 달라지지 않는다. Hades의 좋은 Duo가 거의 늘 "전달 × 피해·상태"이고, 전달 둘을 합친 꼴이 없는 것과 같은 이유다.

어긋나는 증거도 있다. 첫째, Hades는 28짝을 다 만들면서 Heart Rend("약화된 적에게 치명타 피해 증가") 같은 조건부 배율 짝도 남겼다 ([Hades Wiki](https://hades.fandom.com/wiki/Duo_Boons)). 모든 짝이 대박일 필요는 없다는 뜻이다. 둘째, McMillen·LocalThunk·Nintendo는 모두 짝마다 손으로 쓰기보다 **짧은 일반 규칙**을 권한다. v3가 "규칙 하나"로 간 방향 자체는 틀리지 않았다. 다만 LocalThunk의 일반 규칙은 **"핵심 키워드와 수치를 증폭하는"** 것이었고 ([r/balatro 미러](https://lr.sudovanilla.org/r/balatro/comments/1czo9g0/guidelines_for_joker_design)), v3 규칙이 건드린 것은 위치였다. 셋째, Survivor.io Death Ray처럼 새 동작이 반드시 강하지는 않다. 다시 쓴 합성도 측정을 거쳐야 한다.

## explosionG 제안: 빈틈 표로 210짝을 바닥과 천장으로 가른다 (추론·제안)

> 이 절은 위 사례들을 바탕으로 한 **제안**이다. 갈래별 "주는 것 / 목마른 것"은 요청서의 갈래 설명과 v3 규칙표를 보고 이 보고서가 정한 초안이라, 실제 게임 수치로 다시 맞춰야 한다.

### 원칙 여덟 가지

| 원칙 | 한 줄 | 근거 |
|---|---|---|
| 1. 빈틈 표부터 | 짝이 아니라 갈래마다 "주는 것 / 목마른 것"을 먼저 정한다 | McMillen "효과 유형", Rosewater enabler/payoff |
| 2. 목마름을 채울 때만 대박 | B가 목마른 축을 A가 줄 때만 천장 등급 | VS 진화, Noita 트리거, 덫 + 주문 |
| 3. 한 몸에 두 성질 | 두 줄기가 아니라 한 탄·한 몸·한 장판에 둘의 성질을, 두 부모 모양이 보이게 | Isaac Tammy's Head, HoloCure BL Fujoshi |
| 4. 문턱 하나 넘기 | 유한 → 상시, 하나 → 전부, 맞아야 → 닿기만 | Unholy Vespers, Satan |
| 5. 상태가 먼저 보인다 | 묶임·표식·끌림이 눈에 보이고, 그다음 B가 거둔다 | OMD 콤보 표시, Freeze → Shatter |
| 6. 바닥 + 천장 | 210 전부는 일반 규칙, 20~30짝만 손으로 짠 진화, 천장 짝은 일반 규칙 대신 강제 | Ball x Pit 융합/진화 |
| 7. 배달형은 나르는 쪽으로 | 소환수·돌격·회전체처럼 혼자 완결된 갈래는 B로 꺼내지 말고 A로 B를 나르게 | Magicraft 소환 책이 주문을 실어 나름, Isaac 덮어쓰기 교훈 |
| 8. 비싼 B는 여러 번 모아서 | 자주 작용하는 A가 비싼 B를 낼 때는 "Energy"를 모아서, 연쇄는 계수·마스크로 묶기 | PoE2 Energy ∝ 시전 시간, RoR2 proc coefficient |

### 갈래 15개의 "주는 것 / 목마른 것" (초안)

축 여섯 개로 적는다. **때**(언제 터지나), **자리**(어디·누구에게 닿나), **머묾**(적이 범위 안에 머무는 시간), **수**(한 번에 몇 명), **잦음**(얼마나 자주·상시인가), **세기**(한 방의 크기)다.

| 갈래 | 주는 것 (A일 때) | 목마른 것 (B일 때) |
|---|---|---|
| 손공격 | 내가 고른 **자리·때** | **잦음**(손 떼면 0), **수** |
| 총 | **잦음**(빠른 연사), 맞는 순간이 적 위 | **세기**(한 발 약함), **수** |
| 포격 | 먼 무리에 **수·세기** | **때**(착탄 지연), **자리**(앞줄 못 침) |
| 소환수 | 적에 붙어 **머묾**(붙잡기), 자동 추적 | **수**(하나씩 맡음), 생존 |
| 주문 | 큰 **수·세기**, 규칙 변경 | **때·자리**(드물고 언제 쓸지 모름) |
| 함정 | 적이 밟는 정확한 **때·자리**, 묶기(**머묾**) | **잦음**(한 번 쓰고 끝), 적이 와야 함 |
| 공중 | 위에서 넓게 **수** | **때**(그림자 예고 동안 적이 지나감) |
| 돌격 | 한 줄 관통 **수**, 밀어내기 | **자리**(어느 줄인가), **잦음** |
| 음파 | 둘레 밀침·멈칫(**머묾** 조절) | **세기** |
| 회전체 | 오래 남아 반복 타격(**잦음**) | **머묾**(적이 빠져나감), **자리** |
| 장판 | 체류 동안 지속 피해·감속(**머묾**) | **세기**, 적이 지나가면 끝 |
| 광선 | 붙어 있는 동안 커지는 **세기** | **수**(한 줄기), 끊김 |
| 투척 | 튕기며 흩어진 적 **수** | **세기**, 튕길 적이 없으면 낭비 |
| 떼 | 넓게 덮어 약화(받는 피해 증가) | **세기**(직접 피해 약함) |
| 정령 | 처치를 모아 터뜨림, 자동 | **때**(처치가 쌓여야), **세기**(작은 탄) |

이 표로 몇 짝을 돌려 보면 유저 반응이 그대로 재현된다. 방향을 뒤집으면 살아나는 짝도 보인다.

| 짝 (A → B) | B가 목마른 것 ← A가 주는 것 | 판정 |
|---|---|---|
| 함정 → 주문 | 때·자리 ← 때·자리 | 천장 후보 (유저 반응과 일치) |
| 함정 → 공중 | 때 ← 때, 하지만 예고 지연이 남음 | 절반. 예고 없이 바로 내리꽂히게 바꾸면 천장 후보 |
| 함정 → 소환수 | 수·생존 ← 때·자리 | 안 맞음 → 바닥 |
| 소환수 → 함정 (뒤집기) | 적이 와야 함 ← 붙잡기·자동 추적 | 맞음. 짐승이 문 적의 발밑에 덫을 박아 덫을 적에게 배달한다 |
| 장판 → 회전체 | 머묾 ← 감속·체류 | 맞음. 날이 도는 자리에 적이 붙잡힌다 |
| 소환수 → 포격 | 자리(앞줄)·때 ← 붙잡아 멈춘 적 | 맞음. 멈춘 적 위로 포탄이 정확히 떨어진다 |
| 총 → 주문 | 때·자리 ← 잦음·적 위 | 맞음. 단 비싼 주문이라 "N발 맞힐 때마다"로 Energy를 모아야 한다 |

### 210짝 검사표

짝마다 다섯 문항을 0~2점으로 매기고, 지금 쓰는 처치 비율(`check2.ts --v3`)은 바닥선으로 함께 본다.

| 문항 | 0점 | 2점 |
|---|---|---|
| ① 빈틈: B가 목마른 축을 A가 주나 | 안 준다 | 정확히 준다 |
| ② 한 몸: 결과가 한 탄·한 몸·한 장판에 두 성질인가 | 둘이 따로 | 한 몸, 두 부모가 보임 |
| ③ 문턱: 범주가 바뀌는 변화가 있나 | 없음 | 있음 |
| ④ 보이는 인과: A가 바꾼 적 상태가 보이고 B가 그것을 거두나 | 안 보임 | 보임 |
| ⑤ 독립성: 한쪽을 지우면 결과가 달라지나 | 똑같이 돈다 (탈락) | 달라진다 |

8점 이상은 천장 후보, 4~7점은 바닥, 3점 이하는 방향을 뒤집거나(B → A) 다시 짠다. Ballionaire 개발자가 "트리거 하나가 시너지를 내는 상대 수"를 재서 올리려 한 것처럼 ([개발 일지](https://newobject.itch.io/ballionaire/devlog/620660/build-3-released)), 갈래마다 천장 짝이 몇 개인지 세어 **모든 갈래가 A로든 B로든 천장 짝 2개 이상**을 갖게 맞춘다. 점수 매기기는 사람이 해도 되고, 빈틈 표를 데이터로 두면 ①은 자동으로 계산된다.

### 세 층 구조

| 층 | 몇 짝 | 무엇 |
|---|---|---|
| 바닥 | 210 전부 | 지금 v3 일반 규칙. 칸 제한이 없으니 "따로 가진 것보다 조금 낫다"를 지킨다 (지금 ×1.72) |
| 맞물림 보너스 | 빈틈 ①이 맞는 짝 (자동) | 일반 규칙 위에 받은 축만큼 자동 보너스. 때를 받은 B는 쿨다운 비용 없이(Noita의 cast delay 무시), 머묾을 받은 B는 묶인 적에게 ×2 (Genshin 증폭 범위) |
| 천장 | 20~30짝 (갈래당 2~4) | 손으로 짠 새 동작과 문턱, 새 이름, 합성 연출. 이 짝은 일반 규칙 대신 강제한다 (Ball x Pit) |

20~30이라는 크기는 Hades I의 28, VS의 무기당 1개(15개 안팎), Ballionaire 초기 6%(210의 약 13개)에서 잡은 범위다. 천장 짝은 신호를 준다. 두 재료를 다 가지면 Gungeon처럼 표시하고, 레벨 업 선택지가 그 짝을 완성하는 쪽으로 기울게 하며, 합성 순간은 보스 상자처럼 사건으로 만든다. 도감에는 아직 못 만든 칸을 "함정 + ???"처럼 반만 보여 준다. 완전히 숨기는 것은 McMillen의 교훈상 피한다.

### 덫 짝을 빈틈 기준으로 다시 쓴다면 (아이디어 예시)

| 짝 | 지금 (v3) | 빈틈 기준 다시 쓰기 (예) |
|---|---|---|
| 함정 + 소환수 | 밟은 적에 짐승이 튀어나와 붙잡는다 | 방향 뒤집기(소환수 → 함정): 짐승이 문 적의 발밑에 덫이 박힌다. 또는 문턱: 밟은 적이 우리 편 짐승으로 돌아선다 |
| 함정 + 돌격 | 밟힌 자리에서 한 줄을 쓸어 버린다 | 깔고 터뜨리기: 덫이 줄줄이 묶어 세운 적을 돌격이 꿰뚫는다(묶인 적 ×2). 또는 OMD식 밀어 넣기: 돌격이 적을 다른 덫 위로 밀어 넣는다 |
| 함정 + 회전체 | 밟히면 날을 풀어 놓는다 | 머묾 채우기: 날이 묶인 적 둘레에 궤도를 고정하고 돈다. 적이 못 빠져나가는 것이 보인다 |

이 예시들은 검증 전 아이디어다. 프로젝트 방식대로 천장 후보 5~6개를 먼저 연출 미리보기(showcase) 카드로 만들어, 지금 v3 짝과 나란히 보고 고르는 것을 권한다.

### 정해 주실 것

| 결정 | 선택지 | 사례가 가리키는 쪽 |
|---|---|---|
| 합성의 대가 | 재료 둘 다 사라짐 / 하나는 남김 | 둘 다 사라지면 천장급 보상이 필요하다 (Magic Survival·MMBN). 남기면 VS 진화처럼 안전하다 |
| 천장 짝 수와 고르는 법 | 검사표 상위 / 손으로 / 섞어서 | 20~30, 갈래당 2~4 (Hades·VS 규모) |
| 바닥 규칙 | v3 유지 / Ball x Pit식 "둘 다 가짐 + 소폭" | v3 유지가 무난하다. 이미 ×1.72이고 겹친 합성 98%다 |
| 공개 수준 | 다 공개 / 힌트 / 숨김 | 힌트 + 반만 보이는 도감 (Gungeon 표시, Isaac의 실패) |
| 합성 순간 | 평범한 레벨 업 카드 / 보스 상자 같은 사건 | 천장 짝만이라도 사건으로 (VS 상자, Hades 대화) |
| 평가 지표 | 처치 비율만 / 체감 지표 추가 | 추가 권장: B의 명중률·가동률이 오르나, 화면에 새 모양이 있나 |
| 드물게 작용하는 몸 (음파·함정) | 배율을 더 올림 / 깔개 역할로 돌림 | 깔개로 돌리는 쪽 (OMD Barricade·타르는 피해 없이 최고 평가) |

## 결론

지금까지의 헤맴은 "규칙 210개냐, 규칙 하나냐"의 문제가 아니라 **규칙이 어느 축을 건드리느냐**의 문제였다. v2는 축을 건드리지 않고 둘을 나란히 돌렸고, v3는 위치라는 한 축만 건드렸다. 위치에 목마른 갈래(주문, 조금은 공중)에서만 맛이 났던 것은 사례들이 예측하는 그대로다. 그리고 v3의 처치 수는 오히려 매복·톱날 덫 쪽을 가리켰다. 이것은 explosionG에 측정 도구가 하나 빠져 있다는 뜻이기도 하다. 처치 비율은 "세졌나"를 재지만, "플레이어가 아는 한계가 풀렸나"는 재지 못한다. 앞으로의 합성 평가는 빈틈 점수와 처치 비율을 함께 봐야 한다.

"이거랑 이거 섞으면?"이라는 기대도 같은 표에서 나온다. 각 갈래가 무엇을 주고 무엇에 목마른지가 한 문장으로 읽히면, 플레이어는 "덫은 때를 주고, 포격은 때가 없다"처럼 스스로 짝을 떠올린다. 그 예상을 천장 짝의 새 동작과 문턱이 넘어설 때 Giovannetti가 말한 "천재가 된 느낌"이 생긴다. 다음 작업 단위는 짝 210개가 아니라 갈래 15줄이다.
