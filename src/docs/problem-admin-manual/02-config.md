# Detailed Explanation of Basic Functions

This manual details the functions of problem description, configuration settings, and data upload.

---

## I. Problem Description

This section is used to edit the complete description of the problem.

### Problem Description

Write the main content of the problem, explaining the background and requirements. Markdown format is supported.

### Input Description

Describe the input format that the program expects to receive, including data type and range limitations.

### Output Description

Describe the output format that the program should produce, including precision requirements and line break rules.

### Hints

Provide additional problem-solving hints or notes (optional).

### Example Input/Output

Multiple examples can be added for students to refer to. Each example is limited to 1024 characters.

---

## II. Configuration Settings

### 1. Supported Languages

Set the programming languages ​​allowed for students, including:

- C
- C++
- Python

Multiple languages ​​can be selected simultaneously. This setting will affect:

- Language options in the front-end submission interface

- File types accepted in trial mode

- AI teaching assistant's decision logic

### 2. Tag Management

Used to label question types or knowledge points for easy categorization and searching. Separate multiple tags with commas when entering.

**Limitation**: Each tag can contain a maximum of 16 characters.

### 3. Submission Limit

Limit the total number of submissions per student for this problem:

- Enter `-1` for unlimited submissions

- Enter an integer between `1` and `500` to represent the specific submission limit

### 4. Submission Format

Specify the format for student submissions:

| Format              | Description                                          | Applicable Scenarios |
| ------------------- | ---------------------------------------------------- | -------------------- |
| **code**            | Students upload a single source code file directly   | General Problems     |
| **Compressed File** | Students upload a ZIP file containing multiple files | Makefile Project     |

When selecting a compressed file, you can set a maximum size limit (1 to 1000 MB, default 50 MB).

---

## III. Test Data

### Data Compressed File Naming Conventions

The system automatically groups tasks based on the file prefix number:

| Task Number | File Naming Example   | Description |
| ----------- | --------------------- | ----------- |
| Task 0      | `0000.in`, `0000.out` | Prefix `00` |
| Task 1      | `0100.in`, `0100.out` | Prefix `01` |
| Task 2      | `0200.in`, `0200.out` | Prefix `02` |

**Naming Rules**:

```
[Task Number (2 digits)][Data Survey Number (2 digits)].[in|out]
```

**Example**:

```
testdata.zip
├── 0000.in
├── 0000.out
├── 0001.in
├── 0001.out
├── 0100.in
├── 0100.out
└── 0101.in
└── 0101.out
```

The above structure represents:

- Task 0: 2 data points (0000, 0001)

- Task 1: 2 data points (0100, 0101)

> **Note**: The number of input files (`.in`) and output files (`.out`) must be the same, and their numbers must correspond.

### Task Parameter Settings

After uploading the data points, the system will automatically parse and display each task. Adjustable for each task:

| Parameters       | Description                           | Default Values                                |
| ---------------- | ------------------------------------- | --------------------------------------------- |
| **Time Limit**   | Maximum program execution time (ms)   | 1000 ms                                       |
| **Memory Limit** | Maximum available program memory (MB) | 256 MB                                        |
| **Task Score**   | Score allocation for this task        | Evenly distributed across the number of tasks |

> **Verification Rule**: The total score of all tasks must equal 100 points.

---

## IV. Trial Run Mode

Enabling this mode allows students to test their work before formal submission.

### Basic Settings

| Options                      | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| **Maximum Number of Trials** | Enter `-1` for unlimited attempts, or `1` to `500` |
| **Display Standard Output**  | Whether to display stdout content                  |
| **Display Error Messages**   | Whether to display stderr content                  |
| **Results Downloadable**     | Whether to allow downloading execution results     |

### Upload Public Test Data

Upload a compressed file containing only the input file (`.in`) as public test data.

**Naming Rules**: Same prefix numbering rules as official test data.

### Upload Correct Reference Program

When enabling trial mode, at least one correct piece of code (`.c`, `.cpp`, or `.py`) must be uploaded for the system to generate the expected output.

---

## V. AI Teaching Assistant

Assist students in understanding problems or debugging through generative AI models.

### Setup Steps

1. **Enable Feature**: Check "Enable AI Teaching Assistant"

2. **Select Model**: Select a supported model from the drop-down menu.

3. **Select Key**: Check the API key provided by the course.

4. **Upload AC Program**: Provide the correct reference code.

> **Note**: At least one API key must be selected; otherwise, it cannot be saved.

---

## VI. Product Collection

Select the files the system should retain after evaluation:

| Options                                | Description                                                |
| -------------------------------------- | ---------------------------------------------------------- |
| **Compiled Binary File**               | Retain the compiled executable file                        |
| **Student Submission Compressed File** | Save the original compressed file submitted by the student |

---

## Frequently Asked Questions

### Submission Quota Setting Rules?

- Enter `-1` to represent unlimited submissions

- Enter an integer between `1` and `500`

### When should I select compressed file as the submission format? This is used when a task requires students to submit multiple source code or header files simultaneously (e.g., Makefile submission).

### What if the total score for the assessment tasks is not 100?

Adjust the score fields for each task to ensure the total score is 100 before submitting.
