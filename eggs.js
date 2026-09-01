/* ============================================================
 * GOLDEN GOOSE 24K — 알 도감 데이터 + SVG 렌더러
 * 이 파일은 데이터만 담는다. 게임 규칙은 game.js.
 * ============================================================ */

/** 등급표. weight = 알을 낳을 때 이 등급이 뽑힐 확률(%) */
const TIERS = [
  { key: 'common',    name: '일반',   en: 'COMMON',    color: '#9aa7b8', weight: 60   },
  { key: 'uncommon',  name: '고급',   en: 'UNCOMMON',  color: '#4ade80', weight: 25   },
  { key: 'rare',      name: '희귀',   en: 'RARE',      color: '#38bdf8', weight: 10   },
  { key: 'epic',      name: '영웅',   en: 'EPIC',      color: '#c084fc', weight: 4    },
  { key: 'legendary', name: '전설',   en: 'LEGENDARY', color: '#fbbf24', weight: 0.9  },
  { key: 'mythic',    name: '신화',   en: 'MYTHIC',    color: '#fb7185', weight: 0.1  },
];

const TIER_BY_KEY = Object.fromEntries(TIERS.map((t) => [t.key, t]));

/**
 * 알 하나의 정의
 *  id      저장 키 (바꾸면 기존 세이브의 그 알이 사라진다)
 *  name    한국어 이름 / en 영문 이름
 *  tier    등급 키
 *  c1,c2   껍질 그라디언트 색
 *  accent  무늬 색
 *  pattern plain | spots | stripes | cracks | stars | swirl | glow
 *  mat     재질 표기 (24K 순금 강조용)
 *  k24     true 면 "순금 24K" 인증 알
 *  gram    24K 순금 함유량(g) — k24 알만
 */
const EGGS = [
  // ── 일반 ─────────────────────────────────────────────
  { id: 'plain',    name: '맹숭맹숭한 알', en: 'Plain Egg',      tier: 'common',  c1: '#fdfbf5', c2: '#e2dccb', accent: '#cfc7b2', pattern: 'plain',   mat: '석회질 껍질' },
  { id: 'cracked',  name: '금 간 알',      en: 'Cracked Egg',    tier: 'common',  c1: '#f6f1e6', c2: '#dbd2bd', accent: '#a89b80', pattern: 'cracks',  mat: '석회질 껍질 (파손)' },
  { id: 'speckled', name: '얼룩 알',       en: 'Speckled Egg',   tier: 'common',  c1: '#f4ead8', c2: '#d9c8a8', accent: '#8b7355', pattern: 'spots',   mat: '석회질 껍질' },
  { id: 'tiny',     name: '쪼끄만 알',     en: 'Tiny Egg',       tier: 'common',  c1: '#fff6ec', c2: '#f0dcc4', accent: '#d0ab7d', pattern: 'plain',   mat: '석회질 껍질 (미숙)' },
  { id: 'muddy',    name: '흙 묻은 알',    en: 'Muddy Egg',      tier: 'common',  c1: '#cbb79a', c2: '#96805f', accent: '#6b5842', pattern: 'spots',   mat: '흙과 지푸라기' },
  { id: 'lukewarm', name: '미적지근한 알', en: 'Lukewarm Egg',   tier: 'common',  c1: '#ffeedd', c2: '#f3cba2', accent: '#e0a670', pattern: 'stripes', mat: '체온 36.5℃' },
  { id: 'twin',     name: '쌍둥이 알',     en: 'Twin Yolk Egg',  tier: 'common',  c1: '#fff8e6', c2: '#f0dfb2', accent: '#e4c05a', pattern: 'spots',   mat: '노른자 2개' },

  // ── 고급 ─────────────────────────────────────────────
  { id: 'goldleaf', name: '금박 입힌 알',  en: 'Gold Leaf Egg',  tier: 'uncommon', c1: '#fff3c9', c2: '#d9ad4a', accent: '#fffbe8', pattern: 'stripes', mat: '순금 24K 금박 0.12μm', k24: true, gram: 0.05 },
  { id: 'bronze',   name: '청동 알',       en: 'Bronze Egg',     tier: 'uncommon', c1: '#d6934f', c2: '#8c5522', accent: '#ffd9a0', pattern: 'plain',   mat: '청동 Cu88 / Sn12' },
  { id: 'silver',   name: '은 알',         en: 'Silver Egg',     tier: 'uncommon', c1: '#eef2f6', c2: '#9fb0c2', accent: '#ffffff', pattern: 'stripes', mat: '은 925 (스털링)' },
  { id: 'moss',     name: '이끼 알',       en: 'Mossy Egg',      tier: 'uncommon', c1: '#a9c98a', c2: '#5e8347', accent: '#2f4a25', pattern: 'spots',   mat: '이끼와 잔돌' },
  { id: 'candy',    name: '사탕 알',       en: 'Candy Egg',      tier: 'uncommon', c1: '#ffd1e8', c2: '#ff9ac4', accent: '#ffffff', pattern: 'stripes', mat: '설탕 유약' },
  { id: 'cloud',    name: '구름 알',       en: 'Cloud Egg',      tier: 'uncommon', c1: '#e8f4ff', c2: '#b9d6f2', accent: '#ffffff', pattern: 'swirl',   mat: '응결한 수증기' },
  { id: 'marble',   name: '대리석 알',     en: 'Marble Egg',     tier: 'uncommon', c1: '#f7f7f9', c2: '#c5c9d4', accent: '#6b7280', pattern: 'swirl',   mat: '카라라 대리석' },

  // ── 희귀 ─────────────────────────────────────────────
  { id: 'gold24k',  name: '24K 황금 알',   en: '24K Golden Egg', tier: 'rare',    c1: '#ffe888', c2: '#d99512', accent: '#fff8d0', pattern: 'glow',    mat: '순금 24K · 순도 999.9', k24: true, gram: 18.75 },
  { id: 'crystal',  name: '수정 알',       en: 'Crystal Egg',    tier: 'rare',    c1: '#dff6ff', c2: '#79cdf0', accent: '#ffffff', pattern: 'stripes', mat: '무결정 석영' },
  { id: 'lava',     name: '용암 알',       en: 'Lava Egg',       tier: 'rare',    c1: '#ff8a3c', c2: '#7a1a06', accent: '#ffd166', pattern: 'cracks',  mat: '굳은 현무암' },
  { id: 'glacier',  name: '빙하 알',       en: 'Glacier Egg',    tier: 'rare',    c1: '#d9f5ff', c2: '#4aa8d8', accent: '#ffffff', pattern: 'cracks',  mat: '만년빙 (12만 년)' },
  { id: 'stardust', name: '별가루 알',     en: 'Stardust Egg',   tier: 'rare',    c1: '#4b3f9e', c2: '#1b1440', accent: '#ffe9a8', pattern: 'stars',   mat: '성간 먼지' },
  { id: 'rainbow',  name: '무지개 알',     en: 'Rainbow Egg',    tier: 'rare',    c1: '#ff9aa2', c2: '#9ad0ff', accent: '#ffffff', pattern: 'stripes', mat: '굴절광 7색' },
  { id: 'emerald',  name: '에메랄드 알',   en: 'Emerald Egg',    tier: 'rare',    c1: '#7dffc4', c2: '#0e7a55', accent: '#d6fff0', pattern: 'glow',    mat: '에메랄드 원석' },

  // ── 영웅 ─────────────────────────────────────────────
  { id: 'bullion',  name: '골드바 알',     en: 'Bullion Egg',    tier: 'epic',    c1: '#ffe27a', c2: '#b8790a', accent: '#fff6cf', pattern: 'stripes', mat: '순금 24K · 999.9 (1kg 바)', k24: true, gram: 1000 },
  { id: 'aurora',   name: '오로라 알',     en: 'Aurora Egg',     tier: 'epic',    c1: '#7ef9d0', c2: '#5b6cff', accent: '#ffffff', pattern: 'swirl',   mat: '자기폭풍 Kp8' },
  { id: 'thunder',  name: '벼락 맞은 알',  en: 'Thunder Egg',    tier: 'epic',    c1: '#4a4a68', c2: '#16162a', accent: '#ffe14d', pattern: 'cracks',  mat: '낙뢰가 지나간 자리' },
  { id: 'abyss',    name: '심연의 알',     en: 'Abyss Egg',      tier: 'epic',    c1: '#14324a', c2: '#03060f', accent: '#46e0ff', pattern: 'spots',   mat: '수심 12,000 m' },
  { id: 'fossil',   name: '고대 화석 알',  en: 'Fossil Egg',     tier: 'epic',    c1: '#c8b79a', c2: '#6d5a42', accent: '#3b2f22', pattern: 'cracks',  mat: '백악기 퇴적층' },
  { id: 'clockwork',name: '태엽 알',       en: 'Clockwork Egg',  tier: 'epic',    c1: '#d9b98a', c2: '#7a5a2e', accent: '#ffe9b0', pattern: 'stripes', mat: '황동 태엽 · 18K 도금' },

  // ── 전설 ─────────────────────────────────────────────
  { id: 'solar',    name: '태양의 알',     en: 'Solar Egg',      tier: 'legendary', c1: '#fff3a8', c2: '#ff9500', accent: '#ffffff', pattern: 'glow',   mat: '순금 24K · 999.9 (융해 상태)', k24: true, gram: 8000 },
  { id: 'phoenix',  name: '불사조의 알',   en: 'Phoenix Egg',    tier: 'legendary', c1: '#ffd34d', c2: '#ff4d1a', accent: '#fff3c4', pattern: 'glow',   mat: '재와 꺼지지 않는 불씨' },
  { id: 'dragon',   name: '용의 알',       en: 'Dragon Egg',     tier: 'legendary', c1: '#7be08a', c2: '#123a2a', accent: '#ffe14d', pattern: 'spots',  mat: '용린 각질' },
  { id: 'chrono',   name: '시간의 알',     en: 'Chrono Egg',     tier: 'legendary', c1: '#cdb6ff', c2: '#3b2a7a', accent: '#ffe9a8', pattern: 'swirl',  mat: '시간의 침전물' },

  // ── 신화 ─────────────────────────────────────────────
  { id: 'genesis',  name: '창세의 알',     en: 'Genesis Egg',    tier: 'mythic',  c1: '#fff6d8', c2: '#ffb03a', accent: '#ffffff', pattern: 'glow',    mat: '순금 24K · 순도 1000.0', k24: true, gram: 100000 },
  { id: 'cosmos',   name: '우주 알',       en: 'Cosmos Egg',     tier: 'mythic',  c1: '#2b1b6b', c2: '#07040f', accent: '#ffffff', pattern: 'stars',   mat: '암흑물질' },
  { id: 'goosegod', name: '거위신의 알',   en: 'Goosegod Egg',   tier: 'mythic',  c1: '#ffffff', c2: '#ffd76a', accent: '#ff9ad4', pattern: 'glow',    mat: '순금 24K · 계량 불가', k24: true, gram: 1000000 },
];

const EGG_BY_ID = Object.fromEntries(EGGS.map((e) => [e.id, e]));
const EGGS_BY_TIER = Object.fromEntries(
  TIERS.map((t) => [t.key, EGGS.filter((e) => e.tier === t.key)])
);

/* ---------------- SVG 렌더러 ---------------- */

const EGG_PATH = 'M50 6C74 6 93 40 93 66C93 92 74 108 50 108C26 108 7 92 7 66C7 40 26 6 50 6Z';
let _uid = 0;

function patternMarkup(egg, clipId) {
  const a = egg.accent;
  switch (egg.pattern) {
    case 'spots':
      return `<g clip-path="url(#${clipId})" fill="${a}" opacity=".55">
        <circle cx="30" cy="40" r="7"/><circle cx="63" cy="32" r="5"/>
        <circle cx="72" cy="62" r="8"/><circle cx="38" cy="74" r="6"/>
        <circle cx="55" cy="92" r="4.5"/><circle cx="22" cy="60" r="4"/></g>`;
    case 'stripes':
      return `<g clip-path="url(#${clipId})" stroke="${a}" stroke-width="6" opacity=".5" stroke-linecap="round">
        <path d="M-10 40 L110 12"/><path d="M-10 66 L110 38"/>
        <path d="M-10 92 L110 64"/><path d="M-10 118 L110 90"/></g>`;
    case 'cracks':
      return `<g clip-path="url(#${clipId})" stroke="${a}" stroke-width="3" fill="none" opacity=".8" stroke-linejoin="round" stroke-linecap="round">
        <path d="M18 46 L34 54 L26 68 L42 78 L36 96"/>
        <path d="M70 26 L62 44 L76 52 L68 70"/></g>`;
    case 'stars':
      return `<g clip-path="url(#${clipId})" fill="${a}">
        <path d="M32 38 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" opacity=".95"/>
        <path d="M68 60 l2.5 6.5 6.5 2.5 -6.5 2.5 -2.5 6.5 -2.5 -6.5 -6.5 -2.5 6.5 -2.5z" opacity=".85"/>
        <circle cx="52" cy="26" r="2" opacity=".9"/><circle cx="26" cy="78" r="1.8" opacity=".8"/>
        <circle cx="76" cy="34" r="1.6" opacity=".7"/><circle cx="58" cy="92" r="2.2" opacity=".85"/></g>`;
    case 'swirl':
      return `<g clip-path="url(#${clipId})" stroke="${a}" stroke-width="5" fill="none" opacity=".5" stroke-linecap="round">
        <path d="M12 78 q26 -34 52 -18 q22 14 4 34"/><path d="M20 44 q24 -26 50 -12"/></g>`;
    case 'glow':
      return `<g clip-path="url(#${clipId})">
        <ellipse cx="50" cy="58" rx="42" ry="48" fill="${a}" opacity=".26"/>
        <ellipse cx="50" cy="58" rx="24" ry="30" fill="${a}" opacity=".3"/></g>`;
    default:
      return '';
  }
}

/** 알 하나를 인라인 SVG 문자열로 */
function eggSvg(egg, cls) {
  const n = ++_uid;
  const g = 'eg' + n;
  const c = 'ec' + n;
  return `<svg class="egg ${cls || ''}" viewBox="0 0 100 114" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${g}" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="${egg.c1}"/><stop offset="100%" stop-color="${egg.c2}"/>
    </linearGradient>
    <clipPath id="${c}"><path d="${EGG_PATH}"/></clipPath>
  </defs>
  <path d="${EGG_PATH}" fill="url(#${g})"/>
  ${patternMarkup(egg, c)}
  <ellipse cx="35" cy="33" rx="12" ry="17" fill="#fff" opacity=".34" transform="rotate(-18 35 33)"/>
  <path d="${EGG_PATH}" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="2"/>
</svg>`;
}
