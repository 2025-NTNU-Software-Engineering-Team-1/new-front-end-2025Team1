# Pipeline（評測流程）說明

此區塊包含：File Access、Execution Mode、Library Restrictions、Custom Checker、Custom Scoring Script 等說明。

---

## File Access（Allow Read / Allow Write）

### Allow Read

- 允許程式讀取檔案（例如 `fopen` / `open` 等）
- 若要使用 Student Resource Data，必須開啟 Allow Read（Teacher Resource Data 不受限）

### Allow Write

- 允許程式寫入檔案
- **Allow Write 依賴 Allow Read**：若關閉 Allow Read，Allow Write 會被強制關閉，UI 會顯示提示

---

## Library Restrictions（靜態分析限制）

> 不同語言開放不同限制類型：
>
> - Python 支援 Imports 限制
> - C/C++ 支援 Headers 限制

### Enabled

開啟後可針對以下四類設定限制：

1. Syntax Restrictions
2. Imports Restrictions（Python）
3. Headers Restrictions（C/C++）
4. Functions Restrictions

每類可以選擇 **Whitelist（僅允許）** 或 **Blacklist（禁止）** 模式。切換時，系統會清空另一方的列表以避免混用。

---

## Execution Mode（執行模式）

### General

- 一般常見題型，適用大多數情況

### Function Only

- 需要上傳 `Makefile.zip`，以指定方式編譯/連結（具體行為以後端 pipeline 實作為準）

### Interactive

- 互動題模式
- 互動題通常需上傳 Teacher Code（Teacher_file）
- 可選擇 Teacher First（先啟動 teacher 再執行 student，依後端實作）

> 注意：Interactive 模式下 **Custom Checker 會被禁用**（UI 會鎖定該選項）。

---

## Custom Checker（自訂檢查器）

- 開啟後需上傳 `Custom_Checker.py`（或後端已存在的 checker）
- 用於以程式化方式比對學生輸出與正確性（實際行為依後端實作）

前端驗證：若啟用 Custom Checker，必須有檔案存在（或後端已有設定）。

---

## Custom Scoring Script（自訂計分腳本）

- 開啟後需上傳 `Custom_Scorer.py`（或後端已存在的 scoring script）
- 用於自訂題目計分規則（實際行為依後端實作）

前端驗證：若啟用，必須有檔案存在。

---

## 上傳檔案大小限制

各上傳欄位會透過前端 `assertFileSizeOK()` 做檢查；若不符會自動清空選擇並提示錯誤（請參考專案的上限設定）。
