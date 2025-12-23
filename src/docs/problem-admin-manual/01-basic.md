# 題目管理使用說明（總覽）

本說明適用於「建立新題目」與「編輯題目」頁面。所有內容為前端固定文件，僅供閱讀。

---

## 建議操作順序

1. **Problem name / Hidden**
2. **Set Description**（題目敘述、輸入輸出、範例）
3. **Set Configuration**
   - Allowed Languages / Tags / Quota
   - Accepted Format（code / zip）
   - Trial Mode
   - AI VTuber
   - Network & Sidecars
   - Artifact Collection
4. **Set Pipeline**
   - File Access（Allow Read / Allow Write）
   - Execution Mode（general / functionOnly / interactive）
   - Custom Checker / Custom Scoring Script
   - Library Restrictions
5. **Set Test Data**
6. **Set Resource Data（Student / Teacher）**

---

## Test Data Zip（測資壓縮檔）格式

- 壓縮檔內放置 `.in` 與 `.out` 檔案
- **`.in` 與 `.out` 數量必須一致**
- 命名規則（前綴 2 碼代表 task 編號）：
  - `00_xx.in` / `00_xx.out` 代表 Task 0 的多個 case
  - `01_xx.in` / `01_xx.out` 代表 Task 1 的多個 case
- 系統會依照 `00`, `01`, `02`… 的前綴自動分組成 tasks

> 建議：先準備好 Test Data Zip，再回到頁面調整各 task 的 time/memory/score。

---

## Resource Data（資源檔）前置條件（很重要）

Resource Data 會依照 Test Data 的 task/case 結構進行驗證，因此：

- **必須先上傳 Test Data Zip**，讓 tasks 建立完成
- Student Resource Data 需要 **Pipeline > Allow Read**（教師 Resource Data 不受限）

---

## 常見問題（FAQ）

### Q1：我按 Submit 被擋住，但不知道哪裡錯？

- 頁面底部會出現錯誤摘要（Submission blocked…）
- 點擊錯誤訊息會自動展開對應的區塊並捲動到位置

### Q2：Quota 要怎麼填？

- `-1` 代表 unlimited
- 或填 `1 ~ 500`

### Q3：Accepted Format 選 zip 是什麼意思？

- 代表學生以 zip 上傳（而非單一原始碼檔）
- 可設定 `Max Zip Size (MB)` 限制學生上傳大小
