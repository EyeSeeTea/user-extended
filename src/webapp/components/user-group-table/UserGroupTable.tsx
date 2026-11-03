import _ from "lodash";
import React from "react";
import i18n from "../../../utils/i18n";
import FileSaver from "file-saver";

import {
    ObjectsList,
    TableColumn,
    TableConfig,
    TablePagination,
    TableSorting,
    useObjectsTable,
} from "@eyeseetea/d2-ui-components";
import { useAppContext } from "../../contexts/app-context";
import { Pager } from "../../../domain/entities/PaginatedResponse";
import { buildEllipsizedList } from "../user-list-table/UserListTable";
import { UserGroup } from "../../../domain/entities/UserGroup";
import { Id } from "../../../domain/entities/Ref";
import { UsersFilters, UsersFiltersProps } from "../users-filter/UsersFilters";
import ExportIcon from "@material-ui/icons/ArrowDownward";
import { PopoverList } from "../popover-list/PopoverList";
import { getFilename } from "../../utils/file";

import { makeStyles } from "@material-ui/core";
import { isSuperAdmin, UserProps } from "../../../domain/entities/UserProps";
import { AppSettings } from "../../../domain/entities/AppSettings";
import { GroupColumnSetting } from "../../../domain/entities/GroupColumn";
import { useUserGroups } from "./useUserGroups";
import { createPagination, filterAndSortItemWithUsers } from "../../utils/table";
import { useHasNativeUserGroupDescription } from "../../hooks/userHooks";

function generateTableConfig(options: {
    currentPageSize: number;
    columnsPreference: GroupColumnSetting[];
    currentUser: UserProps;
}): TableConfig<UserGroup> {
    const { currentPageSize, columnsPreference, currentUser } = options;

    const allColumns: TableColumn<UserGroup>[] = columnsPreference.map(columnSetting => {
        return {
            name: columnSetting.fieldName,
            text: _.capitalize(columnSetting.fieldName),
            getValue: (userGroup: UserGroup) => {
                if (columnSetting.fieldName === "users") return buildEllipsizedList(userGroup.users);
                if (columnSetting.fieldName === "description") return userGroup.description ?? "";
                return userGroup[columnSetting.fieldName];
            },
            sortable: columnSetting.fieldName !== "users" && columnSetting.fieldName !== "description",
            hidden: columnSetting.state === "unselected",
            disabled: isSuperAdmin(currentUser) ? false : columnSetting.state === "selected-disabled",
        };
    });

    return {
        allowEmptyColumns: false,
        actions: [],
        columns: allColumns,
        initialSorting: { field: "name", order: "asc" },
        paginationOptions: { pageSizeInitialValue: currentPageSize, pageSizeOptions: [10, 25, 50] },
    };
}

type UserGroupTableProps = {
    appSettings: AppSettings;
};

export const UserGroupTable: React.FC<UserGroupTableProps> = React.memo(props => {
    const { appSettings } = props;
    const defaultExcludeOrgUnit = appSettings.uiUserGroupActionsAccess.filterUsersInOrgUnit.defaultValue ?? true;
    const defaultFilterEmptyUsers =
        appSettings.uiUserGroupActionsAccess.filterHideNotApplicableUserGroups.defaultValue ?? true;
    const [currentPageSize, setCurrentPageSize] = React.useState(25);
    const [selectedUsersIds, setSelectedUsersIds] = React.useState<Id[]>();
    const [excludeUsersOrgUnit, setExcludeUsersOrgUnit] = React.useState(defaultExcludeOrgUnit);
    const [filterEmptyUsers, setFilterEmptyUsers] = React.useState(defaultFilterEmptyUsers);
    const { compositionRoot, currentUser } = useAppContext();
    const classes = useStyles();
    const hasNativeDescription = useHasNativeUserGroupDescription();
    const { userGroups } = useUserGroups({
        excludeUsersOutsideOrgUnits: excludeUsersOrgUnit,
        currentUser,
        appSettings,
    });
    const isAdmin = isSuperAdmin(currentUser);
    const [columnsPreference, setColumnsPreference] = React.useState<GroupColumnSetting[]>([]);

    React.useEffect(() => {
        return compositionRoot.groupColumns.get
            .execute(currentUser, { hasNativeDescription })
            .run(setColumnsPreference, console.error);
    }, [compositionRoot.groupColumns, currentUser, appSettings, hasNativeDescription]);

    const items = React.useMemo(
        () =>
            [
                {
                    id: "exportCsv" as const,
                    label: i18n.t("Export to CSV"),
                    icon: <ExportIcon />,
                },
                {
                    id: "exportJson" as const,
                    label: i18n.t("Export to JSON"),
                    icon: <ExportIcon />,
                },
            ].filter(item => isAdmin || appSettings.uiUserGroupActionsAccess[item.id].visible),
        [isAdmin, appSettings.uiUserGroupActionsAccess]
    );

    const config = React.useMemo(() => {
        return generateTableConfig({ currentPageSize, columnsPreference, currentUser });
    }, [currentPageSize, columnsPreference, currentUser]);

    /* Search and export follow the columns enabled in the settings, not the ones rendered: a
     * disabled column must not leak its content through the search results nor through the
     * exported file, not even for a super admin that can still show it in the table. */
    const searchableColumns = React.useMemo(
        () => appSettings.searchableGroupColumns(hasNativeDescription),
        [appSettings, hasNativeDescription]
    );
    const isDescriptionEnabled = searchableColumns.includes("description");

    const getRows = React.useCallback(
        (
            search: string,
            { page, pageSize }: TablePagination,
            sorting: TableSorting<UserGroup>
        ): Promise<{ objects: UserGroup[]; pager: Pager }> => {
            setCurrentPageSize(pageSize);

            const filteredUserGroups = filterAndSortItemWithUsers({
                items: userGroups,
                search: search,
                sort: sorting.order,
                filterEmptyUsers: filterEmptyUsers,
                selectedUsersIds: selectedUsersIds,
                searchFields: searchableColumns,
            });

            return Promise.resolve(createPagination(filteredUserGroups, page, pageSize));
        },
        [userGroups, filterEmptyUsers, selectedUsersIds, searchableColumns]
    );

    const tableProps = useObjectsTable(config, getRows);

    const updateFilters = React.useCallback<UsersFiltersProps["onFilterChange"]>(filters => {
        setSelectedUsersIds(filters.users.length > 0 ? filters.users.map(user => user.value) : undefined);
        setExcludeUsersOrgUnit(filters.excludeOutsideOrgUnit);
        setFilterEmptyUsers(filters.filterEmptyUsers);
    }, []);

    const exportRecords = React.useCallback(
        (action: string) => {
            const fileName = getFilename({
                name: "user-groups",
                format: action === "exportCsv" ? "csv" : "json",
            });
            if (action === "exportCsv") {
                buildCsvRow(tableProps.rows, fileName, isDescriptionEnabled);
            } else if (action === "exportJson") {
                const rows = isDescriptionEnabled
                    ? tableProps.rows
                    : tableProps.rows.map(userGroup => _.omit(userGroup, "description"));
                FileSaver.saveAs(new Blob([JSON.stringify(rows, null, 4)], { type: "application/json" }), fileName);
            }
        },
        [tableProps.rows, isDescriptionEnabled]
    );

    const someFilterEnabled =
        appSettings.uiUserGroupActionsAccess.filterUsers.visible ||
        appSettings.uiUserGroupActionsAccess.filterUsersInOrgUnit.visible ||
        appSettings.uiUserGroupActionsAccess.filterHideNotApplicableUserGroups.visible;

    return (
        <ObjectsList {...tableProps}>
            {(isAdmin || someFilterEnabled) && (
                <UsersFilters
                    onFilterChange={updateFilters}
                    showUserFilter={isAdmin || appSettings.uiUserGroupActionsAccess.filterUsers.visible}
                    showOrgUnitFilter={isAdmin || appSettings.uiUserGroupActionsAccess.filterUsersInOrgUnit.visible}
                    filterUserLabel={i18n.t("Filter users")}
                    emptyUsersLabel={i18n.t("Hide not applicable user groups")}
                    showEmptyUsers={
                        isAdmin || appSettings.uiUserGroupActionsAccess.filterHideNotApplicableUserGroups.visible
                    }
                    defaultExcludeOrgUnit={defaultExcludeOrgUnit}
                    defaultFilterEmptyUsers={defaultFilterEmptyUsers}
                />
            )}
            {items.length > 0 && (
                <div className={classes.popoverContainer}>
                    <PopoverList title={i18n.t("Actions")} items={items} onItemClick={exportRecords} />
                </div>
            )}
        </ObjectsList>
    );
});

const useStyles = makeStyles({
    popoverContainer: {
        order: 100,
    },
});

function buildCsvRow(rows: UserGroup[], fileName: string, includeDescription: boolean): void {
    const header = includeDescription ? ["id", "name", "description", "users"] : ["id", "name", "users"];

    const values = rows.map(ug => {
        const users = ug.users.map(u => u.name).join("|");
        return includeDescription ? [ug.id, ug.name, ug.description ?? "", users] : [ug.id, ug.name, users];
    });

    FileSaver.saveAs(
        new Blob([[header, ...values].map(row => row.map(escapeCsvValue).join(",")).join("\n")], {
            type: "text/csv;charset=utf-8",
        }),
        fileName
    );
}

/* Descriptions are free text, so separators and quotes must be escaped */
function escapeCsvValue(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
