# Kid & Point

老師、家長與孩子共用的即時成長點數系統。

## Firebase 串接版已完成

目前 `main` 已改為真正的 Firebase 架構，而不是 localStorage 共用 Demo。

### 老師端

- Email / 密碼帳號登入
- 第一次登入可建立家庭空間
- 自動產生 `KP-XXXXXX` 家庭代碼
- 可一鍵分享家庭代碼給家長
- 新增多位學生
- 發佈一般任務
- 建立固定任務：每天 / 平日 / 週末
- 內建健康作息 / 學科優秀任務模板
- 家長或孩子回報完成後，由老師核實
- 核實完成才正式加點
- 固定任務核實後自動恢復，不需隔天重發
- 即時加點 / 扣點
- 完整點數帳本
- 核實獎品兌換
- 查看完成與核實時間
- 查看孩子本週 / 本月成長報告

### 家長端

- Email / 密碼帳號登入
- 輸入老師提供的家庭代碼加入
- 即時查看孩子點數
- 查看進行中任務
- 回報任務完成並附註
- 固定任務同一天不會重複回報
- 查看完成與老師核實時間
- 自訂獎品與兌換點數
- 申請獎品兌換
- 紀錄孩子回饋 / 家長觀察
- 查看學習網站連結
- 查看與分享孩子成長摘要
- 可切換到「孩子模式」

### 孩子模式

頁面：`child.html`

孩子模式沿用家庭裝置上已登入的家長 / 老師 Firebase Session，不建立額外弱密碼帳號，也不繞過 Firestore Rules。

目前包含：

- 選擇孩子
- 今日任務清單
- 每天 / 平日 / 週末固定任務
- 一鍵「我完成了」回報
- 回報後等待老師核實才加點
- 今日任務完成進度
- 目前總點數
- 連續成長天數
- 獎品累積進度
- 簡短鼓勵訊息

孩子模式公開路徑：

`https://xieyaozhong.github.io/Kid-and-point/child.html`

### 即時同步

Firestore 使用 `onSnapshot` 即時監聽，因此老師和家長在不同手機、平板或電腦登入同一家庭後，資料會同步更新。

點數核實與獎品兌換使用 Firestore Transaction，避免重複核實造成重複加點或重複扣點。

---

## 固定任務

老師端新增「每日任務」工具，可建立：

- 每天
- 週一～週五
- 週末

固定任務仍儲存在原本的 `tasks` collection，以 `recurrence` 欄位標記週期。

老師核實完成時，既有 transaction 先正常加點；固定任務模組會再把該任務恢復為 `active`，因此隔天不必重新發布。

家長端與孩子模式會以當天 submission 判定是否已回報，避免同一天重複完成同一個固定任務。

---

## 成長週報 / 月報

主系統登入後會出現「成長報告」入口。

報告頁：`report.html`

目前包含：

- 本週 / 本月切換
- 目前總點數
- 期間獲得點數
- 已核實任務數
- 期間點數淨變化
- 最近 7 天點數圖
- 健康作息 / 學科等任務分布
- 進行中任務、待核實、待兌換摘要
- 近期成就
- 家長觀察 / 老師紀錄
- Web Share / 複製文字分享摘要

報告直接讀取同一個 Firestore 家庭空間，不建立第二份資料。

---

## PWA / 加入手機桌面

Repository 已加入：

- `manifest.webmanifest`
- `sw.js`
- `icon.svg`
- `pwa.js`

支援瀏覽器安裝提示。iPhone / iPad 使用 Safari 時，可透過「分享 → 加入主畫面」把 Kid & Point 當成 App 開啟。

PWA 快捷選單包含：

- 孩子模式
- 成長報告

Service Worker 會快取主要介面資源；Firebase 即時資料仍以線上 Firestore 為主。

---

## Firebase 專案

目前 Web App 已綁定：

```text
Project ID: coffee-ship-acc39
```

Repository 包含：

- `.firebaserc`
- `firebase-config.js`
- `firebase.json`
- `firestore.rules`
- `firebase-health.js`

登入頁提供 Firebase 連線診斷，可檢查 Authentication 與 Cloud Firestore 狀態，並支援寄送重設密碼信。

正式使用前仍應在 Firebase Console 確認：

1. Authentication → Email / Password 已啟用
2. Cloud Firestore 已建立
3. `firestore.rules` 已發布
4. Authentication Authorized domains 包含 `xieyaozhong.github.io`

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

`families/{familyCode}` 內保存：

```text
teachers: [uid]
parents: [uid]
```

Firestore Rules 會以這兩個陣列判定使用者是否是家庭成員，以及是否具有老師權限。

家長只能透過已知的家庭代碼讀取指定家庭，不能列出所有家庭。

---

## 核心流程

### 一般任務

```text
老師發佈任務
→ 家長 / 孩子即時看到
→ 回報完成
→ submission = pending
→ 老師核實
→ transaction 更新學生點數
→ 建立 ledger
→ task = done
→ 老師 / 家長即時同步
```

### 固定任務

```text
老師建立固定任務
→ 每日 / 平日 / 週末顯示
→ 家長 / 孩子回報
→ 老師核實並加點
→ task 暫時完成
→ recurring module 自動恢復 active
→ 下一個有效日期再次可完成
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

孩子模式：

`https://xieyaozhong.github.io/Kid-and-point/child.html`

成長報告：

`https://xieyaozhong.github.io/Kid-and-point/report.html`

---

## 專案檔案

```text
Kid-and-point/
├─ index.html
├─ style.css
├─ app.js
├─ pwa.js
├─ recurring.js
├─ firebase-health.js
├─ manifest.webmanifest
├─ sw.js
├─ icon.svg
├─ child.html
├─ child.css
├─ child.js
├─ report.html
├─ report.css
├─ report.js
├─ firebase-config.js
├─ firestore.rules
├─ firebase.json
├─ .firebaserc
├─ README.md
└─ LICENSE
```

## 下一階段

- Email 驗證
- 家庭成員管理與移除
- 老師邀請其他老師
- 照片或作品證明（Firebase Storage）
- Push Notification
- App Check
- 管理員匯出 CSV / PDF 成長報告
- 更嚴格的孩子獨立帳號 / PIN 模式
