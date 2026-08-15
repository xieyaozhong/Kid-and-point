import { firebaseConfig, hasFirebaseConfig } from './firebase-config.js';
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, onSnapshot, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $=s=>document.querySelector(s);
const state={family:null,students:[],tasks:[],submissions:[],rewards:[]};
let auth,db,user,familyId,selectedStudentId='';
let unsubs=[];

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ts(v){if(!v)return 0;if(v?.toMillis)return v.toMillis();if(v?.seconds)return v.seconds*1000;if(typeof v==='number')return v;return Date.parse(v)||0}
function dayKey(v=Date.now()){const d=new Date(typeof v==='number'?v:ts(v));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function isRecurring(t){return ['daily','weekdays','weekends'].includes(t?.recurrence)}
function scheduledToday(t){const day=new Date().getDay();if(t?.recurrence==='weekdays')return day>=1&&day<=5;if(t?.recurrence==='weekends')return day===0||day===6;return true}
function recurrenceLabel(t){return t?.recurrence==='weekdays'?'平日':t?.recurrence==='weekends'?'週末':t?.recurrence==='daily'?'每日':''}
function student(){return state.students.find(s=>s.id===selectedStudentId)||state.students[0]||null}
function taskSubmission(t){
  const list=state.submissions.filter(x=>x.taskId===t.id&&['pending','approved'].includes(x.status));
  const scoped=isRecurring(t)?list.filter(x=>dayKey(x.submittedAt)===dayKey()):list;
  return scoped.sort((a,b)=>ts(b.submittedAt)-ts(a.submittedAt))[0]||null;
}
function fail(text){$('#childLoading').innerHTML=`<div><b>${esc(text)}</b><div style="margin-top:14px"><a class="btn secondary" href="./">返回登入頁</a></div></div>`}
function cleanup(){unsubs.forEach(f=>f());unsubs=[]}

function consecutiveGrowthDays(s){
  if(!s)return 0;
  const days=new Set(state.submissions.filter(x=>x.studentId===s.id&&x.status==='approved').map(x=>dayKey(x.verifiedAt||x.submittedAt)));
  let streak=0,d=new Date();
  if(!days.has(dayKey(+d))){d.setDate(d.getDate()-1)}
  while(days.has(dayKey(+d))){streak++;d.setDate(d.getDate()-1)}
  return streak;
}

function render(){
  const s=student();
  $('#childLoading').classList.add('hidden');$('#childApp').classList.remove('hidden');
  const select=$('#childStudent');
  select.innerHTML=state.students.length?state.students.map(x=>`<option value="${esc(x.id)}" ${x.id===selectedStudentId?'selected':''}>${esc(x.name)}</option>`).join(''):'<option>尚無學生</option>';
  select.disabled=!state.students.length;
  if(!s){$('#childTasks').innerHTML='<div class="child-empty">老師還沒有建立學生資料</div>';return;}
  $('#childName').textContent=`${s.name}，今天想先完成哪一件？`;
  $('#childPoints').textContent=Number(s.points||0);
  const tasks=state.tasks.filter(t=>t.studentId===s.id&&t.status==='active'&&scheduledToday(t));
  const complete=tasks.filter(t=>taskSubmission(t)?.status==='approved').length;
  const pending=tasks.filter(t=>taskSubmission(t)?.status==='pending').length;
  const progress=tasks.length?Math.round(((complete+pending*.5)/tasks.length)*100):100;
  $('#childProgress').style.width=Math.min(100,progress)+'%';
  $('#childProgressText').textContent=`今日 ${complete} 完成 · ${pending} 待核實 · 共 ${tasks.length} 項`;
  $('#todayBadge').textContent=`${tasks.length} 項`;
  $('#childStreak').textContent=`連續成長 ${consecutiveGrowthDays(s)} 天`;
  $('#childMessage').textContent=tasks.length===0?'今天沒有指定任務，去做一件讓自己開心又有收穫的事吧。':complete===tasks.length?'今天的任務都完成了，很漂亮。':complete+pending>0?'已經開始累積了，再完成一件就更接近今天的目標。':'先挑最簡單的一件開始，做完再決定下一件。';

  $('#childTasks').innerHTML=tasks.length?tasks.map(t=>{
    const sub=taskSubmission(t);const done=sub?.status==='approved',wait=sub?.status==='pending';
    const repeat=isRecurring(t)?`<span class="badge">↻ ${recurrenceLabel(t)}</span>`:'';
    const action=done?'<button class="btn child-done" disabled>今天完成 ✓</button>':wait?'<button class="btn child-pending" disabled>等老師核實</button>':`<button class="btn green" data-child-submit="${esc(t.id)}">我完成了</button>`;
    return `<div class="child-task"><div class="child-task-icon ${t.category==='健康作息'?'health':''}">${t.category==='健康作息'?'🌱':'📚'}</div><div><h4>${esc(t.title)}</h4><div class="meta">${esc(t.category||'任務')} · ${esc(t.subCategory||'')} · 完成 +${Number(t.points||0)} 點</div>${repeat}</div>${action}</div>`;
  }).join(''):'<div class="child-empty">今天沒有待完成的任務 🎉</div>';

  const rewards=state.rewards.filter(r=>r.studentId===s.id&&r.active!==false).sort((a,b)=>Number(a.cost)-Number(b.cost)).slice(0,4);
  $('#childRewards').innerHTML=rewards.length?rewards.map(r=>{const cost=Number(r.cost||0),points=Number(s.points||0),pct=Math.min(100,cost?points/cost*100:100),left=Math.max(0,cost-points);return `<div class="reward-line"><b>🎁 ${esc(r.title)}</b><div class="meta">${left===0?'已經可以兌換！':`還差 ${left} 點`} · 需要 ${cost} 點</div><div class="reward-meter"><i style="width:${pct}%"></i></div></div>`}).join(''):'<div class="child-empty">還沒有設定獎品</div>';
}

async function connect(u){
  cleanup();user=u;if(!u)return fail('請先在 Kid & Point 登入家長或老師帳號，再開啟孩子模式。');
  try{
    const p=await getDoc(doc(db,'users',u.uid));if(!p.exists()||!p.data().familyId)return fail('這個帳號還沒有加入家庭');
    familyId=p.data().familyId;const f=await getDoc(doc(db,'families',familyId));if(!f.exists())return fail('找不到家庭資料');
    const fd=f.data();if(!fd.teachers?.includes(u.uid)&&!fd.parents?.includes(u.uid))return fail('這個帳號沒有家庭存取權限');
    state.family={id:f.id,...fd};
    for(const name of ['students','tasks','submissions','rewards']){
      unsubs.push(onSnapshot(collection(db,'families',familyId,name),snap=>{
        state[name]=snap.docs.map(d=>({id:d.id,...d.data()}));
        if(name==='students'&&(!selectedStudentId||!state.students.some(s=>s.id===selectedStudentId)))selectedStudentId=state.students[0]?.id||'';
        render();
      },e=>fail('同步失敗：'+(e.code||e.message))));
    }
  }catch(e){fail('讀取孩子模式失敗：'+e.message)}
}

$('#childStudent').addEventListener('change',e=>{selectedStudentId=e.target.value;render()});
$('#childTasks').addEventListener('click',async e=>{
  const b=e.target.closest('[data-child-submit]');if(!b)return;
  const t=state.tasks.find(x=>x.id===b.dataset.childSubmit),s=student();if(!t||!s||taskSubmission(t))return;
  b.disabled=true;b.textContent='送出中…';
  try{
    await addDoc(collection(db,'families',familyId,'submissions'),{taskId:t.id,studentId:s.id,status:'pending',note:'孩子模式回報',source:'child_mode',submittedAt:serverTimestamp(),submittedBy:user.uid});
  }catch(err){alert('回報失敗：'+err.message);b.disabled=false;b.textContent='我完成了';}
});

if(!hasFirebaseConfig(firebaseConfig))fail('Firebase 尚未完成設定');
else{
  const app=getApps().length?getApp():initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);onAuthStateChanged(auth,connect);
}
