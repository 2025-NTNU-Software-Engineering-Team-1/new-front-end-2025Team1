# Configuration（設定）說明

此區塊包含：Allowed Languages、Tags、Quota、Accepted Format、AI VTuber、Trial Mode、Network & Sidecars、Artifact Collection 等設定說明。

---

## Allowed Languages（可提交語言）

- 目前支援語言示例：C / C++ / Python（內部以 bitmask 記錄）
- 會影響：學生可提交的語言選項，以及 AI VTuber / Trial AC Files 可接受的副檔名（如 `.c` / `.cpp` / `.py`）

---

## Tags（標籤）

- 多個標籤以逗號分隔（例如：`dp,math,greedy`）
- 系統會自動 trim 並移除空字串

---

## Quota（提交配額）

- `-1`：Unlimited（不限制）
- `1 ~ 500`：限制可提交次數

---

## Accepted Format（提交格式：code / zip）

### code

- 學生提交單一原始碼檔（一般 OJ 行為）

### zip

- 學生上傳 zip 檔（內容由題目設定解析）
- 可設定 `Max Zip Size (MB)`（範圍 1~1000，預設 50）

---

## Trial Mode（試跑模式）

開啟 Trial Mode 後，會在題目試跑 / 測試頁提供額外功能（例如上傳範例 AC 檔、設定試跑次數上限等）。

### Trial Max Number

- `-1`：Unlimited
- `1 ~ 500`：限制試跑次數

### Result Visible / Downloadable

- `Result Visible`：允許查看 stdout/stderr 或其他輸出資訊（依後端實作）
- `Result Downloadable`：允許下載輸出檔案（依後端實作）

### Upload Public Test Data (.zip)

- **壓縮檔內只能有 `.in` 檔**（用於試跑公開輸入）
- 前端會檢查檔案大小（目前上限顯示為 ≤ 1GB）

### Upload AC Files（Trial）

- 若 Trial Mode 開啟，需至少上傳 1 個 AC 檔作為參考
- 副檔名由 Allowed Languages 決定（例如 `.c` / `.cpp` / `.py`）

---

## AI VTuber（AI 助教）

### 啟用前端驗證

開啟 AI VTuber 時，前端會檢查：

- 至少選擇一個 API Key
- 至少上傳一個 AC 檔（供 AI 參考）

### AI Model

- 可從 UI 選擇可用的模型（例：Gemini，視後端/平台而定）

### Upload AC Files（AI VTuber）

- 副檔名依 Allowed Languages 決定
- 用途：提供 AI 作為參考的正確程式

### API Keys

- API Keys 由 Course 提供並分為 Active / Inactive
- 支援以 Key Name 搜尋並自動捲動到相應項目
- 右側問號可顯示「建議的 Key 數量」等提示

---

## Network & Sidecars（網路與 sandbox sidecars）

### Network Access Model（Whitelist / Blacklist）

- **Whitelist**：僅允許列在白名單的 IP/URL，其餘皆封鎖
- **Blacklist**：僅封鎖列在黑名單的 IP/URL，其餘皆允許

### IP / URL List

- 使用多筆輸入元件新增
- 請確保格式正確（例：IP：`8.8.8.8`；URL：`example.com`）

### Sidecars（Sandbox environment）

- 可新增 sidecar container（設定 image / name / env / args 等）
- 用途：提供題目測試所需的輔助服務，例如 DB、cache 或 local judge helper

### Dockerfiles.zip（自訂環境）

上傳 zip 後，前端會檢查：

1. zip 必須至少包含一個 `Dockerfile`
2. 每個 Dockerfile 必須位於 `environment_folder/Dockerfile` 的結構下（例如 `python311/Dockerfile`）
3. 前端會解析出 `environment_folder` 列表並顯示，使用者可移除某些環境

> 若結構不符合，系統會拒絕並清空所選檔案。

---

## Artifact Collection（產物收集）

可勾選欲保存或提供下載的產物類型：

- `Compiled Binary`：編譯後的二進位檔
- `Student Artifact (zip)`：學生提交的 zip 檔

此設定會寫入 `config.artifactCollection`。
