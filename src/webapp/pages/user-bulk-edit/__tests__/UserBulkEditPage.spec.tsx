import "@testing-library/jest-dom";
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Future } from "../../../../domain/entities/Future";
import { UserProps } from "../../../../domain/entities/UserProps";
import {
    getLocationText,
    getReactComponentInRoute,
    getTestContext,
    getTestUser,
    givenAScreenSize,
} from "../../../../utils/tests";
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

    describe("when adding and removing rows", () => {
        beforeEach(() => {
            givenAScreenSize(1920, 1080);
        });

        it("keeps the edited values when a user is added", () => {
            const state = givenUsersToEdit(["Traore", "Diallo"]);

            renderPage(state);
            changeSurname(0, "Edited");
            clickAddUser();

            expect(getSurnames()).toEqual(["Edited", "Diallo", ""]);
        });

        it("does not bring back a deleted row when a user is added", () => {
            const state = givenUsersToEdit(["Traore", "Diallo"]);

            renderPage(state);
            deleteRow(0);
            clickAddUser();

            expect(getSurnames()).toEqual(["Diallo", ""]);
        });

        it("keeps the edited values of a row when another one is deleted", () => {
            const state = givenUsersToEdit(["Traore", "Diallo", "Keita"]);

            renderPage(state);
            changeSurname(0, "Edited");
            deleteRow(1);

            expect(getSurnames()).toEqual(["Edited", "Keita"]);
        });
    });

    describe("when a user is added", () => {
        beforeEach(() => {
            givenAScreenSize(2560, 1440);
        });

        it("lets its username and password be filled in, keeping existing usernames read-only", () => {
            const state = givenUsersToEdit(["Traore"]);

            renderPage(state);
            clickAddUser();

            expect(getFieldStates("Username")).toEqual([
                { value: "admin", disabled: true },
                { value: "", disabled: false },
            ]);
            expect(getFieldStates("Password")[1]).toEqual({ value: "", disabled: false });
        });
    });

    describe("when saving fails", () => {
        it("shows the failure in the form error box", async () => {
            const error = "A user is invalid";
            const state = givenUsersToEdit(["Traore"]);

            renderPage(state, error);
            fireEvent.click(screen.getByRole("button", { name: "Save" }));

            expect(await screen.findByText("Error saving users")).toBeInTheDocument();
            expect(screen.getAllByText(error)).toHaveLength(2);
        });
    });
});

function givenANavigationStateWithoutUsers(): NavigationState {
    return null;
}

function givenUsersToEdit(surnames: string[]): NavigationState {
    const users = surnames.map((surname, index) => ({ ...getTestUser(), id: `user${index}`, surname }));
    return { users };
}

function changeSurname(row: number, surname: string) {
    const input = getSurnameInputs()[row];
    if (!input) throw new Error(`No surname input in row ${row}`);
    fireEvent.change(input, { target: { value: surname } });
}

function deleteRow(row: number) {
    const button = screen.getAllByRole("button", { name: "Delete" })[row];
    if (!button) throw new Error(`No delete button in row ${row}`);
    fireEvent.click(button);
}

function clickAddUser() {
    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
}

function getSurnames(): string[] {
    return getSurnameInputs().map(input => input.value);
}

function getFieldStates(placeholder: string): { value: string; disabled: boolean }[] {
    return screen
        .queryAllByPlaceholderText<HTMLInputElement>(placeholder)
        .map(input => ({ value: input.value, disabled: input.disabled }));
}

function getSurnameInputs(): HTMLInputElement[] {
    return screen.getAllByPlaceholderText<HTMLInputElement>("Surname");
}

function renderPage(state: NavigationState, saveError?: string) {
    const { context } = getTestContext();
    if (saveError) vi.spyOn(context.compositionRoot.users, "save").mockReturnValue(Future.error(saveError));

    return getReactComponentInRoute(
        <UserBulkEditPage />,
        { path: "/bulk-edit", url: "/bulk-edit", state },
        context
    );
}
