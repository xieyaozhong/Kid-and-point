import { firebaseConfig } from './firebase-config.js';
import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

const $ = s => document.querySelector(s);

function rulesUrl(){
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules`;
}

function renderFirestoreBlocked(){
  const box=$('#authMessage');
  if(!box) return;
  box.innerHTML=`<div class="notice bad" style="margin-top:10px">
    <b>Firebase 登入已成功，但 Firestore 權限尚未發布</b>
    <div style="margin-top:6px">請到 Firebase → Firestore Database → 規則，把專案的 <code>firestore.rules</code> 內容貼上後按「發布」。</div>
    <a class="btn secondary" style="display:inline-block;margin-top:10px;text-decoration:none" target="_blank" rel="noopener" href="${rulesUrl()}">開啟 Firestore 規則</a>
  </div>`;
}

function mount(){
  const box=$('#authMessage');
  if(!box) return;

  const observer=new MutationObserver(()=>{
    const text=box.textContent||'';
    if(/Missing or insufficient permissions|permission-denied/i.test(text)) renderFirestoreBlocked();
  });
  observer.observe(box,{childList:true,subtree:true,characterData:true});

  try{
    if(!getApps().length) return;
    const auth=getAuth(getApp());
    onAuthStateChanged(auth,user=>{
      if(!user) return;
      setTimeout(()=>{
        const authScreen=$('#authScreen');
        const text=box.textContent||'';
        if(authScreen && !authScreen.classList.contains('hidden') && /讀取帳號資料失敗|Missing or insufficient permissions|permission-denied/i.test(text)){
          renderFirestoreBlocked();
        }
      },300);
    });
  }catch(e){ console.warn('login guard',e); }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount);
else mount();
