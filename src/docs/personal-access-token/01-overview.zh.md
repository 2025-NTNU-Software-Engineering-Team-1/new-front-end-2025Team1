# 概述 (Overview)

Personal Access Token (PAT) 1允許你在不使用帳號密碼的情況下存取 Normal-OJ API。它們非常適合用於：

- **自動化腳本**：CI/CD pipelines 或自動化測試
- **第三方整合**：外部工具存取你的資料
- **長期存取**：Token 可設定過期時間

## 如何使用 (How to Use)

PAT 必須透過 HTTP Header `Authorization` 進行傳遞。

**格式：**

```http
Authorization: Bearer <YOUR_PAT_TOKEN>
```

**cURL 範例：**

```bash
curl -X GET "http://normal-oj.example.com/api/problem" \
     -H "Authorization: Bearer pat_1234567890abcdef"
```

**Python 範例：**

```python
import requests

headers = {
    "Authorization": "Bearer pat_1234567890abcdef"
}
response = requests.get("http://normal-oj.example.com/api/problem", headers=headers)
print(response.json())
```

---

## 權限範圍 (Scopes)

PAT 的權限受限於 **Scopes**。在建立 PAT 時，你必須選擇該 Token 允許執行的操作。如果你嘗試存取未授權的 API，將會收到 `403 Forbidden` 錯誤。

### 可用 Scopes

| Scope               | 說明                   | 適用角色                    |
| ------------------- | ---------------------- | --------------------------- |
| `read:problems`     | 讀取題目列表與詳細內容 | Student, Teacher, TA, Admin |
| `write:problems`    | 建立、修改、刪除題目   | Teacher, TA, Admin          |
| `read:courses`      | 讀取課程列表與內容     | Student, Teacher, TA, Admin |
| `write:courses`     | 建立、修改課程         | Teacher, Admin              |
| `read:submissions`  | 讀取繳交紀錄與程式碼   | Student, Teacher, TA, Admin |
| `write:submissions` | 上傳程式碼進行繳交     | Student, Teacher, TA, Admin |
| `grade:submissions` | 修改繳交分數 (評分)    | Teacher, TA, Admin          |
| `read:user`         | 讀取使用者資訊         | Student, Teacher, TA, Admin |
| `read:userips`      | 讀取使用者登入 IP      | TA, Teacher, Admin          |

> [!NOTE]
> 即使 PAT 擁有某個 Scope，你的帳號本身也必須具備對應的權限 (Role)。例如學生帳號即使申請了 `write:problems` scope，依然無法建立題目。

---

## 安全最佳實踐 (Security Best Practices)

- **最小權限原則**：只勾選你目前需要的 Scopes。
- **設定過期時間**：避免使用永久有效的 Token。
- **不要洩漏 Token**：PAT 等同於你的密碼，請勿提交到公開的 Git 儲存庫。
- **定期更換 Token**：週期性建立新 Token。
- **撤銷未使用的 Token**：停用不再需要的 Token。

## 頻率限制

API 請求有頻率限制以保護系統：

- **已認證請求**：每小時 1000 次
- **未認證請求**：每小時 60 次

超過限制時，您會收到 `429 Too Many Requests` 回應。
