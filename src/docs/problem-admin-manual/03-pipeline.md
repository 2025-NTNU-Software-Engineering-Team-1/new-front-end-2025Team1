# Pipeline (Evaluation Flow) Guide

This section covers File Access, Execution Mode, Library Restrictions, Custom Checker, Custom Scoring Script, and related topics.

---

## File Access (Allow Read / Allow Write)

### Allow Read

- Allows the program to read files (e.g. `fopen` / `open`)
- **Student Resource Data** requires Allow Read to be enabled; Teacher Resource Data is not restricted

### Allow Write

- Allows the program to write files
- **Allow Write depends on Allow Read**:
  - If Allow Read is disabled, Allow Write will be forced off
  - The UI will show a warning when applicable

---

## Library Restrictions (Static analysis restrictions)

> Different languages support different types of restrictions:
>
> - Python supports Imports restrictions
> - C/C++ supports Headers restrictions

### Enabled

When enabled, you can configure four categories:

1. Syntax Restrictions
2. Imports Restrictions (Python)
3. Headers Restrictions (C/C++)
4. Functions Restrictions

Each category can be toggled between **Whitelist** (only allow items in the list) and **Blacklist** (disallow items in the list). Switching between modes clears the opposite list to avoid mixed usage.

---

## Execution Mode

### General

- Standard mode suitable for most problems

### Function Only

- Requires uploading `Makefile.zip`
- Use case: build/link in a specific way (backend pipeline determines exact behavior)

### Interactive

- Interactive problem mode
- Typically requires uploading Teacher Code (Teacher_file)
- Optionally select Teacher First (run teacher first, then student; backend-dependent)

> Note: Custom Checker is disabled in Interactive mode (UI will lock the option).

---

## Custom Checker

- When enabled, you must upload `Custom_Checker.py` (or have it pre-registered on the backend)
- Used to programmatically compare student outputs (behavior depends on backend implementation)

Frontend validation:

- If Custom Checker is enabled, there must be an uploaded file or an existing checker on the backend

---

## Custom Scoring Script

- When enabled, you must upload `Custom_Scorer.py` (or rely on a backend-provided script)
- Used to customize problem scoring rules (backend-dependent)

Frontend validation:

- If enabled, there must be an uploaded file or an existing scoring script on the backend

---

## Upload Size Limits

All upload fields are checked client-side via `assertFileSizeOK()`. If a file exceeds limits, the selection will be cleared and an error will be shown (refer to project-specific limits).
