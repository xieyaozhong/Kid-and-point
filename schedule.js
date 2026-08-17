import { firebaseConfig, hasFirebaseConfig } from './firebase-config.js';
import { getApps, getApp, initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, onSnapshot, updateDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $=s=>document.querySelector(s);
const TZ='Asia/Taipei';
let db,auth,user,familyId,role=null,family=null;
let students=[];
let unsubs=[];
let timer=null;

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clear(){unsubs.forEach(f=>f());unsubs=[];students=[];family=null;familyId=null;role=null;if(timer){clearInterval(timer);timer=null}}
function ensureFirebase(){if(!hasFirebaseConfig(firebaseConfig))return null;const app=getApps().length?getApp():initializeApp(firebaseConfig);db=getFirestore(app);auth=getAuth(app);return app}
function selectedStudentId(){return $('#studentSelect')?.value||students[0]?.id||''}
function selectedStudent(){const id=selectedStudentId();return students.find(s=>s.id===id)||students[0]||null}

function twNow(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  const get=t=>parts.find(p=>p.type===t)?.value||'';
  const weekdayMap={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
  const hour=Number(get('hour')),minute=Number(get('minute'));
  return {date:`${get('year')}-${get('month')}-${get('day')}`,weekday:weekdayMap[get('weekday')]||1,hour,minute,mins:hour*60+minute};
}
function timeMin(v){const m=String(v||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return NaN;return Number(m[1])*60+Number(m[2])}
function padTime(v){const m=String(v||'').trim().match(/^(\d{1,2}):?(\d{2})$/);if(!m)return '';const h=Number(m[1]),n=Number(m[2]);if(h>23||n>59)return '';return `${String(h).padStart(2,'0')}:${String(n).padStart(2,'0')}`}
function weekdayLabel(n){return ['','週一','週二','週三','週四','週五','週六','週日'][Number(n)]||''}
function parseWeekday(v){const x=String(v||'').trim().replace(/^星期/,'').replace(/^週/,'');const map={'一':1,'1':1,'Mon':1,'Monday':1,'二':2,'2':2,'Tue':2,'Tuesday':2,'三':3,'3':3,'Wed':3,'Wednesday':3,'四':4,'4':4,'Thu':4,'Thursday':4,'五':5,'5':5,'Fri':5,'Friday':5,'六':6,'6':6,'Sat':6,'Saturday':6,'日':7,'天':7,'7':7,'Sun':7,'Sunday':7};return map[x]||null}
function isDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||'').trim())}

function dayEntries(){
  const sid=selectedStudentId();if(!sid||!family)return [];
  const all=family?.timetables?.[sid]?.entries||[];
  const now=twNow();
  const weekly=all.filter(e=>e.scope==='weekly'&&Number(e.weekday)===now.weekday);
  const dated=all.filter(e=>e.scope==='date'&&e.date===now.date);
  const bySlot=new Map();
  weekly.forEach(e=>bySlot.set(`${e.start}-${e.end}`,e));
  dated.forEach(e=>bySlot.set(`${e.start}-${e.end}`,e));
  return [...bySlot.values()].sort((a,b)=>timeMin(a.start)-timeMin(b.start));
}
function currentState(){
  const now=twNow(),items=dayEntries();
  const current=items.find(e=>timeMin(e.start)<=now.mins&&now.mins<timeMin(e.end))||null;
  const next=items.find(e=>timeMin(e.start)>now.mins)||null;
  return {now,items,current,next};
}

function addStyles(){
  if($('#scheduleStyles'))return;
  const s=document.createElement('style');s.id='scheduleStyles';s.textContent=`
  .schedule-live{position:relative;overflow:hidden;background:linear-gradient(135deg,#163d32 0%,#285b49 100%);color:#fff;border:0;margin-bottom:18px}
  .schedule-live:after{content:'◷';position:absolute;right:18px;top:4px;font-size:72px;opacity:.08}
  .schedule-live .meta{color:rgba(255,255,255,.72)}
  .schedule-live .eyebrow{color:#bfe4cf}
  .schedule-now-title{font-size:clamp(24px,4vw,38px);margin:6px 0 2px;line-height:1.15}
  .schedule-time{font-weight:700;font-variant-numeric:tabular-nums}
  .schedule-next{margin-top:13px;padding-top:12px;border-top:1px solid rgba(255,255,255,.16)}
  .schedule-list{display:grid;gap:8px;margin-top:14px}
  .schedule-slot{display:grid;grid-template-columns:96px 1fr auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid var(--line,#e6e1d6);border-radius:14px}
  .schedule-slot.now{border-color:#3f7c63;background:#edf7f1}
  .schedule-slot .slot-time{font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}
  .schedule-slot .slot-note{font-size:12px;opacity:.68}
  .schedule-import-help{background:#f6f4ee;border-radius:14px;padding:12px;margin:10px 0;font-size:13px;line-height:1.6}
  .schedule-code{display:block;background:#1f2522;color:#e8f6ee;border-radius:12px;padding:10px 12px;white-space:pre-wrap;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:8px}
  .schedule-file{border:1px dashed var(--line,#d8d2c5);padding:14px;border-radius:14px;background:#faf9f5}
  @media(max-width:620px){.schedule-slot{grid-template-columns:82px 1fr}.schedule-slot>span:last-child{grid-column:2}.schedule-live{margin-bottom:12px}}
  `;document.head.appendChild(s);
}

async function connect(u){
  clear();user=u;if(!u)return;
  try{
    const p=await getDoc(doc(db,'users',u.uid));if(!p.exists()||!p.data().familyId)return;
    familyId=p.data().familyId;
    const fref=doc(db,'families',familyId);const fsnap=await getDoc(fref);if(!fsnap.exists())return;
    family={id:fsnap.id,...fsnap.data()};
    role=family.teachers?.includes(u.uid)?'teacher':family.parents?.includes(u.uid)?'parent':null;if(!role)return;
    unsubs.push(onSnapshot(fref,s=>{family={id:s.id,...s.data()};patchUI()}));
    unsubs.push(onSnapshot(collection(db,'families',familyId,'students'),s=>{students=s.docs.map(d=>({id:d.id,...d.data()}));patchUI()}));
    if(!timer)timer=setInterval(renderLive,30000);
    patchUI();
  }catch(e){console.error('schedule module',e)}
}

function mountTeacherTool(){
  if(role!=='teacher')return;
  const quick=$('#teacherView .quick');if(!quick||$('#scheduleImportBtn'))return;
  const b=document.createElement('button');b.id='scheduleImportBtn';b.type='button';
  b.innerHTML='<span>▦</span><b>匯入課表</b><div class="meta">CSV / TXT / 貼上課表</div>';
  b.onclick=openImportModal;quick.appendChild(b);
}
function mountTeacherPanel(){
  if(role!=='teacher')return;
  const aside=$('#teacherView aside');if(!aside)return;
  let p=$('#teacherSchedulePanel');
  if(!p){p=document.createElement('section');p.id='teacherSchedulePanel';p.className='panel';p.style.marginTop='18px';aside.insertBefore(p,aside.children[1]||null)}
  const st=currentState(),meta=family?.timetables?.[selectedStudentId()];
  p.innerHTML=`<div class="row between"><h3 class="section-title">今日課表</h3><button class="btn secondary" id="editScheduleMini" type="button">匯入</button></div>${compactScheduleHtml(st)}${meta?.updatedAt?`<div class="meta" style="margin-top:10px">最後更新：${esc(new Date(meta.updatedAt).toLocaleString('zh-TW',{timeZone:TZ}))}</div>`:''}`;
  $('#editScheduleMini')?.addEventListener('click',openImportModal);
}
function mountParentLive(){
  if(role!=='parent')return;
  const section=$('#parentView .grid > section');if(!section)return;
  let p=$('#parentLiveSchedule');
  if(!p){p=document.createElement('div');p.id='parentLiveSchedule';section.insertBefore(p,section.firstChild)}
  renderLive();
}
function compactScheduleHtml(st){
  if(!st.items.length)return '<div class="empty">今天尚未排課</div>';
  if(st.current)return `<div><b>正在進行：${esc(st.current.title)}</b><div class="meta">${esc(st.current.start)}–${esc(st.current.end)}${st.current.note?' · '+esc(st.current.note):''}</div></div>${st.next?`<div class="meta" style="margin-top:8px">下一堂 ${esc(st.next.start)}｜${esc(st.next.title)}</div>`:''}`;
  if(st.next)return `<div><b>目前空堂</b><div class="meta">下一堂 ${esc(st.next.start)}–${esc(st.next.end)}｜${esc(st.next.title)}</div></div>`;
  return '<div><b>今日課程已結束</b><div class="meta">今天辛苦了</div></div>';
}
function renderLive(){
  const p=$('#parentLiveSchedule');if(role!=='parent'||!p)return;
  const st=currentState();
  let main='';
  if(st.current){
    const remaining=Math.max(0,timeMin(st.current.end)-st.now.mins);
    const duration=Math.max(1,timeMin(st.current.end)-timeMin(st.current.start));
    const elapsed=Math.max(0,st.now.mins-timeMin(st.current.start));
    const pct=Math.min(100,Math.round(elapsed/duration*100));
    main=`<div class="panel schedule-live"><div class="eyebrow">現在正在進行</div><div class="schedule-now-title">${esc(st.current.title)}</div><div class="schedule-time">${esc(st.current.start)} – ${esc(st.current.end)}</div>${st.current.note?`<div class="meta" style="margin-top:5px">${esc(st.current.note)}</div>`:''}<div class="progress" style="margin-top:14px"><i style="width:${pct}%"></i></div><div class="row between"><small>課程進度 ${pct}%</small><small>約剩 ${remaining} 分鐘</small></div>${st.next?`<div class="schedule-next"><small class="meta">下一堂</small><div><b>${esc(st.next.start)} ${esc(st.next.title)}</b>${st.next.note?` <span class="meta">· ${esc(st.next.note)}</span>`:''}</div></div>`:''}</div>`;
  }else if(st.next){
    const wait=Math.max(0,timeMin(st.next.start)-st.now.mins);
    main=`<div class="panel schedule-live"><div class="eyebrow">目前狀態</div><div class="schedule-now-title">下課 / 空堂</div><div class="meta">下一堂還有約 ${wait} 分鐘</div><div class="schedule-next"><small class="meta">下一堂課</small><div><b>${esc(st.next.start)}–${esc(st.next.end)} ${esc(st.next.title)}</b>${st.next.note?` <span class="meta">· ${esc(st.next.note)}</span>`:''}</div></div></div>`;
  }else{
    main=`<div class="panel schedule-live"><div class="eyebrow">今日課程</div><div class="schedule-now-title">${st.items.length?'今天的課程已結束':'今天沒有排定課程'}</div><div class="meta">${esc(selectedStudent()?.name||'孩子')} · ${esc(st.now.date)}</div></div>`;
  }
  const list=st.items.length?`<div class="panel" style="margin-bottom:18px"><div class="row between"><h3 class="section-title">今天完整課表</h3><span class="meta">台北時間</span></div><div class="schedule-list">${st.items.map(e=>{const isNow=st.current===e;return `<div class="schedule-slot ${isNow?'now':''}"><div class="slot-time">${esc(e.start)}–${esc(e.end)}</div><div><b>${esc(e.title)}</b>${e.note?`<div class="slot-note">${esc(e.note)}</div>`:''}</div><span class="badge">${isNow?'進行中':timeMin(e.end)<=st.now.mins?'已結束':'待上課'}</span></div>`}).join('')}</div></div>`:'';
  p.innerHTML=main+list;
}

function csvSplit(line){
  const out=[];let cur='',quoted=false;
  for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++}else quoted=!quoted}else if((ch===','||ch==='\t')&&!quoted){out.push(cur.trim());cur=''}else cur+=ch}
  out.push(cur.trim());return out;
}
function parseSchedule(text){
  const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const entries=[];const errors=[];
  lines.forEach((line,idx)=>{
    const cols=csvSplit(line);if(cols.length<4){errors.push(`第 ${idx+1} 行欄位不足`);return}
    const first=cols[0].trim();
    if(idx===0&&/日期|date|星期|weekday/i.test(first))return;
    const start=padTime(cols[1]),end=padTime(cols[2]),title=String(cols[3]||'').trim(),note=String(cols.slice(4).join(' / ')||'').trim();
    if(!start||!end||timeMin(end)<=timeMin(start)||!title){errors.push(`第 ${idx+1} 行時間或課程名稱不正確`);return}
    if(isDate(first))entries.push({scope:'date',date:first,start,end,title,note});
    else{const weekday=parseWeekday(first);if(!weekday){errors.push(`第 ${idx+1} 行日期/星期無法辨識：${first}`);return}entries.push({scope:'weekly',weekday,start,end,title,note})}
  });
  entries.sort((a,b)=>String(a.date||a.weekday).localeCompare(String(b.date||b.weekday))||timeMin(a.start)-timeMin(b.start));
  return {entries:entries.slice(0,200),errors};
}
function scheduleRowsHtml(entries){return entries.slice(0,12).map(e=>`<div class="schedule-slot"><div class="slot-time">${esc(e.start)}–${esc(e.end)}</div><div><b>${esc(e.title)}</b><div class="slot-note">${e.scope==='date'?esc(e.date):weekdayLabel(e.weekday)}${e.note?' · '+esc(e.note):''}</div></div></div>`).join('')+(entries.length>12?`<div class="meta" style="margin-top:8px">另有 ${entries.length-12} 堂</div>`:'')}

function openImportModal(){
  const wrap=$('#modalWrap'),body=$('#modalBody');if(!wrap||!body)return;if(!students.length){alert('請先新增學生');return}
  const sid=selectedStudentId()||students[0].id;const old=family?.timetables?.[sid]?.entries||[];
  body.innerHTML=`<form id="scheduleImportForm"><div class="row between"><div><div class="eyebrow" style="color:var(--green)">老師端</div><h3 style="margin:4px 0">匯入課表</h3></div><button type="button" class="btn secondary" data-close-schedule>關閉</button></div>
    <div class="field"><label>學生</label><select name="studentId">${students.map(s=>`<option value="${esc(s.id)}" ${s.id===sid?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="schedule-import-help"><b>支援兩種格式</b><br>指定日期：日期,開始,結束,課程,備註<br>每週固定：星期,開始,結束,課程,備註<span class="schedule-code">2026-08-21,09:00,10:00,數學,分數複習\n2026-08-21,10:15,11:15,英文,閱讀\n一,13:30,14:30,自然,每週固定</span></div>
    <div class="field schedule-file"><label>上傳 CSV / TXT</label><input id="scheduleFile" type="file" accept=".csv,.txt,text/csv,text/plain"></div>
    <div class="field"><label>或直接貼上課表</label><textarea name="raw" rows="8" placeholder="2026-08-21,09:00,10:00,數學,分數複習"></textarea></div>
    <div id="schedulePreview">${old.length?`<div class="meta">目前已有 ${old.length} 堂課；新匯入會取代這位學生的現有課表。</div>`:''}</div>
    <div id="scheduleImportMessage"></div>
    <div class="actions"><button type="button" class="btn secondary" id="clearScheduleBtn">清空這位學生課表</button><button class="btn green" type="submit">預覽並匯入</button></div></form>`;
  wrap.classList.add('open');
  const raw=body.querySelector('textarea[name="raw"]'),preview=$('#schedulePreview');
  function previewNow(){const parsed=parseSchedule(raw.value);preview.innerHTML=parsed.entries.length?`<div class="notice">辨識到 <b>${parsed.entries.length}</b> 堂課${parsed.errors.length?`，另有 ${parsed.errors.length} 行略過`:''}</div><div class="schedule-list">${scheduleRowsHtml(parsed.entries)}</div>`:'<div class="meta">貼上或上傳後會在這裡預覽。</div>'}
  raw.addEventListener('input',previewNow);
  $('#scheduleFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;raw.value=await file.text();previewNow()});
  body.querySelectorAll('[data-close-schedule]').forEach(b=>b.onclick=()=>wrap.classList.remove('open'));
  $('#clearScheduleBtn').onclick=async()=>{
    const studentId=body.querySelector('[name="studentId"]').value;if(!confirm('確定清空這位學生的課表？'))return;
    try{await updateDoc(doc(db,'families',familyId),{[`timetables.${studentId}`]:{entries:[],updatedAt:new Date().toISOString(),updatedBy:user.uid,timezone:TZ}});wrap.classList.remove('open')}catch(e){$('#scheduleImportMessage').innerHTML=`<div class="notice bad">清空失敗：${esc(e.message)}</div>`}
  };
  $('#scheduleImportForm').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget,studentId=form.studentId.value,parsed=parseSchedule(form.raw.value),msg=$('#scheduleImportMessage');
    if(!parsed.entries.length){msg.innerHTML='<div class="notice bad">沒有辨識到可匯入的課程，請確認格式。</div>';return}
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;
    try{
      await updateDoc(doc(db,'families',familyId),{[`timetables.${studentId}`]:{entries:parsed.entries,updatedAt:new Date().toISOString(),updatedBy:user.uid,timezone:TZ}});
      msg.innerHTML=`<div class="notice">已匯入 ${parsed.entries.length} 堂課，家長端會立即同步。</div>`;setTimeout(()=>wrap.classList.remove('open'),600);
    }catch(err){msg.innerHTML=`<div class="notice bad">匯入失敗：${esc(err.message)}</div>`}finally{submit.disabled=false}
  };
}

function patchUI(){addStyles();mountTeacherTool();mountTeacherPanel();mountParentLive();renderLive()}

function watchStudentSelect(){
  document.addEventListener('change',e=>{if(e.target?.id==='studentSelect')setTimeout(patchUI,0)});
  const observer=new MutationObserver(()=>{if(role)patchUI()});observer.observe(document.documentElement,{subtree:true,childList:true});
}

if(ensureFirebase()){
  watchStudentSelect();
  onAuthStateChanged(auth,connect);
}
