import { firebaseConfig as repoConfig, hasFirebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection, onSnapshot, serverTimestamp, arrayUnion, runTransaction } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const storageKey = 'kidpoint.firebaseConfig.v1';
const builtins = [
  {category:'健康作息', title:'完成今日指定喝水量', subCategory:'飲食', points:10},
  {category:'健康作息', title:'準時睡覺／起床', subCategory:'自主訓練', points:10},
  {category:'健康作息', title:'主動整理書包與書桌', subCategory:'自動自發', points:10},
  {category:'健康作息', title:'寫下今天最有感的一件事', subCategory:'感悟思考', points:10},
  {category:'健康作息', title:'完成每日運動目標', subCategory:'每日運動', points:10},
  {category:'學科優秀', title:'國文學習表現傑出', subCategory:'國文', points:10},
  {category:'學科優秀', title:'英文學習表現傑出', subCategory:'英文', points:10},
  {category:'學科優秀', title:'數學作業表現傑出', subCategory:'數學', points:10},
  {category:'學科優秀', title:'自然學習表現傑出', subCategory:'自然', points:10},
  {category:'學科優秀', title:'社會學習表現傑出', subCategory:'社會', points:10},
  {category:'學科優秀', title:'傳統考試達成目標', subCategory:'考試', points:20},
  {category:'學科優秀', title:'完成一項額外學習成就', subCategory:'學習成就', points:15}
];
const resources = [
  ['Khan Academy','數學／科學','https://www.khanacademy.org/'],
  ['PhET','互動科學模擬','https://phet.colorado.edu/zh_TW/'],
  ['GeoGebra','數學互動工具','https://www.geogebra.org/'],
  ['Code.org','遊戲化程式學習','https://code.org/'],
  ['NASA Space Place','太空科學','https://spaceplace.nasa.gov/'],
  ['CoolMath Games','數學遊戲','https://www.coolmathgames.com/']
];

let app, auth, db;
let currentUser = null;
let profile = null;
let familyId = null;
let role = null;
let selectedStudentId = '';
let teacherTab = 'active';
let parentTab = 'tasks';
let authMode = 'login';
let registerRole = 'teacher';
let unsubscribers = [];
const state = { family:null, students:[], tasks:[], submissions:[], rewards:[], redemptions:[], feedback:[], ledger:[] };

function configFromStorage(){ try { return JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { return null; } }
function activeConfig(){ return hasFirebaseConfig(repoConfig) ? repoConfig : configFromStorage(); }
function showOnly(id){ ['loadingScreen','firebaseScreen','authScreen','onboardScreen','appScreen'].forEach(x => $('#'+x)?.classList.toggle('hidden', x !== id)); }
function esc(v=''){ return String(v).replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c])); }
function tsValue(v){ if (!v) return 0; if (typeof v === 'number') return v; if (typeof v === 'string') return Date.parse(v) || 0; if (v?.toMillis) return v.toMillis(); if (v?.seconds) return v.seconds * 1000; return 0; }
function fmt(v){ const ms=tsValue(v); return ms ? new Intl.DateTimeFormat('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(ms) : '—'; }
function startToday(){ const d=new Date(); d.setHours(0,0,0,0); return +d; }
function startWeek(){ const d=new Date(); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return +d; }
function student(){ return state.students.find(s=>s.id===selectedStudentId) || state.students[0] || null; }
function taskById(id){ return state.tasks.find(t=>t.id===id); }
function rewardById(id){ return state.rewards.find(r=>r.id===id); }
function notify(text, kind='ok'){ const box=$('#modalBody'); if(box && $('#modalWrap').classList.contains('open')) box.insertAdjacentHTML('afterbegin',`<div class="notice ${kind}">${esc(text)}</div>`); }
function authMessage(text, kind='bad'){ $('#authMessage').innerHTML = text ? `<div class="notice ${kind}" style="margin-top:10px">${esc(text)}</div>` : ''; }
function onboardMessage(text, kind='bad'){ $('#onboardMessage').innerHTML = text ? `<div class="notice ${kind}">${esc(text)}</div>` : ''; }
function closeModal(){ $('#modalWrap').classList.remove('open'); $('#modalBody').innerHTML=''; }
function openModal(html){ $('#modalBody').innerHTML=html; $('#modalWrap').classList.add('open'); }
function fieldStudents(){ return state.students.map(s=>`<option value="${esc(s.id)}" ${s.id===selectedStudentId?'selected':''}>${esc(s.name)}</option>`).join(''); }
function randomCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const a=new Uint32Array(6); crypto.getRandomValues(a); return 'KP-' + [...a].map(n=>chars[n%chars.length]).join(''); }
function authError(e){ const map={'auth/invalid-credential':'Email 或密碼不正確','auth/email-already-in-use':'這個 Email 已經註冊過','auth/weak-password':'密碼至少需要 6 個字元','auth/invalid-email':'Email 格式不正確','auth/network-request-failed':'目前網路連線失敗'}; return map[e?.code] || e?.message || '操作失敗'; }

function initConfigScreen(){ const cfg=activeConfig(); if(cfg && hasFirebaseConfig(cfg)) return initFirebase(cfg); showOnly('firebaseScreen'); }
$('#firebaseForm').addEventListener('submit', e=>{ e.preventDefault(); const f=new FormData(e.currentTarget); const cfg=Object.fromEntries([...f.entries()].map(([k,v])=>[k,String(v).trim()])); localStorage.setItem(storageKey,JSON.stringify(cfg)); location.reload(); });
function initFirebase(cfg){ try{ app=initializeApp(cfg); auth=getAuth(app); db=getFirestore(app); onAuthStateChanged(auth, handleAuthState); }catch(e){ localStorage.removeItem(storageKey); showOnly('firebaseScreen'); alert('Firebase 設定無法初始化：'+e.message); } }

async function handleAuthState(user){
  cleanupListeners(); currentUser=user;
  if(!user){ profile=null; familyId=null; role=null; showOnly('authScreen'); return; }
  showOnly('loadingScreen');
  try{
    const snap=await getDoc(doc(db,'users',user.uid));
    profile=snap.exists()?{id:snap.id,...snap.data()}:null;
    if(!profile){ profile={name:user.email?.split('@')[0]||'使用者',email:user.email||'',roleHint:localStorage.getItem('kidpoint.roleHint')||'parent',familyId:null}; await setDoc(doc(db,'users',user.uid),profile,{merge:true}); }
    if(profile.familyId) await connectFamily(profile.familyId); else showOnboarding();
  }catch(e){ console.error(e); showOnly('authScreen'); authMessage('讀取帳號資料失敗：'+e.message); }
}

function setAuthMode(mode){ authMode=mode; $('#loginTab').classList.toggle('active',mode==='login'); $('#registerTab').classList.toggle('active',mode==='register'); $('#nameField').classList.toggle('hidden',mode!=='register'); $('#roleField').classList.toggle('hidden',mode!=='register'); $('#authSubmit').textContent=mode==='login'?'登入':'建立帳號'; $('#authForm').password.autocomplete=mode==='login'?'current-password':'new-password'; authMessage(''); }
$('#loginTab').onclick=()=>setAuthMode('login');
$('#registerTab').onclick=()=>setAuthMode('register');
$$('.role-card').forEach(btn=>btn.onclick=()=>{ registerRole=btn.dataset.role; $$('.role-card').forEach(x=>x.classList.toggle('active',x===btn)); });
$('#authForm').addEventListener('submit',async e=>{
  e.preventDefault(); authMessage(''); const f=new FormData(e.currentTarget); const email=String(f.get('email')).trim(); const password=String(f.get('password')); $('#authSubmit').disabled=true;
  try{
    if(authMode==='login') await signInWithEmailAndPassword(auth,email,password);
    else{
      const name=String(f.get('name')||'').trim()||email.split('@')[0]; localStorage.setItem('kidpoint.roleHint',registerRole); const cred=await createUserWithEmailAndPassword(auth,email,password); await setDoc(doc(db,'users',cred.user.uid),{name,email,roleHint:registerRole,familyId:null,createdAt:serverTimestamp()},{merge:true}); profile={name,email,roleHint:registerRole,familyId:null}; showOnboarding();
    }
  }catch(err){ authMessage(authError(err)); }
  finally{$('#authSubmit').disabled=false;}
});

function showOnboarding(){ showOnly('onboardScreen'); const hint=profile?.roleHint || localStorage.getItem('kidpoint.roleHint') || 'parent'; $('#welcomeName').textContent=`${profile?.name||'你好'}，設定你的 Kid & Point`; $('#teacherOnboard').classList.toggle('hidden',hint!=='teacher'); $('#parentOnboard').classList.toggle('hidden',hint!=='parent'); onboardMessage(''); }
$('#onboardLogout').onclick=()=>signOut(auth);
$('#logoutBtn').onclick=()=>signOut(auth);

$('#createFamilyForm').addEventListener('submit',async e=>{
  e.preventDefault(); onboardMessage(''); const name=String(new FormData(e.currentTarget).get('familyName')).trim(); if(!name)return; let code;
  try{
    for(let i=0;i<5;i++){ code=randomCode(); const ref=doc(db,'families',code); const snap=await getDoc(ref); if(!snap.exists()) break; }
    await setDoc(doc(db,'families',code),{name,teachers:[currentUser.uid],parents:[],createdAt:serverTimestamp(),createdBy:currentUser.uid}); await setDoc(doc(db,'users',currentUser.uid),{familyId:code,roleHint:'teacher',name:profile.name,email:currentUser.email},{merge:true}); profile={...profile,familyId:code,roleHint:'teacher'}; await connectFamily(code);
  }catch(err){ console.error(err); onboardMessage('建立家庭失敗：'+err.message); }
});

$('#joinFamilyForm').addEventListener('submit',async e=>{
  e.preventDefault(); onboardMessage(''); const code=String(new FormData(e.currentTarget).get('familyCode')).trim().toUpperCase();
  try{
    const ref=doc(db,'families',code); const snap=await getDoc(ref); if(!snap.exists()) return onboardMessage('找不到這個家庭代碼，請向老師確認'); await updateDoc(ref,{parents:arrayUnion(currentUser.uid)}); await setDoc(doc(db,'users',currentUser.uid),{familyId:code,roleHint:'parent',name:profile.name,email:currentUser.email},{merge:true}); profile={...profile,familyId:code,roleHint:'parent'}; await connectFamily(code);
  }catch(err){ console.error(err); onboardMessage('加入家庭失敗：'+err.message); }
});

async function connectFamily(id){
  cleanupListeners(); familyId=id; const famRef=doc(db,'families',id); const famSnap=await getDoc(famRef);
  if(!famSnap.exists()){ await setDoc(doc(db,'users',currentUser.uid),{familyId:null},{merge:true}); profile.familyId=null; return showOnboarding(); }
  state.family={id,...famSnap.data()}; role=state.family.teachers?.includes(currentUser.uid)?'teacher':state.family.parents?.includes(currentUser.uid)?'parent':null;
  if(!role){ await setDoc(doc(db,'users',currentUser.uid),{familyId:null},{merge:true}); profile.familyId=null; return showOnboarding(); }
  showOnly('appScreen'); $('#familyName').textContent=state.family.name||'Kid & Point'; $('#userName').textContent=profile?.name||currentUser.email; $('#rolePill').textContent=role==='teacher'?'老師端':'家長端'; $('#teacherView').classList.toggle('hidden',role!=='teacher'); $('#parentView').classList.toggle('hidden',role!=='parent'); $('#familyCodeWrap').classList.toggle('hidden',role!=='teacher'); $('#familyCode').textContent=id;
  listen(famRef,'family'); ['students','tasks','submissions','rewards','redemptions','feedback','ledger'].forEach(name=>listen(collection(db,'families',id,name),name));
}

function listen(ref,key){
  const unsub=onSnapshot(ref,snap=>{
    if(key==='family'){ state.family={id:snap.id,...snap.data()}; $('#familyName').textContent=state.family.name||'Kid & Point'; return; }
    state[key]=snap.docs.map(d=>({id:d.id,...d.data()})); if(key==='students'){ if(!selectedStudentId || !state.students.some(s=>s.id===selectedStudentId)) selectedStudentId=state.students[0]?.id||''; } render(); $('#syncDot').classList.add('online'); $('#syncText').textContent='Firestore 即時同步中';
  },err=>{ console.error(key,err); $('#syncDot').classList.remove('online'); $('#syncText').textContent='同步失敗：'+err.code; }); unsubscribers.push(unsub);
}
function cleanupListeners(){ unsubscribers.forEach(f=>f()); unsubscribers=[]; }

$('#familyCodeWrap').onclick=async()=>{ if(!familyId)return; try{await navigator.clipboard.writeText(familyId); $('#familyCodeWrap').innerHTML=`已複製：<b class="copy-code">${esc(familyId)}</b>`; setTimeout(()=>{$('#familyCodeWrap').innerHTML=`家庭代碼：<b id="familyCode" class="copy-code">${esc(familyId)}</b>`;},1500);}catch{} };
$('#studentSelect').addEventListener('change',e=>{selectedStudentId=e.target.value;render();});

function render(){ const sel=$('#studentSelect'); sel.innerHTML=state.students.length?state.students.map(s=>`<option value="${esc(s.id)}" ${s.id===selectedStudentId?'selected':''}>${esc(s.name)}</option>`).join(''):'<option value="">尚無學生</option>'; sel.disabled=!state.students.length; renderResources(); role==='teacher'?renderTeacher():renderParent(); }
function metrics(s){ if(!s)return {today:0,week:0,done:0,pending:0}; const ledger=state.ledger.filter(x=>x.studentId===s.id); const today=ledger.filter(x=>tsValue(x.createdAt)>=startToday()).reduce((a,x)=>a+Number(x.amount||0),0); const week=ledger.filter(x=>tsValue(x.createdAt)>=startWeek()).reduce((a,x)=>a+Number(x.amount||0),0); const done=state.tasks.filter(x=>x.studentId===s.id&&x.status==='done').length; const pending=state.submissions.filter(x=>x.studentId===s.id&&x.status==='pending').length; return {today,week,done,pending}; }
function renderTeacher(){ const s=student(),m=metrics(s),pts=Number(s?.points||0); $('#tName').textContent=s?.name||'尚未新增學生'; $('#tPoints').textContent=pts; $('#tProgress').style.width=Math.min(100,Math.max(0,m.week))+'%'; $('#weekText').textContent=`${m.week} / 100`; $('#todayEarn').textContent=m.today; $('#doneCount').textContent=m.done; $('#pendingCount').textContent=m.pending; const ledger=state.ledger.filter(x=>x.studentId===s?.id).sort((a,b)=>tsValue(b.createdAt)-tsValue(a.createdAt)).slice(0,8); $('#teacherHistory').innerHTML=ledger.length?ledger.map(l=>`<div class="history-item"><div><b>${esc(l.reason)}</b><div class="meta">${fmt(l.createdAt)}</div></div><span class="${Number(l.amount)>=0?'pos':'neg'}">${Number(l.amount)>=0?'+':''}${Number(l.amount)}</span></div>`).join(''):'<div class="empty">尚無點數異動</div>'; renderTeacherList(s); }
function renderTeacherList(s){
  const out=$('#teacherList'); if(!s){out.innerHTML='<div class="empty">先從右側「新增學生」開始</div>';return;}
  if(teacherTab==='active'){
    const arr=state.tasks.filter(t=>t.studentId===s.id&&t.status==='active').sort((a,b)=>tsValue(b.createdAt)-tsValue(a.createdAt)); out.innerHTML=arr.length?arr.map(t=>taskRow(t,'teacher')).join(''):'<div class="empty">目前沒有進行中的任務</div>';
  }else if(teacherTab==='verify'){
    const arr=state.submissions.filter(x=>x.studentId===s.id&&x.status==='pending').sort((a,b)=>tsValue(b.submittedAt)-tsValue(a.submittedAt)); out.innerHTML=arr.length?arr.map(sub=>{const t=taskById(sub.taskId);return `<div class="task"><div class="icon">✓</div><div class="task-main"><h4>${esc(t?.title||'任務')}</h4><div class="meta">回報：${fmt(sub.submittedAt)} ${sub.note?`｜${esc(sub.note)}`:''}</div><span class="badge">待核實</span> <span class="pt">+${Number(t?.points||0)} 點</span></div><div><button class="btn green" data-approve-sub="${esc(sub.id)}">通過</button> <button class="btn danger" data-reject-sub="${esc(sub.id)}">退回</button></div></div>`}).join(''):'<div class="empty">目前沒有待核實任務</div>';
  }else if(teacherTab==='done'){
    const arr=state.tasks.filter(t=>t.studentId===s.id&&t.status==='done').sort((a,b)=>tsValue(b.verifiedAt)-tsValue(a.verifiedAt)); out.innerHTML=arr.length?arr.map(t=>taskRow(t,'done')).join(''):'<div class="empty">尚無已完成任務</div>';
  }else{
    const arr=state.ledger.filter(x=>x.studentId===s.id).sort((a,b)=>tsValue(b.createdAt)-tsValue(a.createdAt)); out.innerHTML=arr.length?arr.map(l=>`<div class="history-item"><div><b>${esc(l.reason)}</b><div class="meta">${fmt(l.createdAt)} · ${esc(l.source||'點數調整')}</div></div><span class="${Number(l.amount)>=0?'pos':'neg'}">${Number(l.amount)>=0?'+':''}${Number(l.amount)}</span></div>`).join(''):'<div class="empty">尚無歷史紀錄</div>';
  }
}
function taskRow(t,mode){ return `<div class="task"><div class="icon">${t.category==='健康作息'?'🌱':'📚'}</div><div class="task-main"><h4>${esc(t.title)}</h4><div><span class="badge">${esc(t.category||'任務')}</span><span class="badge">${esc(t.subCategory||'')}</span>${t.dueAt?`<span class="badge">期限 ${esc(t.dueAt)}</span>`:''}</div><div class="meta" style="margin-top:6px">${mode==='done'?'核實完成 '+fmt(t.verifiedAt):'發布 '+fmt(t.createdAt)}</div></div><span class="pt">+${Number(t.points||0)} 點</span></div>`; }
function renderParent(){ const s=student(),m=metrics(s),pts=Number(s?.points||0); $('#pName').textContent=s?.name||'尚未建立學生'; $('#pPoints').textContent=pts; $('#pProgress').style.width=Math.min(100,Math.max(0,m.week))+'%'; $('#pWeekText').textContent=`本週 ${m.week} 點`; renderParentList(s); }
function renderParentList(s){
  const out=$('#parentList'); if(!s){out.innerHTML='<div class="empty">老師尚未建立學生資料</div>';return;}
  if(parentTab==='tasks'){
    const arr=state.tasks.filter(t=>t.studentId===s.id&&t.status==='active').sort((a,b)=>tsValue(b.createdAt)-tsValue(a.createdAt)); out.innerHTML=arr.length?arr.map(t=>{ const sub=state.submissions.filter(x=>x.taskId===t.id&&x.studentId===s.id).sort((a,b)=>tsValue(b.submittedAt)-tsValue(a.submittedAt))[0]; const action=sub?.status==='pending'?'<span class="badge">已回報・待核實</span>':`<button class="btn green" data-submit-task="${esc(t.id)}">回報完成</button>`; return `<div class="task"><div class="icon">${t.category==='健康作息'?'🌱':'📚'}</div><div class="task-main"><h4>${esc(t.title)}</h4><span class="badge">${esc(t.category)}</span><span class="badge">${esc(t.subCategory||'')}</span><div class="meta" style="margin-top:6px">完成可獲得 <b>+${Number(t.points||0)}</b> 點${sub?.status==='rejected'?' · 上次回報已退回':''}</div></div>${action}</div>`; }).join(''):'<div class="empty">目前沒有需要完成的任務</div>';
  }else if(parentTab==='completed'){
    const arr=state.submissions.filter(x=>x.studentId===s.id&&x.status==='approved').sort((a,b)=>tsValue(b.verifiedAt)-tsValue(a.verifiedAt)); out.innerHTML=arr.length?arr.map(x=>{const t=taskById(x.taskId);return `<div class="task"><div class="icon">✓</div><div class="task-main"><h4>${esc(t?.title||'已完成任務')}</h4><div class="meta">完成回報 ${fmt(x.submittedAt)} · 老師核實 ${fmt(x.verifiedAt)}</div></div><span class="pt">+${Number(t?.points||0)} 點</span></div>`}).join(''):'<div class="empty">尚無完成紀錄</div>';
  }else if(parentTab==='rewards'){
    const arr=state.rewards.filter(r=>r.studentId===s.id&&r.active!==false).sort((a,b)=>Number(a.cost)-Number(b.cost)); out.innerHTML=arr.length?arr.map(r=>{const pending=state.redemptions.some(x=>x.rewardId===r.id&&x.status==='pending');return `<div class="task"><div class="icon reward">🎁</div><div class="task-main"><h4>${esc(r.title)}</h4><div class="meta">需要 ${Number(r.cost||0)} 點${r.description?` · ${esc(r.description)}`:''}</div></div><button class="btn ${pending?'secondary':'green'}" ${pending||Number(s.points)<Number(r.cost)?'disabled':''} data-redeem="${esc(r.id)}">${pending?'等待核實':Number(s.points)<Number(r.cost)?'點數不足':'申請兌換'}</button></div>`}).join(''):'<div class="empty">還沒有獎品，家長可以自己新增</div>';
  }else{
    const arr=state.feedback.filter(x=>x.studentId===s.id).sort((a,b)=>tsValue(b.createdAt)-tsValue(a.createdAt)); out.innerHTML=arr.length?arr.map(x=>`<div class="feedback-card"><b>${x.authorRole==='parent'?'家長觀察':'老師紀錄'}</b><p>${esc(x.content)}</p><div class="meta">${fmt(x.createdAt)}</div></div>`).join(''):'<div class="empty">尚無回饋紀錄</div>';
  }
}
function renderResources(){ $('#resources').innerHTML=resources.map(([name,tag,url])=>`<div class="resource"><div><b>${esc(name)}</b><div class="meta">${esc(tag)}</div></div><a href="${url}" target="_blank" rel="noopener">開啟 ↗</a></div>`).join(''); }

function bindTabs(containerId, setter){ $('#'+containerId).addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;$('#'+containerId).querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));setter(b.dataset.tab);render();}); }
bindTabs('teacherTabs',x=>teacherTab=x); bindTabs('parentTabs',x=>parentTab=x);
$('#teacherList').addEventListener('click',async e=>{ const a=e.target.closest('[data-approve-sub]'),r=e.target.closest('[data-reject-sub]'); if(a) await approveSubmission(a.dataset.approveSub); if(r) await rejectSubmission(r.dataset.rejectSub); });
$('#parentList').addEventListener('click',e=>{ const submit=e.target.closest('[data-submit-task]'), redeem=e.target.closest('[data-redeem]'); if(submit) openSubmitModal(submit.dataset.submitTask); if(redeem) requestRedeem(redeem.dataset.redeem); });
document.addEventListener('click',e=>{ const trigger=e.target.closest('[data-open]'); if(!trigger)return; const type=trigger.dataset.open; if(type==='student') openStudentModal(); if(type==='task') openTaskModal(); if(type==='quickPoint') openPointModal(); if(type==='redemptions') openRedemptionsModal(); if(type==='reward') openRewardModal(); if(type==='feedback') openFeedbackModal(); });
$('#modalWrap').addEventListener('click',e=>{if(e.target===$('#modalWrap')||e.target.closest('[data-close]'))closeModal();});

function modalShell(title,body,submit='儲存'){ return `<div class="row between"><h3>${esc(title)}</h3><button class="btn secondary" data-close type="button">關閉</button></div>${body}<div class="actions"><button class="btn secondary" type="button" data-close>取消</button><button class="btn green" type="submit">${esc(submit)}</button></div>`; }
function openStudentModal(){ openModal(`<form id="studentForm">${modalShell('新增學生','<div class="field"><label>孩子姓名</label><input name="name" required placeholder="宇傑"></div><div class="field"><label>年級（選填）</label><input name="grade" placeholder="小六"></div>','建立學生')}</form>`); $('#studentForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{const ref=await addDoc(collection(db,'families',familyId,'students'),{name:String(f.get('name')).trim(),grade:String(f.get('grade')).trim(),points:0,createdAt:serverTimestamp()});selectedStudentId=ref.id;closeModal();}catch(err){notify(err.message,'bad')}}; }
function openTaskModal(){
  if(!state.students.length)return openStudentModal(); const opts=builtins.map((x,i)=>`<option value="${i}">${esc(x.category)}｜${esc(x.title)} (+${x.points})</option>`).join('');
  openModal(`<form id="taskForm">${modalShell('發佈任務',`<div class="field"><label>學生</label><select name="studentId">${fieldStudents()}</select></div><div class="field"><label>內建任務模板</label><select id="templateSelect"><option value="custom">自訂任務</option>${opts}</select></div><div class="field"><label>任務名稱</label><input name="title" required></div><div class="setup-grid"><div class="field"><label>分類</label><select name="category"><option>健康作息</option><option>學科優秀</option><option>其他</option></select></div><div class="field"><label>子分類</label><input name="subCategory" placeholder="數學 / 每日運動"></div><div class="field"><label>完成點數</label><input name="points" type="number" min="1" max="500" value="10" required></div><div class="field"><label>期限（選填）</label><input name="dueAt" type="date"></div></div>`,'發佈')}</form>`);
  $('#templateSelect').onchange=e=>{if(e.target.value==='custom')return;const x=builtins[Number(e.target.value)],f=$('#taskForm');f.title.value=x.title;f.category.value=x.category;f.subCategory.value=x.subCategory;f.points.value=x.points;};
  $('#taskForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await addDoc(collection(db,'families',familyId,'tasks'),{studentId:String(f.get('studentId')),title:String(f.get('title')).trim(),category:String(f.get('category')),subCategory:String(f.get('subCategory')).trim(),points:Number(f.get('points')),dueAt:String(f.get('dueAt')||''),status:'active',createdAt:serverTimestamp(),createdBy:currentUser.uid});closeModal();}catch(err){notify(err.message,'bad')}};
}
function openPointModal(){ if(!state.students.length)return openStudentModal(); openModal(`<form id="pointForm">${modalShell('即時加／扣點',`<div class="field"><label>學生</label><select name="studentId">${fieldStudents()}</select></div><div class="field"><label>原因</label><input name="reason" required placeholder="作業表現傑出"></div><div class="field"><label>點數（扣點請輸入負數）</label><input name="amount" type="number" min="-500" max="500" value="10" required></div>`,'確認記錄')}</form>`); $('#pointForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await adjustPoints(String(f.get('studentId')),Number(f.get('amount')),String(f.get('reason')).trim(),'manual');closeModal();}catch(err){notify(err.message,'bad')}}; }
function openRewardModal(){ if(!student())return; openModal(`<form id="rewardForm">${modalShell('新增獎品',`<div class="field"><label>獎品名稱</label><input name="title" required placeholder="週末多 30 分鐘遊戲時間"></div><div class="field"><label>需要點數</label><input name="cost" type="number" min="1" value="50" required></div><div class="field"><label>補充說明</label><textarea name="description" placeholder="可和孩子一起約定使用方式"></textarea></div>`,'新增獎品')}</form>`); $('#rewardForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);try{await addDoc(collection(db,'families',familyId,'rewards'),{studentId:selectedStudentId,title:String(f.get('title')).trim(),cost:Number(f.get('cost')),description:String(f.get('description')).trim(),active:true,createdAt:serverTimestamp(),createdBy:currentUser.uid});closeModal();parentTab='rewards';render();}catch(err){notify(err.message,'bad')}}; }
function openFeedbackModal(){ if(!student())return; openModal(`<form id="feedbackForm">${modalShell('記錄孩子回饋',`<div class="field"><label>今天的觀察、孩子說的話或心得</label><textarea name="content" required placeholder="今天做功課比較專心，也主動說想把喝水任務完成。"></textarea></div>`,'記錄')}</form>`); $('#feedbackForm').onsubmit=async e=>{e.preventDefault();const content=String(new FormData(e.currentTarget).get('content')).trim();try{await addDoc(collection(db,'families',familyId,'feedback'),{studentId:selectedStudentId,content,authorUid:currentUser.uid,authorRole:role,createdAt:serverTimestamp()});closeModal();if(role==='parent')parentTab='feedback';render();}catch(err){notify(err.message,'bad')}}; }
function openSubmitModal(taskId){ const t=taskById(taskId); if(!t)return; openModal(`<form id="submitTaskForm">${modalShell('回報任務完成',`<div class="notice">回報後不會立刻加點，要由老師核實才會正式獲得 <b>${Number(t.points||0)} 點</b>。</div><h3 style="font-size:16px">${esc(t.title)}</h3><div class="field"><label>補充說明（選填）</label><textarea name="note" placeholder="例如：今天喝了 1600ml"></textarea></div>`,'送出回報')}</form>`); $('#submitTaskForm').onsubmit=async e=>{e.preventDefault();const note=String(new FormData(e.currentTarget).get('note')).trim();try{await addDoc(collection(db,'families',familyId,'submissions'),{taskId,studentId:t.studentId,status:'pending',note,submittedAt:serverTimestamp(),submittedBy:currentUser.uid});closeModal();}catch(err){notify(err.message,'bad')}}; }
function openRedemptionsModal(){ const arr=state.redemptions.filter(x=>x.status==='pending').sort((a,b)=>tsValue(b.requestedAt)-tsValue(a.requestedAt)); const body=arr.length?arr.map(x=>{const r=rewardById(x.rewardId),s=state.students.find(v=>v.id===x.studentId);return `<div class="task"><div class="icon reward">🎁</div><div class="task-main"><h4>${esc(r?.title||'獎品')}</h4><div class="meta">${esc(s?.name||'學生')} · ${Number(r?.cost||0)} 點 · ${fmt(x.requestedAt)}</div></div><button class="btn green" data-approve-redemption="${esc(x.id)}">核實兌換</button></div>`}).join(''):'<div class="empty">目前沒有待核實兌換</div>'; openModal(`<div class="row between"><h3>待核實兌換</h3><button class="btn secondary" data-close>關閉</button></div>${body}`); $$('[data-approve-redemption]').forEach(b=>b.onclick=async()=>{try{await approveRedemption(b.dataset.approveRedemption);closeModal();}catch(err){notify(err.message,'bad')}}); }

async function adjustPoints(studentId,amount,reason,source){
  if(!amount)throw new Error('點數不能是 0'); const sRef=doc(db,'families',familyId,'students',studentId); const lRef=doc(collection(db,'families',familyId,'ledger'));
  await runTransaction(db,async tx=>{const snap=await tx.get(sRef);if(!snap.exists())throw new Error('找不到學生');const current=Number(snap.data().points||0);const next=current+amount;if(next<0)throw new Error('點數不足，不能扣到負數');tx.update(sRef,{points:next,updatedAt:serverTimestamp()});tx.set(lRef,{studentId,amount,reason,source,createdAt:serverTimestamp(),operatorUid:currentUser.uid});});
}
async function approveSubmission(id){
  const subRef=doc(db,'families',familyId,'submissions',id);
  await runTransaction(db,async tx=>{ const subSnap=await tx.get(subRef);if(!subSnap.exists()||subSnap.data().status!=='pending')throw new Error('這筆回報已處理');const sub=subSnap.data(); const tRef=doc(db,'families',familyId,'tasks',sub.taskId),sRef=doc(db,'families',familyId,'students',sub.studentId); const tSnap=await tx.get(tRef); const sSnap=await tx.get(sRef); if(!tSnap.exists()||!sSnap.exists())throw new Error('任務或學生資料不存在');const t=tSnap.data(),amount=Number(t.points||0),lRef=doc(collection(db,'families',familyId,'ledger')); tx.update(subRef,{status:'approved',verifiedAt:serverTimestamp(),verifiedBy:currentUser.uid});tx.update(tRef,{status:'done',verifiedAt:serverTimestamp(),verifiedBy:currentUser.uid});tx.update(sRef,{points:Number(sSnap.data().points||0)+amount,updatedAt:serverTimestamp()});tx.set(lRef,{studentId:sub.studentId,amount,reason:t.title,source:'task_approved',taskId:sub.taskId,submissionId:id,createdAt:serverTimestamp(),operatorUid:currentUser.uid}); });
}
async function rejectSubmission(id){ await updateDoc(doc(db,'families',familyId,'submissions',id),{status:'rejected',verifiedAt:serverTimestamp(),verifiedBy:currentUser.uid}); }
async function requestRedeem(rewardId){ const r=rewardById(rewardId),s=student(); if(!r||!s)return; if(Number(s.points)<Number(r.cost))return; if(state.redemptions.some(x=>x.rewardId===rewardId&&x.status==='pending'))return; try{await addDoc(collection(db,'families',familyId,'redemptions'),{rewardId,studentId:s.id,status:'pending',requestedAt:serverTimestamp(),requestedBy:currentUser.uid});}catch(err){alert(err.message)} }
async function approveRedemption(id){
  const redRef=doc(db,'families',familyId,'redemptions',id);
  await runTransaction(db,async tx=>{ const redSnap=await tx.get(redRef);if(!redSnap.exists()||redSnap.data().status!=='pending')throw new Error('這筆兌換已處理');const red=redSnap.data();const rRef=doc(db,'families',familyId,'rewards',red.rewardId),sRef=doc(db,'families',familyId,'students',red.studentId);const rSnap=await tx.get(rRef);const sSnap=await tx.get(sRef);if(!rSnap.exists()||!sSnap.exists())throw new Error('獎品或學生資料不存在');const reward=rSnap.data(),cost=Number(reward.cost||0),points=Number(sSnap.data().points||0);if(points<cost)throw new Error('學生目前點數不足');const lRef=doc(collection(db,'families',familyId,'ledger'));tx.update(redRef,{status:'approved',verifiedAt:serverTimestamp(),verifiedBy:currentUser.uid});tx.update(sRef,{points:points-cost,updatedAt:serverTimestamp()});tx.set(lRef,{studentId:red.studentId,amount:-cost,reason:'兌換：'+reward.title,source:'reward_redeemed',rewardId:red.rewardId,redemptionId:id,createdAt:serverTimestamp(),operatorUid:currentUser.uid}); });
}

window.addEventListener('offline',()=>{$('#syncDot')?.classList.remove('online');if($('#syncText'))$('#syncText').textContent='目前離線';});
window.addEventListener('online',()=>{if($('#syncText'))$('#syncText').textContent='重新連線中…';});
initConfigScreen();
