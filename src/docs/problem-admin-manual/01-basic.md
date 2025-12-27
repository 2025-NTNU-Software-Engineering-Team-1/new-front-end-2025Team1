# Problem Management Manual

This document provides guidance for the "Create Problem" and "Edit Problem" pages. It serves as a static reference for administrative operations.

---

## 1. Recommended Workflow

To ensure all settings are correctly linked, please follow this sequence:

### Phase 1: Basic Information

- **Problem Name & Visibility**: Define the title and toggle the hidden status.
- **Problem Statement**: Fill in the description, input/output formats, and provide examples.

### Phase 2: Configuration

- **Submission Rules**: Select allowed languages, add tags, and set the submission quota.
- **Accepted Format**: Choose between source code or zip archive submissions.
- **Feature Toggles**: Enable Trial Mode, AI VTuber assistance, Network access, or Sidecar containers.
- **Artifacts**: Configure collection rules for files generated during execution.

### Phase 3: Pipeline Settings

- **File Access**: Grant permissions for reading or writing files.
- **Execution Mode**: Select General, Function Only, or Interactive mode.
- **Advanced Logic**: Upload custom checkers, scoring scripts, or set library restrictions.

### Phase 4: Data Management

1.  **Test Data**: Upload the zip file first to establish the task structure.
2.  **Task Refinement**: Adjust time limits, memory limits, and scores per task.
3.  **Resource Data**: Upload supplemental files for students or teachers.

---

## 2. Test Data Zip Specification

The system automatically groups files into tasks based on the numerical prefix of the filename.

| Task Index | Filename Pattern        | Description                                          |
| :--------- | :---------------------- | :--------------------------------------------------- |
| **Task 0** | `00_xx.in`, `00_xx.out` | Prefix `00` creates Task 0; supports multiple cases. |
| **Task 1** | `01_xx.in`, `01_xx.out` | Prefix `01` creates Task 1.                          |
| **Task 2** | `02_xx.in`, `02_xx.out` | Prefix `02` creates Task 2 (and so on).              |

> **Note**: The total count of `.in` and `.out` files must be identical, and their indices must match perfectly.

---

## 3. Resource Data Prerequisites

The management of resource files depends on the existing task structure and pipeline permissions:

- **Upload Order**: You must upload the **Test Data Zip** before adding resource files.
- **Student Resources**: These require the **Allow Read** permission in the Pipeline settings to be accessible.
- **Teacher Resources**: These are internal and are not restricted by Pipeline access settings.

---

## 4. FAQ

### Q1: Why is my submission blocked?

If the system detects missing fields or errors, a **Submission blocked** summary will appear at the bottom. Click this message to auto-scroll and expand the section containing the error.

### Q2: How do I configure the Quota?

- Enter `-1` for unlimited submissions.
- Enter an integer between `1` and `500` to set a specific limit.

### Q3: When should I choose "zip" as the Accepted Format?

Select this when the problem requires students to submit multiple files, such as custom headers or complex project structures. You can also specify a **Max Zip Size** to prevent oversized uploads.
