## Why

The bulk edit page (`#/bulk-edit`) loses work and cannot create users (reproduced on DHIS2 2.42.6): "Add user" discards unsaved edits and brings back deleted rows, users added there cannot be saved (empty id, then null references), and opening the route directly shows a blank screen. Creating users through `/new` has been disabled since 2023 (`2f87b09`) for the same root cause: the save path only handles existing users. This change fixes the page and makes user creation work in both places (option A of the task).

## What Changes

- Adding or deleting rows in bulk edit keeps the values already edited and never brings back deleted rows.
- Opening `#/bulk-edit` without navigation state redirects to the users list (`/`) instead of crashing.
- New users (bulk edit "Add user" and `/new`) start from a dedicated id-less template with empty roles, groups and org units (no empty-id references), and no password. The domain generates their id when they are saved.
- In bulk edit, Username and Password are editable for new rows (still read-only for existing users) and their columns are shown when a row is added. The hardcoded `District123$` password is removed.
- Saving validates each user by what it is: rows with an id use the existing-user rules; id-less drafts use the new-user rules (first name, surname, username, password, at least one role, group and org unit) and receive an id from `User.createNew`. If any user is invalid, nothing is sent and the form shows which user and which fields are missing.
- The "Create user" action button in the users list (`/new`) is enabled again.

## Capabilities

### New Capabilities
- `user-bulk-edit`: editing several users in one grid: adding and removing rows, direct access to the route, and which fields are editable per row.
- `user-creation`: creating users from bulk edit and from `/new`: the initial values of a new user, validation before sending, and how errors reach the form.

### Modified Capabilities
None (the only existing spec is `app-settings`, which this change does not touch).

## Impact

- **Domain**: `User.createNew` remains the sole owner of new identifiers; an id-less new-user template lives next to `defaultUserProps` (which stays unchanged for import); `SaveUsersUseCase` tells id-less drafts from existing users and validates each with its rules.
- **Data**: no change expected in `UserD2ApiRepository.save()`; every draft has become a `User` with a valid id before reaching it, and it already supports users without an existing record (import and replicate create users through it).
- **UI**: `UserBulkEditPage.tsx` (rows through the form API, redirect, per-row editability, error shown in the form), `UserEditPage.tsx` (`/new` uses the template), `UserListTable.tsx` (button re-enabled), `UserForm.tsx` (Username editable for new rows).
- **Requests**: no extra lookup is needed to tell new from existing users.
- **i18n**: new or changed strings → `yarn update-po`.
- **Compatibility / rollback**: no public API or stored data changes; rolling back is reverting the commits. Out of scope: import CSV/JSON still creates users from `defaultUserProps`.
