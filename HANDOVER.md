# HANDOVER — GOLDEN GOOSE 24K

> 다음 세션(사람/AI 누구든)이 이 문서만 읽고 이어서 작업할 수 있도록 남기는 인수인계 문서.
> 마지막 업데이트: **2026-09-01** · 상태: **개발 완료, GitHub Pages 배포 완료, 치지직 실연동 확인 전**

## 1. 한눈에 보기

| 항목 | 값 |
|---|---|
| 무엇 | 순금 24K 황금알을 낳는 거위 — 클릭 카운터 + 랜덤 등급 드롭 + 도감 수집형 클리커 |
| 원안 | Steam [Banana](https://store.steampowered.com/app/2923300/Banana/) — 클릭 카운터 / 시간마다 등급 드롭 / 인벤토리 수집 구조를 그대로 차용 |
| 라이브 | https://goormigrm.github.io/golden-goose/ |
| 저장소 | https://github.com/goormigrm/golden-goose (main push → Pages 자동 반영, 빌드 없음) |
| 스택 | **빌드 없음.** 정적 HTML/CSS/바닐라 JS + socket.io-client **2.5.0 고정**(vendor 폴더) |
| 치지직 앱 | 먹방룰렛과 **같은 앱·같은 프록시 공유** · Client ID `95337781-0490-4c9b-ac9a-9577a9ef4db0` |
| 프록시 | https://mukbang-proxy.1117tkdrms.workers.dev (Cloudflare, 계정 1117tkdrms) |
| 관련 저장소 | [mukbang-roulette](https://github.com/goormigrm/mukbang-roulette) — 치지직 연동 원본, `proxy/worker.js` 정본 |

**검증 상태**: 로컬 서버에서 클릭·정기 산란·즉석 산란·도감·후원 환산(테스트 후원)·저장/복원 전부 동작 확인.
**배포 검증(2026-09-01)**: 정적 파일 7개 전부 200, 콘솔 에러 없음, `io`/`Chzzk`/`__gg` 로드 확인,
사이트가 계산한 리디렉션 URI = `https://goormigrm.github.io/golden-goose/`,
프록시 워커가 이 오리진을 CORS 허용함(`OPTIONS /open/v1/sessions/auth` → `Access-Control-Allow-Origin` 확인).

**아직 안 한 것**: **개발자센터에 리디렉션 URI 등록**(안 하면 로그인에서 튕김), 치지직 로그인 성공 확인, 실도네 E2E.

## 2. 확정된 규칙

- **쓰다듬기**: 거위 클릭 1회 = 카운터 +1. 상한 없음.
- **즉석 산란**: 쓰다듬기 1회마다 0.4%(`CLICK_DROP_CHANCE`) 확률로 알 1개.
- **정기 산란**: 3분(`DROP_INTERVAL`)마다 1개. 창을 닫아둔 시간도 누적되어 복귀 시 한꺼번에 지급(**상한 없음** — 임의 제약 금지 원칙).
- **등급 확률**: 일반 60 / 고급 25 / 희귀 10 / 영웅 4 / 전설 0.9 / 신화 0.1 (%). 등급을 먼저 뽑고, 같은 등급 안에서는 균등.
- **알 34종**. 그중 **6종이 순금 24K(순도 999.9)** — 금박 0.05g / 24K황금알 18.75g / 골드바 1kg / 태양 8kg / 창세 100kg / 거위신 1t. 보유 순금 총량을 g→kg→t로 환산 표시.
- **후원 환산**: 1,000원 = 쓰다듬기 10회. 1,000원 단위 내림. 상한 없음. 영상 후원 인정(`ACCEPT_VIDEO_DONATION`).
  환산된 자동 쓰다듬기는 **6초에 걸쳐 소진**되고, 그 클릭에도 즉석 산란 확률이 그대로 적용된다.
- **연출 규칙**: 쓰다듬다 나온 흔한(일반/고급) 중복 알은 토스트로만, 그 외(새 알·희귀 이상·여러 개·오프라인 누적)는 큰 모달.
- **저장**: localStorage `gg:save-v1`. 0.8초 디바운스 + 15초 주기 + 탭 숨김/종료 시 즉시 저장.

## 3. 아키텍처

```
[GitHub Pages 정적 파일] ──REST──> [Cloudflare Worker 프록시] ──> openapi.chzzk.naver.com
        └──────웹소켓(Socket.IO 2.x, 후원 실시간)──직접──> 치지직 세션 서버
```

- openapi.chzzk.naver.com은 **브라우저 CORS 차단** → REST(토큰/세션/구독)만 워커 경유. 웹소켓은 직접.
- Client Secret은 **워커 Secret 환경변수에만** 존재. 이 저장소·프론트에 없음.
- 치지직 세션 서버는 **Socket.IO 2.0.3까지만** 지원 → `vendor/socket.io-2.5.0.slim.js` 고정. v4 클라이언트는 붙지 않는다.
- 빌드 도구가 없어 `index.html`을 그대로 서빙하면 끝. Pages는 `Deploy from a branch` (main / root).

### 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 구조, 거위 SVG, 24K 인증 각인 SVG |
| `styles.css` | 다크+금색 테마 전체 |
| `config.js` | **규칙 상수 + Client ID + 프록시 주소** — 값 조정은 여기만 |
| `eggs.js` | 등급표 `TIERS`, 알 34종 `EGGS`, 알 SVG 렌더러 `eggSvg()` |
| `chzzk.js` | OAuth → 세션 → 후원 구독 + 지수 백오프 재연결 (`rr/src/chzzk.ts`의 바닐라 포팅) |
| `game.js` | 상태/저장, 클릭, 산란, 후원 환산 큐, 렌더, 연출 |
| `vendor/` | socket.io-client 2.5.0 slim (mukbang-roulette의 node_modules에서 복사) |

## 4. 체인지로그

1. (초기) 게임 코어 — 거위 SVG, 클릭 카운터, 3분 정기 산란 + 0.4% 즉석 산란, 알 34종/6등급, 도감·둥지·기록·확률 탭, localStorage 저장, 오프라인 누적 지급, WebAudio 효과음
2. **24K 순금 강조**(사용자 요청) — 헤더 24K 칩, 회전하는 순금 인증 각인(999.9), 24K 스트립(보유 순금 실시간), 알마다 재질 표기, 순금 6종에 함유량 부여 + 확률 탭에 24K 목록, 알 카드 24K 태그
3. **치지직 후원 연동**(사용자 요청) — 1,000원 = 쓰다듬기 10회. `chzzk.js` 포팅, 후원 탭(내역/합계/테스트 후원/리디렉션 URI 안내), 후원 배너 연출, 자동 쓰다듬기 큐(6초 소진), 초당 쓰다듬기(cps)에 자동분 반영
4. 문서 — README / `docs/공지글-모음.md` / 이 문서

## 5. 다음 할 일 (우선순위순)

1. ~~GitHub 저장소 생성 + Pages 배포~~ **완료** (2026-09-01, 저장소명 `golden-goose`)
2. **개발자센터에 리디렉션 URI 추가** — `https://goormigrm.github.io/golden-goose/`
   먹방룰렛 앱에 URI를 하나 더 등록하는 방식(권장). 앱을 나누고 싶으면 새 앱 등록 후 `config.js`의 `PRESET_CLIENT_ID` 교체.
   등록 후 사이트에서 [치지직 로그인] → 동의 → 배지가 🟢 후원 수신 중이 되는지 확인.
3. **실도네 E2E** — 방송 켜고 소액 후원 → 배너/카운터/후원 탭 반영 확인
4. (선택) 워커 `ALLOWED_ORIGINS`를 쓰기로 했다면 이 사이트 오리진도 추가해야 함 (현재는 빈 배열 = 전체 허용)
5. (아이디어, 미구현) 알 판매·업그레이드·부화, 도감 완성 보상, 후원자별 기여 순위, OBS용 컴팩트 모드

## 6. 저장소 이름 후보

| 이름 | 이유 |
|---|---|
| **`golden-goose`** (1순위) | 게임 타이틀 그대로. 짧고 검색·기억이 쉽고 URL이 `goormigrm.github.io/golden-goose/`로 깔끔. 지금 문서들이 이 이름 기준으로 쓰여 있음 |
| `golden-goose-24k` | 24K를 이름에서부터 못 박고 싶을 때. URL이 조금 길어짐 |
| `honk24` | 거위 울음(honk) + 24K. 짧고 밈스러움. 다만 뭘 하는 저장소인지 이름만으론 모름 |
| `egggg` | Banana가 그냥 "Banana"였던 것처럼 극단적 미니멀. 재미는 있지만 검색성 최악 |

## 7. 개발 환경 메모 (이 PC 기준)

- **npm install 필요 없음.** `index.html`을 열면 돌아간다. OAuth를 테스트할 때만 서버가 필요하다(`npx serve .`).
- 이 세션에서는 mukbang-roulette의 vite를 빌려 `.claude/launch.json`에 임시 `goose` 설정을 만들어 8899 포트로 띄워 검증했다(작업 후 제거함).
- 콘솔 디버그: `__gg.state()` / `__gg.lay(n)` / `__gg.donate(원)`.
- git 커밋 메시지에 한글+특수문자를 쓸 때 PowerShell here-string이 깨질 수 있음 → 메시지 파일 + `git commit -F` 사용.
- 사용자 원칙: **요구하지 않은 임의 제약(개수 상한·글자수 컷 등) 금지.** 필요하면 먼저 물어볼 것.
