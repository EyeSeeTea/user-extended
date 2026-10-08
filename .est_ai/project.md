# est-ai — this project

How the est-ai protocol applies to **this project**. The reviews and the init read this file; it belongs to the project and an update never overwrites it. Project facts for people (stack, commands, architecture) live in [`DEVELOPMENT.md`](../DEVELOPMENT.md); the project's own rules live in [`rules/project/`](rules/project/README.md).

-   **Language**: `typescript` → `rules/lang/typescript.md`
-   **Profile**: `dhis2-react` → `rules/dhis2-react/`
-   **Reference**: `dhis2-app-skeleton` → `reference/dhis2-app-skeleton/` (see [`reference/README.md`](reference/README.md))
-   **Installed from**: `EyeSeeTea/ai-dev-skeleton@a36889f` (`est-ai@0.1.0`) — branch `feature/adopt-existing-projects` (PR #15, not merged yet); compare with the skeleton's `CHANGELOG.md` to see what changed since
-   **Modules**: agents `frontend-developer` and `code-reviewer`; skills `est-init`, `est-review-after-exec`, `est-review-pr`; OpenCode (`opencode.json`). Removed: backend and database agents (no backend or database of its own, only the DHIS2 API), Pencil (`graphical-designer`, `pencil-design`, UI design workflow), tracker management (`project-manager`, `task-management`), and the `dhis2-android`/Kotlin profile
