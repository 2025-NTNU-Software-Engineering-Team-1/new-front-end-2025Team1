# 錯誤代碼與列舉

API 錯誤代碼與列舉值參考。

## HTTP 狀態碼

- `200 OK`: 請求成功。
- `400 Bad Request`: 參數無效或資料格式錯誤。
- `401 Unauthorized`: Token 無效或過期 (例如 `422 Signature verification failed`)。
- `403 Forbidden`: Token 有效但權限不足 (Scope 或 Role 不足)。
- `404 Not Found`: 資源 (題目、繳交、課程等) 未找到。
- `429 Too Many Requests`: 超過頻率限制。
- `500 Internal Server Error`: 伺服器內部錯誤。

## 繳交狀態碼

| 代碼 | 狀態 | 說明                               |
| ---- | ---- | ---------------------------------- |
| 0    | AC   | 通過 (Accepted)                    |
| 1    | WA   | 答案錯誤 (Wrong Answer)            |
| 2    | CE   | 編譯錯誤 (Compilation Error)       |
| 3    | TLE  | 執行逾時 (Time Limit Exceeded)     |
| 4    | MLE  | 記憶體溢出 (Memory Limit Exceeded) |
| 5    | RE   | 執行錯誤 (Runtime Error)           |
| 6    | JE   | 裁判系統錯誤 (Judging Error)       |
| 7    | OLE  | 輸出溢出 (Output Limit Exceeded)   |

## 語言代碼

| ID  | 語言   |
| --- | ------ |
| 0   | C      |
| 1   | C++    |
| 2   | Python |
