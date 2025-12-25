# Configuration Guide

This section covers: Allowed Languages, Tags, Quota, Accepted Format, AI VTuber, Trial Mode, Network & Sidecars, and Artifact Collection.

---

## Allowed Languages

- Example supported languages: C / C++ / Python (stored as a bitmask internally)
- This affects:
  - Which languages students can submit in
  - Allowed file extensions for AI VTuber AC files and Trial AC files (e.g. `.c`, `.cpp`, `.py`)

---

## Tags

- Enter multiple tags separated by commas (e.g. `dp,math,greedy`)
- The system will auto-trim and remove empty entries

---

## Quota

- `-1`: Unlimited
- `1 ~ 500`: Limit on the number of submissions

---

## Accepted Format (code / zip)

### code

- Students submit a single source file (typical OJ behavior)

### zip

- Students submit a zip archive
- You can set `Max Zip Size (MB)` (range 1~1000, default 50)

---

## Trial Mode

When Trial Mode is enabled, extra features appear on testing/trial pages (e.g., uploading example AC files, limiting trial count).

### Trial Max Number

- `-1`: Unlimited
- `1 ~ 500`: Limit on trial runs

### Result Visible / Downloadable

- `Result Visible`: Allows viewing of stdout/stderr and output details (backend-dependent)
- `Result Downloadable`: Allows downloading of output files (backend-dependent)

### Upload Public Test Data (.zip)

- **The zip must contain only `.in` files**
- File size is checked on the frontend (current UI shows ≤ 1GB)

### Upload AC Files (Trial)

- Must upload at least one AC file when Trial Mode is enabled
- File extensions are determined by Allowed Languages (e.g. `.c`, `.cpp`, `.py`)

---

## AI VTuber

### Frontend validation when enabling

When enabling AI VTuber, frontend validation checks that:

- At least one API Key is selected
- At least one AC file is uploaded

### AI Model

- The UI allows choosing available models (e.g. Gemini, depending on platform)

### Upload AC Files (AI VTuber)

- File extensions follow Allowed Languages
- Purpose: provide reference AC program files for the AI

### API Keys

- API keys are retrieved per course and marked Active / Inactive
- You can search by key name and the UI will auto-scroll to the match
- A help icon shows suggested key counts and tips

---

## Network & Sidecars

### Network Access Model (Whitelist / Blacklist)

- **Whitelist**: Only IPs/URLs on the list are allowed; all others are blocked
- **Blacklist**: Only IPs/URLs on the list are blocked; all others are allowed

### IP / URL List

- Use the multi-entry input to add items
- Ensure formatting is correct (e.g. IP: `8.8.8.8`; URL: `example.com`)

### Sidecars (Sandbox environment)

- You can add sidecar containers (image, name, env, args, etc.)
- Use case: provide auxiliary services for testing such as DB, cache, or local judge helpers

### Dockerfiles.zip (custom environments)

When a zip is uploaded, the frontend checks:

1. The zip must contain at least one `Dockerfile`
2. Each Dockerfile must follow the structure `environment_folder/Dockerfile` (e.g. `python311/Dockerfile`)
3. The frontend will parse and present the `environment_folder` list and allow removing environments

> If the structure is invalid, the upload is rejected and the selection is cleared.

---

## Artifact Collection

Select which artifact types should be retained or made available for download:

- `Compiled Binary`: the compiled binary file
- `Student Artifact (zip)`: the student's submitted zip

This setting is stored in `config.artifactCollection`.
