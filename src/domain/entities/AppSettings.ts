import _ from "lodash";
import { Struct } from "./generic/Struct";
import { Permission } from "./Permission";
import { Id } from "./Ref";
import { UserColumns } from "./User";
import { UserAction, userActions } from "./UserAction";
import { ActionPermission } from "./ActionPermission";
import { fromPairs, getKeys, isValueInUnionType, Maybe } from "../../types/utils";
import { defaultRules, getInternalRulesForAction } from "./UserActionRule";
import { userColumns } from "./UserColumn";
import { isSuperAdmin, UserProps } from "./UserProps";
import { roleColumns, RoleColumnType } from "./RoleColumn";
import {
    DashboardUiActionAccess,
    UserGroupUiActionAccess,
    UserRoleUiActionAccess,
    UserUiActionAccess,
} from "./FilterUserActionPermission";
import { dashboardColumns, DashboardColumnType } from "./DashboardColumn";
import { groupColumns, GroupColumnType } from "./GroupColumn";

export const CONSTANT_SETTINGS_CODE = "user-extended-app-settings";

type AppSettingsAttr = {
    columns: SettingsUserColumn[];
    showOnlyActiveUsers: boolean;
    showFeedback: boolean;
    settingsAccess: Permission;
    organisationUnitsField: OrgUnitFieldPolicy;
    actionsAccess: ActionsPermissions;
    showCustomRootOrgUnits: boolean;
    showOnlyUsersInTheirOrgUnits: boolean;
    limitPasswordActionsToUserOrgUnits: boolean;
    rootOrgUnitIds: Id[];
    hide: {
        users: Id[];
        userGroups: Id[];
        userRoles: Id[];
    };
    status: AppSettingStatus;
    uiUserActionsAccess: UserUiActionAccess;
    roleColumns: SettingsRoleColumn[];
    dashboardColumns: SettingsDashboardColumn[];
    groupColumns: SettingsGroupColumn[];
    uiUserGroupActionsAccess: UserGroupUiActionAccess;
    uiUserRoleActionsAccess: UserRoleUiActionAccess;
    uiDashboardActionsAccess: DashboardUiActionAccess;
    /* Opaque handle for the source of the user group description. The domain
     * never interprets its content: only the repository knows how to resolve it. */
    userGroupDescriptionSource: Maybe<string>;
    userGroupDescriptionHasTranslations: boolean;
};

type AppSettingStatus = "active" | "inactive";

export const orgUnitFields = ["shortName", "code"] as const;
export type OrgUnitField = typeof orgUnitFields[number];

export const orgUnitFieldPolicies = ["userDefined", ...orgUnitFields] as const;
export type OrgUnitFieldPolicy = typeof orgUnitFieldPolicies[number];

export function parseOrgUnitFieldPolicy(value: unknown, defaultValue: OrgUnitFieldPolicy): OrgUnitFieldPolicy {
    return isValueInUnionType(value, orgUnitFieldPolicies) ? value : defaultValue;
}

export type ColumnSettingValue = "visible" | "disabled" | "optional" | "mandatory";
export type SettingsUserColumn = { field: UserColumns; value: ColumnSettingValue };
export type SettingsRoleColumn = { field: RoleColumnType; value: ColumnSettingValue };
export type SettingsDashboardColumn = { field: DashboardColumnType; value: ColumnSettingValue };
export type SettingsGroupColumn = { field: GroupColumnType; value: ColumnSettingValue };
export type ActionsPermissions = Record<UserAction, ActionPermission>;
const defaultHideValues = { users: [], userGroups: [], userRoles: [], orgUnits: [] };

export class AppSettings extends Struct<AppSettingsAttr>() {
    static defaultSettings(status: AppSettingStatus): AppSettings {
        return this.create({
            columns: this.defaultColumns(),
            showOnlyActiveUsers: false,
            showFeedback: true,
            settingsAccess: emptyPermission,
            organisationUnitsField: "userDefined",
            actionsAccess: defaultActions(),
            hide: defaultHideValues,
            status: status,
            rootOrgUnitIds: [],
            showCustomRootOrgUnits: false,
            showOnlyUsersInTheirOrgUnits: false,
            limitPasswordActionsToUserOrgUnits: false,
            uiUserActionsAccess: this.defaultUiActions(),
            roleColumns: this.defaultRoleColumns(),
            dashboardColumns: this.defaultDashboardColumns(),
            uiUserGroupActionsAccess: this.defaultUserGroupUiActions(),
            uiUserRoleActionsAccess: this.defaultUserRoleUiActions(),
            uiDashboardActionsAccess: this.defaultUiDashboardActions(),
            groupColumns: this.defaultGroupColumns(),
            userGroupDescriptionSource: undefined,
            userGroupDescriptionHasTranslations: false,
        });
    }

    get hasUserGroupDescriptionSource(): boolean {
        return Boolean(this.userGroupDescriptionSource);
    }

    /* Without a configured source there is nothing to show in the description column */
    get availableGroupColumns(): SettingsGroupColumn[] {
        return this.hasUserGroupDescriptionSource
            ? this.groupColumns
            : this.groupColumns.filter(column => column.field !== "description");
    }

    /* Fields the user group search and the exports work with: a column disabled in the settings
     * must not leak its content, not even for a super admin that can still show it in the table */
    get searchableGroupColumns(): GroupColumnType[] {
        return this.availableGroupColumns.filter(column => column.value !== "disabled").map(column => column.field);
    }

    get isActive(): boolean {
        return this.status === "active";
    }

    updateStatus(status: AppSettingStatus): AppSettings {
        return this._update({ status });
    }

    updateColumns(columns: SettingsUserColumn[]): AppSettings {
        return this._update({ columns });
    }

    updateOrganisationUnitsField(organisationUnitsField: OrgUnitFieldPolicy): AppSettings {
        return this._update({ organisationUnitsField });
    }

    get configuredOrgUnitField(): Maybe<OrgUnitField> {
        return this.organisationUnitsField === "userDefined" ? undefined : this.organisationUnitsField;
    }

    updateRoleColumns(columns: SettingsRoleColumn[]): AppSettings {
        return this._update({ roleColumns: columns });
    }

    updateDashboardColumns(columns: SettingsDashboardColumn[]): AppSettings {
        return this._update({ dashboardColumns: columns });
    }

    updateGroupColumns(columns: SettingsGroupColumn[]): AppSettings {
        return this._update({ groupColumns: columns });
    }

    updateUserGroupDescriptionSource(source: Maybe<string>): AppSettings {
        return this._update({ userGroupDescriptionSource: source || undefined });
    }

    updateUserGroupDescriptionHasTranslations(hasTranslations: boolean): AppSettings {
        return this._update({ userGroupDescriptionHasTranslations: hasTranslations });
    }

    updateColumnField(columnToUpdate: UserColumns, value: ColumnSettingValue): SettingsUserColumn[] {
        return this.columns.map(column => {
            if (column.field === columnToUpdate) {
                return { ...column, value };
            }
            return column;
        });
    }

    updateRoleColumnField(columnToUpdate: RoleColumnType, value: ColumnSettingValue): SettingsRoleColumn[] {
        return this.roleColumns.map(column => {
            if (column.field === columnToUpdate) return { ...column, value };
            return column;
        });
    }

    areAllActionsPublic(): boolean {
        return Object.values(this.actionsAccess).every(permission => permission.isPublic);
    }

    isActionPublic(action: UserAction): boolean {
        return this.actionsAccess[action].isPublic;
    }

    isHideOrgUnitsEmpty(): boolean {
        return _.isEmpty(this.rootOrgUnitIds);
    }

    isHideUserRelatedConfigurationEmpty(): boolean {
        return _.isEmpty(this.hide.users) && _.isEmpty(this.hide.userGroups) && _.isEmpty(this.hide.userRoles);
    }

    validateUserAndBuild(user: UserProps): AppSettings {
        return isSuperAdmin(user) ? this._update({ hide: defaultHideValues }) : this;
    }

    private static defaultColumns(): SettingsUserColumn[] {
        return userColumns.map(column => ({ field: column, value: "optional" }));
    }

    private static defaultRoleColumns(): SettingsRoleColumn[] {
        return roleColumns.map(column => ({ field: column, value: "optional" }));
    }

    private static defaultDashboardColumns(): SettingsDashboardColumn[] {
        return dashboardColumns.map(column => ({ field: column, value: "optional" }));
    }

    private static defaultGroupColumns(): SettingsGroupColumn[] {
        return groupColumns.map(column => ({ field: column, value: "optional" }));
    }

    private static defaultUiActions(): AppSettingsAttr["uiUserActionsAccess"] {
        return {
            filterActive: { visible: true },
            filterTwoFactorAuth: { visible: true },
            filterExternalAuth: { visible: true },
            filterRoles: { visible: true },
            filterUserGroups: { visible: true },
            filterOrgUnits: { visible: true },
            filterOrgUnitsView: { visible: true },
            filterOrgUnitsSearch: { visible: true },
            import: { visible: true },
            exportJson: { visible: true },
            exportCsv: { visible: true },
        };
    }

    private static defaultUserGroupUiActions(): AppSettingsAttr["uiUserGroupActionsAccess"] {
        return {
            filterHideNotApplicableUserGroups: { visible: true, defaultValue: true },
            filterUsersInOrgUnit: { visible: true, defaultValue: true },
            filterUsers: { visible: true },
            exportCsv: { visible: true },
            exportJson: { visible: true },
        };
    }

    private static defaultUserRoleUiActions(): AppSettingsAttr["uiUserRoleActionsAccess"] {
        return {
            filterHideNotApplicableUserRoles: { visible: true, defaultValue: true },
            filterUsersInOrgUnit: { visible: true, defaultValue: true },
            filterUsers: { visible: true },
        };
    }

    private static defaultUiDashboardActions(): AppSettingsAttr["uiDashboardActionsAccess"] {
        return {
            filterUsersInOrgUnit: { visible: true, defaultValue: true },
            filterUsers: { visible: true },
            filterOwners: { visible: true },
        };
    }
}

export function markAllActionsPublic() {
    const publicPermission = ActionPermission.public();
    const publicActions: ActionsPermissions = Object.assign(
        {},
        ...userActions.map(action => ({ [action]: publicPermission }))
    );

    return injectInternalRules(publicActions);
}

function instantiateActionsAccesses(): Record<UserAction, ActionPermission> {
    const publicPermission = ActionPermission.public();
    return fromPairs(
        userActions.map((action: UserAction): [UserAction, ActionPermission] => {
            const defaultActionPermission = publicPermission.updateRules(defaultRules[action]);
            return [action, defaultActionPermission];
        })
    );
}

export function removeInternalRules(actionsAccess: ActionsPermissions): ActionsPermissions {
    return _.mapValues(actionsAccess, permission => {
        const filteredRules = permission.getSelectableRules();
        return permission.updateRules(filteredRules);
    });
}

export function injectInternalRules(actionsAccess: ActionsPermissions): ActionsPermissions {
    const actionKeys = getKeys(actionsAccess);

    const updatedPermissions = actionKeys.map((action): [UserAction, ActionPermission] => {
        const newRules = _.uniq(actionsAccess[action].rules.concat(getInternalRulesForAction(action)));
        return [action, actionsAccess[action].updateRules(newRules)];
    });

    return fromPairs(updatedPermissions);
}

export function defaultActions(): ActionsPermissions {
    return instantiateActionsAccesses();
}

const emptyPermission: Permission = new Permission({ users: [], userGroups: [] });
