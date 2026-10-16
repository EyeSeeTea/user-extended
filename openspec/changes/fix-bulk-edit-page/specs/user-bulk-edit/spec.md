## Purpose

Defines how the bulk edit page lets a user edit several users in one grid: which users it opens with, how rows are added and removed without losing work, and which fields can be edited in each row.

## ADDED Requirements

### Requirement: The page opens only with users to edit
The bulk edit page SHALL open with the users selected in the users list. When it is opened without users (no selection, a direct link, a bookmark or a reload), it SHALL redirect to the users list without errors.

#### Scenario: Opening the route directly
- **WHEN** the user opens `#/bulk-edit` in a new tab or from a bookmark
- **THEN** the app shows the users list and logs no error, and the other routes keep working

#### Scenario: Opening from the users list
- **WHEN** the user selects two users in the list and chooses Edit
- **THEN** the page shows one row per selected user with their current values

### Requirement: Adding or removing rows keeps the rest of the form
Adding a row SHALL append one empty row and keep every value already edited and every row already removed. Removing a row SHALL remove only that row and keep the values of the others.

#### Scenario: Add a row after editing
- **WHEN** the user changes the surname of a row and then clicks "Add user"
- **THEN** the changed surname is kept and a new empty row appears at the end

#### Scenario: Add a row after deleting one
- **WHEN** the user deletes a row and then clicks "Add user"
- **THEN** the deleted row does not come back and a new empty row appears at the end

#### Scenario: Delete a row after editing another
- **WHEN** the user edits a row and then deletes a different row
- **THEN** the edited row keeps its values

### Requirement: New rows can be filled in completely
Username and Password SHALL be editable in rows added with "Add user" and stay read-only for existing users. When a row is added, the Username and Password columns SHALL be visible. A new row SHALL NOT carry a preset password.

#### Scenario: Fill in a new row
- **WHEN** the user clicks "Add user"
- **THEN** the Username and Password columns are shown, both are editable and empty in the new row, and Username stays read-only in the existing rows
