# Technical debt

Debt found and deliberately postponed. Each entry says what it is, why it matters and when to address it.

## The bulk edit presentation logic depends on react-final-form

- **Found:** 2026-10-16, review of task group 2 of `fix-bulk-edit-page`.
- **What:** `useUserBulkEdit` keeps the bulk edit rows in a final-form instance: adding, removing and editing
  rows go through the form API, and fields validate with the UI validators of `UserForm.tsx` (`useValidations`).
  The grid cells are react-final-form fields (`RenderUserImportField`, `UserRoleGroupFF`, `OrgUnitSelectorFF`,
  `PreviewInputFF`), shared with the `/new` wizard and the import table.
- **Why it matters:** presentation logic is tied to a form library instead of being plain state the page renders
  (`.est_ai/rules/dhis2-react/react.md` → *Presentation logic lives in custom hooks*), and the user rules are split
  between the UI validators and the domain (`User`): the domain does not validate phone, WhatsApp or the email of
  existing users, so the same user can pass one and fail the other.
- **Proposal:** the hook owns the rows as state (`addUser`, `removeUser`, `updateField`) and validates with the
  domain; the grid uses controlled fields, splitting each FF field into a controlled component plus a thin FF
  adapter for the wizard and the import table; the missing rules move to the domain as value objects.
- **When:** a separate change, after `fix-bulk-edit-page`.
