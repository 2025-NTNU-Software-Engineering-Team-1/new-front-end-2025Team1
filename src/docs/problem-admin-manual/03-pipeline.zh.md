# 進階功能詳細說明

本手冊詳細說明判題流程與資源檔案的進階設定，包含程式碼範例。

---

## 一、檔案存取權限

設定學生程式的檔案操作權限：

| 選項 | 說明 |
|------|------|
| **允許讀取** | 程式可執行檔案讀取操作 |
| **允許寫入** | 程式可建立或修改檔案 |

### 連動規則

- 寫入權限必須建立在讀取權限之上
- 關閉「允許讀取」時，「允許寫入」會自動關閉
- 學生資源檔案功能需要開啟讀取權限

---

## 二、執行模式

系統提供三種程式執行模式：

### 1. 一般模式

適用於標準的輸入/輸出題目，無需額外設定。

### 2. 僅限函式模式 (Function Only)

適用於需要特定編譯或連結方式的題目。

**必要條件**：上傳 `makefile.zip` 壓縮檔

**壓縮檔結構範例**：
```
makefile.zip
├── Makefile
├── main.c       # 教師提供的主程式
└── utils.h      # 共用標頭檔（選用）
```

**Makefile 範例**：
```makefile
CC = gcc
CFLAGS = -Wall -O2

all: a.out

a.out: main.c student.c
	$(CC) $(CFLAGS) -o $@ $^

clean:
	rm -f a.out
```

> **說明**：學生提交的程式碼會被命名為 `student.c`、`student.cpp` 或 `student.py`，再與教師提供的檔案一同編譯。

### 3. 互動模式 (Interactive)

適用於需要程式間通訊的互動式題目。

**必要條件**：上傳教師端程式（`.c`、`.cpp` 或 `.py`）

**設定選項**：
- **教師端優先執行**：教師程式先啟動，學生程式後啟動

**互動流程**：
1. 教師程式讀取測資檔案
2. 教師程式透過標準輸出/輸入與學生程式溝通
3. 教師程式將判題結果寫入 `Check_Result` 檔案

**教師程式範例（C 語言）**：
```c
#include <stdio.h>

int main(void) {
    // 1. 讀取測資
    FILE *fp = fopen("testcase.in", "r");
    if (!fp) {
        return 1;
    }
    long long n = 0;
    if (fscanf(fp, "%lld", &n) != 1) {
        fclose(fp);
        return 1;
    }
    fclose(fp);

    // 2. 發送資料給學生程式
    printf("%lld\n", n);
    fflush(stdout);

    // 3. 接收學生回應
    long long received = 0;
    if (scanf("%lld", &received) != 1) {
        return 1;
    }

    // 4. 判題並寫入結果
    FILE *out = fopen("Check_Result", "w");
    if (!out) {
        return 1;
    }
    if (received == n * n) {
        fprintf(out, "STATUS: AC\nMESSAGE: ok\n");
    } else {
        fprintf(out,
                "STATUS: WA\nMESSAGE: expected %lld got %lld\n",
                n * n,
                received);
    }
    fclose(out);
    return 0;
}
```

> **注意**：互動模式下，自訂檢查器功能會被停用。

---

## 三、自訂檢查器 (Custom Checker)

當標準的字串比對無法滿足需求時，可上傳 Python 腳本進行自訂比對。

### 使用情境

- 允許浮點數誤差
- 接受多種正確答案
- 忽略空白或換行差異
- 部分正確也給分

### 腳本規範

檢查器腳本必須定義 `check` 函式，並輸出結果：

```python
#!/usr/bin/env python3
"""
Custom Checker for Floating Point Number Comparison
允許小誤差（epsilon = 1e-6）的浮點數比對
"""
import sys


def check(input_file, output_file, answer_file):
    """
    自訂檢查器主函式
    
    Args:
        input_file: 輸入檔案路徑（測資 .in）
        output_file: 學生輸出檔案路徑
        answer_file: 預期答案檔案路徑（測資 .out）
    
    Returns:
        tuple: (status, message) 其中 status 為 "AC" 或 "WA"
    """
    EPSILON = 1e-6  # 浮點數比對容差

    try:
        # 讀取輸入檔以取得預期數量
        with open(input_file, 'r') as f:
            lines = f.read().strip().split('\n')
            n = int(lines[0])

        # 讀取學生輸出
        with open(output_file, 'r') as f:
            student_output = f.read().strip()
            if not student_output:
                return "WA", "Empty output"
            student_lines = student_output.split('\n')
            student_nums = []
            for line in student_lines:
                line = line.strip()
                if line:
                    try:
                        student_nums.append(float(line))
                    except ValueError:
                        return "WA", f"Invalid number format: '{line}'"

        # 讀取預期答案
        with open(answer_file, 'r') as f:
            answer_output = f.read().strip()
            answer_lines = answer_output.split('\n')
            answer_nums = []
            for line in answer_lines:
                line = line.strip()
                if line:
                    answer_nums.append(float(line))

        # 檢查數量
        if len(student_nums) != n:
            return "WA", f"Expected {n} numbers, got {len(student_nums)}"

        if len(student_nums) != len(answer_nums):
            return "WA", f"Line count mismatch: expected {len(answer_nums)}, got {len(student_nums)}"

        # 逐一比對（含容差）
        for i, (student_val, answer_val) in enumerate(zip(student_nums, answer_nums), 1):
            diff = abs(student_val - answer_val)
            if diff > EPSILON:
                return "WA", (
                    f"Number {i}: expected {answer_val:.10f}, got {student_val:.10f} "
                    f"(difference = {diff:.2e}, tolerance = {EPSILON:.2e})")

        return "AC", f"All {n} numbers match within tolerance (ε = {EPSILON:.2e})"

    except FileNotFoundError as e:
        return "WA", f"File not found: {e.filename}"
    except Exception as e:
        return "WA", f"Checker error: {str(e)}"


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("STATUS: WA")
        print("MESSAGE: Invalid checker arguments (expected 3 file paths)")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    answer_file = sys.argv[3]

    status, message = check(input_file, output_file, answer_file)

    print(f"STATUS: {status}")
    print(f"MESSAGE: {message}")
```

### 輸出格式

檢查器必須輸出以下格式：
```
STATUS: AC
MESSAGE: All numbers match within tolerance
```

或

```
STATUS: WA
MESSAGE: Number 3: expected 3.14159, got 3.15000
```

---

## 四、自訂計分腳本 (Custom Scorer)

需要特殊評分邏輯時，可上傳 Python 腳本進行自訂計分。

### 使用情境

- 依正確測資比例給分
- 考慮程式執行時間加分/扣分
- 遲交扣分邏輯
- 多因素綜合計分

### 腳本規範

計分腳本從 stdin 讀取 JSON 格式的評測結果，輸出 JSON 格式的分數：

```python
#!/usr/bin/env python3
"""
Custom Scorer for Partial Credit
支援部分計分、時間加分與遲交扣分
"""
import json
import sys


def calculate_score(scoring_input):
    """
    計算最終分數
    
    Args:
        scoring_input: dict 包含 tasks, stats, lateSeconds 等資訊
    
    Returns:
        dict: 包含 score, message, breakdown
    """
    tasks = scoring_input.get("tasks", [])
    stats = scoring_input.get("stats", {})
    late_seconds = scoring_input.get("lateSeconds", 0)

    total_score = 0
    task_scores = []
    messages = []

    # 各任務權重（需與 meta.json 對齊）
    task_weights = [30, 40, 30]

    for task_idx, task in enumerate(tasks):
        results = task.get("results", []) if isinstance(task, dict) else task
        task_weight = task_weights[task_idx] if task_idx < len(task_weights) else 0
        
        correct_count = sum(
            1 for case in results
            if isinstance(case, dict) and case.get("status") == "AC"
        )
        total_count = len(results)
        
        if total_count > 0:
            task_score = int(task_weight * (correct_count / total_count))
        else:
            task_score = 0

        task_scores.append(task_score)
        total_score += task_score
        messages.append(
            f"Task {task_idx + 1}: {correct_count}/{total_count} correct → {task_score} pts"
        )

    # 時間加分：平均時間 < 500ms 加 5%
    avg_time = stats.get("avgRunTime", 0)
    time_bonus = 0
    if avg_time > 0 and avg_time < 500:
        time_bonus = int(total_score * 0.05)
        total_score += time_bonus
        messages.append(f"Time Bonus: avg={avg_time:.0f}ms < 500ms → +{time_bonus} pts")

    # 遲交扣分：每天扣 10%，最多 30%
    late_penalty = 0
    if isinstance(late_seconds, (int, float)) and late_seconds > 0:
        late_days = late_seconds / 86400
        penalty_rate = min(0.3, late_days * 0.1)
        late_penalty = int(total_score * penalty_rate)
        total_score -= late_penalty
        messages.append(
            f"Late Penalty: {late_days:.1f} days → -{late_penalty} pts"
        )

    # 分數界限
    total_score = max(0, min(100, total_score))

    return {
        "score": total_score,
        "message": " | ".join(messages),
        "breakdown": {
            "taskScores": task_scores,
            "timeBonus": time_bonus,
            "latePenalty": late_penalty,
            "finalScore": total_score
        }
    }


if __name__ == "__main__":
    try:
        input_data = json.load(sys.stdin)
        result = calculate_score(input_data)
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        error_result = {
            "score": 0,
            "message": f"Scorer Error: {str(e)}",
            "breakdown": {}
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)
```

### 輸入格式

系統傳入的 JSON 結構：
```json
{
  "tasks": [
    {
      "results": [
        {"status": "AC", "runTime": 120, "memory": 1024},
        {"status": "WA", "runTime": 150, "memory": 1024}
      ]
    }
  ],
  "stats": {
    "avgRunTime": 135,
    "maxMemory": 1024
  },
  "lateSeconds": 0
}
```

### 輸出格式

腳本必須輸出：
```json
{
  "score": 85,
  "message": "Task 1: 1/2 correct → 15 pts | Time Bonus: +4 pts",
  "breakdown": {
    "taskScores": [15],
    "timeBonus": 4,
    "latePenalty": 0,
    "finalScore": 85
  }
}
```

---

## 五、函式庫使用限制

透過靜態分析限制程式可使用的函式庫與語法。

### 限制類別

| 類別 | Python | C/C++ |
|------|--------|-------|
| **語法限制** | ✓ | ✓ |
| **匯入限制** | ✓ (import) | ✗ |
| **標頭檔限制** | ✗ | ✓ (#include) |
| **函式限制** | ✓ | ✓ |

### 過濾模式

每種限制可切換為：
- **白名單**：僅允許清單內的項目
- **黑名單**：禁止使用清單內的項目

> **注意**：切換模式時會自動清空原有清單。

### 常見限制範例

**禁止使用排序函式（黑名單）**：
```
函式限制: sort, sorted, qsort
```

**僅允許基礎標頭檔（白名單）**：
```
標頭檔限制: stdio.h, stdlib.h, string.h
```

---

## 六、資源檔案

### 學生資源檔案

供學生程式讀取的額外資料檔案（如 `.csv`、`.bmp`）。

**前置條件**：
1. 必須先上傳測資壓縮檔
2. 必須開啟「允許讀取」權限

**檔案命名規則**：
```
[任務編號 2 位數][測資編號 2 位數].[副檔名]
```

**範例**：
```
student_resource.zip
├── 0000.csv    # 對應測資 0000
├── 0001.csv    # 對應測資 0001
├── 0100.bmp    # 對應測資 0100
└── 0101.bmp    # 對應測資 0101
```

### 教師資源檔案

供教師程式（如自訂檢查器）讀取的資料檔案。

**特性**：不受「允許讀取」權限限制。

---

## 七、網路與環境擴充

### 網路存取模型

控制學生程式的網路連線權限：

| 模式 | 說明 |
|------|------|
| **白名單** | 僅允許連線清單中的位址 |
| **黑名單** | 僅封鎖清單中的位址 |

清單支援輸入：
- IP 位址（如 `192.168.1.1`）
- 網域名稱（如 `api.example.com`）

### 側掛容器 (Sidecars)

在評測環境中新增輔助容器，用於提供：
- 資料庫服務
- API 模擬服務
- 快取服務

**設定欄位**：
- 容器名稱
- Docker 映像名稱
- 環境變數
- 啟動參數

### 自訂環境 (Dockerfile)

上傳包含 Dockerfile 的壓縮檔以自訂執行環境：

**壓縮檔結構**：
```
dockerfiles.zip
└── python311/
    └── Dockerfile
```

系統會自動解析壓縮檔結構，列出偵測到的環境。
