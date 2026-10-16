## Context

See proposal.md (Why). Current state that shapes the approach:

- `UserBulkEditPage` keeps the rows in a `users` state that is also the `initialValues` of react-final-form. `addRow` changes that state, so the form reinitializes and drops unsaved edits; `removeRow` changes only the form (`form.change`), so the state still has the deleted row and the next reinitialization brings it back.
- The page reads `location.state as { users }`; with no state (`null`) the destructuring throws before the existing `users.length === 0 → <Navigate to="/">` guard runs.
- New rows and `/new` start from `defaultUserProps`, which has `id: ""` and one empty-id item in `userRoles`, `userGroups`, `organisationUnits`, `dataViewOrganisationUnits` and `searchOrganisationsUnits`. `defaultUserProps` is also used by import (`ImportUsersUseCase`), so it stays as it is.
- `SaveUsersUseCase` validates every user with `User.createExisted`. `User` already has the new-user rules (`createNew`, `isExistingUser: false`), but `createNew` always generates a new id, and the UI needs the id it already gave the row.
- `UserD2ApiRepository.save()` prefetches the users by id and merges each one with its existing record if there is one (`buildUserToSave(undefined, user)` for new users). Import and replicate already create users through it, so it handles new users once ids are valid.
- Username is rendered `disabled={isEdit}`, and bulk edit passes `isEdit: true` for every row.

## Goals / Non-Goals

**Goals:**
- One save path for existing and new users (bulk edit and `/new`), with the new-user rules applied in the domain before any request.
- Validation errors shown in the form, not only as a snackbar.

**Non-Goals:**
- Changing `defaultUserProps` or how import creates users.
- Per-field inline errors in the grid: errors are listed in the form's error box, by user and field.
- Changing `UserD2ApiRepository.save()` or `TransferFF`.

## Decisions

### Data flow

```
UserBulkEditPage / UserEditPage (webapp)
  ├─ new row / new user ← newUserProps()            (domain/entities/UserProps.ts)
  └─ onSubmit → compositionRoot.users.save(users)
        SaveUsersUseCase (domain/usecases)
          ├─ userRepository.getByIds(ids)            → which ids exist
          ├─ existing → User.createExisted(props)
          ├─ others   → User.createNew(props)         (keeps props.id)
          ├─ any error → Future.error(message by user and field), nothing sent
          └─ userRepository.save(users)               (data, unchanged)
  ← error → shown as the form's submit error
```

### 1. Rows live only in the form
The page keeps its initial users as fixed `initialValues` (from the navigation state, never updated afterwards). "Add user" appends the new row with the form API (`form.change("users", [...current, newUser])`), as `removeRow` already does. The form is the only source of truth for rows, so it never reinitializes.
- *Alternative:* keep the `users` state and sync it on every change (`FormSpy`), or set `keepDirtyOnReinitialize`. Rejected: two sources of truth for the same rows, and `keepDirtyOnReinitialize` would still bring back deleted rows.

### 2. Missing navigation state
Read the state as optional (`location.state?.users ?? []`) so the existing empty-users guard redirects to `/`.

### 3. New-user template
A `newUserProps()` function in `UserProps.ts` returns `defaultUserProps` with a `generateUid()` id, empty collections (`userRoles`, `userGroups`, `organisationUnits`, `dataViewOrganisationUnits`, `searchOrganisationsUnits`, `authorities`) and an empty password. It is a function so every call gets a new id and fresh dates. Bulk edit "Add user" and `/new` use it; the hardcoded password goes away.
- *Alternative:* fix `defaultUserProps`. Rejected by the task: import depends on it.

### 4. Telling new from existing users in the use case
`SaveUsersUseCase` asks the repository which ids exist (`getByIds`, already in `UserRepository`), validates those with `createExisted` and the rest with `createNew`. `User.createNew` keeps an `id` when it is given and generates one otherwise, so its current callers (import, replicate) do not change.
- *Alternative:* the UI tells the use case which users are new (a flag or a list of ids). Rejected: the UI already lost that information in `/new` (the id is generated before save) and could lie; the server is the source of truth, and it costs one request per save.

### 5. Errors reach the form
The use case joins the validation errors into one message that names each invalid user (username or name, or its row) and its fields, using the existing `ValidationError` helpers. The bulk edit `onSubmit` returns it as `{ [FORM_ERROR]: message }` so the form's existing `NoticeBox` shows it (today it returns the bare string, which react-final-form ignores, and only the snackbar shows it). `UserEditWizard` already shows the string returned by `onSave` as its submit error.

### 6. Editable fields per row
Bulk edit passes `isEdit` per row: `false` for rows added in the page, `true` for users that came from the list. The page knows the initial ids (from `initialValues`), so a row is new when its id is not among them. When a row is added, `username` and `password` are added to the visible columns if they are missing.

### 7. `/new`
`UserEditPage` uses `newUserProps()` instead of `{ ...defaultUserProps, id: generateUid() }`, and `UserListTable` re-enables `onActionButtonClick: () => navigate("/new")` (removing the FIXME).

## Risks / Trade-offs

- [The wizard behind `/new` may have other problems not covered by the task, since it has been disabled since 2023] → test `/new` end to end on DHIS2 2.42 during the change; anything outside the save path goes to a separate task.
- [`updateUserGroups` after the metadata post may not handle users that did not exist before] → covered by the end-to-end check; import already creates users through the same `save()`.
- [Errors are listed in one box, not next to each cell] → acceptable for this task (non-goal); a grid of 6+ columns per user still says which user and field.
- [One extra request per save] → `getByIds` on the ids being saved, chunked like the other id lookups.
- [`TransferFF` treats an empty-id ref as selected] → no longer reachable from bulk edit or `/new`; import still uses `defaultUserProps`, but it does not render the form.

## Migration Plan

No data or API migration. Rollback is reverting the change's commits.
