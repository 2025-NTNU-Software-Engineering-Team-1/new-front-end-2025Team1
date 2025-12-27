# Course API

Access course information.

## List Courses - `GET /course`

**Scope:** `read:courses`

Get a list of courses available to the user.

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

## Get Course - `GET /course/<course_name>`

**Scope:** `read:courses`

Get detailed information about a specific course.

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
