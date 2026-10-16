import "@testing-library/jest-dom";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserProps } from "../../../../domain/entities/UserProps";
import { getLocationText, getReactComponentInRoute, getTestContext } from "../../../../utils/tests";
import { UserBulkEditPage } from "../UserBulkEditPage";

type NavigationState = { users: UserProps[] } | null;

describe("UserBulkEditPage", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("when opened without users in the navigation state", () => {
        it("shows the users list without logging errors", () => {
            const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
            const state = givenANavigationStateWithoutUsers();

            renderPage(state);

            expect(screen.getByText(getLocationText("/"))).toBeInTheDocument();
            expect(consoleError).not.toHaveBeenCalled();
        });
    });
});

function givenANavigationStateWithoutUsers(): NavigationState {
    return null;
}

function renderPage(state: NavigationState) {
    const { context } = getTestContext();

    return getReactComponentInRoute(
        <UserBulkEditPage isEdit={true} />,
        { path: "/bulk-edit", url: "/bulk-edit", state },
        context
    );
}
