// 4차시: 설명 가능한 규칙 기반 점수. 점수는 일치 확률이 아니다.
(function () {
  const detailed = new Set(['classroom-grade1', 'classroom-grade2', 'classroom-grade3', 'stairs', 'restroom', 'water-station', 'shoe-lockers']);
  // 실제 학교 배치 확인 전에는 명칭상 관계가 분명한 한 쌍만 사용한다.
  const adjacent = [['cafeteria', 'cafeteria-entrance']];
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const known = value => !!normalize(value) && !['other', 'unknown', '모름', '장소 모름', '없음', '기타'].includes(normalize(value));
  function day(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
    const time = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / 86400000 : NaN;
  }
  function tokens(value) {
    return new Set(normalize(value).split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 2 && known(word) && !['있음', '있어요', '물건', '특징', '입니다'].includes(word)));
  }
  function score(query, candidate) {
    const parts = [];
    for (const [key, label] of [['color', '색상'], ['itemType', '종류']]) {
      const match = known(query[key]) && query[key] === candidate[key];
      parts.push({label, points: match ? 3 : 0, reason: match ? '동일' : '불일치 또는 기타'});
    }
    const samePlace = known(query.location) && query.location === candidate.location &&
      (!detailed.has(query.location) || (known(query.locationDetail) && normalize(query.locationDetail) === normalize(candidate.locationDetail)));
    const near = adjacent.some(pair => pair.includes(query.location) && pair.includes(candidate.location) && query.location !== candidate.location);
    parts.push({label: '장소', points: samePlace || near ? 2 : 0, reason: samePlace ? '동일 장소 (세부 위치 필요 장소는 세부 입력도 일치)' : near ? '급식실 ↔ 급식실 앞 인접' : '장소 또는 세부 위치 불일치·모름'});
    const gap = Math.abs(day(query.date) - day(candidate.date));
    parts.push({label: '날짜', points: gap <= 3 ? 2 : 0, reason: Number.isFinite(gap) ? `${gap}일 차이 (3일 이내 가산)` : '유효한 날짜 없음'});
    const otherWords = tokens(candidate.features);
    const common = [...tokens(query.features)].filter(word => otherWords.has(word));
    parts.push({label: '특징', points: common.length ? 2 : 0, reason: common.length ? `공통 단어: ${common.join(', ')}` : '공통 단어 없음'});
    return {candidate, parts, total: parts.reduce((sum, part) => sum + part.points, 0), gap};
  }
  function rank(query, candidates) {
    if (!['lost', 'found'].includes(query.type)) return [];
    return candidates.filter(item => item.type === (query.type === 'lost' ? 'found' : 'lost') && item.status !== 'returned' && (!query.id || item.id !== query.id))
      .map(item => score(query, item)).filter(item => item.total > 0)
      .sort((a, b) => b.total - a.total || (Number.isFinite(a.gap) ? a.gap : Infinity) - (Number.isFinite(b.gap) ? b.gap : Infinity) || String(a.candidate.id).localeCompare(String(b.candidate.id), 'en'));
  }
  globalThis.LOST_FOUND_MATCHING = Object.freeze({score, rank});
})();
