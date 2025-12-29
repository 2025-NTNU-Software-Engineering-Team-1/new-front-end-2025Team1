# New Question Page Navigation

This guide provides an overview of the new question page structure, helping you quickly understand the function of each section.

---

## Homepage Introduction

1. Question Name: Required field, used to identify the question.

2. Display Status:
- **Shown**: Students can see this question in the course.
- **Hidden**: The question is not visible to students.
3. Mode Switching:
- **Normal Mode**: Only the basic settings section is displayed.
- **Advanced Mode**: The "Judging Process" and "Resource Files" sections are also displayed.
    > The system will remember your preference settings and automatically apply them the next time you open the page.

---

## Introduction to the Five Main Sections

### 1. Problem Description

Edit the detailed description of the problem, including:

- Problem Description
- Input and Output Formats
- Problem Hints
- Example Input/Output

### 2. Configuration Settings

Set the submission specifications and function switches for the problems:

- Supported Languages ​​(C / C++ / Python)
- Tag Management
- Submission Quota Management
- Submission Format
- Test Mode
- AI Teaching Assistant Function
- Network and Environment Expansion
- Product Collection

### 3. Judging Process (Advanced)

Set advanced options for the program execution environment:

- File Access Permissions
- Library Usage Restrictions
- Execution Mode Selection
- Custom Grading Scripts / Scoring Scripts

### 4. Test Data

Upload the compressed test data file and adjust the parameters of each task:

- Time Limit
- Memory Limit
- Task Scores

### 5. Resource Files (Advanced)

Upload resource files (e.g., bmp, csv) for student or teacher use.

---

## Error Summary and Submission

### Error Summary

When form validation fails, a summary list of all errors will be displayed at the bottom of the page. Clicking on any error will automatically redirect to the corresponding section.

### Submission Status

Different messages will be displayed below the submit button depending on the form status:

- **Waiting for Editing**: No submission attempt yet
- **Submission Blocked**: Validation error exists and needs correction
- **Ready**: All fields have passed validation

---

## Quick Operation Process

1. Enter the question name
2. Expand "Question Description" to write the question content
3. Expand "Configuration Settings" to set the language and submission guidelines
4. Expand "Test Data" to upload the test data compressed file
5. Enable advanced mode as needed to set the judging process
6. Click the submit button to complete the setup

> **Tip**: It is recommended to upload the test data first. The system will automatically parse the task structure for subsequent settings.