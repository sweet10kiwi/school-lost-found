// 4회차: DB 저장·조회·추천·작성 브라우저의 반환 완료.
const dialog = document.querySelector('#registration-dialog');
const form = document.querySelector('#registration-form');
const preview = document.querySelector('#input-preview');
const fields = form.elements;
const categories = globalThis.LOST_FOUND_CATEGORIES;
let registrationType = 'lost';
let currentValues = null;
const results = document.querySelector('#match-results');
const db = globalThis.LOST_FOUND_DB;
let savedPost = null;
let draftId = null;
let saving = false;
let dialogVersion = 0;
for (const [field, list] of [['color', categories.colors], ['itemType', categories.itemTypes], ['location', categories.locations]]) {
  for (const item of list) fields[field].add(new Option(item.label, item.id));
}
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function updateLocation() {
  const location = fields.location.value;
  const classroom = location.startsWith('classroom-');
  const needsDetail = classroom || ['stairs', 'restroom', 'water-station', 'shoe-lockers', 'other'].includes(location);
  fields.locationDetail.required = needsDetail;
  document.querySelector('#detail-label').textContent = classroom ? '반·세부 위치 (필수)' : `세부 위치 (${needsDetail ? '필수' : '선택'})`;
  fields.locationDetail.placeholder = classroom ? '예: 5반, 창가 쪽 자리' : '예: 본관 2층 / 장소를 모르면 모름';
  fields.locationDetail.setCustomValidity('');
}
document.querySelectorAll('[data-register]').forEach((button) => {
  button.addEventListener('click', () => {
    if (saving) return;
    dialogVersion++;
    registrationType = button.dataset.register;
    const found = registrationType === 'found';
    form.reset();
    currentValues = null;
    savedPost = null;
    draftId = crypto.randomUUID();
    document.querySelector('#save-input').disabled = false;
    document.querySelector('#save-input').textContent = '게시글 저장';
    document.querySelector('#save-status').textContent = '';
    document.querySelector('#edit-input').hidden = false;
    document.querySelector('.preview-note').textContent = '입력값을 확인했습니다. 아직 저장되거나 게시되지 않았습니다.';
    results.hidden = true;
    for (const field of form.querySelectorAll('input, select, textarea')) field.setCustomValidity('');
    fields.date.max = localToday();
    fields.storageLocation.disabled = !found;
    fields.storageLocation.required = found;
    document.querySelector('#storage-field').hidden = !found;
    document.querySelector('#dialog-title').textContent = found ? '습득물 등록' : '분실물 등록';
    document.querySelector('#location-label').textContent = `${found ? '발견한' : '잃어버린'} 장소 (필수)`;
    document.querySelector('#date-label').textContent = `${found ? '발견한' : '잃어버린'} 날짜 (필수)`;
    updateLocation();
    preview.hidden = true;
    document.querySelector('#preview-values').replaceChildren();
    form.hidden = false;
    dialog.showModal();
    dialog.scrollTop = 0;
    fields.color.focus();
  });
});
fields.location.addEventListener('change', updateLocation);
form.addEventListener('input', (event) => event.target.setCustomValidity?.(''));
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
document.querySelector('#edit-input').addEventListener('click', () => {
  if (saving || savedPost) return;
  dialogVersion++;
  results.hidden = true;
  preview.hidden = true;
  form.hidden = false;
  fields.color.focus();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  for (const field of form.querySelectorAll('input:not([type="date"]), textarea')) {
    if (field.disabled) continue;
    field.value = field.value.trim();
    field.setCustomValidity(field.required && !field.value ? '공백만 입력할 수 없습니다. 내용을 입력해 주세요.' : '');
  }
  fields.date.max = localToday();
  if (!form.reportValidity()) return;
  const values = Object.fromEntries(new FormData(form));
  values.type = registrationType;
  values.id = draftId;
  currentValues = values;
  results.hidden = true;
  const labelFor = (list, id) => list.find(item => item.id === id).label;
  const rows = [
    ['등록 유형', registrationType === 'found' ? '습득물' : '분실물'],
    ['색상', labelFor(categories.colors, values.color)],
    ['물건 종류', labelFor(categories.itemTypes, values.itemType)],
    [registrationType === 'found' ? '발견한 장소' : '잃어버린 장소', labelFor(categories.locations, values.location)],
    ['세부 위치', values.locationDetail || '입력하지 않음'],
    [registrationType === 'found' ? '발견한 날짜' : '잃어버린 날짜', values.date],
    ['물건 특징', values.features]
  ];
  if (registrationType === 'found') rows.push(['현재 보관 장소', values.storageLocation]);
  const list = document.querySelector('#preview-values');
  list.replaceChildren();
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    list.append(dt, dd);
  }
  form.hidden = true;
  preview.hidden = false;
  preview.focus();
});

document.querySelector('#match-input').addEventListener('click', async () => {
  if (!currentValues) return;
  const version = dialogVersion;
  const button = document.querySelector('#match-input');
  button.disabled = true;
  results.hidden = false;
  document.querySelector('#match-list').replaceChildren();
  document.querySelector('#match-count').textContent = 'DB의 최신 게시글을 비교하고 있습니다.';
  try {
    const {posts} = await db.list();
    if (version !== dialogVersion) return;
    renderMatches(globalThis.LOST_FOUND_MATCHING.rank(currentValues, posts));
  } catch (error) {
    if (version === dialogVersion) document.querySelector('#match-count').textContent = error.message;
  } finally { button.disabled = false; }
});

function renderMatches(matches) {
  const list = document.querySelector('#match-list');
  list.replaceChildren();
  const label = (items, id) => items.find(item => item.id === id)?.label || id;
  for (const [index, match] of matches.entries()) {
    const item = match.candidate;
    const card = document.createElement('article');
    card.className = 'match-card';
    const title = document.createElement('h4');
    title.textContent = `${index + 1}. ${label(categories.colors, item.color)} ${label(categories.itemTypes, item.itemType)} · ${match.total}/12점`;
    const info = document.createElement('p');
    info.textContent = `${item.id} · ${item.type === 'found' ? '습득물' : '분실물'} · ${label(categories.locations, item.location)} · ${item.date}`;
    const features = document.createElement('p');
    features.textContent = `특징: ${item.features}${item.storageLocation ? ' / 보관: ' + item.storageLocation : ''}`;
    const reasons = document.createElement('ul');
    for (const part of match.parts) {
      const row = document.createElement('li');
      row.textContent = `${part.label} +${part.points}점 — ${part.reason}`;
      reasons.append(row);
    }
    card.append(title, info, features, reasons);
    list.append(card);
  }
  document.querySelector('#match-count').textContent = matches.length ? `${matches.length}건의 후보를 점수순으로 표시합니다.` : '일치하는 후보가 없습니다. 다른 게시글이 등록된 뒤 다시 확인해 보세요.';
  results.hidden = false;
  results.focus();
}

document.querySelector('#save-input').addEventListener('click', async () => {
  if (!currentValues || saving || savedPost) return;
  saving = true;
  const button = document.querySelector('#save-input');
  const edit = document.querySelector('#edit-input');
  button.disabled = true; edit.disabled = true;
  document.querySelector('#save-status').textContent = 'DB에 저장 중입니다…';
  try {
    const {post} = await db.create(currentValues);
    savedPost = post;
    currentValues = post;
    edit.hidden = true;
    button.textContent = '저장 완료';
    document.querySelector('.preview-note').textContent = 'DB에 저장했습니다. 새로고침하거나 다시 접속해도 게시글을 조회할 수 있습니다.';
    document.querySelector('#save-status').textContent = '저장 완료! 아래에서 비슷한 물건을 확인하세요.';
    await refreshPosts();
  } catch(error) {
    document.querySelector('#save-status').textContent = error.message;
    button.disabled = false;
  } finally { saving = false; edit.disabled = false; }
});

function makePostCard(item) {
  const label = (items, id) => items.find(value => value.id === id)?.label || id;
  const card = document.createElement('article'); card.className = 'match-card post-card'; card.dataset.id = item.id;
  const title = document.createElement('h3');
  title.textContent = `${item.type === 'lost' ? '분실' : '습득'} · ${label(categories.colors,item.color)} ${label(categories.itemTypes,item.itemType)}`;
  const info = document.createElement('p');
  info.textContent = `${item.date} · ${label(categories.locations,item.location)} · ${item.status === 'returned' ? '반환 완료' : '찾는 중'}${item.isMine ? ' · 내가 등록' : ''}`;
  const detail = document.createElement('details');
  const summary = document.createElement('summary'); summary.textContent = '물건 상세 보기';
  const text = document.createElement('p'); text.className = 'post-details';
  text.textContent = `세부 위치: ${item.locationDetail || '입력하지 않음'}\n특징: ${item.features}${item.type === 'found' ? '\n현재 보관 장소: '+item.storageLocation : ''}`;
  detail.append(summary,text); card.append(title,info,detail);
  if (item.status !== 'returned') {
    const recommend = document.createElement('button'); recommend.className = 'text-button'; recommend.textContent = '비슷한 물건 찾기';
    const inline = document.createElement('div'); inline.setAttribute('role','status');
    recommend.addEventListener('click',async () => {
      recommend.disabled = true; inline.textContent = '최신 게시글을 비교 중입니다…';
      try {
        const {posts} = await db.list();
        if (posts.find(post=>post.id===item.id)?.status === 'returned') { inline.textContent='반환 완료된 게시글입니다. 목록을 새로고침해 주세요.'; return; }
        const matches = globalThis.LOST_FOUND_MATCHING.rank(item,posts);
        inline.replaceChildren();
        if (!matches.length) inline.textContent='현재 일치하는 후보가 없습니다.';
        for (const match of matches) {
          const row=document.createElement('p');
          row.textContent=`${match.total}/12점 · ${label(categories.colors,match.candidate.color)} ${label(categories.itemTypes,match.candidate.itemType)} · ${match.candidate.date} · ${label(categories.locations,match.candidate.location)} · ${match.candidate.features}${match.candidate.storageLocation ? ' · 보관: '+match.candidate.storageLocation : ''}\n${match.parts.map(part=>`${part.label} ${part.points}점 (${part.reason})`).join(' / ')}`;
          inline.append(row);
        }
      }catch(error){inline.textContent=error.message;}finally{recommend.disabled=false;}
    });
    card.append(recommend,inline);
    if (item.isMine) {
      const done = document.createElement('button'); done.className='text-button'; done.textContent='반환 완료로 표시';
      done.addEventListener('click',async()=>{
        if(!confirm('실제로 물건을 돌려주거나 찾았나요? 반환 완료하면 추천에서 제외됩니다.')) return;
        done.disabled=true;
        try{await db.returned(item.id);await refreshPosts();}catch(error){inline.textContent=error.message;done.disabled=false;}
      });
      card.append(done);
    }
  }
  return card;
}
let loadingPosts = false;
async function refreshPosts() {
  if (loadingPosts) return;
  loadingPosts=true;
  const button=document.querySelector('#refresh-posts'); button.disabled=true;
  const status=document.querySelector('#list-status'); status.textContent='DB에서 게시글을 불러오는 중입니다.';
  try {
    const {posts,hasMore}=await db.list();
    document.querySelector('#post-list').replaceChildren(...posts.map(makePostCard));
    document.querySelector('.count').textContent=`${posts.length}건${hasMore ? '+' : ''}`;
    status.textContent=posts.length ? `최신 DB 게시글입니다.${hasMore ? ' 최근 200건만 표시·추천합니다.' : ''}` : '등록된 게시글이 없습니다. 첫 물건을 등록해 보세요.';
  }catch(error){status.textContent=error.message;document.querySelector('.count').textContent='조회 실패';}
  finally{button.disabled=false;loadingPosts=false;}
}
document.querySelector('#refresh-posts').addEventListener('click',refreshPosts);
refreshPosts();
