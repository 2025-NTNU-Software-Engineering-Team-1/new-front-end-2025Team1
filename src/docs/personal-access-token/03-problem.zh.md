# 題目 API

管理程式題目，包含建立、更新與讀取詳細資訊。

## 取得題目列表 - `GET /problem`

**Scope:** `read:problems`

取得題目列表，支援分頁與篩選。

**Request:**

```http
GET /api/problem?offset=0&count=20&course=Public&tags=dp,graph
Authorization: Bearer <PAT_TOKEN>
```

**Query Parameters:**

| 參數         | 類型   | 說明                 |
| ------------ | ------ | -------------------- |
| `offset`     | int    | 起始位置（預設：0）  |
| `count`      | int    | 每頁數量（預設：20） |
| `course`     | string | 課程名稱篩選         |
| `tags`       | string | 標籤篩選（逗號分隔） |
| `problem_id` | int    | 題目 ID 篩選         |
| `name`       | string | 題目名稱搜尋         |

**Response (200):**

```json
{
  "status": "ok",
  "data": [
    {
      "problemId": 1,
      "problemName": "A+B Problem",
      "tags": ["basic", "math"],
      "courseNames": ["Public"],
      "acUser": 150,
      "submitter": 200,
      "status": 0
    }
  ]
}
```

---

## 取得題目詳情 - `GET /problem/<problem_id>`

**Scope:** `read:problems`

取得特定題目的詳細資訊。

**Request:**

```http
GET /api/problem/123
Authorization: Bearer <PAT_TOKEN>
```

**Response (200):**

```json
{
  "status": "ok",
  "data": {
    "problemId": 123,
    "problemName": "Sample Problem",
    "description": "...",
    "tags": ["dp"],
    "courses": [{ "course": "Algorithms", "status": 0 }],
    "testCase": { "tasks": [...] },
    "allowedLanguage": [0, 1, 2]
  }
}
```

---

## 建立題目 - `POST /problem/manage`

**Scope:** `write:problems`
**Role Required:** Teacher, TA, Admin

建立新題目。

**Request:**

```json
{
  "problemName": "New Problem",
  "courses": ["Public"],
  "description": "Problem description...",
  "tags": ["tag1"],
  "type": 0,
  "quota": -1,
  "testCaseInfo": {
    "tasks": [
      {
        "caseCount": 5,
        "taskScore": 20,
        "memoryLimit": 65536,
        "timeLimit": 1000
      }
    ]
  }
}
```

**Response (200):**

```json
{
  "status": "ok",
  "data": {
    "problemId": 456
  }
}
```

---

## 更新題目 - `PUT /problem/manage/<problem_id>`

**Scope:** `write:problems`
**Role Required:** Teacher, TA, Admin

更新題目資訊。

**Request:**

```json
{
  "problemName": "Updated Name",
  "description": "Updated description"
}
```

**Response (200):**

```json
{
  "status": "ok",
  "data": null
}
```

---

## 刪除題目 - `DELETE /problem/manage/<problem_id>`

**Scope:** `write:problems`
**Role Required:** Teacher, TA, Admin

刪除題目。

**Request:**

```http
DELETE /api/problem/manage/456
Authorization: Bearer <PAT_TOKEN>
```

**Response (200):**

```json
{
  "status": "ok",
  "data": { "ok": true }
}
```
