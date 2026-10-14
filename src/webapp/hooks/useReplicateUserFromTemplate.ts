import React, { useEffect, useCallback } from "react";
import { useLoading, useSnackbar } from "@eyeseetea/d2-ui-components";
import { FormState } from "final-form";
import _ from "lodash";

import i18n from "../../utils/i18n";
import { useAppContext } from "../contexts/app-context";
import { Id } from "../../domain/entities/Ref";
import { User } from "../../domain/entities/User";
import { Future } from "../../domain/entities/Future";
import {
    ReplicateTemplate,
    ReplicateTemplateProps,
    ReplicateTemplateValidationError,
} from "../../domain/entities/ReplicateTemplate";
import { useAppSettingsContext } from "../contexts/AppSettingsProvider";
import { Password } from "../../domain/value-objects/Password";

export interface UseReplicateUserFromTemplateReturn {
    userToReplicate: User | undefined;
    existingUsernames: string[];
    replicateTitle: string;
    hasValidationErrors: boolean;
    isMounted: boolean;
    randomPasswordBase: string;
    initialValues: ReplicateTemplateProps;
    validateTemplate: (values: ReplicateTemplateProps) => Record<string, string>;
    replicateUsers: (values: ReplicateTemplateProps) => void;
    handleFormStateChange: (state: FormState<ReplicateTemplateProps>) => void;
}

export const useReplicateUserFromTemplate = (
    userToReplicateId: Id,
    onRequestClose: () => void
): UseReplicateUserFromTemplateReturn => {
    const { compositionRoot } = useAppContext();
    const { appSettings } = useAppSettingsContext();

    const [userToReplicate, setUserToReplicate] = React.useState<User | undefined>();
    const [existingUsernames, setExistingUsernames] = React.useState<string[]>([]);
    const [replicateTitle, setReplicateTitle] = React.useState<string>(i18n.t("Replicate User"));
    const [hasValidationErrors, setValidationError] = React.useState<boolean>(false);
    const [isUserLoaded, setIsUserLoaded] = React.useState(true);
    const [isMounted, setIsMounted] = React.useState(false);

    const loading = useLoading();
    const snackbar = useSnackbar();

    const randomPasswordBase = React.useMemo(() => {
        return Password.generate().value;
    }, []);

    const initialValues = React.useMemo(() => {
        return {
            replicateCount: "1",
            usernameTemplate: `${userToReplicate?.username}_$index`,
            passwordTemplate: `${randomPasswordBase}_$index`,
        };
    }, [userToReplicate, randomPasswordBase]);

    useEffect(() => {
        const handleUsersError = (message: string) => {
            snackbar.error(i18n.t(message));
            onRequestClose();
        };

        loading.show(true);
        setIsUserLoaded(false);

        const userFuture = compositionRoot.users.get([userToReplicateId]);
        const identifiersFuture = compositionRoot.users.listAllIdentifiers({
            hideUsers: appSettings.hide.users,
            onlyActiveUsers: appSettings.showOnlyActiveUsers,
            onlyUsersOrgUnits: false,
        });

        Future.joinObj({
            user: userFuture,
            allIdentifiers: identifiersFuture,
        }).run(
            ({ user: [user], allIdentifiers }) => {
                if (!user) {
                    handleUsersError(`Unable to load user: ${userToReplicateId}`);
                } else {
                    try {
                        setUserToReplicate(User.createExisted(user).getOrThrow());
                    } catch (error) {
                        loading.show(false);
                        handleUsersError(`User has invalid properties: ${(error as Error).message}`);
                    }
                    const usernames = allIdentifiers.map(u => u.username);
                    setExistingUsernames(usernames);
                    setIsUserLoaded(true);
                }
            },
            error => {
                handleUsersError(`Error loading users data: ${error}`);
            }
        );
    }, [
        compositionRoot,
        loading,
        onRequestClose,
        snackbar,
        userToReplicateId,
        appSettings.showOnlyActiveUsers,
        appSettings.hide.users,
    ]);

    useEffect(() => {
        if (isUserLoaded && userToReplicate && userToReplicate.username) {
            setReplicateTitle(
                i18n.t("Replicate {{user}}", {
                    user: `${userToReplicate.name} (${userToReplicate.username})`,
                })
            );
            setIsMounted(true);
            loading.reset();
        }
    }, [isUserLoaded, loading, userToReplicate]);

    const validateTemplate = useCallback(
        (values: ReplicateTemplateProps) => {
            return ReplicateTemplate.validateReplicateTemplate(values, existingUsernames);
        },
        [existingUsernames]
    );

    const replicateUsers = useCallback(
        async ({
            replicateCount,
            usernameTemplate,
            passwordTemplate,
        }: {
            replicateCount: string;
            usernameTemplate: string;
            passwordTemplate: string;
        }) => {
            if (!userToReplicate) return;

            loading.show(true, i18n.t("Replicating users"));

            try {
                const replicateTemplate = new ReplicateTemplate(
                    {
                        replicateCount: replicateCount,
                        usernameTemplate,
                        passwordTemplate,
                    },
                    existingUsernames
                );
                return compositionRoot.users.replicateFromTemplate(userToReplicate, replicateTemplate).run(
                    () => {
                        loading.hide();
                        onRequestClose();
                        snackbar.success(
                            i18n.t("User {{user}} replicated successfully {{n}} times", {
                                user: userToReplicate.username,
                                n: replicateCount,
                            })
                        );
                    },
                    error => {
                        loading.hide();
                        snackbar.error(
                            i18n.t("Error replicating user {{user}}: {{message}}", {
                                user: userToReplicate.username,
                                message: error,
                                nsSeparator: false,
                            })
                        );
                    }
                );
            } catch (error) {
                if (error instanceof ReplicateTemplateValidationError) {
                    loading.hide();
                    const errorMessage = (error as Error).message;
                    snackbar.error(
                        i18n.t("Error in template: {{message}}", {
                            message: errorMessage,
                            nsSeparator: false,
                        })
                    );
                } else {
                    loading.hide();
                    snackbar.error(
                        i18n.t("Error replicating user {{user}}: {{message}}", {
                            user: userToReplicate.username,
                            message: error,
                            nsSeparator: false,
                        })
                    );
                }
            }
        },
        [compositionRoot.users, loading, snackbar, onRequestClose, userToReplicate, existingUsernames]
    );

    const handleFormStateChange = useCallback((state: FormState<ReplicateTemplateProps>) => {
        requestAnimationFrame(() => {
            setValidationError(!_.isEmpty(state.errors));
        });
    }, []);

    return {
        userToReplicate,
        existingUsernames,
        replicateTitle,
        hasValidationErrors,
        isMounted,
        randomPasswordBase,
        initialValues,
        validateTemplate,
        replicateUsers,
        handleFormStateChange,
    };
};
