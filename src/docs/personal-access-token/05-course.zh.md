# 課程 API

存取課程資訊。

## 取得課程列表 - `GET /course`

**Scope:** `read:courses`

取得使用者可存取的課程列表。

**Request:**

```http
GET /api/course
Authorization: Bearer <PAT_TOKEN>
```

**Response (200):**

```json
{
  "status": "ok",
  "data": [
    {
      "course": "Algorithms",
      "teacher": "Dr. Smith",
      "color": "#FF5733",
      "emoji": "💻"
    }
  ]
}
```

---

## 取得課程詳情 - `GET /course/<course_name>`

**Scope:** `read:courses`

取得特定課程的詳細資訊。

**Request:**

```http
GET /api/course/Algorithms
Authorization: Bearer <PAT_TOKEN>
```

**Response (200):**

```json
{
  "status": "ok",
  "data": {
    "course": "Algorithms",
    "type": 0,
    "problems": [...],
    "scoreboard": [...]
  }
}
```
