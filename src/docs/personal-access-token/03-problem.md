# Problem API

Manage coding problems, including creating, updating, and retrieving problem details.

## List Problems - `GET /problem`

**Scope:** `read:problems`

Get a list of problems with pagination and filtering support.

**Request:**

```http
GET /api/problem?offset=0&count=20&course=Public&tags=dp,graph
Authorization: Bearer <PAT_TOKEN>
```

**Query Parameters:**

| Parameter    | Type   | Description                            |
| ------------ | ------ | -------------------------------------- |
| `offset`     | int    | Starting index (default: 0)            |
| `count`      | int    | Number of items per page (default: 20) |
| `course`     | string | Filter by course name                  |
| `tags`       | string | Filter by tags (comma separated)       |
| `problem_id` | int    | Filter by problem ID                   |
| `name`       | string | Search by problem name                 |

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

## Get Problem - `GET /problem/<problem_id>`

**Scope:** `read:problems`

Get detailed information about a specific problem.

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

## Create Problem - `POST /problem/manage`

**Scope:** `write:problems`
**Role Required:** Teacher, TA, Admin

Create a new problem.

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

## Update Problem - `PUT /problem/manage/<problem_id>`

**Scope:** `write:problems`
**Role Required:** Teacher, TA, Admin

Update an existing problem.

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

## Delete Problem - `DELETE /problem/manage/<problem_id>`

**Scope:** `write:problems`
**Role Required:** Teacher, TA, Admin

Delete a problem.

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
