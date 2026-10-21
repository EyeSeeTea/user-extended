import { useLoading, useSnackbar } from "@eyeseetea/d2-ui-components";
import { createForm, FormApi } from "final-form";
import { useCallback, useState } from "react";
import { useLocation } from "react-router";
import { newUserProps, UserProps, UserToSave } from "../../../domain/entities/UserProps";
import { MetadataResponse } from "../../../types/d2-api";
import i18n from "../../../utils/i18n";
import { useAppContext } from "../../contexts/app-context";
import { useGoBack } from "../../hooks/useGoBack";

export type UserBulkEditFormValues = { users: UserToSave[] };

export interface UserBulkEditState {
    shouldRedirect: boolean;
    form: FormApi<UserBulkEditFormValues>;
    columns: string[];
    columnSelectorOpen: boolean;
    summary: MetadataResponse[] | undefined;
    addUser: () => void;
    removeUser: (row: number) => void;
    isNewUser: (row: number) => boolean;
    save: (values: UserBulkEditFormValues) => Promise<string | undefined>;
    goBack: () => void;
    close: () => void;
    changeColumns: (columns: string[]) => void;
    openColumnSelector: () => void;
    closeColumnSelector: () => void;
    closeSummary: () => void;
}

export function useUserBulkEdit(): UserBulkEditState {
    const { compositionRoot } = useAppContext();
    const goBack = useGoBack();
    const loading = useLoading();
    const snackbar = useSnackbar();
    const location = useLocation();

    const [initialUsers] = useState(() => getUsersFromLocationState(location.state));
    const [summary, setSummary] = useState<MetadataResponse[]>();
    const [columns, setColumns] = useState<string[]>(baseUserColumns);
    const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);

    const close = useCallback(() => goBack(true), [goBack]);

    const save = useCallback(
        async ({ users }: UserBulkEditFormValues) => {
            loading.show(true, i18n.t("Saving users"));

            const { data, error } = await compositionRoot.users.save(users).runAsync();
            loading.reset();

            if (error) {
                snackbar.error(error);
                return error;
            }

            if (data && data.status === "ERROR") {
                setSummary([data]);
            } else {
                close();
            }
        },
        [compositionRoot, snackbar, close, loading]
    );

    const [form] = useState(() =>
        createForm<UserBulkEditFormValues>({ initialValues: { users: initialUsers }, onSubmit: save })
    );

    const addUser = useCallback(() => {
        form.change("users", [...form.getState().values.users, newUserProps()]);
        setColumns(columns => [...columns, ...newUserColumns.filter(column => !columns.includes(column))]);
    }, [form]);

    const removeUser = useCallback(
        (row: number) => {
            const users = form.getState().values.users;
            form.change("users", [...users.slice(0, row), ...users.slice(row + 1)]);
        },
        [form]
    );

    const isNewUser = useCallback(
        (row: number) => {
            const user = form.getState().values.users[row];
            return user?.id === undefined;
        },
        [form]
    );

    const openColumnSelector = useCallback(() => setColumnSelectorOpen(true), []);
    const closeColumnSelector = useCallback(() => setColumnSelectorOpen(false), []);
    const closeSummary = useCallback(() => setSummary(undefined), []);

    return {
        shouldRedirect: initialUsers.length === 0,
        form,
        columns,
        columnSelectorOpen,
        summary,
        addUser,
        removeUser,
        isNewUser,
        save,
        goBack,
        close,
        changeColumns: setColumns,
        openColumnSelector,
        closeColumnSelector,
        closeSummary,
    };
}

function getUsersFromLocationState(state: unknown): UserProps[] {
    return typeof state === "object" && state !== null && "users" in state && Array.isArray(state.users)
        ? state.users
        : [];
}

const baseUserColumns = ["firstName", "surname", "email", "userRoles", "userGroups", "organisationUnits"];

/* Columns a new user needs to be filled in; existing users have them read-only or optional */
const newUserColumns = ["username", "password"];
