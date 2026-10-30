// Public reading/registration; per-browser 256-bit capability authenticates ownership.
// No user-supplied table name, SQL, owner hash, status, or server credential is accepted.
import './categories.js';
const categories = (globalThis as any).LOST_FOUND_CATEGORIES;
const root = Deno.env.get('SUPABASE_URL')! + '/rest/v1/school_lost_found_posts';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const fields = 'id,type,color,itemType,location,locationDetail,date,features,storageLocation,status,created_at';
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type,x-owner-token','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS','Cache-Control':'no-store'};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status,headers:{...cors,'Content-Type':'application/json'}});
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
async function db(query: string, method = 'GET', body?: unknown) {
  const response = await fetch(root + query, {method,headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body ? JSON.stringify(body) : undefined,signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('database');
  return response.json();
}
Deno.serve(async req => {
  if(req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  try {
    if(!['GET','POST','PATCH'].includes(req.method)) return json({error:'지원하지 않는 요청입니다.'},405);
    const token = req.headers.get('X-Owner-Token') || '';
    if(!/^[a-f0-9]{64}$/.test(token)) return json({error:'작성자 확인 정보가 없습니다. 브라우저 저장 공간을 허용해 주세요.'},401);
    const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
    const ownerHash = [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    const publicRows = (rows: any[]) => rows.map(({owner_hash,...row})=>({...row,isMine:owner_hash===ownerHash}));
    if(req.method === 'GET') {
      const rows = await db(`?select=${fields},owner_hash&order=created_at.desc,id.desc&limit=201`);
      return json({posts:publicRows(rows.slice(0,200)),hasMore:rows.length>200});
    }
    if(Number(req.headers.get('Content-Length'))>8192) return json({error:'입력 내용이 너무 깁니다.'},413);
    const raw = await req.text();
    if(raw.length>8192) return json({error:'입력 내용이 너무 깁니다.'},413);
    let body;
    try{body=JSON.parse(raw);}catch{return json({error:'입력 형식이 올바르지 않습니다.'},400);}
    if(!body || !uuid(body.id)) return json({error:'게시글 번호가 올바르지 않습니다.'},400);
    if(req.method === 'PATCH') {
      const rows = await db(`?id=eq.${body.id}&owner_hash=eq.${ownerHash}&select=${fields},owner_hash`,'PATCH',{status:'returned'});
      return rows.length ? json({post:publicRows(rows)[0]}) : json({error:'이 브라우저에서 작성한 게시글만 반환 완료로 바꿀 수 있습니다.'},403);
    }
    if(!['lost','found'].includes(body.type)) return json({error:'등록 유형을 확인해 주세요.'},400);
    for(const [field,group] of [['color','colors'],['itemType','itemTypes'],['location','locations']]) {
      if(!categories[group].some((item:any)=>item.id===body[field])) return json({error:'선택 항목을 확인해 주세요.'},400);
    }
    const value = (key:string,max:number,required=false) => {
      if(typeof body[key] !== 'string' && body[key] !== undefined) throw new Error('validation');
      const text=(body[key] || '').trim();
      if(text.length>max || (required && !text))throw new Error('validation');
      return text;
    };
    const detailRequired = body.location.startsWith('classroom-') || ['stairs','restroom','water-station','shoe-lockers','other'].includes(body.location);
    let post;
    try {
      const date=value('date',10,true);
      const parsed=new Date(date+'T00:00:00Z');
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date || date>today)throw new Error('validation');
      post={id:body.id,type:body.type,color:body.color,itemType:body.itemType,location:body.location,locationDetail:value('locationDetail',100,detailRequired),date,features:value('features',500,true),storageLocation:body.type==='found'?value('storageLocation',100,true):'',owner_hash:ownerHash};
    }catch{return json({error:'필수 항목·날짜·글자 수를 확인해 주세요.'},400);}
    const existing=await db(`?id=eq.${body.id}&select=${fields},owner_hash`);
    if(existing.length) return existing[0].owner_hash===ownerHash ? json({post:publicRows(existing)[0]}) : json({error:'다른 게시글 번호로 다시 시도해 주세요.'},409);
    // A basic per-browser quota; this is not a substitute for CAPTCHA in a large public service.
    const recent=await db(`?owner_hash=eq.${ownerHash}&created_at=gte.${encodeURIComponent(new Date(Date.now()-3600000).toISOString())}&select=id&limit=20`);
    if(recent.length>=20)return json({error:'한 브라우저에서 한 시간에 20건까지 등록할 수 있습니다.'},429);
    const rows=await db(`?select=${fields},owner_hash`,'POST',post);
    return json({post:publicRows(rows)[0]},201);
  }catch{return json({error:'DB 요청을 완료하지 못했습니다. 입력 내용을 유지한 채 다시 시도해 주세요.'},503);}
});
