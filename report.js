import { firebaseConfig as repoConfig, hasFirebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const storageKey='kidpoint.firebaseConfig.v1';
const state={family:null,students:[],tasks:[],submissions:[],rewards:[],redemptions:[],feedback:[],ledger:[]};
let db,auth,currentUser,profile,familyId,role,selectedStudentId='',range='week';

function configFromStorage(){try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch{return null}}
function activeConfig(){return hasFirebaseConfig(repoConfig)?repoConfig:configFromStorage()}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function ts(v){if(!v)return 0;if(typeof v==='number')return v;if(typeof v==='string')return Date.parse(v)||0;if(v?.toMillis)return v.toMillis();if(v?.seconds)return v.seconds*1000;return 0}
function fmt(v){const ms=ts(v);return ms?new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(ms):'—'}
function startOfWeek(){const d=new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return +d}
function startOfMonth(){const d=new Date();d.setDate(1);d.setHours(0,0,0,0);return +d}
function rangeStart(){return range==='week'?startOfWeek():startOfMonth()}
function student(){return state.students.find(s=>s.id===selectedStudentId)||state.students[0]||null}
function net(entries){return entries.reduce((sum,x)=>sum+Number(x.amount||0),0)}

function fail(message){
  $('#reportLoading').innerHTML=`<div style="text-align:center"><b>${esc(message)}</b><div style="margin-top:12px"><a class="btn secondary" href="./">返回主系統</a></div></div>`;
}

const cfg=activeConfig();
if(!cfg||!hasFirebaseConfig(cfg)){
  fail('尚未設定 Firebase，請先回主系統完成連線設定');
}else{
  try{
    const app=initializeApp(cfg);
    auth=getAuth(app);db=getFirestore(app);
    onAuthStateChanged(auth,handleAuth);
  }catch(e){fail('Firebase 初始化失敗：'+e.message)}
}

async function handleAuth(user){
  currentUser=user;
  if(!user)return fail('目前尚未登入 Kid & Point');
  try{
    const p=await getDoc(doc(db,'users',user.uid));
    if(!p.exists())return fail('找不到帳號資料');
    profile={id:p.id,...p.data()};familyId=profile.familyId;
    if(!familyId)return fail('這個帳號尚未加入家庭');
    const f=await getDoc(doc(db,'families',familyId));
    if(!f.exists())return fail('找不到家庭資料');
    state.family={id:f.id,...f.data()};
    role=state.family.teachers?.includes(user.uid)?'teacher':state.family.parents?.includes(user.uid)?'parent':null;
    if(!role)return fail('你目前沒有這個家庭的存取權限');
    connectCollections();
  }catch(e){console.error(e);fail('讀取成長報告失敗：'+e.message)}
}

function connectCollections(){
  ['students','tasks','submissions','rewards','redemptions','feedback','ledger'].forEach(name=>{
    onSnapshot(collection(db,'families',familyId,name),snap=>{
      state[name]=snap.docs.map(d=>({id:d.id,...d.data()}));
      if(name==='students'){
        const urlId=new URL(location.href).searchParams.get('student');
        if(!selectedStudentId&&urlId&&state.students.some(s=>s.id===urlId))selectedStudentId=urlId;
        if(!selectedStudentId||!state.students.some(s=>s.id===selectedStudentId))selectedStudentId=state.students[0]?.id||'';
      }
      render();
    },e=>{console.error(name,e);fail('Firestore 權限或同步失敗：'+e.code)});
  });
}

function render(){
  if(!state.family)return;
  $('#reportLoading').classList.add('hidden');
  $('#reportApp').classList.remove('hidden');
  const s=student();
  const select=$('#reportStudent');
  select.innerHTML=state.students.length?state.students.map(x=>`<option value="${esc(x.id)}" ${x.id===selectedStudentId?'selected':''}>${esc(x.name)}</option>`).join(''):'<option>尚無學生</option>';
  select.disabled=!state.students.length;
  $('#reportSubtitle').textContent=`${state.family.name||'Kid & Point'} · ${role==='teacher'?'老師端':'家長端'} · ${range==='week'?'本週成長摘要':'本月成長摘要'}`;
  if(!s){
    $('#metricGrid').innerHTML='<div class="report-empty">老師尚未建立學生資料</div>';
    $('#dailyChart').innerHTML='';$('#categoryBreakdown').innerHTML='';$('#todoGrid').innerHTML='';$('#achievements').innerHTML='';$('#reportFeedback').innerHTML='';
    return;
  }
  renderMetrics(s);renderDaily(s);renderCategories(s);renderTodo(s);renderAchievements(s);renderFeedback(s);
}

function rangeData(s){
  const start=rangeStart();
  const ledger=state.ledger.filter(x=>x.studentId===s.id&&ts(x.createdAt)>=start);
  const done=state.tasks.filter(x=>x.studentId===s.id&&x.status==='done'&&ts(x.verifiedAt)>=start);
  return {start,ledger,done,earned:ledger.filter(x=>Number(x.amount)>0).reduce((a,x)=>a+Number(x.amount),0),spent:Math.abs(ledger.filter(x=>Number(x.amount)<0).reduce((a,x)=>a+Number(x.amount),0))};
}

function renderMetrics(s){
  const d=rangeData(s);const n=net(d.ledger);
  $('#metricGrid').innerHTML=`
    <div class="metric-card"><small>目前總點數</small><strong>${Number(s.points||0)}</strong><small>可用點數</small></div>
    <div class="metric-card"><small>${range==='week'?'本週':'本月'}獲得</small><strong>+${d.earned}</strong><small>正向點數累積</small></div>
    <div class="metric-card"><small>${range==='week'?'本週':'本月'}完成</small><strong>${d.done.length}</strong><small>已由老師核實任務</small></div>
    <div class="metric-card"><small>${range==='week'?'本週':'本月'}淨變化</small><strong>${n>=0?'+':''}${n}</strong><small>${d.spent?`已兌換 / 扣除 ${d.spent} 點`:'目前沒有扣點'}</small></div>`;
  $('#rangeNet').textContent=`${range==='week'?'本週':'本月'}淨值 ${n>=0?'+':''}${n}`;
}

function dayKey(d){return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}
function renderDaily(s){
  const days=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);d.setHours(0,0,0,0);days.push(d)}
  const vals=days.map(d=>{
    const start=+d,end=start+86400000;
    return net(state.ledger.filter(x=>x.studentId===s.id&&ts(x.createdAt)>=start&&ts(x.createdAt)<end));
  });
  const max=Math.max(1,...vals.map(v=>Math.abs(v)));
  $('#dailyChart').innerHTML=days.map((d,i)=>{
    const v=vals[i],h=Math.max(4,Math.round(Math.abs(v)/max*135));
    return `<div class="bar-col"><div class="bar-value">${v>=0?'+':''}${v}</div><div class="bar-track"><div class="bar-fill ${v<0?'negative':''}" style="height:${h}px" title="${dayKey(d)} ${v} 點"></div></div><div class="bar-day">${d.getMonth()+1}/${d.getDate()}</div></div>`;
  }).join('');
}

function renderCategories(s){
  const d=rangeData(s);const buckets={};
  d.done.forEach(t=>{const k=t.category||'其他';buckets[k]=(buckets[k]||0)+Number(t.points||0)});
  const rows=Object.entries(buckets).sort((a,b)=>b[1]-a[1]);
  const max=Math.max(1,...rows.map(x=>x[1]));
  $('#categoryBreakdown').innerHTML=rows.length?rows.map(([k,v])=>`<div class="category-row"><b>${esc(k)}</b><div class="category-track"><div class="category-fill" style="width:${Math.round(v/max*100)}%"></div></div><span class="pt">${v}</span></div>`).join(''):'<div class="report-empty">這個期間還沒有核實完成的任務</div>';
}

function renderTodo(s){
  const active=state.tasks.filter(x=>x.studentId===s.id&&x.status==='active').length;
  const pending=state.submissions.filter(x=>x.studentId===s.id&&x.status==='pending').length;
  const redeem=state.redemptions.filter(x=>x.studentId===s.id&&x.status==='pending').length;
  $('#todoGrid').innerHTML=`<div class="todo"><b>${active}</b><span>進行中任務</span></div><div class="todo"><b>${pending}</b><span>待老師核實</span></div><div class="todo"><b>${redeem}</b><span>待核實兌換</span></div>`;
}

function renderAchievements(s){
  const arr=state.tasks.filter(x=>x.studentId===s.id&&x.status==='done').sort((a,b)=>ts(b.verifiedAt)-ts(a.verifiedAt)).slice(0,6);
  $('#achievements').innerHTML=arr.length?arr.map(t=>`<div class="achievement"><div><b>${esc(t.title)}</b><div class="meta">${esc(t.category||'任務')} · 核實 ${fmt(t.verifiedAt)}</div></div><span class="pt">+${Number(t.points||0)}</span></div>`).join(''):'<div class="report-empty">尚無已核實成就</div>';
}

function renderFeedback(s){
  const arr=state.feedback.filter(x=>x.studentId===s.id).sort((a,b)=>ts(b.createdAt)-ts(a.createdAt)).slice(0,5);
  $('#reportFeedback').innerHTML=arr.length?arr.map(x=>`<div class="report-note"><b>${x.authorRole==='teacher'?'老師紀錄':'家長觀察'}</b><p>${esc(x.content)}</p><div class="meta">${fmt(x.createdAt)}</div></div>`).join(''):'<div class="report-empty">尚無回饋或觀察紀錄</div>';
}

$('#reportStudent').addEventListener('change',e=>{
  selectedStudentId=e.target.value;
  const u=new URL(location.href);u.searchParams.set('student',selectedStudentId);history.replaceState(null,'',u);
  render();
});

$$('[data-range]').forEach(btn=>btn.addEventListener('click',()=>{
  range=btn.dataset.range;
  $$('[data-range]').forEach(x=>x.classList.toggle('active',x===btn));
  render();
}));

$('#shareReport').addEventListener('click',async()=>{
  const s=student();if(!s)return;
  const d=rangeData(s),n=net(d.ledger),label=range==='week'?'本週':'本月';
  const text=`${s.name} ${label}成長摘要\n目前 ${Number(s.points||0)} 點\n${label}獲得 +${d.earned} 點\n完成 ${d.done.length} 項核實任務\n淨變化 ${n>=0?'+':''}${n} 點`;
  try{
    if(navigator.share)await navigator.share({title:`Kid & Point｜${s.name}成長報告`,text,url:location.href});
    else{await navigator.clipboard.writeText(text+'\n'+location.href);const old=$('#shareReport').textContent;$('#shareReport').textContent='摘要已複製';setTimeout(()=>$('#shareReport').textContent=old,1500)}
  }catch{}
});
