# Pipeline（評測流程）說明

此區塊包含：File Access、Execution Mode、Library Restrictions、Custom Checker、Custom Scoring Script 等。

---

## File Access（Allow Read / Allow Write）

### Allow Read

- 允許程式讀取檔案（例如 `fopen` / `open` 等）
- **學生 Resource Data** 需要 Allow Read 才能啟用（教師 Resource Data 不受限）

### Allow Write

- 允許程式寫入檔案
- **Allow Write 依賴 Allow Read**：
  - 若關閉 Allow Read，Allow Write 會被強制關閉
  - UI 會顯示提示訊息

---

## Library Restrictions（靜態分析限制）

> 此功能會依語言開放不同項目：
>
> - Python 才能使用 Imports 限制
> - C/C++ 才能使用 Headers 限制

### Enabled

開啟後可設定四個類別：

1. Syntax Restrictions
2. Imports Restrictions（Python）
3. Headers Restrictions（C/C++）
4. Functions Restrictions

每個類別可切換：

- **Whitelist**：只允許列表內項目
- **Blacklist**：禁止列表內項目

切換 whitelist/blacklist 時，前端會清空另一側列表（避免混用）。

---

## Execution Mode（執行模式）

### General

- 一般題型（最常用）

### Function Only

- 需要上傳 `Makefile.zip`
- 用途：以指定方式編譯/連結（依後端 pipeline 實作）

### Interactive

- 互動題模式
- 互動題會要求：
  - 上傳 Teacher Code（Teacher_file）
  - 可選 Teacher First（先跑 teacher 再跑 student，依後端行為）

> 注意：Interactive 模式下 **Custom Checker 會被禁用**（UI 會鎖定）。

---

## Custom Checker

- 開啟後需上傳 `Custom_Checker.py`
- 用於自訂比對輸出（依後端行為）

前端驗證：

- Custom Checker 開啟時必須有檔案（或後端已有上傳的 checker）

---

## Custom Scoring Script

- 開啟後需上傳 `Custom_Scorer.py`
- 用於自訂計分（依後端行為）

前端驗證：

- 開啟時必須有檔案（或後端已有上傳的 scoring script）

---

## 上傳檔案大小限制

各上傳欄位會經過前端 `assertFileSizeOK()` 檢查。若不符合會自動清空選擇並提示錯誤（依你專案的檢查規則/上限設定）。
