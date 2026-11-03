import { instance, mock, when } from "ts-mockito";
import { AppSettings, ColumnSettingValue } from "../../entities/AppSettings";
import { Future } from "../../entities/Future";
import { defaultUserProps, UserProps } from "../../entities/UserProps";
import { RoleColumnD2Repository } from "../../../data/repositories/RoleColumnD2Repository";
import { GroupColumnD2Repository } from "../../../data/repositories/GroupColumnD2Repository";
import { DashboardColumnD2Repository } from "../../../data/repositories/DashboardColumnD2Repository";
import { AppSettingsD2Repository } from "../../../data/repositories/AppSettingsD2Repository";
import { GetRoleColumnsUseCase } from "../GetRoleColumnsUseCase";
import { GetGroupColumnsUseCase } from "../GetGroupColumnsUseCase";
import { GetDashboardColumnsUseCase } from "../GetDashboardColumnsUseCase";

const SUPER_ADMIN = buildUser(["ALL"]);
const REGULAR_USER = buildUser(["F_USER_ADD"]);

let appSettingsRepositoryMock: AppSettingsD2Repository;

type ColumnState = "selected" | "unselected" | "selected-disabled";
type ColumnSettingResult = { fieldName: string; state: ColumnState; position: number };
type Preference = { state: ColumnState; position: number };

type Scenario = {
    name: string;
    field: string;
    settingsWith: (value: ColumnSettingValue) => AppSettings;
    getColumns: (args: { preferences: Preference[]; user: UserProps }) => Promise<ColumnSettingResult[]>;
};

const scenarios: Scenario[] = [
    {
        name: "GetRoleColumnsUseCase",
        field: "description",
        settingsWith: value =>
            AppSettings.defaultSettings("active").updateRoleColumns([{ field: "description", value }]),
        getColumns: ({ preferences, user }) => {
            const repository = mock(RoleColumnD2Repository);
            const columns = preferences.map(preference => ({ fieldName: "description" as const, ...preference }));
            when(repository.get()).thenReturn(Future.success(columns));
            const useCase = new GetRoleColumnsUseCase(instance(repository), instance(appSettingsRepositoryMock));

            return useCase.execute(user).toPromise();
        },
    },
    {
        name: "GetGroupColumnsUseCase",
        field: "users",
        settingsWith: value => AppSettings.defaultSettings("active").updateGroupColumns([{ field: "users", value }]),
        getColumns: ({ preferences, user }) => {
            const repository = mock(GroupColumnD2Repository);
            const columns = preferences.map(preference => ({ fieldName: "users" as const, ...preference }));
            when(repository.get()).thenReturn(Future.success(columns));
            const useCase = new GetGroupColumnsUseCase(instance(repository), instance(appSettingsRepositoryMock));

            return useCase.execute(user, { hasNativeDescription: false }).toPromise();
        },
    },
    {
        name: "GetDashboardColumnsUseCase",
        field: "description",
        settingsWith: value =>
            AppSettings.defaultSettings("active").updateDashboardColumns([{ field: "description", value }]),
        getColumns: ({ preferences, user }) => {
            const repository = mock(DashboardColumnD2Repository);
            const columns = preferences.map(preference => ({ fieldName: "description" as const, ...preference }));
            when(repository.get()).thenReturn(Future.success(columns));
            const useCase = new GetDashboardColumnsUseCase(instance(repository), instance(appSettingsRepositoryMock));

            return useCase.execute(user).toPromise();
        },
    },
];

describe.each(scenarios)("$name", scenario => {
    beforeEach(() => {
        appSettingsRepositoryMock = mock(AppSettingsD2Repository);
    });

    describe("columns configured as disabled", () => {
        it("should be excluded for a user without the ALL authority", async () => {
            givenColumnSetting(scenario, "disabled");

            const columns = await scenario.getColumns({ preferences: [], user: REGULAR_USER });

            expect(columns).toEqual([]);
        });

        it("should be returned as unselected for a super admin, so they can enable them", async () => {
            givenColumnSetting(scenario, "disabled");

            const columns = await scenario.getColumns({ preferences: [], user: SUPER_ADMIN });

            expect(columns).toEqual([{ fieldName: scenario.field, state: "unselected", position: 0 }]);
        });

        it("should keep the stored preference of a super admin", async () => {
            givenColumnSetting(scenario, "disabled");
            const preferences = [{ state: "selected" as const, position: 2 }];

            const columns = await scenario.getColumns({ preferences, user: SUPER_ADMIN });

            expect(columns).toEqual([{ fieldName: scenario.field, state: "selected", position: 2 }]);
        });
    });
});

function givenColumnSetting(scenario: Scenario, value: ColumnSettingValue): void {
    when(appSettingsRepositoryMock.get()).thenReturn(Future.success(scenario.settingsWith(value)));
}

function buildUser(authorities: string[]): UserProps {
    return { ...defaultUserProps, authorities };
}
