# Learning guide folder

A **learning guide** teaches a topic inside a scenario (mainly Dojos). You author
it as Markdown and upload it as a **folder** in the scenario editor
(Scenario → *Learning guide* → drop a folder). Students see it rendered in the
**Guide** panel of the scenario workspace.

## Folder structure

```
my-guide/
  main.md            # REQUIRED — the guide, in Markdown
  images/
    alert.png        # any images referenced by main.md
    process-tree.png
```

- `main.md` must be at the folder root.
- Images (and any other assets) can sit anywhere under the folder; reference them
  from `main.md` with **relative paths** (e.g. `![C2](images/alert.png)`). On
  upload they're stored in object storage and served — rendered inline for the
  student — via an authorized route. Put images in a subfolder (e.g. `images/`).
- A text-only guide (no images) doesn't need object storage configured.

## Markdown

Standard Markdown: headings (use them for **parts** and **tasks**), lists, code
fences, tables, links, and images. For example:

```markdown
# Part 1 — Triage

## Task 1: Read the alert queue
Open the **Alerts** panel and note the first alert that fires.

![The first alert](images/alert.png)
```

## Prompt blocks (CTF questions)

To test students on their findings, add a fenced **`prompt`** block anywhere in
`main.md`. It renders as an interactive question card (answer + check), and the
"solved" state is saved per student.

    ```prompt
    question: What is the C2 IP address?
    answer: 185.220.101.34
    hint: Look at the outbound connections on win-ep-04.
    points: 10
    ```

| Field      | Required | Notes                                            |
| ---------- | -------- | ------------------------------------------------ |
| `question` | yes      | Shown to the student.                            |
| `answer`   | yes      | Checked case-insensitively, trimmed. **Never sent to the client.** |
| `hint`     | no       | Shown after a wrong answer.                       |
| `points`   | no       | Displayed on the card (informational).            |

Notes:

- Each field is a single line (`key: value`).
- Blocks missing `question` or `answer` are ignored.
- Answers are stripped server-side; students only ever receive the question,
  hint, and points. Checking happens in a Server Action.

## After upload

The editor shows the guide status (number of prompts and assets). Re-drop a
folder to replace it, or **Remove** to clear it.

See also: [autobuild.md](./autobuild.md) to build a whole scenario (including its
guide) from one folder.
