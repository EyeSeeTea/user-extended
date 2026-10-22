import { beforeEach, describe, expect, it } from "vitest";
import { MetadataResponse } from "../../../types/d2-api";
import { Future, FutureData } from "../../entities/Future";
import { PaginatedResponse } from "../../entities/PaginatedResponse";
import { Id, NamedRef } from "../../entities/Ref";
import { Stats } from "../../entities/Stats";
import { User } from "../../entities/User";
import { NewUserProps, newUserProps, UserProps } from "../../entities/UserProps";
import { UserIdentifier } from "../../entities/UserIdentifier";
import { ListOptions, UpdateStrategy, UserRepository } from "../../repositories/UserRepository";
import { SaveUsersUseCase } from "../SaveUsersUseCase";

describe("SaveUsersUseCase", () => {
    let repository: UserTestRepository;
    let useCase: SaveUsersUseCase;

    beforeEach(() => {
        repository = new UserTestRepository();
        useCase = new SaveUsersUseCase(repository);
    });

    it("rejects a new user without roles without saving any user", async () => {
        const user = givenNewUser({ username: "new-user", userRoles: [] });

        const result = await useCase.execute([user]).runAsync();

        expect(result.error).toContain("new-user");
        expect(result.error).toContain("userRoles");
        expect(repository.savedUsers).toEqual([]);
    });

    it("rejects a new user without a password without saving any user", async () => {
        const user = givenNewUser({ username: "new-user", password: "" });

        const result = await useCase.execute([user]).runAsync();

        expect(result.error).toContain("new-user");
        expect(result.error).toContain("password");
        expect(repository.savedUsers).toEqual([]);
    });

    it("identifies an invalid user by its row when it has no username or name", async () => {
        const user = givenNewUser({ username: "", name: "", userRoles: [] });

        const result = await useCase.execute([user]).runAsync();

        expect(result.error).toContain("Row 1");
        expect(result.error).toContain("userRoles");
        expect(repository.savedUsers).toEqual([]);
    });

    it("saves a complete new user with a generated identifier and its references", async () => {
        const user = givenNewUser();

        await useCase.execute([user]).toPromise();

        expect(repository.savedUsers).toHaveLength(1);
        expect(repository.savedUsers[0]).toMatchObject({
            userRoles: user.userRoles,
            userGroups: user.userGroups,
            organisationUnits: user.organisationUnits,
        });
        expect(repository.savedUsers[0]?.id).toMatch(/^[a-zA-Z][a-zA-Z0-9]{10}$/);
    });

    it("validates existing and new users with their corresponding rules", async () => {
        const existingProps = givenExistingUser({ password: "", userRoles: [] });
        const newUser = givenNewUser();

        await useCase.execute([existingProps, newUser]).toPromise();

        expect(repository.savedUsers[0]?.id).toEqual(existingProps.id);
        expect(repository.savedUsers[1]?.id).toMatch(/^[a-zA-Z][a-zA-Z0-9]{10}$/);
    });

    it("checks open-id uniqueness before validating users", async () => {
        const users = [givenNewUser({ openId: "shared" }), givenNewUser({ openId: "shared" })];

        const result = await useCase.execute(users).runAsync();

        expect(result.error).toEqual("Open IDs must be unique");
        expect(repository.savedUsers).toEqual([]);
    });
});

function givenNewUser(overrides: Partial<NewUserProps> = {}): NewUserProps {
    return {
        ...newUserProps(),
        firstName: "New",
        surname: "User",
        username: "new-user",
        password: "ValidPassword123!",
        userRoles: [{ id: "role0000001", name: "Role" }],
        userGroups: [{ id: "group000001", name: "Group" }],
        organisationUnits: [{ id: "orgUnit0001", name: "Org unit", code: "OU", path: ["orgUnit0001"] }],
        ...overrides,
    };
}

function givenExistingUser(overrides: Partial<UserProps> = {}): UserProps {
    return { ...givenNewUser(), id: "existing001", ...overrides };
}

class UserTestRepository implements UserRepository {
    public savedUsers: User[] = [];

    getByIds(_ids: Id[]): FutureData<User[]> {
        return this.unsupported();
    }

    save(users: User[]): FutureData<MetadataResponse> {
        this.savedUsers = users;
        return Future.success(successfulMetadataResponse);
    }

    getCurrent(): FutureData<User> {
        return this.unsupported();
    }

    list(_options: ListOptions): FutureData<PaginatedResponse<User>> {
        return this.unsupported();
    }

    listAll(_options: ListOptions): FutureData<User[]> {
        return this.unsupported();
    }

    listAllUserIdentifiers(_options: ListOptions): FutureData<UserIdentifier[]> {
        return this.unsupported();
    }

    saveInChunks(_users: User[], _chunkSize: number): FutureData<void> {
        return this.unsupported();
    }

    updateRoles(_ids: Id[], _update: NamedRef[], _strategy: UpdateStrategy): FutureData<MetadataResponse> {
        return this.unsupported();
    }

    updateGroups(_ids: Id[], _update: NamedRef[], _strategy: UpdateStrategy): FutureData<MetadataResponse> {
        return this.unsupported();
    }

    getColumns(): FutureData<Array<keyof User>> {
        return this.unsupported();
    }

    saveColumns(_columns: Array<keyof User>): FutureData<void> {
        return this.unsupported();
    }

    resetPasswords(_users: User[]): FutureData<Stats> {
        return this.unsupported();
    }

    verifyPassword(_password: string): FutureData<true> {
        return this.unsupported();
    }

    remove(_ids: Id[]): FutureData<Stats> {
        return this.unsupported();
    }

    getInMyOrgUnit(): FutureData<UserIdentifier[]> {
        return this.unsupported();
    }

    private unsupported<T>(): FutureData<T> {
        return Future.error("Unsupported operation in UserTestRepository");
    }
}

const successfulMetadataResponse: MetadataResponse = {
    importParams: {
        importMode: "COMMIT",
        identifier: "UID",
        importReportMode: "ERRORS",
        preheatMode: "REFERENCE",
        importStrategy: "CREATE_AND_UPDATE",
        atomicMode: "ALL",
        mergeMode: "REPLACE",
        flushMode: "AUTO",
        skipSharing: false,
        skipValidation: false,
        async: false,
        inclusionStrategy: "NON_NULL",
        userOverrideMode: "NONE",
        overrideUser: "",
    },
    status: "OK",
    stats: { created: 0, updated: 0, deleted: 0, ignored: 0, total: 0 },
    typeReports: [],
};
