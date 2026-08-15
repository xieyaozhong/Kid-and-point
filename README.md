# Kid & Point

老師與家長即時同步的孩子成長點數系統。

## Firebase 串接版已完成

目前 `main` 已改為真正的 Firebase 架構，而不是 localStorage 共用 Demo。

### 老師端

- Email / 密碼帳號登入
- 第一次登入可建立家庭空間
- 自動產生 `KP-XXXXXX` 家庭代碼
- 新增多位學生
- 發佈任務
- 內建健康作息 / 學科優秀任務模板
- 家長回報完成後，由老師核實
- 核實完成才正式加點
- 即時加點 / 扣點
- 完整點數帳本
- 核實獎品兌換
- 查看完成與核實時間

### 家長端

- Email / 密碼帳號登入
- 輸入老師提供的家庭代碼加入
- 即時查看孩子點數
- 查看進行中任務
- 回報任務完成並附註
- 查看完成與老師核實時間
- 自訂獎品與兌換點數
- 申請獎品兌換
- 紀錄孩子回饋 / 家長觀察
- 查看學習網站連結

### 即時同步

Firestore 使用 `onSnapshot` 即時監聽，因此老師和家長在不同手機、平板或電腦登入同一家庭後，資料會同步更新。

點數核實與獎品兌換使用 Firestore Transaction，避免重複核實造成重複加點或重複扣點。

---

## 第一次 Firebase 設定

### 1. 建立 Firebase Project

進入 Firebase Console，建立一個新 Project。

### 2. 建立 Web App

在 Project Overview 內新增 Web App，Firebase 會提供：

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

網站第一次開啟時會直接顯示「連接 Firebase」畫面，可以把這些值貼進去。

也可以直接修改：

`firebase-config.js`

把 Firebase 提供的 config 寫進檔案後，所有裝置就不需要各自輸入設定。

> Firebase Web config 是用來識別 Firebase Project 的前端設定，不應把它當成伺服器私鑰。真正的資料保護要靠 Authentication 與 Firestore Security Rules。

### 3. 啟用 Authentication

Firebase Console → Authentication → Sign-in method

啟用：

- Email / Password

接著到 Authentication → Settings → Authorized domains，加入：

```text
xieyaozhong.github.io
```

如果之後改成自己的網域，也要把該網域加入 Authorized domains。

### 4. 建立 Cloud Firestore

Firebase Console → Firestore Database → Create database

建議正式使用時不要使用永久 Test Mode。

### 5. 套用 Security Rules

Repository 已包含：

- `firestore.rules`
- `firebase.json`

可以直接把 `firestore.rules` 內容貼到 Firebase Console → Firestore → Rules。

或安裝 Firebase CLI 後：

```bash
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

---

## Firestore 資料結構

```text
users/{uid}

families/{familyCode}
├─ students/{studentId}
├─ tasks/{taskId}
├─ submissions/{submissionId}
├─ rewards/{rewardId}
├─ redemptions/{redemptionId}
├─ feedback/{feedbackId}
└─ ledger/{entryId}
```

`families/{familyCode}` 內會保存：

```text
teachers: [uid]
parents: [uid]
```

Firestore Rules 會以這兩個陣列判定使用者是否是家庭成員，以及是否具有老師權限。

家長只能透過已知的家庭代碼讀取指定家庭，不能列出所有家庭。

---

## 核心流程

### 任務

```text
老師發佈任務
→ 家長即時看到
→ 家長回報完成
→ submission = pending
→ 老師核實
→ transaction 更新學生點數
→ 建立 ledger
→ task = done
→ 老師 / 家長即時同步
```

### 獎品兌換

```text
家長建立獎品
→ 申請兌換
→ redemption = pending
→ 老師核實
→ transaction 檢查目前點數
→ 扣除點數
→ 建立負數 ledger
→ 即時同步
```

---

## GitHub Pages

Repository：`xieyaozhong/Kid-and-point`

Pages：

```text
Source: Deploy from a branch
Branch: main
Folder: / (root)
```

公開網址：

`https://xieyaozhong.github.io/Kid-and-point/`

---

## 專案檔案

```text
Kid-and-point/
├─ index.html
├─ style.css
├─ app.js
├─ firebase-config.js
├─ firestore.rules
├─ firebase.json
├─ README.md
└─ LICENSE
```

## 下一階段

- 忘記密碼 / Email 驗證
- 家庭成員管理與移除
- 老師邀請其他老師
- 任務週期 / 每日重複
- 照片或作品證明（Firebase Storage）
- 每週 / 每月成長圖表
- Push Notification
- 孩子端
- PWA 安裝到手機桌面
- App Check
