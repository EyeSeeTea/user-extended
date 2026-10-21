import React from "react";
import styled from "styled-components";
import { HashRouter, Route, Routes } from "react-router-dom";
import { LegacyAppWrapper } from "../../legacy/LegacyApp";
import { ListHybrid } from "../../legacy/List/List.component";
import { useAppContext } from "../contexts/app-context";
import { UserBulkEditPage } from "./user-bulk-edit/UserBulkEditPage";
import { UserEditPage } from "./user-edit/UserEditPage";
import { About } from "../components/about/About";
import { AboutPage } from "./about/AboutPage";
import { DashboardTable } from "../components/dashboard/DashboardTable";
import { UserRoleTable } from "../components/user-role/UserRoleTable";
import { UserGroupTable } from "../components/user-group-table/UserGroupTable";
import { TabsMenu } from "../components/tabs-menu/TabsMenu";
import { useAppSettingsContext } from "../contexts/AppSettingsProvider";
import { SettingsDialogModal } from "../components/settings-dialog-modal/SettingsDialogModal";

const TabWrapper = ({
    children,
    showSettingsIcon,
    onClickSettings,
}: {
    children: React.ReactNode;
    showSettingsIcon: boolean;
    onClickSettings: () => void;
}) => (
    <LegacyAppWrapper>
        <TabsMenu showSettings={showSettingsIcon} onClickSettings={onClickSettings}>
            {children}
        </TabsMenu>
    </LegacyAppWrapper>
);

export const Router: React.FC = React.memo(() => {
    const { api, currentUser, compositionRoot } = useAppContext();
    const [currentUserHasAccessToSettings, setCurrentUserHasAccessToSettings] = React.useState(false);
    const [showSettings, setShowSettings] = React.useState(false);
    const { appSettings, setAppSettings } = useAppSettingsContext();

    React.useEffect(() => {
        compositionRoot.users.checkCurrentUserCanAccessSettings().run(setCurrentUserHasAccessToSettings, console.error);
    }, [compositionRoot.users]);

    const updateAppSettings = React.useCallback(
        newAppSettings => {
            setAppSettings(newAppSettings);
            setShowSettings(false);
        },
        [setAppSettings]
    );

    const openSettings = React.useCallback(() => {
        setShowSettings(true);
    }, []);

    const closeSettings = React.useCallback(() => {
        setShowSettings(false);
    }, []);

    return (
        <HashRouter>
            <Routes>
                <Route path="/bulk-edit" element={<UserBulkEditPage />} />
                <Route path="/edit/:id" element={<UserEditPage type="edit" />} />
                <Route path="/new" element={<UserEditPage type="new" />} />
                <Route path="/about" element={<AboutPage />} />

                <Route
                    path="/"
                    element={
                        <TabWrapper showSettingsIcon={currentUserHasAccessToSettings} onClickSettings={openSettings}>
                            <ListHybrid api={api} params={{ modelType: "users", currentUser }} />
                        </TabWrapper>
                    }
                />

                <Route
                    path="/dashboards"
                    element={
                        <TabWrapper showSettingsIcon={currentUserHasAccessToSettings} onClickSettings={openSettings}>
                            <DashboardTable appSettings={appSettings} />
                        </TabWrapper>
                    }
                />

                <Route
                    path="/user-roles"
                    element={
                        <TabWrapper showSettingsIcon={currentUserHasAccessToSettings} onClickSettings={openSettings}>
                            <UserRoleTable appSettings={appSettings} />
                        </TabWrapper>
                    }
                />

                <Route
                    path="/user-groups"
                    element={
                        <TabWrapper showSettingsIcon={currentUserHasAccessToSettings} onClickSettings={openSettings}>
                            <UserGroupTable appSettings={appSettings} />
                        </TabWrapper>
                    }
                />
            </Routes>
            <IconsContainer>
                <About icon="about" visible={true} />
            </IconsContainer>

            {showSettings && currentUserHasAccessToSettings && (
                <SettingsDialogModal onClose={closeSettings} onCloseAppSettings={updateAppSettings} />
            )}
        </HashRouter>
    );
});

const IconsContainer = styled.div`
    align-items: center;
    inset-block-end: -3px;
    display: flex;
    gap: 1em;
    justify-content: center;
    position: fixed;
    inset-inline-end: 80px;
`;
