let deferredInstallPrompt = null;

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

async function shareText(title, text){
  try{
    if(navigator.share){
      await navigator.share({title,text,url:location.href});
      return true;
    }
    await navigator.clipboard.writeText(`${text}\n${location.href}`);
    return true;
  }catch{
    return false;
  }
}

function ensureAppActions(){
  const userbar=document.querySelector('.userbar');
  if(userbar && !document.querySelector('#reportLink')){
    const link=document.createElement('a');
    link.id='reportLink';
    link.className='btn secondary';
    link.href='./report.html';
    link.textContent='成長報告';
    userbar.insertBefore(link,document.querySelector('#logoutBtn'));
  }

  if(userbar && !document.querySelector('#installAppBtn') && !isStandalone()){
    const btn=document.createElement('button');
    btn.id='installAppBtn';
    btn.className='btn secondary';
    btn.type='button';
    btn.textContent='安裝 App';
    btn.hidden=!deferredInstallPrompt && !isIOS();
    btn.addEventListener('click',async()=>{
      if(deferredInstallPrompt){
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt=null;
        btn.hidden=true;
      }else if(isIOS()){
        alert('在 Safari 點「分享」按鈕，再選「加入主畫面」，就能把 Kid & Point 當成 App 使用。');
      }
    });
    userbar.insertBefore(btn,document.querySelector('#logoutBtn'));
  }

  const familybar=document.querySelector('.familybar .row');
  const code=document.querySelector('#familyCode')?.textContent?.trim();
  const codeWrap=document.querySelector('#familyCodeWrap');
  if(familybar && codeWrap && !codeWrap.classList.contains('hidden') && code && !document.querySelector('#shareFamilyBtn')){
    const btn=document.createElement('button');
    btn.id='shareFamilyBtn';
    btn.type='button';
    btn.className='btn secondary';
    btn.textContent='分享家庭代碼';
    btn.addEventListener('click',async()=>{
      const ok=await shareText('Kid & Point 家庭邀請',`請加入 Kid & Point，家庭代碼：${code}`);
      btn.textContent=ok?'已分享 / 複製':'分享失敗';
      setTimeout(()=>btn.textContent='分享家庭代碼',1500);
    });
    familybar.insertBefore(btn,document.querySelector('#studentSelect'));
  }
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  ensureAppActions();
  const btn=document.querySelector('#installAppBtn');
  if(btn) btn.hidden=false;
});

window.addEventListener('appinstalled',()=>{
  deferredInstallPrompt=null;
  document.querySelector('#installAppBtn')?.remove();
});

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.error));
}

const observer=new MutationObserver(()=>ensureAppActions());
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
window.addEventListener('DOMContentLoaded',ensureAppActions);

// Optional modules are kept separate from the core teacher/parent workflow.
import('./auth-fix.js').catch(console.error);
import('./login-guard.js').catch(console.error);
import('./firebase-health.js').catch(console.error);
import('./recurring.js').catch(console.error);
