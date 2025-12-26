# Pipeline (Evaluation Flow) Guide

This section covers the configuration of the evaluation environment, including file access permissions, execution modes, static analysis restrictions, and custom logic scripts.

---

## 1. File Access (Read / Write)

File access controls the program's ability to interact with the file system.

- **Allow Read**: Required for the program to perform read operations. **Student Resource Data** will only be accessible if this is enabled. Teacher Resource Data remains accessible regardless of this setting.
- **Allow Write**: Enables file writing operations.
- **Dependency**: "Allow Write" is dependent on "Allow Read." If read access is disabled, write access is automatically revoked, and a warning will be displayed in the UI.

---

## 2. Library Restrictions

Static analysis is used to restrict the resources a program can utilize based on the language:

- **Language Support**: Python uses Import restrictions, while C/C++ uses Header restrictions.
- **Filtering Modes**: Each category can be toggled between two modes:
  - **Whitelist**: Only items in the list are permitted.
  - **Blacklist**: Items in the list are strictly forbidden.
- **Note**: Switching between Whitelist and Blacklist will clear the current list to prevent configuration errors.

Categories include: Syntax, Imports (Python), Headers (C/C++), and Functions.

---

## 3. Execution Mode

| Mode              | Use Case                                    | Prerequisites                                              |
| :---------------- | :------------------------------------------ | :--------------------------------------------------------- |
| **General**       | Standard algorithmic problems.              | None.                                                      |
| **Function Only** | Problems requiring custom build/link logic. | Must upload `Makefile.zip`.                                |
| **Interactive**   | Programs interacting with a judge process.  | Requires Teacher Code. Optional "Teacher First" execution. |

> **System Note**: Custom Checker is automatically disabled and locked when Interactive mode is selected.

---

## 4. Custom Logic Scripts

### Custom Checker

Used to programmatically evaluate student outputs. If enabled, the user must either upload a `Custom_Checker.py` or utilize a pre-registered backend script.

### Custom Scoring Script

Used to define non-standard scoring rules. Similar to the checker, an uploaded script or backend default is required when this feature is active.

---

## 5. Upload Size Limits

To ensure performance, all file upload fields undergo client-side validation. If a file exceeds the defined limit, the selection will be cleared, and an error alert will be triggered immediately.
