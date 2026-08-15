import { firebaseConfig, hasFirebaseConfig } from './firebase-config.js';
import { getApps, getApp, initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, onSnapshot, addDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $=s=>document.querySelector(s);
const state={students:[],tasks:[],submissions:[]};
let db,auth,user,familyId,role=null;
let unsubs=[];

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ts(v){if(!v)return 0;if(v?.toMillis)return v.toMillis();if(v?.seconds)return v.seconds*1000;if(typeof v==='number')return v;return Date.parse(v)||0}
function dayKey(v=Date.now()){const d=new Date(typeof v==='number'?v:ts(v));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function isRecurring(t){return ['daily','weekdays','weekends'].includes(t?.recurrence)}
function recurrenceLabel(t){return t?.recurrence==='weekdays'?'平日':t?.recurrence==='weekends'?'週末':'每日'}
function scheduledToday(t){
  if(!isRecurring(t))return true;
  const day=new Date().getDay();
  if(t.recurrence==='weekdays')return day>=1&&day<=5;
  if(t.recurrence==='weekends')return day===0||day===6;
  return true;
}
function todaySubmission(taskId){
  const today=dayKey();
  return state.submissions
    .filter(x=>x.taskId===taskId && ['pending','approved'].includes(x.status) && dayKey(x.submittedAt)===today)
    .sort((a,b)=>ts(b.submittedAt)-ts(a.submittedAt))[0]||null;
}
function clear(){unsubs.forEach(f=>f());unsubs=[];state.students=[];state.tasks=[];state.submissions=[];role=null;familyId=null}

function ensureFirebase(){
  if(!hasFirebaseConfig(firebaseConfig))return null;
  const app=getApps().length?getApp():initializeApp(firebaseConfig);
  db=getFirestore(app);auth=getAuth(app);return app;
}

async function connect(u){
  clear();user=u;if(!u)return;
  try{
    const p=await getDoc(doc(db,'users',u.uid));
    if(!p.exists()||!p.data().familyId)return;
    familyId=p.data().familyId;
    const f=await getDoc(doc(db,'families',familyId));
    if(!f.exists())return;
    const fd=f.data();
    role=fd.teachers?.includes(u.uid)?'teacher':fd.parents?.includes(u.uid)?'parent':null;
    if(!role)return;
    for(const name of ['students','tasks','submissions']){
      unsubs.push(onSnapshot(collection(db,'families',familyId,name),snap=>{
        state[name]=snap.docs.map(d=>({id:d.id,...d.data()}));
        if(name==='tasks'&&role==='teacher')reopenRecurringTasks();
        requestAnimationFrame(patchUI);
      }));
    }
    patchUI();
  }catch(e){console.error('recurring module',e)}
}

async function reopenRecurringTasks(){
  const done=state.tasks.filter(t=>isRecurring(t)&&t.status==='done');
  for(const t of done){
    try{
      await updateDoc(doc(db,'families',familyId,'tasks',t.id),{
        status:'active',
        lastCompletedAt:t.verifiedAt||serverTimestamp(),
        repeatReopenedAt:serverTimestamp()
      });
    }catch(e){console.error('reopen recurring task',e)}
  }
}

function mountChildLink(){
  const userbar=$('.userbar');
  if(!userbar||$('#childModeLink'))return;
  const a=document.createElement('a');
  a.id='childModeLink';a.className='btn secondary';a.href='./child.html';a.textContent='孩子模式';
  const logout=$('#logoutBtn');userbar.insertBefore(a,logout||null);
}

function mountTeacherTool(){
  const quick=$('#teacherView .quick');
  if(role!=='teacher'||!quick||$('#recurringTaskBtn'))return;
  const b=document.createElement('button');
  b.id='recurringTaskBtn';b.type='button';
  b.innerHTML='<span>↻</span><b>每日任務</b><div class="meta">喝水、運動、閱讀自動重複</div>';
  b.onclick=openRecurringModal;quick.appendChild(b);
}

function renderRecurringPanel(){
  const aside=$('#teacherView aside');
  if(role!=='teacher'||!aside)return;
  let panel=$('#recurringTaskPanel');
  if(!panel){
    panel=document.createElement('section');panel.id='recurringTaskPanel';panel.className='panel';panel.style.marginTop='18px';aside.appendChild(panel);
  }
  const selected=$('#studentSelect')?.value||state.students[0]?.id||'';
  const items=state.tasks.filter(t=>t.studentId===selected&&isRecurring(t));
  panel.innerHTML=`<h3 class="section-title">固定任務</h3>${items.length?items.map(t=>`<div class="history-item"><div><b>${esc(t.title)}</b><div class="meta">${recurrenceLabel(t)} · ${esc(t.subCategory||t.category||'任務')}</div></div><span class="pt">+${Number(t.points||0)}</span></div>`).join(''):'<div class="empty">尚未建立每日任務</div>'}`;
}

function patchParentTaskButtons(){
  if(role!=='parent')return;
  document.querySelectorAll('[data-submit-task]').forEach(btn=>{
    const t=state.tasks.find(x=>x.id===btn.dataset.submitTask);if(!t||!isRecurring(t))return;
    const row=btn.closest('.task');
    const main=row?.querySelector('.task-main');
    if(main&&!main.querySelector('[data-repeat-badge]')){
      const badge=document.createElement('span');badge.className='badge';badge.dataset.repeatBadge='1';badge.textContent='↻ '+recurrenceLabel(t);main.appendChild(badge);
    }
    const sub=todaySubmission(t.id);
    if(!scheduledToday(t)){btn.disabled=true;btn.textContent='今日不執行';return;}
    if(sub){btn.disabled=true;btn.textContent=sub.status==='pending'?'已回報・待核實':'今日已完成';}
  });
}

function patchUI(){
  mountChildLink();mountTeacherTool();renderRecurringPanel();patchParentTaskButtons();
}

function openRecurringModal(){
  const wrap=$('#modalWrap'),body=$('#modalBody');if(!wrap||!body)return;
  if(!state.students.length){alert('請先新增學生');return;}
  body.innerHTML=`<form id="recurringTaskForm">
    <div class="row between"><h3>建立固定任務</h3><button type="button" class="btn secondary" data-close>關閉</button></div>
    <div class="notice">固定任務核實後會自動回到下一次可完成狀態，同一天不會重複回報。</div>
    <div class="field"><label>學生</label><select name="studentId">${state.students.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label>任務名稱</label><input name="title" required placeholder="完成今日指定喝水量"></div>
    <div class="setup-grid">
      <div class="field"><label>週期</label><select name="recurrence"><option value="daily">每天</option><option value="weekdays">週一～週五</option><option value="weekends">週末</option></select></div>
      <div class="field"><label>分類</label><select name="category"><option>健康作息</option><option>學科優秀</option><option>其他</option></select></div>
      <div class="field"><label>子分類</label><input name="subCategory" placeholder="每日運動 / 閱讀"></div>
      <div class="field"><label>完成點數</label><input name="points" type="number" min="1" max="500" value="10" required></div>
    </div>
    <div class="actions"><button type="button" class="btn secondary" data-close>取消</button><button class="btn green" type="submit">建立固定任務</button></div>
  </form>`;
  wrap.classList.add('open');
  $('#recurringTaskForm').onsubmit=async e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);const submit=e.currentTarget.querySelector('[type="submit"]');submit.disabled=true;
    try{
      await addDoc(collection(db,'families',familyId,'tasks'),{
        studentId:String(f.get('studentId')),title:String(f.get('title')).trim(),category:String(f.get('category')),subCategory:String(f.get('subCategory')).trim(),points:Number(f.get('points')),recurrence:String(f.get('recurrence')),status:'active',dueAt:'',createdAt:serverTimestamp(),createdBy:user.uid
      });
      wrap.classList.remove('open');body.innerHTML='';
    }catch(err){alert('建立固定任務失敗：'+err.message)}finally{submit.disabled=false;}
  };
}

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-submit-task]');if(!b)return;
  const t=state.tasks.find(x=>x.id===b.dataset.submitTask);if(!t||!isRecurring(t))return;
  if(!scheduledToday(t)||todaySubmission(t.id)){
    e.preventDefault();e.stopImmediatePropagation();patchParentTaskButtons();
  }
},true);

$('#studentSelect')?.addEventListener('change',()=>requestAnimationFrame(renderRecurringPanel));
const observer=new MutationObserver(()=>requestAnimationFrame(patchUI));
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

if(ensureFirebase())onAuthStateChanged(auth,connect);
