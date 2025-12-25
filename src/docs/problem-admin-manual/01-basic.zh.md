# 題目管理使用說明（總覽）

本說明適用於「建立新題目」與「編輯題目」頁面。所有內容為前端固定文件，僅供閱讀與操作參考。

---

## 建議操作順序

1. **Problem name / Hidden（題目名稱與是否隱藏）**
2. **設定題目敘述**（輸入輸出格式、說明與範例）
3. **設定 Configuration**
   - Allowed Languages / Tags / Quota（可提交語言、標籤、提交配額）
   - Accepted Format（提交格式：code / zip）
   - Trial Mode（試跑）
   - AI VTuber（AI 助教）
   - Network & Sidecars（網路與 sidecar 容器）
   - Artifact Collection（產物收集）
4. **設定 Pipeline（評測流程）**
   - File Access（Allow Read / Allow Write）
   - Execution Mode（執行模式：general / functionOnly / interactive）
   - Custom Checker / Custom Scoring Script（自訂檢查器 / 計分腳本）
   - Library Restrictions（靜態分析限制）
5. **上傳 Test Data（測資）**
6. **上傳 Resource Data（學生 / 教師資源檔）**

---

## Test Data Zip（測資壓縮檔）格式

- 壓縮檔內放置 `.in` 與 `.out` 檔案
- **`.in` 與 `.out` 檔案數量必須一致**
- 命名規則（前綴 2 碼代表 Task 編號）：
  - `00_xx.in` / `00_xx.out` 代表 Task 0 的多個 case
  - `01_xx.in` / `01_xx.out` 代表 Task 1 的多個 case
- 系統會依照 `00`, `01`, `02`… 的前綴自動分組成 tasks

> 建議：先準備好 Test Data Zip，再回到頁面調整各 task 的 time/memory/score。

---

## Resource Data（資源檔）前置條件（重要）

Resource Data 會依照 Test Data 的 task/case 結構做驗證，因此：

- **必須先上傳 Test Data Zip**，讓 tasks 結構建立完成
- Student Resource Data（學生專用資源）需要 **Pipeline > Allow Read** 才能啟用；Teacher Resource Data（教師資源）則不受此限制

---

## 常見問題（FAQ）

### Q1：送出時被阻擋但不知道哪裡錯？

- 頁面會在底部顯示錯誤摘要（Submission blocked…），點擊該訊息會自動展開對應區塊並滾動到錯誤位置

### Q2：Quota 要如何填寫？

- `-1` 表示 Unlimited（不限制）
- 或填入 `1 ~ 500` 的整數限制提交次數

### Q3：Accepted Format 選 zip 是什麼意思？

- 代表學生以 zip 檔上傳（而非單一原始碼檔）
- 可設定 `Max Zip Size (MB)` 以限制上傳大小
