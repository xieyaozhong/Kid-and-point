import { firebaseConfig, hasFirebaseConfig } from './firebase-config.js';
import { getApps, getApp, initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const $ = (s) => document.querySelector(s);

function getFirebase(){
  if(!hasFirebaseConfig(firebaseConfig)) throw new Error('Firebase Web config 尚未完整設定');
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth:getAuth(app), db:getFirestore(app) };
}

function showMessage(text, kind='bad'){
  const box=$('#authMessage');
  if(!box) return;
  box.innerHTML=`<div class="notice ${kind}" style="margin-top:10px">${String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>`;
}

function friendlyError(error){
  const map={
    'auth/email-already-in-use':'這個 Email 已經建立過帳號，請直接切回「登入」。',
    'auth/invalid-email':'Email 格式不正確。',
    'auth/weak-password':'密碼強度不足，請至少使用 6 個字元。',
    'auth/operation-not-allowed':'Firebase 尚未啟用 Email/Password。請到 Firebase Console → Authentication → Sign-in method → Email/Password 開啟後再試一次。',
    'auth/configuration-not-found':'這個 Firebase 專案尚未初始化 Authentication。請先在 Firebase Console 建立 Authentication，並啟用 Email/Password。',
    'auth/admin-restricted-operation':'Firebase 目前禁止一般使用者自行建立帳號，請檢查 Authentication 的使用者註冊設定。',
    'auth/too-many-requests':'Firebase 暫時限制這台裝置建立新帳號，請稍後再試或換一個網路。',
    'auth/network-request-failed':'目前無法連上 Firebase Authentication，請檢查網路後再試。',
    'auth/invalid-api-key':'Firebase API Key 無效，請重新確認 Web App 設定。',
    'auth/app-not-authorized':'這個 Firebase Web App 尚未被授權使用 Authentication。',
    'auth/internal-error':'Firebase Authentication 暫時發生內部錯誤，請再試一次。'
  };
  return map[error?.code] || error?.message || '建立帳號失敗';
}

function currentRole(){
  return document.querySelector('.role-card.active')?.dataset?.role || 'teacher';
}

async function handleRegister(event){
  if(!$('#registerTab')?.classList.contains('active')) return;

  // Override the legacy registration handler only. Login still uses app.js.
  event.preventDefault();
  event.stopImmediatePropagation();

  const form=event.currentTarget;
  const button=$('#authSubmit');
  const f=new FormData(form);
  const name=String(f.get('name')||'').trim();
  const email=String(f.get('email')||'').trim();
  const password=String(f.get('password')||'');
  const role=currentRole();

  if(!name){ showMessage('請輸入你的名稱'); return; }
  if(!email){ showMessage('請輸入 Email'); return; }
  if(password.length<6){ showMessage('密碼至少需要 6 個字元'); return; }

  button.disabled=true;
  button.textContent='建立帳號中…';
  showMessage('正在建立 Firebase Authentication 帳號…','ok');

  localStorage.setItem('kidpoint.roleHint',role);
  localStorage.setItem('kidpoint.pendingName',name);

  try{
    const {auth,db}=getFirebase();
    const cred=await createUserWithEmailAndPassword(auth,email,password);

    // Auth account creation is the source of truth. Firestore profile provisioning
    // runs after Auth succeeds, so a Firestore issue cannot falsely report that
    // the Firebase account itself was not created.
    try{
      await setDoc(doc(db,'users',cred.user.uid),{
        name,
        email,
        roleHint:role,
        familyId:null,
        createdAt:serverTimestamp()
      },{merge:true});
      localStorage.removeItem('kidpoint.pendingName');
      showMessage('帳號建立成功，正在進入第一次設定…','ok');
    }catch(profileError){
      console.error('profile provisioning failed',profileError);
      const code=profileError?.code||'';
      if(code==='not-found' || code==='failed-precondition'){
        showMessage('Firebase 帳號已建立成功，但 Cloud Firestore 尚未建立。請先建立 Firestore Database，再重新登入。','bad');
      }else{
        showMessage('Firebase 帳號已建立成功，但 Firestore 個人資料尚未寫入。請確認 Firestore Database 已建立並套用 firestore.rules。','bad');
      }
    }
  }catch(error){
    console.error('registration failed',error);
    showMessage(friendlyError(error),'bad');
  }finally{
    button.disabled=false;
    button.textContent='建立帳號';
  }
}

function mount(){
  const form=$('#authForm');
  if(!form || form.dataset.authFixMounted==='1') return;
  form.dataset.authFixMounted='1';
  form.addEventListener('submit',handleRegister,true);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
else mount();
