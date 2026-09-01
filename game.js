/* ============================================================
 * GOLDEN GOOSE 24K — 게임 로직
 *   · 거위를 쓰다듬으면 카운터가 오르고, 가끔 그 자리에서 알을 낳는다
 *   · 3분마다 알을 하나 낳는다 (창을 닫아둔 동안도 누적)
 *   · 치지직 후원 1,000원 = 쓰다듬기 10회 (config.js 에서 조정)
 *
 * UI 원칙
 *   1. 알 획득은 **절대 클릭을 막지 않는다.** 모달 없이 알림 카드만 띄우고 스스로 사라진다.
 *      모달은 사용자가 둥지/도감의 알을 직접 눌렀을 때만 연다.
 *   2. 화면에 즉석 산란 확률(수치)은 노출하지 않는다. 등급 확률만 공개.
 *   3. 후원 누적 금액과 누적 쓰다듬기 횟수는 노출하지 않는다(수입 추정 방지). 건수만 공개.
 *   4. 연동/개발자용 정보는 화면에 두지 않는다.
 * ============================================================ */

const SAVE_KEY = 'gg:save-v1';

/** 후원 밴드에 띄우는 최근 후원 칩 개수 (표시용 창일 뿐, 기록은 전부 보관한다) */
const DON_TICKER_VISIBLE = 30;
/** 화면에 동시에 떠 있는 획득 알림 카드 수 */
const DROP_CARDS_VISIBLE = 4;

/* ---------------- DOM ---------------- */
const $ = (id) => document.getElementById(id);
const el = {
  clickCount: $('clickCount'),
  cps: $('cps'),
  goldGram: $('goldGram'),
  goose: $('gooseBtn'),
  fx: $('fxLayer'),
  timerText: $('timerText'),
  timerFill: $('timerFill'),

  bagGrid: $('bagGrid'),
  bagEmpty: $('bagEmpty'),
  bagTotal: $('bagTotal'),
  bagSort: $('bagSort'),

  dexBody: $('dexBody'),
  dexOwned: $('dexOwned'),
  dexTotal: $('dexTotal'),
  dexPct: $('dexPct'),
  dexFill: $('dexFill'),

  statGrid: $('statGrid'),
  tierStats: $('tierStats'),
  ratesTable: $('ratesTable'),
  k24List: $('k24List'),

  donFeed: $('donFeed'),
  donEmpty: $('donEmpty'),
  donCount: $('donCount'),

  bannerSlot: $('bannerSlot'),
  dropStack: $('dropStack'),
  tierFlash: $('tierFlash'),

  reveal: $('reveal'),
  revealCard: $('revealCard'),

  soundBtn: $('soundBtn'),
  resetBtn: $('resetBtn'),
  saveHint: $('saveHint'),
  chzLogin: $('chzLoginBtn'),
  chzLogout: $('chzLogoutBtn'),
  chzStatus: $('chzStatus'),
};

/* ---------------- 상태 ---------------- */
function freshState() {
  const now = Date.now();
  return {
    clicks: 0,
    drops: 0,
    owned: {}, // id -> { c: 개수, first: 최초획득ms, last: 최근획득ms }
    progress: 0, // 다음 알까지 누적된 ms
    lastSeen: now,
    startedAt: now,
    sound: true,
    // sum / clicks 는 내부 기록용. 화면에는 띄우지 않는다.
    don: { count: 0, sum: 0, clicks: 0, feed: [], seen: [] },
  };
}

let state = freshState();

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    state = Object.assign(freshState(), s);
    state.don = Object.assign({ count: 0, sum: 0, clicks: 0, feed: [], seen: [] }, s.don || {});
    Object.keys(state.owned).forEach((id) => {
      if (!EGG_BY_ID[id]) delete state.owned[id]; // 데이터 개편으로 사라진 알 정리
    });
  } catch (e) {
    console.warn('세이브를 읽지 못해 새로 시작합니다', e);
  }
}

let saveTimer = null;
function save(now) {
  state.lastSeen = Date.now();
  if (now) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    flashSaved();
    return;
  }
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    flashSaved();
  }, 800);
}

let hintTimer = null;
function flashSaved() {
  if (!el.saveHint) return;
  el.saveHint.classList.add('on');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.saveHint.classList.remove('on'), 900);
}

/* ---------------- 서식 ---------------- */
const nf = (n) => Math.floor(n).toLocaleString('ko-KR');

function fmtGram(g) {
  if (g >= 1e6) return (g / 1e6).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + ' t';
  if (g >= 1000) return (g / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + ' kg';
  return g.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' g';
}

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + '일 ' + h + '시간';
  if (h > 0) return h + '시간 ' + m + '분';
  return m + '분';
}

function fmtClock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const tierIdx = (key) => TIERS.findIndex((t) => t.key === key);
const tierOf = (egg) => TIER_BY_KEY[egg.tier];

/* ---------------- 추첨 ---------------- */
const TIER_WEIGHT_SUM = TIERS.reduce((s, t) => s + t.weight, 0);

function rollTier() {
  let r = Math.random() * TIER_WEIGHT_SUM;
  for (const t of TIERS) {
    r -= t.weight;
    if (r < 0) return t;
  }
  return TIERS[0];
}

function rollEgg() {
  const pool = EGGS_BY_TIER[rollTier().key];
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ---------------- 사운드 ---------------- */
let actx = null;
function audio() {
  if (!state.sound) return null;
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(freq, start, dur, type, vol) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol == null ? 0.14 : vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function sfxClick() {
  tone(520 + Math.random() * 120, 0, 0.07, 'triangle', 0.07);
}

function sfxDrop(tierKey) {
  const idx = tierIdx(tierKey);
  const base = 392;
  const steps = [0, 4, 7, 11, 14, 19].slice(0, Math.max(3, idx + 3));
  steps.forEach((st, i) => tone(base * Math.pow(2, st / 12), i * 0.075, 0.34, 'triangle', 0.13));
  if (idx >= 3) {
    steps.forEach((st, i) => tone(base * 2 * Math.pow(2, st / 12), 0.4 + i * 0.06, 0.5, 'sine', 0.1));
  }
}

function sfxDonation() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.07, 0.3, 'square', 0.09));
}

/* ---------------- 획득 ---------------- */
let needRender = false; // 렌더는 프레임당 한 번으로 모은다

function addEgg(egg) {
  const now = Date.now();
  const rec = state.owned[egg.id];
  const isNew = !rec;
  if (isNew) state.owned[egg.id] = { c: 1, first: now, last: now };
  else {
    rec.c += 1;
    rec.last = now;
  }
  state.drops += 1;
  return isNew;
}

/** n개를 낳는다. source: 'timer' | 'click' | 'offline' */
function layEggs(n, source) {
  if (n <= 0) return;
  const got = [];
  for (let i = 0; i < n; i++) {
    const e = rollEgg();
    got.push({ egg: e, isNew: addEgg(e) });
  }
  needRender = true;
  save();

  const best = got.reduce((a, b) => (tierIdx(b.egg.tier) > tierIdx(a.egg.tier) ? b : a));
  sfxDrop(best.egg.tier);

  el.goose.classList.add('is-lay');
  setTimeout(() => el.goose.classList.remove('is-lay'), 720);

  notifyDrop(got, source, best);
}

/* ---------------- 획득 알림 (클릭을 막지 않음) ---------------- */
const HOLD_BY_TIER = [3600, 4000, 4800, 5600, 6600, 7600]; // ms

function pushCard(html, tierColor, hold) {
  const d = document.createElement('div');
  d.className = 'drop-card';
  d.style.setProperty('--tc', tierColor);
  d.style.setProperty('--hold', hold + 'ms');
  d.innerHTML = html;
  el.dropStack.appendChild(d);
  while (el.dropStack.children.length > DROP_CARDS_VISIBLE) el.dropStack.firstChild.remove();
  setTimeout(() => d.remove(), hold + 500);
  return d;
}

function flashScreen(tier) {
  el.tierFlash.style.setProperty('--fc', tier.color + '55');
  el.tierFlash.classList.remove('on');
  void el.tierFlash.offsetWidth; // 리플로우로 애니메이션 재시작
  el.tierFlash.classList.add('on');
  setTimeout(() => el.tierFlash.classList.remove('on'), 1200);
}

function goldLine(egg) {
  return egg.k24 ? ' &middot; <span class="k24">순금 ' + fmtGram(egg.gram) + '</span>' : '';
}

function notifyDrop(list, source, best) {
  const bi = tierIdx(best.egg.tier);
  const hold = HOLD_BY_TIER[bi] || 4000;

  if (list.length === 1) {
    const { egg, isNew } = list[0];
    const t = tierOf(egg);
    const big = bi >= 2 || isNew;
    const card = pushCard(
      eggSvg(egg) +
        '<div class="dc-body">' +
        '<span class="dc-tier">' + t.en + ' &middot; ' + t.name + '</span>' +
        '<b class="dc-name">' + esc(egg.name) + '</b>' +
        '<span class="dc-meta">보유 ' + nf(state.owned[egg.id].c) + '개' + goldLine(egg) + '</span>' +
        '</div>' +
        (isNew ? '<span class="dc-new">NEW</span>' : ''),
      t.color,
      hold
    );
    if (big) card.classList.add('big');
  } else {
    const counts = {};
    let newCount = 0;
    list.forEach((g) => {
      counts[g.egg.id] = (counts[g.egg.id] || 0) + 1;
      if (g.isNew) newCount++;
    });
    const ids = Object.keys(counts).sort((a, b) => tierIdx(EGG_BY_ID[b].tier) - tierIdx(EGG_BY_ID[a].tier));
    const shown = ids.slice(0, 6);
    const rest = ids.length - shown.length;
    const t = tierOf(best.egg);
    const card = pushCard(
      eggSvg(best.egg) +
        '<div class="dc-body">' +
        '<span class="dc-tier">' + (source === 'offline' ? '자리 비운 사이' : '한꺼번에') + '</span>' +
        '<b class="dc-name">알 ' + nf(list.length) + '개를 낳아뒀습니다</b>' +
        '<div class="dc-mini">' + shown.map((id) => eggSvg(EGG_BY_ID[id])).join('') +
        (rest > 0 ? '<span>+' + rest + '종</span>' : '') + '</div>' +
        '</div>' +
        (newCount ? '<span class="dc-new">NEW ' + newCount + '</span>' : ''),
      t.color,
      Math.max(hold, 6000)
    );
    card.classList.add('big');
  }

  if (bi >= 3) flashScreen(tierOf(best.egg));
}

/* ---------------- 클릭 ---------------- */
let clickLog = []; // [시각, 횟수]

function applyClicks(n) {
  state.clicks += n;
  let drops = 0;
  for (let i = 0; i < n; i++) if (Math.random() < CLICK_DROP_CHANCE) drops++;
  el.clickCount.textContent = nf(state.clicks);
  if (drops > 0) layEggs(drops, 'click');
}

function handClick(ev) {
  applyClicks(1);
  clickLog.push([performance.now(), 1]);
  sfxClick();

  el.goose.classList.add('is-press');
  setTimeout(() => el.goose.classList.remove('is-press'), 90);

  const r = el.fx.getBoundingClientRect();
  let x = r.width / 2;
  let y = r.height * 0.42;
  if (ev && ev.clientX) {
    x = ev.clientX - r.left;
    y = ev.clientY - r.top;
  }
  popText('+1', x, y);
  if (Math.random() < 0.35) feather(x, y);
  save();
}

function popText(text, x, y) {
  const d = document.createElement('div');
  d.className = 'fx-pop';
  d.textContent = text;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  el.fx.appendChild(d);
  setTimeout(() => d.remove(), 950);
}

function feather(x, y) {
  const d = document.createElement('div');
  d.className = 'fx-feather';
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  d.style.setProperty('--dx', (Math.random() * 90 - 45).toFixed(0) + 'px');
  el.fx.appendChild(d);
  setTimeout(() => d.remove(), 1550);
}

/* ---------------- 치지직 후원 → 자동 쓰다듬기 ---------------- */
let autoQueue = 0;

function clicksForAmount(amount) {
  return Math.floor(amount / DONATION_UNIT) * CLICKS_PER_1000;
}

function handleDonation(d) {
  if (state.don.seen.indexOf(d.id) >= 0) return; // 중복 수신 방지
  state.don.seen.push(d.id);
  if (state.don.seen.length > 400) state.don.seen.splice(0, state.don.seen.length - 400);

  const ignored = !ACCEPT_VIDEO_DONATION && d.isVideo;
  const gain = ignored ? 0 : clicksForAmount(d.amount);

  state.don.count += 1;
  state.don.sum += d.amount;
  state.don.clicks += gain;
  state.don.feed.unshift({ t: Date.now(), nick: d.nick, message: d.message, gained: gain > 0 });

  if (gain > 0) {
    autoQueue += gain;
    sfxDonation();
    donationBanner(d, gain);
  }
  renderDonations();
  needRender = true; // '받은 후원' 타일도 같이 갱신
  save(true);
}

/** 도착 순간에만 금액을 보여주고 사라진다. 누적 금액은 어디에도 남기지 않는다. */
function donationBanner(d, gain) {
  const b = document.createElement('div');
  b.className = 'don-banner';
  b.innerHTML =
    '<span class="amt">' + nf(d.amount) + '원</span>' +
    '<span class="who">' + esc(d.nick) + '</span>' +
    '<span>&rarr; 쓰다듬기 ' + nf(gain) + '회!</span>';
  el.bannerSlot.appendChild(b);
  setTimeout(() => b.remove(), 5000);
}

/* ---------------- 알 상세 (사용자가 직접 눌렀을 때만) ---------------- */
function showEggDetail(egg) {
  const rec = state.owned[egg.id];
  if (!rec) return;
  const t = tierOf(egg);
  el.revealCard.style.setProperty('--tc', t.color);
  el.revealCard.innerHTML =
    '<span class="reveal-tier">' + t.en + ' &middot; ' + t.name + '</span>' +
    eggSvg(egg, 'reveal-egg') +
    '<h2 class="reveal-name">' + esc(egg.name) + '</h2>' +
    '<p class="reveal-en">' + esc(egg.en) + '</p>' +
    (egg.k24
      ? '<div class="reveal-mat is-k24">재질 &middot; <b>' + esc(egg.mat) + '</b><br>순금 함유량 ' + fmtGram(egg.gram) + '</div>'
      : '<div class="reveal-mat">재질 &middot; ' + esc(egg.mat) + '</div>') +
    '<p class="reveal-meta">보유 <b>' + nf(rec.c) + '</b>개 &middot; 처음 만난 날 ' +
    new Date(rec.first).toLocaleDateString('ko-KR') + '</p>' +
    '<button class="reveal-btn" type="button">닫기</button>';
  el.reveal.hidden = false;
}

function closeReveal() {
  el.reveal.hidden = true;
}

/* ---------------- 렌더 ---------------- */
function eggCell(egg, count, locked) {
  const t = tierOf(egg);
  return (
    '<div class="egg-cell' + (locked ? ' locked' : '') + '" style="--tc:' + t.color + '"' +
    (locked ? '' : ' data-egg="' + egg.id + '"') + '>' +
    '<span class="tier-dot"></span>' +
    (count ? '<span class="cnt">' + nf(count) + '</span>' : '') +
    eggSvg(egg) +
    '<span class="en">' + (locked ? '???' : esc(egg.name)) + '</span>' +
    (egg.k24 ? '<span class="k24-tag">24K</span>' : '') +
    '</div>'
  );
}

const ownedIds = () => Object.keys(state.owned);
const totalEggs = () => ownedIds().reduce((s, id) => s + state.owned[id].c, 0);
const totalGold = () =>
  ownedIds().reduce((s, id) => {
    const e = EGG_BY_ID[id];
    return e && e.k24 ? s + e.gram * state.owned[id].c : s;
  }, 0);

function renderBag() {
  const ids = ownedIds();
  el.bagTotal.textContent = nf(totalEggs());
  el.bagEmpty.hidden = ids.length > 0;
  const mode = el.bagSort.value;
  ids.sort((a, b) => {
    if (mode === 'recent') return state.owned[b].last - state.owned[a].last;
    if (mode === 'count') return state.owned[b].c - state.owned[a].c;
    const d = tierIdx(EGG_BY_ID[b].tier) - tierIdx(EGG_BY_ID[a].tier);
    return d !== 0 ? d : state.owned[b].c - state.owned[a].c;
  });
  el.bagGrid.innerHTML = ids.map((id) => eggCell(EGG_BY_ID[id], state.owned[id].c, false)).join('');
}

function renderDex() {
  const owned = ownedIds().length;
  el.dexOwned.textContent = owned;
  el.dexTotal.textContent = EGGS.length;
  const pct = (owned / EGGS.length) * 100;
  el.dexPct.textContent = pct.toFixed(0) + '%';
  el.dexFill.style.width = pct + '%';
  el.dexBody.innerHTML = TIERS.slice()
    .reverse()
    .map((t) => {
      const pool = EGGS_BY_TIER[t.key];
      const have = pool.filter((e) => state.owned[e.id]).length;
      return (
        '<div class="dex-group" style="--tc:' + t.color + '">' +
        '<div class="dex-group-head"><span class="bar"></span>' +
        '<span style="color:' + t.color + '">' + t.name + '</span>' +
        '<span class="n">' + have + ' / ' + pool.length + '</span></div>' +
        '<div class="egg-grid">' +
        pool.map((e) => eggCell(e, state.owned[e.id] ? state.owned[e.id].c : 0, !state.owned[e.id])).join('') +
        '</div></div>'
      );
    })
    .join('');
}

function renderStats() {
  // 후원 누적 금액 / 누적 쓰다듬기 횟수는 수입이 추정되므로 넣지 않는다.
  const cards = [
    { k: '쓰다듬기', v: nf(state.clicks) },
    { k: '모은 알', v: nf(totalEggs()) },
    { k: '도감', v: ownedIds().length + '<small>/ ' + EGGS.length + '</small>' },
    { k: '함께한 시간', v: fmtDur(Date.now() - state.startedAt) },
    { k: '보유 순금 24K', v: fmtGram(totalGold()), gold: true },
    { k: '받은 후원', v: nf(state.don.count) + '<small>건</small>', gold: true },
  ];
  el.statGrid.innerHTML = cards
    .map((c) => '<div class="stat' + (c.gold ? ' gold' : '') + '"><div class="k">' + c.k + '</div><div class="v">' + c.v + '</div></div>')
    .join('');

  const total = totalEggs() || 1;
  el.tierStats.innerHTML = TIERS.slice()
    .reverse()
    .map((t) => {
      const n = EGGS_BY_TIER[t.key].reduce((s, e) => s + (state.owned[e.id] ? state.owned[e.id].c : 0), 0);
      return (
        '<div class="tier-row" style="--tc:' + t.color + '">' +
        '<span class="dot"></span><span class="nm" style="color:' + t.color + '">' + t.name + '</span>' +
        '<span class="track"><span class="fill" style="width:' + (n / total) * 100 + '%"></span></span>' +
        '<span class="num">' + nf(n) + '개</span></div>'
      );
    })
    .join('');
}

function renderRates() {
  el.ratesTable.innerHTML =
    '<thead><tr><th>등급</th><th>종류</th><th style="text-align:right">확률</th></tr></thead><tbody>' +
    TIERS.slice()
      .reverse()
      .map(
        (t) =>
          '<tr style="--tc:' + t.color + '"><td><span class="nm"><span class="dot"></span>' +
          '<span style="color:' + t.color + '">' + t.name + '</span> <small>' + t.en + '</small></span></td>' +
          '<td>' + EGGS_BY_TIER[t.key].length + '종</td>' +
          '<td class="p">' + t.weight + '%</td></tr>'
      )
      .join('') +
    '</tbody>';

  el.k24List.innerHTML = EGGS.filter((e) => e.k24)
    .map(
      (e) =>
        '<div class="k24-item">' + eggSvg(e) +
        '<span class="t"><b>' + esc(e.name) + '</b><small>' + esc(e.mat) + '</small></span>' +
        '<span class="g">' + fmtGram(e.gram) + '</span></div>'
    )
    .join('');
}

/** 후원 밴드 — 닉네임과 메시지만. 금액은 도착 순간의 배너에만 잠깐 뜬다. */
function renderDonations() {
  const f = state.don.feed;
  el.donCount.textContent = nf(state.don.count);
  el.donEmpty.hidden = f.length > 0;
  const goldEgg = EGG_BY_ID.gold24k;
  el.donFeed.innerHTML = f
    .slice(0, DON_TICKER_VISIBLE)
    .map(
      (d) =>
        '<span class="don-chip">' + eggSvg(goldEgg) +
        '<span class="who">' + esc(d.nick) + '</span>' +
        (d.message ? '<span class="msg">' + esc(d.message) + '</span>' : '') +
        '</span>'
    )
    .join('');
}

function renderGold() {
  el.goldGram.textContent = fmtGram(totalGold());
}

function renderAll() {
  el.clickCount.textContent = nf(state.clicks);
  renderGold();
  renderBag();
  renderDex();
  renderStats();
  renderDonations();
}

/* ---------------- 루프 ---------------- */
let lastTick = performance.now();
let statTick = 0;

function tick(now) {
  const dt = Math.min(1000, now - lastTick);
  lastTick = now;

  state.progress += dt;
  let lay = 0;
  while (state.progress >= DROP_INTERVAL) {
    state.progress -= DROP_INTERVAL;
    lay++;
  }
  if (lay > 0) layEggs(lay, 'timer');

  el.timerText.textContent = fmtClock(DROP_INTERVAL - state.progress);
  el.timerFill.style.width = (state.progress / DROP_INTERVAL) * 100 + '%';

  // 후원 자동 쓰다듬기 소진 (많이 들어와도 6초 안에 다 처리)
  if (autoQueue > 0) {
    const rate = Math.max(20, Math.ceil(autoQueue / 6));
    const n = Math.max(1, Math.min(autoQueue, Math.round((rate * dt) / 1000)));
    autoQueue -= n;
    applyClicks(n);
    clickLog.push([now, n]);
    if (Math.random() < 0.4) {
      const r = el.fx.getBoundingClientRect();
      popText('+' + n, r.width * (0.3 + Math.random() * 0.4), r.height * (0.3 + Math.random() * 0.3));
    }
    if (autoQueue === 0) {
      needRender = true;
      save(true);
    }
  }

  // 초당 쓰다듬기
  const cut = now - 1000;
  while (clickLog.length && clickLog[0][0] < cut) clickLog.shift();
  let per = 0;
  for (let i = 0; i < clickLog.length; i++) per += clickLog[i][1];
  el.cps.textContent = per.toFixed(1);

  if (needRender) {
    needRender = false;
    renderGold();
    renderBag();
    renderDex();
    renderStats();
  }

  // '함께한 시간'만 주기적으로 갱신
  if (now - statTick > 30000) {
    statTick = now;
    renderStats();
  }

  requestAnimationFrame(tick);
}

/* ---------------- 치지직 ---------------- */
function setChzUi() {
  const has = Chzzk.hasToken();
  el.chzLogin.hidden = has;
  el.chzLogout.hidden = !has;
}

function setStatus(s, detail) {
  const label = { off: '연동 꺼짐', connecting: '연결 중', on: '후원 수신 중', error: '오류' }[s] || s;
  el.chzStatus.dataset.s = s;
  el.chzStatus.textContent = label;
  el.chzStatus.title = detail || '';
}

async function initChzzk() {
  Chzzk.onStatus(setStatus);
  Chzzk.onDonation(handleDonation);
  await Chzzk.handleOAuthRedirect();
  setChzUi();
  if (Chzzk.hasToken()) Chzzk.connect();
  else setStatus('off');
}

/* ---------------- 초기화 ---------------- */
function init() {
  load();

  // 자리를 비운 사이 낳아둔 알
  const away = Math.max(0, Date.now() - state.lastSeen);
  state.progress += away;
  let offline = 0;
  while (state.progress >= DROP_INTERVAL) {
    state.progress -= DROP_INTERVAL;
    offline++;
  }

  el.soundBtn.classList.toggle('is-off', !state.sound);
  renderAll();
  renderRates();

  el.goose.addEventListener('click', handClick);

  // 알 상세 — 둥지/도감에서 직접 눌렀을 때만
  document.addEventListener('click', (e) => {
    const cell = e.target.closest && e.target.closest('.egg-cell[data-egg]');
    if (cell) showEggDetail(EGG_BY_ID[cell.dataset.egg]);
  });

  el.bagSort.addEventListener('change', renderBag);

  el.reveal.addEventListener('click', (e) => {
    if (e.target.classList.contains('reveal-btn') || e.target.classList.contains('reveal-bg')) closeReveal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeReveal();
  });

  el.soundBtn.addEventListener('click', () => {
    state.sound = !state.sound;
    el.soundBtn.classList.toggle('is-off', !state.sound);
    if (state.sound) sfxClick();
    save(true);
  });
  el.resetBtn.addEventListener('click', () => {
    if (!confirm('모은 알과 기록이 모두 사라집니다. 정말 처음부터 다시 시작할까요?')) return;
    localStorage.removeItem(SAVE_KEY);
    state = freshState();
    autoQueue = 0;
    renderAll();
    save(true);
  });

  el.chzLogin.addEventListener('click', () => {
    if (Chzzk.hasToken()) Chzzk.connect();
    else Chzzk.startLogin();
  });
  el.chzLogout.addEventListener('click', () => {
    Chzzk.logout();
    setChzUi();
  });

  window.addEventListener('beforeunload', () => save(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save(true);
  });
  setInterval(() => save(true), 15000);

  if (offline > 0) setTimeout(() => layEggs(offline, 'offline'), 500);

  requestAnimationFrame(tick);
  initChzzk();
}

document.addEventListener('DOMContentLoaded', init);

// 콘솔 전용 디버그 (화면에는 노출하지 않는다)
window.__gg = {
  state: () => state,
  lay: (n) => layEggs(n || 1, 'timer'),
  donate: (won, nick, msg) =>
    handleDonation({
      id: 'dbg|' + Date.now() + '|' + Math.random(),
      nick: nick || '테스트후원',
      amount: won,
      message: msg || '',
      isVideo: false,
    }),
};
