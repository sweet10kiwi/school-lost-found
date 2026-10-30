// Only the publishable key is public. The server keeps privileged credentials.
globalThis.LOST_FOUND_DB = (() => {
  const url = 'https://ywuwqrisyfpqktsptyyn.supabase.co/functions/v1/school-lost-found';
  const key = 'sb_publishable_CPHXPmy0rMdnd239RxdJLA__DAB8gk9';
  const tokenKey = 'school-lost-found-owner-v1';
  function ownerToken() {
    let token = localStorage.getItem(tokenKey);
    if (!/^[a-f0-9]{64}$/.test(token || '')) {
      token = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(tokenKey, token);
    }
    return token;
  }
  async function request(method, data) {
    let token;
    try { token = ownerToken(); } catch { throw new Error('이 브라우저의 저장 공간을 허용한 뒤 다시 시도해 주세요.'); }
    let response;
    try {
      response = await fetch(url, {method, headers: {'apikey': key, 'Content-Type': 'application/json', 'X-Owner-Token': token}, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(20000)});
    } catch { throw new Error('DB에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    return result;
  }
  return Object.freeze({list: () => request('GET'), create: item => request('POST', item), returned: id => request('PATCH', {id})});
})();
