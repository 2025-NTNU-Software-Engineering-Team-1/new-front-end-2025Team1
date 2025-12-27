# Error Codes & Enums

Reference for API error codes and enumeration values.

## HTTP Status Codes

- `200 OK`: Request succeeded.
- `400 Bad Request`: Invalid parameters or data format.
- `401 Unauthorized`: Invalid or expired token (e.g., `422 Signature verification failed`).
- `403 Forbidden`: Token valid but lacks permission (Scope or Role).
- `404 Not Found`: Resource (Problem, Submission, Course, etc.) not found.
- `429 Too Many Requests`: Rate limit exceeded.
- `500 Internal Server Error`: Server-side error.

## Submission Status Codes

| Code | Status | Description           |
| ---- | ------ | --------------------- |
| 0    | AC     | Accepted              |
| 1    | WA     | Wrong Answer          |
| 2    | CE     | Compilation Error     |
| 3    | TLE    | Time Limit Exceeded   |
| 4    | MLE    | Memory Limit Exceeded |
| 5    | RE     | Runtime Error         |
| 6    | JE     | Judging Error         |
| 7    | OLE    | Output Limit Exceeded |

## Language Types

| ID  | Language |
| --- | -------- |
| 0   | C        |
| 1   | C++      |
| 2   | Python   |
