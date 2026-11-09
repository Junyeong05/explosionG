# 연쇄 폭발 (explosionG) — 에이전트 메모

구조는 [`README.md`](README.md)·[`docs/architecture.md`](docs/architecture.md), 기획은 [`docs/design/`](docs/design/).

## 포털 보고 (portalShare)

이 프로젝트의 현황은 [Junyeong05/portalShare](https://github.com/Junyeong05/portalShare)에서 관리한다. 포털의 id는 `explosion-g`.

**언제 보고하나**
- 사용자가 "포털 업데이트해줘"라고 할 때
- 의미 있는 단위가 끝났을 때: 기능 완성, PR 머지, 출시/배포, 새 블로커 발생, 사용자 결정이 필요해졌을 때
- 사소한 수정(오타, 리팩터 일부)은 보고하지 않는다

**어떻게**
1. portalShare를 클론 (세션에 없으면 추가)
2. portalShare의 `CLAUDE.md` 규칙대로 `projects/explosion-g/status.json` 갱신 + `log.md` 맨 위에 항목 추가
   - 화면이 바뀌었으면 `screens/` 스크린샷 갱신, 설명할 거리가 있으면 `docs/`에 정리 문서 추가
3. `node scripts/build.mjs --check` 통과 확인 → `status(explosion-g): ...` 로 커밋 → push

## 연출 미리보기 HTML (11-09 유저 요청)

"앞으로는 뭔가 구현하면 어떤 식으로 연출되고 어떤 식으로 싸우는지 HTML로 정리해서 주면 된다."
기능·무기·규칙을 구현하면 **실제로 도는 화면을 HTML 한 파일로** 만들어 사용자에게 보낸다.

- 장면 정의: `tools/showcase/pages/<이름>.ts` — 카드마다 무기·레벨·설명 (`Scene`, `tools/showcase/runtime.ts`)
- 만들기: `npm run showcase -- <이름>` → `docs/showcase/<이름>.html` (실제 sim·렌더 코드를 묶은 한 파일, 외부 의존 없음)
- 카드 = 캔버스(실제 게임 화면이 반복 재생) + 제목·꼬리표 + 무기 + "어떻게 싸우나" 한두 문장. 위에 목차와 속도(1×·0.5×·0.25×)
- 브라우저(Playwright)로 열어 오류 없이 도는지, 폰 너비(390px)에서 가로 스크롤이 없는지 보고 나서 파일을 보낸다
- 예: `docs/showcase/categories.html` (갈래 15개)
