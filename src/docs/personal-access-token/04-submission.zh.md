# 繳交 API

管理繳交紀錄，包含建立、讀取列表與詳細資訊。

## 取得繳交紀錄列表 - `GET /submission`

**Scope:** `read:submissions`

取得繳交紀錄列表，支援篩選。

**Request:**

```http
GET /api/submission?offset=0&count=20&problem_id=123&status=AC
Authorization: Bearer <PAT_TOKEN>
```

**Query Parameters:**

| 參數            | 類型   | 說明                 |
| --------------- | ------ | -------------------- |
| `offset`        | int    | 起始位置（預設：0）  |
| `count`         | int    | 每頁數量（預設：20） |
| `problem_id`    | int    | 題目 ID 篩選         |
| `username`      | string | 使用者名稱篩選       |
| `status`        | string | 狀態篩選 (如 AC, WA) |
| `language_type` | string | 語言類型 ID 篩選     |
| `course`        | string | 課程名稱篩選         |

**Response (200):**

```json
{
  "status": "ok",
  "data": {
    "submissions": [
      {
        "submissionId": "60f...",
        "problemId": 123,
        "username": "user1",
        "status": 0,
        "score": 100,
        "timestamp": "2023-01-01T12:00:00"
      }
    ],
    "submissionCount": 100
  }
}
```

---

## 建立新的繳交 - `POST /submission`

**Scope:** `write:submissions`

建立新的繳交。

**Request:**

```json
{
  "problem_id": 123,
  "language_type": 1
}
```

**Response (200):**

```json
{
  "status": "ok",
  "data": {
    "submissionId": "60f..."
  },
  "msg": "submission recieved.\nplease send source code with given submission id later."
}
```

> [!IMPORTANT]
> 建立繳交後，必須使用 `PUT /submission/<submission_id>` 上傳程式碼檔案。

---

## 上傳程式碼 - `PUT /submission/<submission_id>`

**Scope:** `write:submissions`

上傳繳交的程式碼。

**Request:**

- **Content-Type:** `multipart/form-data`
- **File:** `code` (程式碼檔案)

```bash
curl -X PUT "http://localhost:8080/api/submission/60f..." \
     -H "Authorization: Bearer <PAT_TOKEN>" \
     -F "code=@main.cpp"
```

**Response (200):**

```json
{
  "status": "ok",
  "data": { "ok": true },
  "msg": "send to judgement."
}
```

---

## 取得繳交詳情 - `GET /submission/<submission_id>`

**Scope:** `read:submissions`

取得特定繳交的詳細資訊。

**Request:**

```http
GET /api/submission/60f...
Authorization: Bearer <PAT_TOKEN>
```

**Response (200):**

```json
{
  "status": "ok",
  "data": {
    "submissionId": "60f...",
    "problemId": 123,
    "username": "user1",
    "status": 0,
    "score": 100,
    "code": "print('Hello')",
    "tasks": [...]
  }
}
```

---

## 修改繳交分數 - `PUT /submission/<submission_id>/grade`

**Scope:** `grade:submissions`
**Role Required:** Teacher, TA, Admin

手動修改繳交分數。

**Request:**

```json
{
  "score": 100
}
```

**Response (200):**

```json
{
  "status": "ok",
  "msg": "Submission 60f... score recieved."
}
```
