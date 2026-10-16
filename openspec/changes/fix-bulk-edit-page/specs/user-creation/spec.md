## Purpose

Defines how the app creates DHIS2 users, from the bulk edit page and from the new user page: the values a new user starts with and the validation that runs before anything is sent to the server.

## ADDED Requirements

### Requirement: A new user starts empty and identifiable
A new user SHALL start with a valid generated identifier, no roles, no groups, no organisation units (data capture, data view and search) and no password. It SHALL NOT carry references without an identifier.

#### Scenario: New row in bulk edit
- **WHEN** the user clicks "Add user" in bulk edit
- **THEN** the new row has no role, group or organisation unit selected and an empty password

#### Scenario: New user page
- **WHEN** the user opens the new user page from the users list
- **THEN** the form has no role, group or organisation unit selected and an empty password

### Requirement: Users are validated as new or existing before saving
On save, a user that already exists in DHIS2 SHALL be validated with the existing-user rules, and any other user with the new-user rules: first name, surname, a valid username, a valid password, and at least one role, one group and one data capture organisation unit. If any user fails validation, nothing SHALL be sent to the server and the form SHALL show which user and which fields are invalid.

#### Scenario: New user without a role
- **WHEN** the user saves a new user with every field filled in except the role
- **THEN** no user is sent to the server and the form shows that the role of that user is missing

#### Scenario: New user without a password
- **WHEN** the user saves a new user without a password
- **THEN** no user is sent to the server and the form shows that the password of that user is invalid

#### Scenario: Complete new user
- **WHEN** the user saves a new user with all required fields
- **THEN** the user is created in DHIS2 with the given identifier, roles, groups and organisation units

#### Scenario: Existing users together with a new one
- **WHEN** the user edits existing users without roles and adds a complete new user, then saves
- **THEN** the existing users are saved with the existing-user rules (no role is required) and the new user is created

#### Scenario: Users cannot be checked
- **WHEN** the server fails while the app checks which users already exist
- **THEN** nothing is saved and the form shows the error

### Requirement: Users can be created from the users list
The users list SHALL offer an action to create a user, which opens the new user page.

#### Scenario: Create a user from the list
- **WHEN** the user clicks the create action in the users list
- **THEN** the new user page opens with an empty user
