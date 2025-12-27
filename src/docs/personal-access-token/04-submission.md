# Submission API

Manage submissions, including creating, listing, and retrieving submission details and artifacts.

## List Submissions - `GET /submission`

**Scope:** `read:submissions`

Get a list of submissions with filtering options.

**Request:**

```http
GET /api/submission?offset=0&count=20&problem_id=123&status=AC
Authorization: Bearer <PAT_TOKEN>
```

**Query Parameters:**

| Parameter       | Type   | Description                            |
| --------------- | ------ | -------------------------------------- |
| `offset`        | int    | Starting index (default: 0)            |
| `count`         | int    | Number of items per page (default: 20) |
| `problem_id`    | int    | Filter by problem ID                   |
| `username`      | string | Filter by username                     |
| `status`        | string | Filter by status (e.g., AC, WA)        |
| `language_type` | string | Filter by language type ID             |
| `course`        | string | Filter by course name                  |

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

## Create Submission - `POST /submission`

**Scope:** `write:submissions`

Submit a solution to a problem.

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
> After creating a submission, you must upload the source code using `PUT /submission/<submission_id>`.

---

## Upload Source Code - `PUT /submission/<submission_id>`

**Scope:** `write:submissions`

Upload source code for a submission.

**Request:**

- **Content-Type:** `multipart/form-data`
- **File:** `code` (Source code file)

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

## Get Submission - `GET /submission/<submission_id>`

**Scope:** `read:submissions`

Get details of a specific submission.

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

## Grade Submission - `PUT /submission/<submission_id>/grade`

**Scope:** `grade:submissions`
**Role Required:** Teacher, TA, Admin

Manually grade a submission.

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
