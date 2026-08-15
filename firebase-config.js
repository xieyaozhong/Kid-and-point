// Kid & Point Firebase 設定
// Firebase Web config 不是伺服器私鑰；此檔用於前端初始化 Firebase。
export const firebaseConfig = {
  apiKey: "AIzaSyDLYvNr_2E37zgw4dshHcX5yMCY_lMQ_LA",
  authDomain: "coffee-ship-acc39.firebaseapp.com",
  databaseURL: "https://coffee-ship-acc39-default-rtdb.firebaseio.com",
  projectId: "coffee-ship-acc39",
  storageBucket: "coffee-ship-acc39.firebasestorage.app",
  messagingSenderId: "282578790981",
  appId: "1:282578790981:web:bf04b69dc6e9f33f3cd12c",
  measurementId: "G-0LEM6KTGFG"
};

export function hasFirebaseConfig(config = firebaseConfig) {
  return Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
}
