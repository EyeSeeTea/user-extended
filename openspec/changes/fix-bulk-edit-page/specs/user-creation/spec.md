## Purpose

Defines how the app creates DHIS2 users, from the bulk edit page and from the new user page: the values a new user starts with and the validation that runs before anything is sent to the server.

## ADDED Requirements

### Requirement: A new user starts empty and receives its identity from the domain
A new-user form SHALL start without an identifier, roles, groups, organisation units (data capture, data view and search) or password. It SHALL NOT carry references without an identifier. When it is saved, the domain SHALL generate its valid identifier.

#### Scenario: New row in bulk edit
- **WHEN** the user clicks "Add user" in bulk edit
- **THEN** the new row has no role, group or organisation unit selected and an empty password

#### Scenario: New user page
- **WHEN** the user opens the new user page from the users list
- **THEN** the form has no role, group or organisation unit selected and an empty password

### Requirement: Users are validated as new or existing before saving
On save, a row with an identifier SHALL be validated with the existing-user rules, and an id-less draft with the new-user rules: first name, surname, a valid username, a valid password, and at least one role, one group and one data capture organisation unit. If any user fails validation, nothing SHALL be sent to the server and the form SHALL show which user and which fields are invalid.

#### Scenario: New user without a role
- **WHEN** the user saves a new user with every field filled in except the role
- **THEN** no user is sent to the server and the form shows that the role of that user is missing

#### Scenario: New user without a password
- **WHEN** the user saves a new user without a password
- **THEN** no user is sent to the server and the form shows that the password of that user is invalid

#### Scenario: Complete new user
- **WHEN** the user saves a new user with all required fields
- **THEN** the domain gives the user a valid identifier and the user is created in DHIS2 with its roles, groups and organisation units

#### Scenario: Existing users together with a new one
- **WHEN** the user edits existing users without roles and adds a complete new user, then saves
- **THEN** the existing users are saved with the existing-user rules (no role is required) and the new user is created

### Requirement: Users can be created from the users list
The users list SHALL offer an action to create a user, which opens the new user page.

#### Scenario: Create a user from the list
- **WHEN** the user clicks the create action in the users list
- **THEN** the new user page opens with an empty user
