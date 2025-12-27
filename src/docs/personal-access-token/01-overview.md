# Personal Access Token Overview

Personal Access Tokens (PAT) allow you to authenticate with the Normal-OJ API without using your password. They are ideal for:

- **Automation**: CI/CD pipelines, scripts
- **Third-party integrations**: External tools accessing your data
- **Long-lived access**: Tokens can be configured with custom expiration

## How to Use

### Bearer Token Authentication

Include your PAT in the `Authorization` header:

```http
GET /api/endpoint
Authorization: Bearer <YOUR_PAT_TOKEN>
```

### Example with cURL

```bash
curl -H "Authorization: Bearer pat_abc123..." \
     https://noj.tw/api/auth/me
```

### Example with Python

```python
import requests

headers = {"Authorization": "Bearer pat_abc123..."}
response = requests.get("https://noj.tw/api/auth/me", headers=headers)
print(response.json())
```

## Security Best Practices

1. **Never share your token** - Treat it like a password
2. **Use minimal scopes** - Only request permissions you need
3. **Set expiration dates** - Limit token lifetime
4. **Rotate tokens regularly** - Create new tokens periodically
5. **Revoke unused tokens** - Deactivate tokens you no longer need

## Token Scopes

| Scope        | Description                |
| ------------ | -------------------------- |
| `read_only`  | Read access to your data   |
| `read_write` | Read and write access      |
| `admin`      | Full administrative access |

## Rate Limits

API requests are rate-limited to protect the system:

- **Authenticated requests**: 1000 requests/hour
- **Unauthenticated requests**: 60 requests/hour

When you exceed the limit, you'll receive a `429 Too Many Requests` response.
