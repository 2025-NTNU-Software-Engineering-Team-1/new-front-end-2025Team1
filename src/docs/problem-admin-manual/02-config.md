# Configuration Settings Manual

This section explains the configuration settings for problems, including submission rules, Trial Mode, AI VTuber, Network settings, and Artifact Collection.

---

## 1. General Submission Rules

### Allowed Languages

Specifies the programming languages (e.g., C, C++, Python) that students can use for submission. This setting determines the language options available to students and the accepted file extensions for AI VTuber and Trial Mode. Internally, these are stored using a bitmask.

### Tags

Used to categorize problems. Multiple tags should be separated by commas (e.g., `dp,math,greedy`). The system automatically trims whitespace and removes empty strings.

### Quota

Limits the number of times a student can submit a solution.

- `-1`: Unlimited submissions.
- `1 to 500`: Specific submission limit.

### Accepted Format

- **Code**: Students submit a single source file.
- **Zip**: Students upload a zip archive. You can set a `Max Zip Size (MB)` between 1 and 1000 (default is 50).

---

## 2. Trial Mode

Enabling Trial Mode provides a testing interface for students to verify their code before final submission.

- **Trial Max Number**: Limits test attempts. Use `-1` for unlimited or `1 to 500` for a specific limit.
- **Visibility & Downloads**: Configure whether students can view stdout/stderr or download output files.
- **Public Test Data (.zip)**: Upload a zip containing only `.in` files for public testing. The file size limit is 1GB.
- **AC Files (Trial)**: At least one correct reference file (AC file) must be uploaded if Trial Mode is enabled.

---

## 3. AI VTuber (AI Assistant)

### Frontend Verification

When enabled, the system verifies that:

1. At least one API Key is selected.
2. At least one AC file is uploaded as a reference for the AI.

### Model & API Keys

- **AI Model**: Select available models (e.g., Gemini) from the UI.
- **API Keys**: Provided by the Course. You can search by Key Name to auto-scroll to specific entries. Hover over the help icon to see the recommended number of keys.

---

## 4. Network & Sidecars

### Network Access Model

- **Whitelist**: Blocks all traffic except for the specified IPs/URLs.
- **Blacklist**: Allows all traffic except for the specified IPs/URLs.
- **IP / URL List**: Add entries using the multi-input component.

### Sidecars (Sandbox Environment)

Auxiliary containers (e.g., DB, Cache, or Local Judge Helpers) can be added by defining the image name, environment variables, and arguments.

### Dockerfiles.zip (Custom Environments)

When uploading custom environment configurations, the following structure is required:

1. The zip must contain at least one `Dockerfile`.
2. Each file must follow the path: `environment_folder/Dockerfile` (e.g., `python311/Dockerfile`).
3. The system will parse and list the detected environments for user confirmation.

---

## 5. Artifact Collection

Select which files should be preserved or made available for download after execution:

- **Compiled Binary**: The binary file generated after compilation.
- **Student Artifact (zip)**: The original zip archive submitted by the student.
