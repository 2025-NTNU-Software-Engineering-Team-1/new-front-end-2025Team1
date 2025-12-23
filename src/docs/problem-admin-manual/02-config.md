# Configuration（設定）說明

此區塊包含：Allowed Languages、Tags、Quota、Accepted Format、AI VTuber、Trial Mode、Network & Sidecars、Artifact Collection。

---

## Allowed Languages

- 目前支援：C / C++ / Python（以 bitmask 方式記錄）
- 這會影響：
  - 學生可提交語言
  - AI VTuber AC Files / Trial AC Files 可上傳的副檔名限制（`.c` / `.cpp` / `.py`）

---

## Tags

- 以逗號分隔輸入（例如：`dp,math,greedy`）
- 系統會自動 trim、去除空字串

---

## Quota

- `-1`：Unlimited
- `1 ~ 500`：限制可提交次數

---

## Accepted Format（code / zip）

### code

- 學生提交原始碼（一般 OJ 行為）

### zip

- 學生提交 zip
- 可設定 `Max Zip Size (MB)`（範圍 1~1000，預設 50）

---

## Trial Mode（試跑模式）

Trial Mode 開啟後，會在「題目測試/試跑」相關頁面提供額外功能。

### Trial Max Number

- `-1`：Unlimited
- `1 ~ 500`：限制試跑次數

### Result Visible / Downloadable

- `Result Visible`：允許查看 stdout/stderr 或輸出資訊（依後端功能為準）
- `Result Downloadable`：允許下載輸出檔（依後端功能為準）

### Upload Public Test Data (.zip)

- **壓縮檔內只能有 `.in` 檔**
- 檔案大小限制依前端檢查（目前顯示 ≤ 1GB）

### Upload AC Files（Trial）

- 需至少上傳 1 個 AC 檔（若 Trial Mode 開啟）
- 副檔名依 Allowed Languages 決定（`.c` / `.cpp` / `.py`）

---

## AI VTuber（AI 助教）

### 啟用條件（前端驗證）

開啟 AI VTuber 後，送出時會檢查：

- **至少選擇一個 API Key**
- **至少上傳一個 AC 檔**

### AI Model

- 可選擇 Gemini 模型（依 UI 列表）

### Upload AC Files（AI VTuber）

- 副檔名依 Allowed Languages 決定（`.c` / `.cpp` / `.py`）
- 目的：提供 AI 參考用的正確程式（AC）

### API Keys

- Keys 依 course 取得並分成 Active / Inactive
- 支援搜尋 key name 並自動捲動定位
- 右側問號可取得「建議 key 數量」(Suggestion)

---

## Network & Sidecars（網路與沙盒環境）

### Network Access Model（Whitelist / Blacklist）

- **Whitelist**：只允許列表中的 IP/URL，其餘全部封鎖
- **Blacklist**：封鎖列表中的 IP/URL，其餘全部允許

### IP / URL List

- 使用多筆輸入元件新增
- 請確保格式正確（例如 IP：`8.8.8.8`；URL：`example.com`）

### Sidecars（Sandbox Environment）

- 可新增 sidecar container（image/name/env/args 等）
- 用途：提供額外服務（例如 DB、cache、local judge helper）

### Dockerfiles.zip（自訂環境）

上傳 zip 後前端會檢查：

1. zip 裡必須至少包含一個 `Dockerfile`
2. 每個 Dockerfile 必須符合結構：  
   `environment_folder/Dockerfile`  
   例如：`python311/Dockerfile`
3. 前端會解析出 `environment_folder` 列表並顯示，可刪除某個 env

> 若結構不符合，會直接拒絕並清空選擇的檔案。

---

## Artifact Collection（產物收集）

可勾選要保存/提供下載的產物類型：

- `Compiled Binary`：編譯後的二進位檔
- `Student Artifact (zip)`：學生提交的 zip 產物

此設定會寫入 `config.artifactCollection`。
