# Problem Management Manual (Overview)

This manual applies to the "Create Problem" and "Edit Problem" pages. All content is a front-end static document intended for reading and reference.

---

## Recommended Order of Steps

1. **Problem name / Hidden**
2. **Set Description** (problem statement, I/O, examples)
3. **Set Configuration**
   - Allowed Languages / Tags / Quota
   - Accepted Format (code / zip)
   - Trial Mode
   - AI VTuber
   - Network & Sidecars
   - Artifact Collection
4. **Set Pipeline**
   - File Access (Allow Read / Allow Write)
   - Execution Mode (general / functionOnly / interactive)
   - Custom Checker / Custom Scoring Script
   - Library Restrictions
5. **Set Test Data**
6. **Set Resource Data (Student / Teacher)**

---

## Test Data Zip Format

- Place `.in` and `.out` files inside the zip
- **The number of `.in` and `.out` files must match**
- Naming convention (two-digit prefix denotes the task index):
  - `00_xx.in` / `00_xx.out` represent multiple cases for Task 0
  - `01_xx.in` / `01_xx.out` represent multiple cases for Task 1
- The system groups files automatically by the `00`, `01`, `02`, ... prefixes into tasks

> Tip: prepare the Test Data Zip first, then come back to the page to configure per-task time/memory/score.

---

## Resource Data Prerequisites (Important)

Resource data is validated against the Test Data task/case structure, therefore:

- **You must upload the Test Data Zip first** so tasks are created
- Student Resource Data requires **Pipeline > Allow Read**; Teacher Resource Data is not restricted by this

---

## FAQ

### Q1: My submit is blocked and I don't know why

- An error summary ("Submission blocked...") appears at the bottom of the page
- Clicking the error message will expand and scroll to the relevant section

### Q2: How do I set Quota?

- `-1` means unlimited
- Or enter an integer from `1` to `500`

### Q3: What does choosing `zip` for Accepted Format mean?

- Students will submit a zip archive instead of a single source file
- You can set `Max Zip Size (MB)` to restrict upload size
