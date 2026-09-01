/* ============================================================
 * 치지직 Open API 연동 (바닐라 JS 포팅)
 *   OAuth 로그인 → 세션 생성(Socket.IO) → 후원(DONATION) 이벤트 구독
 *
 * 주의 1. openapi.chzzk.naver.com 은 브라우저 CORS를 허용하지 않는다.
 *         → REST(토큰/세션/구독)는 반드시 프록시 워커를 경유.  웹소켓은 직접 연결.
 * 주의 2. 치지직 세션 서버는 Socket.IO 2.0.3 까지만 지원한다.
 *         → vendor/socket.io-2.5.0.slim.js (v2 계열) 고정. v4 클라이언트는 붙지 않는다.
 * ============================================================ */

const Chzzk = (function () {
  const DIRECT_API = 'https://openapi.chzzk.naver.com';
  const LS_TOKEN = 'gg:chzzk-token';
  const LS_STATE = 'gg:oauth-state';

  let socket = null;
  let statusCb = function () {};
  let donationCb = function () {};
  let reconnectTimer = null;
  let reconnectDelay = 5000;
  let manualOff = true;

  function apiBase() {
    return (PRESET_PROXY_URL || '').trim().replace(/\/+$/, '') || DIRECT_API;
  }

  function tokens() {
    try {
      return JSON.parse(localStorage.getItem(LS_TOKEN) || 'null');
    } catch (e) {
      return null;
    }
  }

  function saveTokens(t) {
    if (t) localStorage.setItem(LS_TOKEN, JSON.stringify(t));
    else localStorage.removeItem(LS_TOKEN);
  }

  function msg(e) {
    if (e instanceof TypeError) return '네트워크/CORS 차단 — 프록시 주소를 확인하세요';
    return e instanceof Error ? e.message : String(e);
  }

  /** 개발자센터에 등록해야 하는 로그인 리디렉션 URI */
  function redirectUri() {
    return location.origin + location.pathname;
  }

  function startLogin() {
    if (!PRESET_CLIENT_ID) {
      alert('config.js 의 PRESET_CLIENT_ID 가 비어 있습니다.');
      return;
    }
    const state =
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    localStorage.setItem(LS_STATE, state);
    const u = new URL('https://chzzk.naver.com/account-interlock');
    u.searchParams.set('clientId', PRESET_CLIENT_ID);
    u.searchParams.set('redirectUri', redirectUri());
    u.searchParams.set('state', state);
    location.href = u.toString();
  }

  async function tokenRequest(extra) {
    const body = Object.assign({ clientId: PRESET_CLIENT_ID }, extra);
    const res = await fetch(apiBase() + '/auth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(function () {
      return null;
    });
    if (!res.ok || !json || !json.content || !json.content.accessToken) {
      throw new Error((json && json.message) || 'HTTP ' + res.status);
    }
    return {
      accessToken: json.content.accessToken,
      refreshToken: json.content.refreshToken || '',
    };
  }

  /** 로그인 후 돌아온 ?code= 를 토큰으로 교환 */
  async function handleOAuthRedirect() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const st = params.get('state');
    if (!code) return false;
    history.replaceState(null, '', location.pathname);
    if (!st || st !== localStorage.getItem(LS_STATE)) {
      statusCb('error', 'OAuth state 불일치 — 다시 로그인해주세요');
      return false;
    }
    localStorage.removeItem(LS_STATE);
    try {
      saveTokens(await tokenRequest({ grantType: 'authorization_code', code: code, state: st }));
      return true;
    } catch (e) {
      statusCb('error', '토큰 교환 실패: ' + msg(e));
      return false;
    }
  }

  async function api(path, init, retry) {
    init = init || {};
    if (retry === undefined) retry = true;
    const t = tokens();
    if (!t) throw new Error('로그인이 필요합니다');
    const res = await fetch(apiBase() + path, {
      method: init.method || 'GET',
      headers: Object.assign({}, init.headers, {
        Authorization: 'Bearer ' + t.accessToken,
        'Content-Type': 'application/json',
      }),
      body: init.body,
    });
    if (res.status === 401 && retry && t.refreshToken) {
      saveTokens(await tokenRequest({ grantType: 'refresh_token', refreshToken: t.refreshToken }));
      return api(path, init, false);
    }
    const json = await res.json().catch(function () {
      return null;
    });
    if (!res.ok) throw new Error((json && json.message) || 'HTTP ' + res.status);
    return json;
  }

  function parseEvent(raw) {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    return raw;
  }

  async function subscribeDonation(sessionKey) {
    try {
      await api(
        '/open/v1/sessions/events/subscribe/donation?sessionKey=' + encodeURIComponent(sessionKey),
        { method: 'POST' }
      );
    } catch (e) {
      statusCb('error', '후원 구독 실패: ' + msg(e));
    }
  }

  function openSocket(url) {
    statusCb('connecting', '웹소켓 연결 중...');
    if (typeof io !== 'function') {
      statusCb('error', 'socket.io 로더를 찾지 못했습니다 (vendor 스크립트 확인)');
      return;
    }
    const s = io(url, {
      reconnection: false,
      transports: ['websocket'],
      timeout: 8000,
      forceNew: true,
    });
    socket = s;

    s.on('SYSTEM', function (raw) {
      const ev = parseEvent(raw);
      if (!ev) return;
      if (ev.type === 'connected' && ev.data && ev.data.sessionKey) {
        subscribeDonation(ev.data.sessionKey);
      } else if (ev.type === 'subscribed') {
        reconnectDelay = 5000;
        statusCb('on', '후원 수신 중');
      } else if (ev.type === 'revoked') {
        statusCb('error', '이벤트 구독이 해제되었습니다(revoked)');
      }
    });

    s.on('DONATION', function (raw) {
      const d = parseEvent(raw);
      if (!d) return;
      const amount = Number(d.payAmount) || 0;
      const nick = d.donatorNickname || '익명';
      const text = d.donationText || '';
      donationCb({
        // 같은 사람이 3초 내 같은 금액·메시지를 중복 수신할 때만 걸러낸다
        id: 'chzzk|' + nick + '|' + amount + '|' + text + '|' + Math.floor(Date.now() / 3000),
        nick: nick,
        amount: amount,
        message: text,
        isVideo: String(d.donationType || '').toUpperCase().indexOf('VIDEO') >= 0,
      });
    });

    s.on('disconnect', function () {
      if (!manualOff) {
        statusCb('error', '연결 끊김 — 재연결 시도');
        scheduleReconnect();
      }
    });
    s.on('connect_error', function () {
      statusCb('error', '웹소켓 연결 실패');
      scheduleReconnect();
    });
    s.on('connect_timeout', function () {
      statusCb('error', '웹소켓 연결 시간 초과');
      scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (manualOff || reconnectTimer !== null) return;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      if (!manualOff) connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 60000);
  }

  function disconnectSocket() {
    if (socket) {
      try {
        socket.disconnect();
      } catch (e) {
        /* 이미 끊긴 소켓 */
      }
      socket = null;
    }
  }

  /** 세션 연결 + 후원 이벤트 구독 */
  async function connect() {
    manualOff = false;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    disconnectSocket();
    statusCb('connecting', '세션 URL 요청 중...');
    try {
      const auth = await api('/open/v1/sessions/auth');
      const url = auth && auth.content && auth.content.url;
      if (!url) throw new Error('세션 URL을 받지 못했습니다');
      openSocket(url);
    } catch (e) {
      statusCb('error', msg(e));
      scheduleReconnect();
    }
  }

  function disconnect() {
    manualOff = true;
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    disconnectSocket();
    statusCb('off');
  }

  function logout() {
    disconnect();
    saveTokens(null);
  }

  return {
    hasToken: function () {
      return tokens() !== null;
    },
    redirectUri: redirectUri,
    startLogin: startLogin,
    handleOAuthRedirect: handleOAuthRedirect,
    connect: connect,
    disconnect: disconnect,
    logout: logout,
    onStatus: function (cb) {
      statusCb = cb;
    },
    onDonation: function (cb) {
      donationCb = cb;
    },
  };
})();
