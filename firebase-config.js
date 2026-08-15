// Kid & Point Firebase 設定
// Firebase Web config 不是私鑰；建立 Firebase Web App 後可將設定貼到這裡。
// 未填設定時，頁面也可以從「Firebase 設定」畫面儲存在瀏覽器本機。
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

export function hasFirebaseConfig(config = firebaseConfig) {
  return Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
}
