import React from "react";
import styled from "styled-components";
import { Tabs, Tab, Dialog } from "@material-ui/core";
import i18n from "../../../utils/i18n";
import { ImportSettingsPage } from "../import-settings/ImportSettingsPage";
import { LoggerSettingsPage } from "../../pages/log-settings/LoggerSettingsPage";
import { ColumnsSettingsPage } from "../columns-settings/ColumnsSettingsPage";
import {
    AppSettings,
    OrgUnitFieldPolicy,
    SettingsUserColumn,
    SettingsRoleColumn,
    SettingsDashboardColumn,
    SettingsGroupColumn,
} from "../../../domain/entities/AppSettings";
import { useLoading, useSnackbar } from "@eyeseetea/d2-ui-components";
import { PermissionsPage } from "../permissions-page/PermissionsPage";
import { useAppSettingsContext } from "../../contexts/AppSettingsProvider";
import { useUserColumns } from "../user-list-table/userColumns";
import { UserGroupDescriptionSourceSelect } from "../user-group-description-source-select/UserGroupDescriptionSourceSelect";
import { Maybe } from "../../../types/utils";

type SettingsOption = "import" | "logger" | "columns" | "permissions" | "user-permissions" | "filter-permissions";

type SettingsDialogModalProps = {
    onCloseAppSettings: (appSettings: AppSettings) => void;
    onClose: () => void;
};

const permissionsGroupByTab = {
    "user-permissions": "users",
    permissions: "global",
    "filter-permissions": "filter",
} as const;

const errorCodes = [
    {
        code: "EMPTY_RULES_IN_ACTION_PERMISSION",
        message: i18n.t("One or more actions have users or user groups assigned but no rules."),
    },
];

export const SettingsDialogModal: React.FC<SettingsDialogModalProps> = props => {
    const { onClose, onCloseAppSettings } = props;
    const [selectedTab, setSelectedTab] = React.useState<SettingsOption>("import");
    const { save, appSettings: initialData } = useAppSettingsContext();
    const [appSettings, setAppSettings] = React.useState<AppSettings>(initialData);
    const userColumns = useUserColumns();

    const loading = useLoading();
    const snackbar = useSnackbar();

    function onChangeTab(value: SettingsOption) {
        setSelectedTab(value);
    }

    const onSaveData = React.useCallback(
        (data: AppSettings) => {
            loading.show(true, i18n.t("Saving..."));
            save(
                data,
                () => {
                    loading.hide();
                    onCloseAppSettings(data);
                },
                message => {
                    loading.hide();
                    const errorMessage = errorCodes.find(errorCode => errorCode.code === message)?.message;
                    snackbar.error(errorMessage || message);
                }
            );
        },
        [loading, onCloseAppSettings, save, snackbar]
    );

    const updateColumns = React.useCallback(
        (columns: SettingsUserColumn[]) => {
            const updatedSettings = appSettings.updateColumns(columns);
            setAppSettings(updatedSettings);
        },
        [appSettings, setAppSettings]
    );

    const updateOrganisationUnitsField = React.useCallback(
        (value: OrgUnitFieldPolicy) => {
            setAppSettings(appSettings.updateOrganisationUnitsField(value));
        },
        [appSettings, setAppSettings]
    );

    const updateRoleColumns = React.useCallback(
        (columns: SettingsRoleColumn[]) => {
            const updatedSettings = appSettings.updateRoleColumns(columns);
            setAppSettings(updatedSettings);
        },
        [appSettings, setAppSettings]
    );

    const updateDashboardColumns = React.useCallback(
        (columns: SettingsDashboardColumn[]) => {
            const updatedSettings = appSettings.updateDashboardColumns(columns);
            setAppSettings(updatedSettings);
        },
        [appSettings, setAppSettings]
    );

    const updateGroupColumns = React.useCallback(
        (columns: SettingsGroupColumn[]) => {
            // Columns not rendered (description without a configured source) must be preserved
            const updatedColumns = appSettings.groupColumns.map(
                column => columns.find(updatedColumn => updatedColumn.field === column.field) ?? column
            );
            const updatedSettings = appSettings.updateGroupColumns(updatedColumns);
            setAppSettings(updatedSettings);
        },
        [appSettings, setAppSettings]
    );

    const updateUserGroupDescriptionSource = React.useCallback(
        (source: Maybe<string>) => {
            setAppSettings(appSettings.updateUserGroupDescriptionSource(source));
        },
        [appSettings, setAppSettings]
    );

    const updateUserGroupDescriptionHasTranslations = React.useCallback(
        (hasTranslations: boolean) => {
            setAppSettings(appSettings.updateUserGroupDescriptionHasTranslations(hasTranslations));
        },
        [appSettings, setAppSettings]
    );

    const roleColumnsMetadata = React.useMemo(
        () => [
            { name: "name", text: i18n.t("Name") },
            { name: "description", text: i18n.t("Description") },
            { name: "users", text: i18n.t("Users") },
        ],
        []
    );

    const dashboardColumnsMetadata = React.useMemo(
        () => [
            { name: "name", text: i18n.t("Name") },
            { name: "description", text: i18n.t("Description") },
            { name: "owner", text: i18n.t("Owner") },
            { name: "users", text: i18n.t("Users") },
        ],
        []
    );

    const groupColumnsMetadata = React.useMemo(
        () => [
            { name: "name", text: i18n.t("Name") },
            { name: "description", text: i18n.t("Description") },
            { name: "users", text: i18n.t("Users") },
        ],
        []
    );

    const visibleGroupColumns = React.useMemo(() => appSettings.availableGroupColumns, [appSettings]);

    const saveSettings = React.useCallback(() => {
        onSaveData(appSettings);
    }, [appSettings, onSaveData]);

    const renderSelectedTab = (tab: SettingsOption) => {
        switch (tab) {
            case "import":
                return (
                    <ImportSettingsPage
                        value={appSettings.organisationUnitsField}
                        onUpdate={updateOrganisationUnitsField}
                        onClose={onClose}
                        onSave={saveSettings}
                    />
                );
            case "logger":
                return <LoggerSettingsPage onClose={onClose} />;
            case "columns":
                return (
                    <ColumnsContainer>
                        <ColumnsSettingsPage
                            columns={appSettings.columns}
                            columnsMetadata={userColumns}
                            onUpdateColumns={updateColumns}
                            onClose={onClose}
                            onSave={saveSettings}
                            title={i18n.t("User Columns")}
                            showActions
                        />
                        <ColumnsSettingsPage
                            columns={visibleGroupColumns}
                            columnsMetadata={groupColumnsMetadata}
                            onUpdateColumns={updateGroupColumns}
                            onClose={onClose}
                            onSave={saveSettings}
                            title={i18n.t("Group Columns")}
                        >
                            <UserGroupDescriptionSourceSelect
                                value={appSettings.userGroupDescriptionSource}
                                onChange={updateUserGroupDescriptionSource}
                                hasTranslations={appSettings.userGroupDescriptionHasTranslations}
                                onHasTranslationsChange={updateUserGroupDescriptionHasTranslations}
                            />
                        </ColumnsSettingsPage>
                        <ColumnsSettingsPage
                            columns={appSettings.roleColumns}
                            columnsMetadata={roleColumnsMetadata}
                            onUpdateColumns={updateRoleColumns}
                            onClose={onClose}
                            onSave={saveSettings}
                            title={i18n.t("Role Columns")}
                        />
                        <ColumnsSettingsPage
                            columns={appSettings.dashboardColumns}
                            columnsMetadata={dashboardColumnsMetadata}
                            onUpdateColumns={updateDashboardColumns}
                            onClose={onClose}
                            onSave={saveSettings}
                            title={i18n.t("Dashboard Columns")}
                        />
                    </ColumnsContainer>
                );
            case "user-permissions":
            case "permissions":
            case "filter-permissions":
                return (
                    <PermissionsPage
                        onSave={onSaveData}
                        onClose={onClose}
                        permissionsGroup={permissionsGroupByTab[tab]}
                        appSettings={appSettings}
                    />
                );
        }
    };

    return (
        <Dialog open maxWidth="lg" fullWidth onClose={onClose}>
            <Tabs value={selectedTab} onChange={(_event, value) => onChangeTab(value)}>
                <Tab label={i18n.t("Import")} value="import" />
                <Tab label={i18n.t("Logger")} value="logger" />
                <Tab label={i18n.t("Permissions")} value="permissions" />
                <Tab label={i18n.t("User Permissions")} value="user-permissions" />
                <Tab label={i18n.t("Columns")} value="columns" />
                <Tab label={i18n.t("Filter Permissions")} value="filter-permissions" />
            </Tabs>

            {renderSelectedTab(selectedTab)}
        </Dialog>
    );
};

const ColumnsContainer = styled.div`
    padding: 2em;
`;
