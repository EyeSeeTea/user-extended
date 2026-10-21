import { User } from "../User";
import { UserProps } from "../UserProps";

describe("User Entity", () => {
    const validUserProps: UserProps = {
        id: "user123",
        name: "John Doe",
        username: "johndoe",
        firstName: "John",
        surname: "Doe",
        email: "john.doe@example.com",
        phoneNumber: "+1234567890",
        whatsApp: "",
        facebookMessenger: "",
        skype: "",
        telegram: "",
        twitter: "",
        lastUpdated: new Date(),
        created: new Date(),
        apiUrl: "https://api.example.com",
        userRoles: [{ id: "role1", name: "Admin" }],
        userGroups: [{ id: "group1", name: "Administrators" }],
        organisationUnits: [{ id: "org1", name: "Main Org", code: "MAIN", path: ["org1"] }],
        dataViewOrganisationUnits: [{ id: "org1", name: "Main Org", code: "MAIN", path: ["org1"] }],
        searchOrganisationsUnits: [{ id: "org1", name: "Main Org", code: "MAIN", path: ["org1"] }],
        lastLogin: new Date(),
        status: "active",
        disabled: false,
        access: { read: true, update: true, externalize: true, delete: true, write: true, manage: true },
        openId: null,
        ldapId: null,
        externalAuth: false,
        twoFactorEnabled: false,
        password: "ValidPassword123!",
        accountExpiry: null,
        authorities: ["F_USER_VIEW"],
        createdBy: { id: "creator1", username: "creator" },
        lastModifiedBy: { id: "modifier1", username: "modifier" },
        uiLocale: "en",
        dbLocale: "en",
    };

    const validUser2Props: UserProps = {
        id: "user123",
        name: "John Doe",
        username: "johndoe",
        firstName: "John",
        surname: "Doe",
        email: "john.doe@example.com",
        phoneNumber: "+1234567890",
        whatsApp: "",
        facebookMessenger: "",
        skype: "",
        telegram: "",
        twitter: "",
        lastUpdated: new Date(),
        created: new Date(),
        apiUrl: "https://api.example.com",
        userRoles: [{ id: "role1", name: "Admin" }],
        userGroups: [],
        organisationUnits: [{ id: "org1", name: "Main Org", code: "MAIN", path: ["org1"] }],
        dataViewOrganisationUnits: [{ id: "org1", name: "Main Org", code: "MAIN", path: ["org1"] }],
        searchOrganisationsUnits: [{ id: "org1", name: "Main Org", code: "MAIN", path: ["org1"] }],
        lastLogin: new Date(),
        status: "active",
        disabled: false,
        access: { read: true, update: true, externalize: true, delete: true, write: true, manage: true },
        openId: null,
        ldapId: null,
        externalAuth: false,
        twoFactorEnabled: false,
        password: "",
        accountExpiry: null,
        authorities: ["F_USER_VIEW"],
        createdBy: { id: "creator1", username: "creator" },
        lastModifiedBy: { id: "modifier1", username: "modifier" },
        uiLocale: "en",
        dbLocale: "en",
    };

    describe("createNew factory method", () => {
        describe("successful creation", () => {
            it("generates its own identifier even when the input carries one", () => {
                const user = User.createNew(validUserProps).getOrThrow();

                expect(user.id).not.toBe(validUserProps.id);
                expect(user.id).toMatch(/^[a-zA-Z][a-zA-Z0-9]{10}$/);
            });

            it("generates an identifier when none is given", () => {
                const { id: _id, ...propsWithoutId } = validUserProps;

                const user = User.createNew(propsWithoutId).getOrThrow();

                expect(user.id).toMatch(/^[a-zA-Z][a-zA-Z0-9]{10}$/);
            });

            it("should create a new user with valid properties", () => {
                const user = User.createNew(validUserProps).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.username).toBe("johndoe");
                expect(user.firstName).toBe("John");
                expect(user.surname).toBe("Doe");
                expect(user.email).toBe("john.doe@example.com");
            });

            it("should allow valid username with separators", () => {
                const propsWithValidUsername = { ...validUserProps, username: "john.doe_test@domain-name" };

                const user = User.createNew(propsWithValidUsername).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.username).toBe("john.doe_test@domain-name");
            });

            it("should allow valid email", () => {
                const propsWithValidEmail = { ...validUserProps, email: "test@example.com" };

                const user = User.createNew(propsWithValidEmail).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.email).toBe("test@example.com");
            });

            it("should use 'en' as default language when empty language is provided", () => {
                const propsWithEmptyLanguages = {
                    ...validUserProps,
                    uiLocale: "",
                    dbLocale: "",
                };

                const user = User.createNew(propsWithEmptyLanguages).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.uiLocale).toBe("en");
                expect(user.dbLocale).toBe("en");
            });
        });

        describe("username validation", () => {
            it("should throw error when username is missing", () => {
                const propsWithoutUsername = { ...validUserProps, username: "" };

                const userResult = User.createNew(propsWithoutUsername);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Please provide a username");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when username starts with separator", () => {
                const propsWithInvalidUsername = { ...validUserProps, username: ".johndoe" };

                const userResult = User.createNew(propsWithInvalidUsername);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Username cannot start or end with a separator");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when username ends with separator", () => {
                const propsWithInvalidUsername = { ...validUserProps, username: "johndoe." };

                const userResult = User.createNew(propsWithInvalidUsername);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Username cannot start or end with a separator");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when username has consecutive separators", () => {
                const propsWithInvalidUsername = { ...validUserProps, username: "john..doe" };

                const userResult = User.createNew(propsWithInvalidUsername);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Username cannot have two separators in a row");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when username is too short", () => {
                const propsWithShortUsername = { ...validUserProps, username: "a" };

                const userResult = User.createNew(propsWithShortUsername);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Username should be at least 2 characters long");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when username is too long", () => {
                const propsWithLongUsername = { ...validUserProps, username: "a".repeat(256) };

                const userResult = User.createNew(propsWithLongUsername);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Username may not exceed 255 characters");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when username contains invalid characters", () => {
                const propsWithInvalidUsername = { ...validUserProps, username: "john#doe" };

                const userResult = User.createNew(propsWithInvalidUsername);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Username can only include . _ - or @ as separators");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });
        });

        describe("password validation", () => {
            it("should throw error when password is missing for new user", () => {
                const propsWithoutPassword = { ...validUserProps, password: "" };

                const userResult = User.createNew(propsWithoutPassword);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Please provide a password");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when password is too short", () => {
                const propsWithShortPassword = { ...validUserProps, password: "Short1!" };

                const userResult = User.createNew(propsWithShortPassword);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Password should be at least 8 characters long");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when password is too long", () => {
                const propsWithLongPassword = { ...validUserProps, password: "a".repeat(256) };

                const userResult = User.createNew(propsWithLongPassword);

                userResult.match({
                    error: errors => {
                        expect(errors.length).toBeGreaterThanOrEqual(1);
                        const allErrors = errors.flatMap(e => e.errors);
                        expect(
                            allErrors.some(error => error.includes("Password should be no longer than 255 characters"))
                        ).toBe(true);
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when password lacks lowercase letter", () => {
                const propsWithInvalidPassword = { ...validUserProps, password: "PASSWORD123!" };

                const userResult = User.createNew(propsWithInvalidPassword);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Password should contain at least one lowercase letter");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when password lacks uppercase letter", () => {
                const propsWithInvalidPassword = { ...validUserProps, password: "password123!" };

                const userResult = User.createNew(propsWithInvalidPassword);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Password should contain at least one UPPERCASE letter");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when password lacks number", () => {
                const propsWithInvalidPassword = { ...validUserProps, password: "Password!" };

                const userResult = User.createNew(propsWithInvalidPassword);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Password should contain at least one number");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when password lacks special character", () => {
                const propsWithInvalidPassword = { ...validUserProps, password: "Password123" };

                const userResult = User.createNew(propsWithInvalidPassword);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Password should have at least one special character");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });
        });

        describe("required fields validation", () => {
            it("should throw error when firstName is missing", () => {
                const propsWithoutFirstName = { ...validUserProps, firstName: "" };

                const userResult = User.createNew(propsWithoutFirstName);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("First name is required");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when surname is missing", () => {
                const propsWithoutSurname = { ...validUserProps, surname: "" };

                const userResult = User.createNew(propsWithoutSurname);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Surname is required");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });
        });

        describe("email validation", () => {
            it("should throw error when email is invalid", () => {
                const propsWithInvalidEmail = { ...validUserProps, email: "invalid-email" };

                const userResult = User.createNew(propsWithInvalidEmail);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Please provide a valid email");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });
        });

        describe("organizational fields validation", () => {
            it("should throw error when organisationUnits is empty", () => {
                const propsWithoutOrgUnits = { ...validUserProps, organisationUnits: [] };

                const userResult = User.createNew(propsWithoutOrgUnits);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Please select at least one organisationUnits");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when userRoles is empty", () => {
                const propsWithoutRoles = { ...validUserProps, userRoles: [] };

                const userResult = User.createNew(propsWithoutRoles);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Please select at least one userRoles");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });

            it("should throw error when userGroups is empty", () => {
                const propsWithoutGroups = { ...validUserProps, userGroups: [] };

                const userResult = User.createNew(propsWithoutGroups);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("Please select at least one userGroups");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });
        });
    });

    describe("createExisted factory method", () => {
        describe("successful creation with skipSourceErrors", () => {
            it("should create a user with valid properties and skip source errors", () => {
                const propsWithMissingFields = {
                    ...validUserProps,
                    email: "",
                    organisationUnits: [],
                    userRoles: [],
                    userGroups: [],
                };

                const user = User.createExisted(propsWithMissingFields).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.username).toBe("johndoe");
            });

            it("should create a user for existing user without password", () => {
                const propsWithoutPassword = { ...validUserProps, password: "" };

                const user = User.createExisted(propsWithoutPassword).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.username).toBe("johndoe");
            });

            it("should create a user for existing user without username", () => {
                const propsWithoutUsername = { ...validUserProps, username: "" };

                const user = User.createExisted(propsWithoutUsername).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.username).toBe("");
            });

            it("should create a user for existing user with invalid username", () => {
                const propsWithInvalidUsername = { ...validUserProps, username: "_invalid..username" };

                const user = User.createExisted(propsWithInvalidUsername).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.username).toBe("_invalid..username");
            });

            it("should allow missing organisation units when skipSourceErrors is true", () => {
                const propsWithoutOrgUnits = { ...validUserProps, organisationUnits: [] };

                const user = User.createExisted(propsWithoutOrgUnits).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.organisationUnits).toEqual([]);
            });

            it("should allow missing user roles when skipSourceErrors is true", () => {
                const propsWithoutRoles = { ...validUserProps, userRoles: [] };

                const user = User.createExisted(propsWithoutRoles).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.userRoles).toEqual([]);
            });

            it("should allow missing user groups when skipSourceErrors is true", () => {
                const propsWithoutGroups = { ...validUserProps, userGroups: [] };

                const user = User.createExisted(propsWithoutGroups).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.userGroups).toEqual([]);
            });

            it("should allow empty email when skipSourceErrors is true", () => {
                const propsWithEmptyEmail = { ...validUserProps, email: "" };

                const user = User.createExisted(propsWithEmptyEmail).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.email).toBe("");
            });

            it("should allow invalid email when skipSourceErrors is true", () => {
                const propsWithInvalidEmail = { ...validUserProps, email: "invalid-email" };

                const user = User.createExisted(propsWithInvalidEmail).getOrThrow();

                expect(user).toBeInstanceOf(User);
                expect(user.email).toBe("invalid-email");
            });
        });

        describe("validation still enforced", () => {
            it("should still validate required fields like firstName", () => {
                const propsWithoutFirstName = { ...validUserProps, firstName: "" };

                const userResult = User.createExisted(propsWithoutFirstName);

                userResult.match({
                    error: errors => {
                        expect(errors).toHaveLength(1);
                        expect(errors[0]?.errors).toContain("First name is required");
                    },
                    success: () => {
                        throw new Error("Expected validation to fail but it succeeded");
                    },
                });
            });
        });
    });

    describe("error message formatting", () => {
        it("should combine multiple validation errors", () => {
            const propsWithMultipleErrors = {
                ...validUserProps,
                username: "",
                firstName: "",
                surname: "",
                password: "weak",
            };

            const userResult = User.createNew(propsWithMultipleErrors);

            userResult.match({
                error: errors => {
                    expect(errors.length).toBeGreaterThan(1);
                    const allErrors = errors.flatMap(e => e.errors);
                    expect(allErrors.some(err => err.includes("Please provide a username"))).toBe(true);
                    expect(allErrors.some(err => err.includes("First name is required"))).toBe(true);
                    expect(allErrors.some(err => err.includes("Surname is required"))).toBe(true);
                    expect(allErrors.some(err => err.includes("Password should be at least 8 characters long"))).toBe(
                        true
                    );
                },
                success: () => {
                    throw new Error("Expected validation to fail but it succeeded");
                },
            });
        });
    });

    describe("update", () => {
        describe("userGroups", () => {
            it("should not throw error when password is missing", () => {
                const user = User.createExisted(validUser2Props).getOrThrow();
                const updatedUser = user.update({ password: undefined }).getOrThrow();
                const userGroups = [{ id: "group1", name: "Administrators" }];

                const updatedUserResult = updatedUser.update({ userGroups }).getOrThrow();

                expect(updatedUserResult.userGroups).toEqual(userGroups);
            });
        });
    });
});
