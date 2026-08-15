# Kid & Point

一套讓老師與家長共同追蹤孩子表現的成長點數系統。

## 已完成的第一版功能

- 老師端／家長端雙入口
- 學生個別狀態與目前點數
- 老師發佈任務
- 內建任務分類：健康作息、學科優秀
- 家長回報任務完成
- 老師核實完成後才正式發點
- 即時加點與原因紀錄
- 完成時間、核實時間、歷史點數帳本
- 家長自訂獎品
- 孩子提出兌換、老師核實兌換
- 孩子回饋／家長觀察紀錄
- 學習網站連結
- 多學生切換
- 手機版響應式介面

## 即時同步

網站本身可直接部署到 GitHub Pages，但 GitHub Pages 是靜態網站，不會替不同裝置保存共用資料。

系統已內建 Firebase Firestore 即時同步介面：

1. 到 Firebase Console 建立一個專案。
2. 建立 Web App。
3. 啟用 Firestore Database。
4. 在網頁右上角按「同步設定」。
5. 將 Firebase 提供的 Web App config JSON 貼入。
6. 儲存後重新載入，畫面會顯示「Firestore 即時同步中」。

沒有設定 Firebase 時，系統會自動使用瀏覽器 localStorage 的 Demo 單機資料，不會讓頁面失效。

## 建議的正式版安全設定

目前第一版使用 `kidpoint/shared` 作為共享文件，方便先完成即時同步驗證。正式給真實家庭與老師使用前，建議加入 Firebase Authentication，並將資料拆成：

- `users/{uid}`：帳號、角色（teacher / parent）
- `students/{studentId}`：孩子基本狀態
- `tasks/{taskId}`：任務
- `ledger/{entryId}`：點數帳本
- `rewards/{rewardId}`：獎品
- `redemptions/{redemptionId}`：兌換申請
- `feedback/{feedbackId}`：孩子回饋
- `families/{familyId}`：老師與家長的存取關係

正式版 Firestore Rules 應限制：老師才能核實任務與兌換、家長只能查看被授權孩子並新增獎品／回饋、孩子本身不可直接修改點數。

## GitHub Pages

Repository：`xieyaozhong/Kid-and-point`

Pages 建議設定：

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/ (root)`

完成後網址會是：

`https://xieyaozhong.github.io/Kid-and-point/`

## 下一階段建議

第二版可加入：帳號登入、老師／家長邀請碼、孩子端、照片或作品證明、任務期限、每日重複任務、排行榜（可關閉）、週報/月報、成長雷達圖、通知、PWA 安裝到桌面，以及更細緻的權限與 Firestore Security Rules。
