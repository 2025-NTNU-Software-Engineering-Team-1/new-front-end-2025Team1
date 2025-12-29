# Detailed Advanced Features Guide

This manual provides a detailed explanation of the judging pipeline and advanced settings for resource files, including code examples.

---

## I. File Access Permissions

Set the file operation permissions for the student's program:

| Option          | Description                                   |
| :-------------- | :-------------------------------------------- |
| **Allow Read**  | The program can perform file read operations. |
| **Allow Write** | The program can create or modify files.       |

### Linkage Rules

- Write permission must be built upon read permission.
- When "Allow Read" is turned off, "Allow Write" will automatically be turned off.
- The student resource file feature requires read permission to be enabled.

---

## II. Execution Modes

The system provides three program execution modes:

### 1. General Mode

Applicable to standard input/output problems, no additional setup required.

### 2. Function Only Mode

Applicable to problems that require specific compilation or linking methods.

**Prerequisite**: Upload a `makefile.zip` archive.

**Example Archive Structure**:

```
makefile.zip
├── Makefile
├── main.c       # Main program provided by the teacher
└── utils.h      # Shared header file (optional)
```

**Example Makefile**:

```makefile
CC = gcc
CFLAGS = -Wall -O2

all: a.out

a.out: main.c student.c
	$(CC) $(CFLAGS) -o $@ $^

clean:
	rm -f a.out
```

> **Note**: The code submitted by the student will be named `student.c`, `student.cpp`, or `student.py`, and then compiled together with the files provided by the teacher.

### 3. Interactive Mode

Applicable to interactive problems that require communication between programs.

**Prerequisite**: Upload the teacher-side program (`.c`, `.cpp`, or `.py`).

**Configuration Options**:

- **Teacher Program Executes First**: The teacher's program starts first, followed by the student's program.

**Interaction Flow**:

1. The teacher's program reads the test case file.
2. The teacher's program communicates with the student's program via standard output/input.
3. The teacher's program writes the judging result to the `Check_Result` file.

**Example Teacher Program (C language)**:

```c
#include <stdio.h>

int main(void) {
    // 1. Read test data
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

    // 2. Send data to the student program
    printf("%lld\n", n);
    fflush(stdout);

    // 3. Receive student response
    long long received = 0;
    if (scanf("%lld", &received) != 1) {
        return 1;
    }

    // 4. Judge and write result
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

> **Note**: In Interactive mode, the Custom Checker feature will be disabled.

---

## III. Custom Checker

When standard string comparison cannot meet requirements, you can upload a Python script for custom comparison.

### Use Cases

- Allowing floating-point error.
- Accepting multiple correct answers.
- Ignoring whitespace or newline differences.
- Giving credit for partial correctness.

### Script Specification

The checker script must define a `check` function and output the results:

```python
#!/usr/bin/env python3
"""
Custom Checker for Floating Point Number Comparison
Allows small errors (epsilon = 1e-6) for floating-point comparison
"""
import sys


def check(input_file, output_file, answer_file):
    """
    Main function for the custom checker

    Args:
        input_file: Path to the input file (test case .in)
        output_file: Path to the student's output file
        answer_file: Path to the expected answer file (test case .out)

    Returns:
        tuple: (status, message) where status is "AC" or "WA"
    """
    EPSILON = 1e-6  # Tolerance for floating-point comparison

    try:
        # Read the input file to get the expected count
        with open(input_file, 'r') as f:
            lines = f.read().strip().split('\n')
            n = int(lines[0])

        # Read the student's output
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

        # Read the expected answer
        with open(answer_file, 'r') as f:
            answer_output = f.read().strip()
            answer_lines = answer_output.split('\n')
            answer_nums = []
            for line in answer_lines:
                line = line.strip()
                if line:
                    answer_nums.append(float(line))

        # Check the count
        if len(student_nums) != n:
            return "WA", f"Expected {n} numbers, got {len(student_nums)}"

        if len(student_nums) != len(answer_nums):
            return "WA", f"Line count mismatch: expected {len(answer_nums)}, got {len(student_nums)}"

        # Compare one by one (including tolerance)
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

### Output Format

The checker must output in the following format:

```
STATUS: AC
MESSAGE: All numbers match within tolerance
```

Or

```
STATUS: WA
MESSAGE: Number 3: expected 3.14159, got 3.15000
```

---

## IV. Custom Scorer

When special scoring logic is needed, you can upload a Python script for custom scoring.

### Use Cases

- Scoring based on the proportion of correct test cases.
- Adding/deducting points based on program execution time.
- Late submission deduction logic.
- Multi-factor comprehensive scoring.

### Script Specification

The scoring script reads assessment results in JSON format from stdin and outputs the score in JSON format:

```python
#!/usr/bin/env python3
"""
Custom Scorer for Partial Credit
Supports partial credit, time bonuses, and late submission penalties
"""
import json
import sys


def calculate_score(scoring_input):
    """
    Calculate final score

    Args:
        scoring_input: dict containing tasks, stats, lateSeconds, etc.

    Returns:
        dict: containing score, message, breakdown
    """
    tasks = scoring_input.get("tasks", [])
    stats = scoring_input.get("stats", {})
    late_seconds = scoring_input.get("lateSeconds", 0)

    total_score = 0
    task_scores = []
    messages = []

    # Task weights (should align with meta.json)
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

    # Time bonus: average time < 500ms adds 5%
    avg_time = stats.get("avgRunTime", 0)
    time_bonus = 0
    if avg_time > 0 and avg_time < 500:
        time_bonus = int(total_score * 0.05)
        total_score += time_bonus
        messages.append(f"Time Bonus: avg={avg_time:.0f}ms < 500ms → +{time_bonus} pts")

    # Late penalty: 10% deduction per day, up to 30%
    late_penalty = 0
    if isinstance(late_seconds, (int, float)) and late_seconds > 0:
        late_days = late_seconds / 86400
        penalty_rate = min(0.3, late_days * 0.1)
        late_penalty = int(total_score * penalty_rate)
        total_score -= late_penalty
        messages.append(
            f"Late Penalty: {late_days:.1f} days → -{late_penalty} pts"
        )

    # Score boundaries
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

### Input Format

JSON structure passed by the system:

```json
{
  "tasks": [
    {
      "results": [
        { "status": "AC", "runTime": 120, "memory": 1024 },
        { "status": "WA", "runTime": 150, "memory": 1024 }
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

### Output Format

The script must output:

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

## V. Library Usage Restrictions

Restrict the libraries and syntax available to programs through static analysis.

### Restriction Categories

| Category                  | Python     | C/C++        |
| :------------------------ | :--------- | :----------- |
| **Syntax Restrictions**   | ✓          | ✓            |
| **Import Restrictions**   | ✓ (import) | ✗            |
| **Header Restrictions**   | ✗          | ✓ (#include) |
| **Function Restrictions** | ✓          | ✓            |

### Filter Modes

Each restriction can be toggled between:

- **Whitelist**: Only allow items in the list.
- **Blacklist**: Prohibit items in the list.

> **Note**: Switching modes will automatically clear the existing list.

### Common Restriction Examples

**Prohibit use of sorting functions (Blacklist)**:

```
Function Restrictions: sort, sorted, qsort
```

**Allow only basic header files (Whitelist)**:

```
Header Restrictions: stdio.h, stdlib.h, string.h
```

---

## VI. Resource Files

### Student Resource Files

Additional data files (e.g., `.csv`, `.bmp`) for the student's program to read.

**Prerequisites**:

1. Test case archive must be uploaded first.
2. "Allow Read" permission must be enabled.

**File Naming Rules**:

```
[2-digit Task Number][2-digit Test Case Number].[Extension]
```

**Example**:

```
student_resource.zip
├── 0000.csv    # Corresponds to test case 0000
├── 0001.csv    # Corresponds to test case 0001
├── 0100.bmp    # Corresponds to test case 0100
└── 0101.bmp    # Corresponds to test case 0101
```

### Teacher Resource Files

Data files for the teacher's program (e.g., Custom Checker) to read.

**Properties**: Not restricted by "Allow Read" permission.

---

## VII. Network and Environment Extensions

### Network Access Model

Control network connection permissions for student programs:

| Mode          | Description                                      |
| :------------ | :----------------------------------------------- |
| **Whitelist** | Only allow connections to addresses in the list. |
| **Blacklist** | Only block connections to addresses in the list. |

The list supports entries for:

- IP addresses (e.g., `192.168.1.1`)
- Domain names (e.g., `api.example.com`)

### Sidecars

Add auxiliary containers to the evaluation environment to provide:

- Database services.
- API simulation services.
- Caching services.

**Configuration Fields**:

- Container name.
- Docker image name.
- Environment variables.
- Startup arguments.

### Custom Environment (Dockerfile)

Upload an archive containing a Dockerfile to customize the execution environment:

**Archive Structure**:

```
dockerfiles.zip
└── python311/
    └── Dockerfile
```

The system will automatically parse the archive structure and list the detected environments.
