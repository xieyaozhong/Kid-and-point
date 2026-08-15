// Kid & Point Firebase 設定
// Firebase Web config 不是私鑰；建立 Firebase Web App 後可將設定貼到這裡。
// apiKey 尚待從 Firebase Console 的 Web App Config 補上。
export const firebaseConfig = {
  apiKey: "",
  authDomain: "coffee-ship-acc39.firebaseapp.com",
  projectId: "coffee-ship-acc39",
  storageBucket: "",
  messagingSenderId: "282578790981",
  appId: "1:282578790981:web:bf04b69dc6e9f33f3cd12c"
};

export function hasFirebaseConfig(config = firebaseConfig) {
  return Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
}
