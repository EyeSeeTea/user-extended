import { render, RenderResult } from "@testing-library/react";
import { LoadingProvider, SnackbarProvider } from "@eyeseetea/d2-ui-components";
import { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { getCompositionRoot } from "../CompositionRoot";
import { getD2ApiFromInstance } from "./d2-api";
import { AppContext, AppContextState } from "../webapp/contexts/app-context";
import { Instance } from "../data/entities/Instance";
import { UserProps } from "../domain/entities/UserProps";

export function getTestUser(): UserProps {
    return {
        id: "xE7jOejl9FI",
        name: "John Traore",
        username: "admin",
        userGroups: [],
        userRoles: [],
        organisationUnits: [],
        dataViewOrganisationUnits: [],
        searchOrganisationsUnits: [],
        firstName: "John",
        surname: "Traore",
        email: "john.traore@example.com",
        phoneNumber: "",
        whatsApp: "",
        facebookMessenger: "",
        skype: "",
        telegram: "",
        twitter: "",
        lastUpdated: new Date("2020-01-01T12:00:00.000"),
        created: new Date("2020-01-01T12:00:00.000"),
        apiUrl: "http://localhost:8080/api",
        lastLogin: new Date("2020-01-01T12:00:00.000"),
        status: "ACTIVE",
        disabled: false,
        access: {
            manage: true,
            externalize: true,
            write: true,
            delete: true,
            read: true,
            update: true,
        },
        openId: null,
        ldapId: null,
        externalAuth: false,
        twoFactorEnabled: false,
        password: "",
        accountExpiry: null,
        authorities: ["ALL"],
        createdBy: null,
        lastModifiedBy: null,
        uiLocale: "en",
        dbLocale: "en",
    };
}

export function getTestConfig() {
    return {};
}

export function getTestD2() {
    return {};
}

export function getTestContext() {
    // The fetch backend has no mock adapter, so tests get a real client they must not let hit the network
    const instance = new Instance({ url: "http://localhost:8080" });
    const api = getD2ApiFromInstance(instance);
    const context = {
        api: api,
        d2: getTestD2(),
        currentUser: getTestUser(),
        config: getTestConfig(),
        compositionRoot: getCompositionRoot(instance, "dataStore"),
    };

    return { api, context };
}

export function getReactComponent(children: ReactNode, context: AppContextState): RenderResult {
    return render(
        <AppContext.Provider value={context}>
            <SnackbarProvider>
                <LoadingProvider>{children}</LoadingProvider>
            </SnackbarProvider>
        </AppContext.Provider>
    );
}

export interface TestRoute {
    path: string;
    url: string;
    state?: unknown;
}

/* Renders children at the given route; any other route shows the current location (getLocationText) */
export function getReactComponentInRoute(
    children: ReactNode,
    route: TestRoute,
    context: AppContextState
): RenderResult {
    return getReactComponent(
        <MemoryRouter initialEntries={[{ pathname: route.url, state: route.state }]}>
            <Routes>
                <Route path={route.path} element={children} />
                <Route path="*" element={<CurrentLocation />} />
            </Routes>
        </MemoryRouter>,
        context
    );
}

export function getLocationText(pathname: string): string {
    return `Current location: ${pathname}`;
}

const CurrentLocation: React.FC = () => {
    const { pathname } = useLocation();
    return <p>{getLocationText(pathname)}</p>;
};
