/* ============================================================
 * 배포 전에 개발자가 채워 두는 값.
 * 여기만 채워두면 스트리머는 [치지직 로그인] → [동의] 두 번만 누르면 된다.
 * ============================================================ */

/** 치지직 개발자센터 Client ID (공개돼도 되는 값) */
const PRESET_CLIENT_ID = '95337781-0490-4c9b-ac9a-9577a9ef4db0';

/** CORS 프록시(Cloudflare Worker) 주소.
 *  openapi.chzzk.naver.com 은 브라우저에서 직접 호출이 막혀 있어 REST는 이걸 거친다.
 *  Client Secret 은 이 코드가 아니라 워커의 환경변수(CHZZK_CLIENT_SECRET)에만 존재한다.
 *  ※ 먹방룰렛과 같은 워커를 공유한다. 따로 쓰고 싶으면 워커를 새로 배포하고 주소만 바꾸면 된다. */
const PRESET_PROXY_URL = 'https://mukbang-proxy.1117tkdrms.workers.dev';

/* ---------------- 게임 규칙 ---------------- */

/** 도네이션 1,000원당 쓰다듬기 횟수 */
const CLICKS_PER_1000 = 10;

/** 도네이션 인정 단위(원). 이 단위로 내림해서 환산한다. 1,500원 → 1,000원분(10회) */
const DONATION_UNIT = 1000;

/** 거위가 스스로 알을 낳는 주기(ms) */
const DROP_INTERVAL = 3 * 60 * 1000;

/** 쓰다듬기 1회당 즉석에서 알을 낳을 확률 */
const CLICK_DROP_CHANCE = 0.004;

/** 영상 도네도 인정할지 */
const ACCEPT_VIDEO_DONATION = true;
