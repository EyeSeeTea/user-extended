import { describe, it, expect, beforeEach } from "vitest";
import { instance, mock, when } from "ts-mockito";
import { AppSettings, ColumnSettingValue, SettingsGroupColumn } from "../../entities/AppSettings";
import { Future } from "../../entities/Future";
import { GroupColumnSetting } from "../../entities/GroupColumn";
import { GetGroupColumnsUseCase } from "../GetGroupColumnsUseCase";
import { AppSettingsD2Repository } from "../../../data/repositories/AppSettingsD2Repository";
import { GroupColumnD2Repository } from "../../../data/repositories/GroupColumnD2Repository";
import { Maybe } from "../../../types/utils";
import { defaultUserProps, UserProps } from "../../entities/UserProps";

const nonAdminUser: UserProps = { ...defaultUserProps, id: "user-1", authorities: [] };
const withoutNativeDescription = { hasNativeDescription: false };

let columnRepositoryMock: GroupColumnD2Repository;
let appSettingsRepositoryMock: AppSettingsD2Repository;

describe("GetGroupColumnsUseCase", () => {
    beforeEach(() => {
        columnRepositoryMock = mock(GroupColumnD2Repository);
        appSettingsRepositoryMock = mock(AppSettingsD2Repository);
    });

    it("excludes the description column when no description source is configured", async () => {
        const useCase = givenUseCase({ descriptionSource: undefined, columnValue: "visible" });

        const columns = await useCase.execute(nonAdminUser, withoutNativeDescription).toPromise();

        expect(fieldNames(columns)).toEqual(["name", "users"]);
    });

    it("includes the description column when a description source is configured", async () => {
        const useCase = givenUseCase({ descriptionSource: "attribute-1", columnValue: "visible" });

        const columns = await useCase.execute(nonAdminUser, withoutNativeDescription).toPromise();

        expect(fieldNames(columns)).toContain("description");
    });

    it("applies the configured value to the description column", async () => {
        const useCase = givenUseCase({ descriptionSource: "attribute-1", columnValue: "mandatory" });

        const columns = await useCase.execute(nonAdminUser, withoutNativeDescription).toPromise();

        expect(findColumn(columns, "description")?.state).toEqual("selected-disabled");
    });

    it("excludes the description column when it is disabled, even with a source configured", async () => {
        const useCase = givenUseCase({ descriptionSource: "attribute-1", columnValue: "disabled" });

        const columns = await useCase.execute(nonAdminUser, withoutNativeDescription).toPromise();

        expect(fieldNames(columns)).toEqual(["name", "users"]);
    });

    it("adds the description column as unselected when it is optional, so the user can show it", async () => {
        const useCase = givenUseCase({ descriptionSource: "attribute-1", columnValue: "optional" });

        const columns = await useCase.execute(nonAdminUser, withoutNativeDescription).toPromise();

        expect(findColumn(columns, "description")?.state).toEqual("unselected");
    });

    it("includes the description column on an instance with the native field and no source configured", async () => {
        const useCase = givenUseCase({ descriptionSource: undefined, columnValue: "visible" });

        const columns = await useCase.execute(nonAdminUser, { hasNativeDescription: true }).toPromise();

        expect(fieldNames(columns)).toEqual(["name", "description", "users"]);
    });

    it("keeps the description column between name and users when the user has no preference for it", async () => {
        const useCase = givenUseCase({
            descriptionSource: "attribute-1",
            columnValue: "optional",
            preferences: [
                { fieldName: "name", state: "selected", position: 0 },
                { fieldName: "users", state: "selected", position: 1 },
            ],
        });

        const columns = await useCase.execute(nonAdminUser, withoutNativeDescription).toPromise();

        expect(fieldNames(columns)).toEqual(["name", "description", "users"]);
    });

    function givenUseCase(options: {
        descriptionSource: Maybe<string>;
        columnValue: ColumnSettingValue;
        preferences?: GroupColumnSetting[];
    }): GetGroupColumnsUseCase {
        const groupColumns: SettingsGroupColumn[] = [
            { field: "name", value: "visible" },
            { field: "description", value: options.columnValue },
            { field: "users", value: "visible" },
        ];

        const appSettings = AppSettings.defaultSettings("active")
            .updateGroupColumns(groupColumns)
            .updateUserGroupDescriptionSource(options.descriptionSource);

        when(appSettingsRepositoryMock.get()).thenReturn(Future.success(appSettings));
        when(columnRepositoryMock.get()).thenReturn(Future.success(options.preferences ?? []));

        return new GetGroupColumnsUseCase(instance(columnRepositoryMock), instance(appSettingsRepositoryMock));
    }
});

function fieldNames(columns: GroupColumnSetting[]): string[] {
    return columns.map(column => column.fieldName);
}

function findColumn(columns: GroupColumnSetting[], fieldName: string): Maybe<GroupColumnSetting> {
    return columns.find(column => column.fieldName === fieldName);
}
