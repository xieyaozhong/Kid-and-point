import { firebaseConfig, hasFirebaseConfig } from './firebase-config.js';
import { getApps, getApp, initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $ = (s) => document.querySelector(s);

function ensureFirebase(){
  if(!hasFirebaseConfig(firebaseConfig)) throw new Error('Firebase Web config 尚未完整設定');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { app, auth:getAuth(app), db:getFirestore(app) };
}

function resultRow(label, text, ok=true){
  return `<div style="display:flex;gap:8px;align-items:flex-start;margin-top:7px"><span aria-hidden="true">${ok?'✓':'!'}</span><div><b>${label}</b><div class="meta">${text}</div></div></div>`;
}

async function testAuthProvider(){
  const url=`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  try{
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'kidpoint-diagnostic@example.invalid',password:'KidPoint-Diagnostic-Only',returnSecureToken:true})});
    if(r.ok) return {ok:true,text:'Email/Password Authentication 可使用'};
    const data=await r.json().catch(()=>({}));
    const message=data?.error?.message||`HTTP ${r.status}`;
    if(/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|USER_DISABLED/.test(message)) return {ok:true,text:'Email/Password Authentication 已啟用'};
    if(/CONFIGURATION_NOT_FOUND/.test(message)) return {ok:false,text:'Authentication 尚未初始化。先建立 Authentication，再開啟 Email/Password。'};
    if(/OPERATION_NOT_ALLOWED/.test(message)) return {ok:false,text:'Email/Password 尚未啟用，請到 Authentication → Sign-in method 開啟'};
    if(/API_KEY_INVALID|PROJECT_NOT_FOUND/.test(message)) return {ok:false,text:'Firebase Web config 無效：'+message};
    return {ok:false,text:'Authentication 回應：'+message};
  }catch(e){
    return {ok:false,text:'Authentication 網路檢查失敗：'+e.message};
  }
}

async function testFirestore(db){
  try{
    const snap=await getDoc(doc(db,'users','__kidpoint_diagnostic__'));
    return {ok:true,text:snap.exists()?'Firestore 可連線':'Firestore 可連線，測試文件不存在（正常）'};
  }catch(e){
    if(e?.code==='permission-denied') return {ok:true,text:'Firestore 可連線，Security Rules 正在保護未授權資料'};
    if(e?.code==='failed-precondition' || e?.code==='not-found') return {ok:false,text:'Cloud Firestore 預設資料庫尚未建立。請先建立 Firestore Database。'};
    if(e?.code==='unavailable') return {ok:false,text:'Firestore 暫時無法連線'};
    return {ok:false,text:`Firestore：${e?.code||e?.message||'未知錯誤'}`};
  }
}

function mount(){
  const card=$('#authScreen .auth-card');
  if(!card || $('#firebaseHealthPanel')) return;
  const project=firebaseConfig.projectId || '';
  const panel=document.createElement('div');
  panel.id='firebaseHealthPanel';
  panel.className='notice';
  panel.style.marginTop='14px';
  panel.innerHTML=`
    <div class="row between" style="gap:12px;align-items:flex-start">
      <div><b>Firebase 已綁定</b><div class="meta">${project || '尚未設定專案'}</div></div>
      <button id="firebaseDiagnoseBtn" class="btn secondary" type="button">檢查連線</button>
    </div>
    <div id="firebaseHealthResult" class="meta" style="margin-top:8px">Web App 設定已載入；Authentication 與 Firestore 必須另外啟用。</div>
    <div class="row" style="margin-top:10px;flex-wrap:wrap">
      <a class="btn secondary" target="_blank" rel="noopener" href="https://console.firebase.google.com/project/${project}/authentication/providers">開啟 Authentication</a>
      <a class="btn secondary" target="_blank" rel="noopener" href="https://console.firebase.google.com/project/${project}/firestore">開啟 Firestore</a>
    </div>
    <button id="forgotPasswordBtn" class="btn secondary" type="button" style="width:100%;margin-top:10px">忘記密碼／寄重設信</button>`;
  card.appendChild(panel);

  $('#firebaseDiagnoseBtn').addEventListener('click',async()=>{
    const btn=$('#firebaseDiagnoseBtn');
    const out=$('#firebaseHealthResult');
    btn.disabled=true;btn.textContent='檢查中…';out.innerHTML='正在檢查 Firebase Authentication 與 Firestore…';
    try{
      const {db}=ensureFirebase();
      const [a,f]=await Promise.all([testAuthProvider(),testFirestore(db)]);
      out.innerHTML=resultRow('Web App',`${firebaseConfig.projectId} / ${firebaseConfig.appId}`,true)+resultRow('Authentication',a.text,a.ok)+resultRow('Cloud Firestore',f.text,f.ok);
    }catch(e){
      out.innerHTML=resultRow('Firebase',e.message,false);
    }finally{btn.disabled=false;btn.textContent='檢查連線';}
  });

  $('#forgotPasswordBtn').addEventListener('click',async()=>{
    const email=$('#authForm input[name="email"]')?.value?.trim();
    const out=$('#firebaseHealthResult');
    if(!email){out.innerHTML=resultRow('忘記密碼','先在 Email 欄輸入你的帳號 Email',false);return;}
    try{
      const {auth}=ensureFirebase();
      await sendPasswordResetEmail(auth,email);
      out.innerHTML=resultRow('重設密碼',`已送出重設信到 ${email}，請檢查收件匣與垃圾郵件`,true);
    }catch(e){
      const map={
        'auth/invalid-email':'Email 格式不正確',
        'auth/operation-not-allowed':'Firebase 尚未啟用 Email/Password',
        'auth/configuration-not-found':'Firebase Authentication 尚未初始化',
        'auth/network-request-failed':'目前網路連線失敗'
      };
      out.innerHTML=resultRow('重設密碼',map[e?.code]||e?.message||'寄送失敗',false);
    }
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
else mount();
