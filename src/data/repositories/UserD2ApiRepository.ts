import { D2Api, D2UserSchema, MetadataResponse, SelectedPick, PatchOperation, ErrorReport } from "../../types/d2-api";
import _ from "lodash";
import { Future, FutureData } from "../../domain/entities/Future";
import { OrgUnit } from "../../domain/entities/OrgUnit";
import { Pager, PaginatedResponse } from "../../domain/entities/PaginatedResponse";
import { Id, NamedRef } from "../../domain/entities/Ref";
import { Stats } from "../../domain/entities/Stats";
import { User } from "../../domain/entities/User";
import { ListOptions, UpdateStrategy, UserRepository } from "../../domain/repositories/UserRepository";
import { translateUserFilters, D2ApiFilters } from "./UserFilterTranslator";
import { LocaleCode } from "../../domain/entities/UserProps";
import { UserIdentifier } from "../../domain/entities/UserIdentifier";
import { Maybe } from "../../types/utils";
// eslint-disable-next-line unused-imports/no-unused-imports, @typescript-eslint/no-unused-vars
import { cache } from "../../utils/cache";
import { getD2ApiFromInstance, getMajorVersion, joinPaths } from "../../utils/d2-api";
import { apiToFuture } from "../../utils/futures";
import { DataStoreStorageClient } from "../clients/storage/DataStoreStorageClient";
import { Namespaces } from "../clients/storage/Namespaces";
import { StorageClient } from "../clients/storage/StorageClient";
import { D2ApiLogger, D2LoggerMessage } from "../D2ApiLogger";
import { Instance } from "../entities/Instance";
import { ApiD2OrgUnit } from "../models/DHIS2Model";
import { ApiUserModel } from "../models/UserModel";
import { Codec, exactly, string } from "purify-ts";
import i18n from "../../utils/i18n";
import {
    buildUserToSave,
    buildUserWithoutPassword,
    chunkRequest,
    ExistingApiUser,
    getDiffUserIdsByGroup,
    getErrorFromResponse,
} from "../utils";
import { getLanguage } from "../../domain/utils/getLanguage";
import { validationErrorsToString } from "../../domain/utils/validationErrorsToString";
import { GET_USERS_BY_IDS_CHUNK_SIZE, LIST_ALL_USERS_PAGE_SIZE } from "../../domain/utils/limits";

export class UserD2ApiRepository implements UserRepository {
    private api: D2Api;
    private userStorage: StorageClient;

    constructor(instance: Instance) {
        this.api = getD2ApiFromInstance(instance);
        this.userStorage = new DataStoreStorageClient("user", instance);
    }

    // TODO: this method should be in a different use case
    // retrieve users, update them
    private getLocales(users: User[]): FutureData<User[]> {
        const $requests = users.map((user): FutureData<User> => {
            return apiToFuture(
                this.api.request<D2UserSettings>({
                    method: "get",
                    url: "/userSettings.json",
                    params: { user: user.username },
                })
            ).map((response): User => {
                const userResult = User.createExisted({
                    ...user,
                    uiLocale: response.keyUiLocale,
                    dbLocale: response.keyDbLocale,
                });

                return userResult.match({
                    success: user => {
                        return user;
                    },
                    error: errors => {
                        throw new Error(
                            `Error setting locales for user ${user.id}: ${validationErrorsToString(errors)}`
                        );
                    },
                });
            });
        });

        return Future.parallel($requests, { maxConcurrency: 5 }).map(users => users);
    }

    private saveLocales(users: User[]): FutureData<void> {
        const $requests = users.flatMap(user => {
            return [this.saveLocaleRequest(user, "keyDbLocale"), this.saveLocaleRequest(user, "keyUiLocale")];
        });
        return Future.parallel($requests, { maxConcurrency: 2 }).map(() => undefined);
    }

    private saveLocaleRequest(user: User, keyLocale: KeyLocale): FutureData<void> {
        return apiToFuture(
            this.api.request({
                method: "post",
                url: `/userSettings/${keyLocale}.json`,
                params: { user: user.username, value: this.getLocaleValueByType(user, keyLocale) },
            })
        );
    }

    private getLocaleValueByType(user: User, keyLocale: KeyLocale): string {
        switch (keyLocale) {
            case DB_LOCALE_KEY:
                return getLanguage(user.dbLocale);
            case UI_LOCALE_KEY:
                return getLanguage(user.uiLocale);
        }
    }

    remove(ids: Id[]): FutureData<Stats> {
        return chunkRequest(ids, userIds => {
            // TODO: Legacy metadata POST endpoint with importStrategy=DELETE. This should be replaced with per-user DELETE /api/users/{id} or the bulk delete if DHIS2 version supports it
            return apiToFuture<Dhis2Response>(
                this.api.metadata.post({ users: userIds.map(id => ({ id: id })) }, { importStrategy: "DELETE" })
            ).flatMap(d2Response => {
                const res = d2Response.response ? d2Response.response : d2Response;
                return Future.success([
                    new Stats({
                        created: res.stats.created,
                        updated: res.stats.updated,
                        ignored: res.stats.ignored,
                        deleted: res.stats.deleted,
                        errorMessage: getErrorFromResponse(res.typeReports),
                    }),
                ]);
            });
        }).flatMap(stats => {
            return Future.success(Stats.combine(stats));
        });
    }

    resetPasswords(users: User[]): FutureData<Stats> {
        const $requests = users.map(user => apiToFuture(this.api.post(`/users/${user.id}/reset`)));

        return Future.parallel($requests, { maxConcurrency: 5 }).map(() => Stats.empty()); // There is no response body from the API
    }

    @cache()
    public getCurrent(): FutureData<User> {
        return apiToFuture(
            this.api.currentUser.get({
                fields: {
                    ...fields,
                    organisationUnits: { ...fields.organisationUnits, level: true },
                    settings: { keyDbLocale: true },
                },
            })
        ).map(user => this.toDomainUser(user));
    }

    public list(options: ListOptions): FutureData<PaginatedResponse<User>> {
        return this.getIs242Plus().flatMap(is242Plus => {
            return this.listWithVersion(options, is242Plus);
        });
    }

    private listWithVersion(options: ListOptions, is242Plus: boolean): FutureData<PaginatedResponse<User>> {
        const { page, pageSize } = options;
        const normalizedPage = page ?? 1;
        const normalizedPageSize = pageSize ?? 25;
        const idFilterValues = this.getIdInFilterValues(options);

        return this.getUsersIdsInChunks(options.hideUsers).flatMap(usersIdsToHide => {
            if (!idFilterValues || idFilterValues.length === 0) {
                return apiToFuture(
                    this.api.models.users.get({
                        fields: {
                            ...fields,
                            ...auditFields,
                            userCredentials: { ...fields.userCredentials, ...auditFields },
                        },
                        page,
                        pageSize,
                        ...this.createCommonListQueryParams(options, is242Plus),
                    })
                ).flatMap(({ objects, pager }) => {
                    return this.recalculatePagination(options, is242Plus).map(newPager => {
                        const users = objects.map(user => this.toDomainUser(user as ApiUserWithAudit));
                        const excludeHiddenUsers = usersIdsToHide
                            ? users.filter(user => !usersIdsToHide.includes(user.id))
                            : users;
                        return { pager: newPager ?? pager, objects: excludeHiddenUsers };
                    });
                });
            }

            // If there is an ID filter, we need to chunk the requests to avoid URL length limits
            const sorting = options.sorting ?? { field: "firstName", order: "asc" };
            const baseFilters = options.filters ?? {};

            return chunkRequest(
                idFilterValues,
                idsChunk => {
                    const chunkOptions: ListOptions = {
                        ...options,
                        filters: { ...baseFilters, id: idsChunk },
                    };

                    return apiToFuture(
                        this.api.models.users.get({
                            fields: {
                                ...fields,
                                ...auditFields,
                                userCredentials: { ...fields.userCredentials, ...auditFields },
                            },
                            paging: false,
                            ...this.createCommonListQueryParams(chunkOptions, is242Plus),
                        })
                    ).map(({ objects }) => objects);
                },
                100,
                { maxConcurrency: 5 }
            ).map(objects => {
                const users = objects.map(user => this.toDomainUser(user));
                const excludeHiddenUsers = usersIdsToHide
                    ? users.filter(user => !usersIdsToHide.includes(user.id))
                    : users;
                const uniqueUsers = _.uniqBy(excludeHiddenUsers, user => user.id);
                const sortedUsers = _.orderBy(uniqueUsers, [sorting.field], [sorting.order]);
                const startIndex = (normalizedPage - 1) * normalizedPageSize;
                const pagedUsers = sortedUsers.slice(startIndex, startIndex + normalizedPageSize);
                const total = sortedUsers.length;
                const pageCount = total === 0 ? 0 : Math.ceil(total / normalizedPageSize);

                return {
                    pager: {
                        page: normalizedPage,
                        pageSize: normalizedPageSize,
                        total,
                        pageCount,
                    },
                    objects: pagedUsers,
                };
            });
        });
    }

    verifyPassword(password: string): FutureData<true> {
        return apiToFuture(
            this.api.post<typeof verifyPasswordResponseCodec>(`/account/validatePassword?password=${password}`)
        ).flatMap(data => {
            return verifyPasswordResponseCodec.decode(data).caseOf<FutureData<true>>({
                Left: () => Future.error(i18n.t("Invalid response from server")),
                Right: data => {
                    if (data.response === "error") {
                        return Future.error(data.message || i18n.t("Unknown error"));
                    } else {
                        return Future.success(true);
                    }
                },
            });
        });
    }

    private buildApiFilters(options: ListOptions, is242Plus: boolean): D2ApiFilters {
        return translateUserFilters(options.filters, options.onlyActiveUsers, is242Plus);
    }

    private getUsersIdsInChunks(ids: Id[]): FutureData<Maybe<Id[]>> {
        if (ids.length === 0) return Future.success(undefined);
        return chunkRequest(ids, usersIds => {
            return apiToFuture(
                this.api.models.users.get({
                    fields: { id: true },
                    filter: { id: { in: usersIds } },
                    paging: false,
                })
            ).map(d2Response => {
                return d2Response.objects.map(d2User => d2User.id);
            });
        });
    }

    public listAllIds(options: ListOptions): FutureData<string[]> {
        return this.getIs242Plus().flatMap(is242Plus => {
            return this.getUsersIdsInChunks(options.hideUsers).flatMap(usersIdsToExclude => {
                return apiToFuture(
                    this.api.models.users.get({
                        fields: { id: true },
                        paging: false,
                        ...this.createCommonListQueryParams(options, is242Plus),
                    })
                ).map(({ objects }) => {
                    const usersIds = objects.map(user => user.id);
                    return usersIdsToExclude ? usersIds.filter(id => !usersIdsToExclude.includes(id)) : usersIds;
                });
            });
        });
    }

    private createCommonListQueryParams(options: ListOptions, is242Plus: boolean) {
        const {
            search,
            sorting = { field: "firstName", order: "asc" },
            canManage,
            rootJunction,
            onlyUsersOrgUnits,
        } = options;

        const apiFilters = this.buildApiFilters(options, is242Plus);
        const areFiltersEnabled = Object.values(apiFilters).some(v => v !== undefined && v !== null);
        const sortingField = sorting.field === "status" ? "disabled" : sorting.field;

        return {
            query: search !== "" ? search : undefined,
            canManage: canManage === "true" ? "true" : undefined,
            filter: apiFilters,
            rootJunction: areFiltersEnabled ? rootJunction : undefined,
            userOrgUnits: onlyUsersOrgUnits ? "true" : undefined,
            includeChildren: onlyUsersOrgUnits ? "true" : undefined,
            order: `${sortingField}:${sorting.order}`,
        };
    }

    public listAllUserIdentifiers(options: ListOptions): FutureData<UserIdentifier[]> {
        return this.getIs242Plus().flatMap(is242Plus => {
            return this.listAllUserIdentifiersWithVersion(options, is242Plus);
        });
    }

    private listAllUserIdentifiersWithVersion(options: ListOptions, is242Plus: boolean): FutureData<UserIdentifier[]> {
        const idFilterValues = this.getIdInFilterValues(options);

        return this.getUsersIdsInChunks(options.hideUsers).flatMap(usersIdsToExclude => {
            if (!idFilterValues || idFilterValues.length === 0) {
                return apiToFuture(
                    this.api.models.users.get({
                        fields: { id: true, name: true, username: true, userCredentials: { username: true } },
                        paging: false,
                        ...this.createCommonListQueryParams(options, is242Plus),
                    })
                ).map(({ objects }) => {
                    const filteredObjects = usersIdsToExclude
                        ? objects.filter(user => !usersIdsToExclude.includes(user.id))
                        : objects;
                    return filteredObjects.map(
                        user =>
                            new UserIdentifier({
                                id: user.id,
                                username: user.username || user.userCredentials?.username || "",
                                name: user.name,
                            })
                    );
                });
            }

            return this.getUserIdentifiersInChunks(options, is242Plus, {
                userIds: idFilterValues,
                usersIdsToExclude: usersIdsToExclude,
            });
        });
    }

    private getIdInFilterValues(options: ListOptions): Maybe<Id[]> {
        const idFilterValues = options.filters?.id;
        return idFilterValues && idFilterValues.length > 0 ? idFilterValues : undefined;
    }

    private getUserIdentifiersInChunks(
        options: ListOptions,
        is242Plus: boolean,
        params: { userIds: Maybe<Id[]>; usersIdsToExclude: Maybe<Id[]> }
    ): FutureData<UserIdentifier[]> {
        const { userIds, usersIdsToExclude } = params;
        if (!userIds || userIds.length === 0) return Future.success([]);

        const baseFilters = options.filters ?? {};
        return chunkRequest(
            userIds,
            idsChunk => {
                const chunkOptions: ListOptions = { ...options, filters: { ...baseFilters, id: idsChunk } };

                return apiToFuture(
                    this.api.models.users.get({
                        fields: { id: true, name: true, username: true, userCredentials: { username: true } },
                        paging: false,
                        ...this.createCommonListQueryParams(chunkOptions, is242Plus),
                    })
                ).map(({ objects }) => objects);
            },
            100,
            { maxConcurrency: 5 }
        ).map(objects => {
            const filteredObjects = usersIdsToExclude
                ? objects.filter(user => !usersIdsToExclude.includes(user.id))
                : objects;
            const uniqueUsers = _.uniqBy(filteredObjects, user => user.id);
            return uniqueUsers.map(
                user =>
                    new UserIdentifier({
                        id: user.id,
                        username: user.username || user.userCredentials?.username || "",
                        name: user.name,
                    })
            );
        });
    }

    public getByIds(ids: Id[]): FutureData<User[]> {
        if (ids.length === 0) return Future.success([]);
        return this.getUsersByIds(ids);
    }

    private getUsersByIds(ids: Id[]): FutureData<User[]> {
        const $requests = chunkRequest(
            ids,
            usersIds => {
                return apiToFuture(
                    this.api.models.users.get({
                        paging: false,
                        fields: {
                            ...fields,
                            ...auditFields,
                            userCredentials: { ...fields.userCredentials, ...auditFields },
                        },
                        filter: { id: { in: usersIds } },
                        v: +new Date().getTime(),
                    })
                ).flatMap(({ objects }) => {
                    const users = objects.map(user => this.toDomainUser(user));
                    return this.getUsersGroups(usersIds).flatMap(d2UsersWithGroups => {
                        const usersWithGroups = this.addGroupsToUsers(users, d2UsersWithGroups);
                        return this.getLocales(usersWithGroups);
                    });
                });
            },
            GET_USERS_BY_IDS_CHUNK_SIZE
        );

        return $requests.map(_.flatten);
    }

    private addGroupsToUsers(users: User[], d2UsersWithGroups: D2UserGroupByKey): User[] {
        return users.map((user): User => {
            const userGroups = d2UsersWithGroups[user.id] || [];

            const userResult = User.createExisted({ ...user, userGroups: userGroups });

            return userResult.match({
                success: user => {
                    return user;
                },
                error: errors => {
                    throw new Error(`Error adding groups to user ${user.id}: ${validationErrorsToString(errors)}`);
                },
            });
        });
    }

    private getUsersGroups(usersIds: Id[]): FutureData<D2UserGroupByKey> {
        const $requests = chunkRequest(usersIds, usersChunksIds => {
            return apiToFuture(
                this.api.models.userGroups.get({
                    filter: { "users.id": { in: usersChunksIds } },
                    fields: { id: true, displayName: true, users: true },
                    paging: false,
                })
            ).map(response => {
                return response.objects.map(d2Group => ({
                    id: d2Group.id,
                    name: d2Group.displayName,
                    users: d2Group.users,
                }));
            });
        });

        return $requests.map(d2UsersGroups => {
            const userGroups = _(d2UsersGroups)
                .flatMap(group => group.users.map(user => ({ userId: user.id, group })))
                .value();

            const groupedByUser = _(userGroups)
                .groupBy(ug => ug.userId)
                .mapValues(groups => groups.map(group => _.omit(group.group, ["users"])))
                .value();

            return groupedByUser;
        });
    }

    private getFullUsers(options: ListOptions): FutureData<ExistingApiUser[]> {
        const { page, pageSize, search, sorting = { field: "firstName", order: "asc" } } = options;

        // getFullUsers is only used internally for save() prefetch; keep 2.41-compatible filter keys
        const apiFilters = translateUserFilters(options.filters, options.onlyActiveUsers, false);

        const userData$ = apiToFuture(
            this.api.models.users.get({
                fields: savePrefetchFields,
                page,
                pageSize,
                paging: false,
                filter: {
                    identifiable: search ? { token: search } : undefined,
                    ...apiFilters,
                },
                order: `${sorting.field}:${sorting.order}`,
                v: +new Date().getTime(),
            })
        );
        return userData$.flatMap(({ objects }) => {
            return this.getUsersGroups(objects.map(user => user.id)).map(d2UsersGroups => {
                const users = objects.map(user => {
                    const userGroups = d2UsersGroups[user.id] || [];
                    return { ...user, userGroups };
                });
                return users;
            });
        });
    }

    public listAll(
        options: ListOptions,
        state: { initialPage: number; users: User[] } = { initialPage: 1, users: [] }
    ): FutureData<User[]> {
        const { initialPage, users } = state;
        return this.list({ ...options, pageSize: LIST_ALL_USERS_PAGE_SIZE, page: initialPage }).flatMap(
            ({ pager, objects }) => {
                const newUsers = [...users, ...objects];
                if (pager.page >= pager.pageCount) {
                    return Future.success(newUsers);
                } else {
                    return this.listAll(options, {
                        initialPage: initialPage + 1,
                        users: newUsers,
                    });
                }
            }
        );
    }

    public save(usersToSave: User[]): FutureData<MetadataResponse> {
        const validations = usersToSave.map(user => ApiUserModel.decode(this.toApiUser(user)));
        const users = _.compact(validations.map(either => either.toMaybe().extract()));
        const errors = _.compact(validations.map(either => either.leftOrDefault("")));

        if (errors.length > 0) {
            return Future.error(errors.join("\n"));
        }

        const userIds = users.map(user => user.id);

        return this.getLogger().flatMap(logger => {
            return this.getFullUsers({
                filters: { id: userIds },
                onlyUsersOrgUnits: false,
                onlyActiveUsers: false,
                hideUsers: [],
            }).flatMap(existingUsers => {
                const usersToSend = _(userIds)
                    .map(userId => {
                        const existingUser = existingUsers.find(user => user.id === userId);
                        const user = users.find(user => user.id === userId);
                        if (!user) return undefined;
                        return buildUserToSave(existingUser, user);
                    })
                    .compact()
                    .value();

                logger?.log({ users: buildUserWithoutPassword(usersToSend as ApiUser[]) });
                return apiToFuture(this.api.metadata.post({ users: usersToSend }))
                    .flatMap(data => {
                        return Future.sequential([
                            this.updateUserGroups(users, existingUsers, logger),
                            this.saveLocales(usersToSave),
                        ]).map(() => {
                            logger?.log(data);
                            return data;
                        });
                    })
                    .flatMapError(error => {
                        logger?.log({ error: error });
                        return Future.error(error);
                    });
            });
        });
    }

    public saveInChunks(users: User[], chunkSize: number): FutureData<void> {
        const requests = _.chunk(users, chunkSize).map(usersChunk => this.save(usersChunk));
        return Future.sequential(requests).toVoid();
    }

    private getLogger(): FutureData<Maybe<D2LoggerMessage>> {
        return this.getCurrent().flatMap(currentUser => {
            const d2ApiTracker = new D2ApiLogger(this.api);
            return d2ApiTracker.buildLogger(currentUser);
        });
    }

    //TODO: this method should be an use case or part of a existed use case because contains application business rules
    // retrieve users, update them and save them again
    public updateRoles(ids: Id[], update: NamedRef[], strategy: UpdateStrategy): FutureData<MetadataResponse> {
        return this.getByIds(ids).flatMap(storedUsers => {
            const commonRoles = _.intersectionBy(
                ...storedUsers.map(user => user.userRoles.map(role => role)),
                ({ id }) => id
            );

            const users = storedUsers.map(user => {
                const userResult = User.createExisted({
                    ...user,
                    userRoles:
                        strategy === "merge"
                            ? _.uniqBy(
                                  [..._.differenceBy(user.userRoles, commonRoles, ({ id }) => id), ...update],
                                  ({ id }) => id
                              )
                            : update,
                });

                return userResult.match({
                    success: user => {
                        return user;
                    },
                    error: errors => {
                        throw new Error(
                            `Error updating roles for user ${user.id}: ${validationErrorsToString(errors)}`
                        );
                    },
                });
            });

            return this.save(users);
        });
    }

    //TODO: this method should be an use case or part of a existed use case because contains application business rules
    // retrieve users, update them and save them again
    public updateGroups(ids: Id[], update: NamedRef[], strategy: UpdateStrategy): FutureData<MetadataResponse> {
        return this.getByIds(ids).flatMap(storedUsers => {
            const commonGroups = _.intersectionBy(
                ...storedUsers.map(user => user.userGroups.map(group => group)),
                ({ id }) => id
            );

            const users = storedUsers.map(user => {
                const userResult = User.createExisted({
                    ...user,
                    userGroups:
                        strategy === "merge"
                            ? _.uniqBy(
                                  [..._.differenceBy(user.userGroups, commonGroups, ({ id }) => id), ...update],
                                  ({ id }) => id
                              )
                            : update,
                });

                return userResult.match({
                    success: user => {
                        return user;
                    },
                    error: errors => {
                        throw new Error(`Error creating user ${user.id}: ${validationErrorsToString(errors)}`);
                    },
                });
            });

            return this.save(users);
        });
    }

    public getColumns(): FutureData<Array<keyof User>> {
        const $request = this.userStorage.getOrCreateObject<Array<keyof User>>(
            Namespaces.VISIBLE_COLUMNS,
            defaultColumns
        );
        return $request.map(columns => {
            const result = columns.length ? columns : defaultColumns;
            return result;
        });
    }

    public saveColumns(columns: Array<keyof User>): FutureData<void> {
        return this.userStorage.saveObject<Array<keyof User>>(Namespaces.VISIBLE_COLUMNS, columns);
    }

    updateUserGroups(users: ApiUser[], existing: ApiUser[], logger: Maybe<D2LoggerMessage>): FutureData<void> {
        const allUsersGroupsToUpdate = this.buildUsersByGroupId(users);
        const allExistingUsersGroups = this.buildUsersByGroupId(existing);

        const userGroupsWithUsersToAdd = getDiffUserIdsByGroup(allUsersGroupsToUpdate, allExistingUsersGroups);
        const userGroupsWithUsersToRemove = getDiffUserIdsByGroup(allExistingUsersGroups, allUsersGroupsToUpdate);

        const $requestsToAdd = this.buildRequestsGroups(userGroupsWithUsersToAdd, "add");
        const $requestsToDelete = this.buildRequestsGroups(userGroupsWithUsersToRemove, "delete");

        return Future.sequential([$requestsToAdd, $requestsToDelete]).flatMap(() => {
            const groupsIdsToAdd = userGroupsWithUsersToAdd
                .filter(group => group.usersIds.length > 0)
                .map(group => group.id);
            const groupsIdsToDelete = userGroupsWithUsersToRemove
                .filter(group => group.usersIds.length > 0)
                .map(group => group.id);

            if (logger) {
                this.logGroupChanges(logger, userGroupsWithUsersToAdd, "add");
                this.logGroupChanges(logger, userGroupsWithUsersToRemove, "delete");

                logger.log({ groupsIdsToAdd: groupsIdsToAdd, groupsIdsToDelete: groupsIdsToDelete });
            }

            return Future.success(undefined);
        });
    }

    private logGroupChanges(
        logger: D2LoggerMessage,
        groups: Array<{
            id: Id;
            usersIds: Id[];
        }>,
        action: "add" | "delete"
    ) {
        groups.forEach(group => {
            if (group.usersIds.length > 0) {
                logger.log({
                    action: action,
                    groupId: group.id,
                    userIds: group.usersIds,
                });
            }
        });
    }

    private buildRequestsGroups(
        userGroups: Array<{ id: Id; usersIds: Id[] }>,
        action: D2ActionGroup
    ): FutureData<void> {
        const $requests = userGroups.map((userGroup): FutureData<void> => {
            if (userGroup.usersIds.length === 0) return Future.success(undefined);
            return this.buildGroupsToSave(userGroup, action);
        });

        return Future.sequential($requests).toVoid();
    }

    private buildUsersByGroupId(users: ApiUser[]): D2UserGroupByKey {
        return _(users)
            .flatMap(user =>
                user.userGroups.map(group => ({
                    groupId: group.id,
                    user: user,
                }))
            )
            .groupBy(x => x.groupId)
            .mapValues(groupUsers => groupUsers.map(({ user }) => ({ id: user.id, name: user.name })))
            .value();
    }

    private buildGroupsToSave(userGroup: { id: Id; usersIds: Id[] }, action: D2ActionGroup): FutureData<void> {
        const isAdding = action === "add";
        const usersIdRefs = userGroup.usersIds.map(id => ({ id: id }));

        const patchOperations: PatchOperation[] = usersIdRefs.map(userIdRef =>
            isAdding
                ? {
                      op: "add",
                      path: "/users/-",
                      value: userIdRef,
                  }
                : {
                      op: "remove-by-id",
                      path: "/users",
                      id: userIdRef.id,
                  }
        );
        return apiToFuture(this.api.models.userGroups.patch(userGroup.id, patchOperations)).flatMap(d2Response => {
            if (d2Response.errorReports && d2Response.errorReports.length !== 0) {
                const messages =
                    d2Response.errorReports?.map((e: ErrorReport): string => e.message).filter(Boolean) ?? [];
                const errorMessage = Array.from(new Set(messages)).join("\n");
                return Future.error(errorMessage);
            } else {
                return Future.success(undefined);
            }
        });
    }

    private toDomainUser(input: ApiUserWithAudit): User {
        const { userCredentials: rawUserCredentials, ...user } = input;

        const userCredentials = rawUserCredentials ?? {};

        const userRoles = input.userRoles || userCredentials.userRoles || [];
        const username = input.username || userCredentials.username || "";

        const lastLoginRaw = input.lastLogin ?? userCredentials.lastLogin;
        const disabled: boolean = input.disabled ?? userCredentials.disabled ?? false;
        const externalAuth: boolean = input.externalAuth ?? userCredentials.externalAuth ?? false;
        const ldapId = input.ldapId ?? userCredentials.ldapId;
        const openId = input.openId ?? userCredentials.openId;

        const authorities = _(userRoles)
            .map(userRole => userRole.authorities ?? [])
            .flatten()
            .uniq()
            .value();

        const userResult = User.createExisted({
            id: user.id,
            name: user.name,
            firstName: user.firstName,
            surname: user.surname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            whatsApp: user.whatsApp,
            facebookMessenger: user.facebookMessenger,
            skype: user.skype,
            telegram: user.telegram,
            twitter: user.twitter,
            lastUpdated: new Date(user.lastUpdated),
            created: new Date(user.created),
            userGroups: _(user.userGroups)
                .orderBy(ug => ug.name)
                .value(),
            username,
            apiUrl: `${this.api.baseUrl}/api/users/${user.id}.json`,
            userRoles:
                _(userRoles)
                    .map(userRole => ({ id: userRole.id, name: userRole.name }))
                    .orderBy(ur => ur.name)
                    .value() || [],
            lastLogin: lastLoginRaw ? new Date(lastLoginRaw) : undefined,
            status: disabled ? "Disabled" : "Active",
            disabled,
            organisationUnits: this.getDomainOrgUnits(user.organisationUnits),
            dataViewOrganisationUnits: this.getDomainOrgUnits(user.dataViewOrganisationUnits),
            searchOrganisationsUnits: this.getDomainOrgUnits(user.teiSearchOrganisationUnits),
            access: user.access,
            openId,
            ldapId,
            externalAuth,
            twoFactorEnabled: userCredentials.twoFA,
            password: userCredentials.password,
            accountExpiry: userCredentials.accountExpiry,
            authorities,
            dbLocale: input.settings?.keyDbLocale ?? "",
            uiLocale: "",
            ...this.getUserAuditFields(input),
        });

        return userResult.match({
            success: user => {
                return user;
            },
            error: errors => {
                throw new Error(`Error processing user ${user.id}: ${validationErrorsToString(errors)}`);
            },
        });
    }

    private getUserAuditFields(user: ApiUserWithAudit): Pick<User, "createdBy" | "lastModifiedBy"> {
        const uc = user.userCredentials;
        const createdBy = uc?.createdBy || user.createdBy;
        const lastUpdatedBy = uc?.lastUpdatedBy || user.lastUpdatedBy;
        return {
            createdBy: createdBy ? { id: createdBy.id, username: createdBy.displayName } : undefined,
            lastModifiedBy: lastUpdatedBy ? { id: lastUpdatedBy?.id, username: lastUpdatedBy?.displayName } : undefined,
        };
    }

    private toApiUser(input: User): ApiUserWithAudit {
        return {
            id: input.id,
            name: input.name,
            username: input.username,
            openId: input.openId ?? "",
            ldapId: input.ldapId ?? "",
            firstName: input.firstName,
            surname: input.surname,
            email: input.email,
            phoneNumber: input.phoneNumber,
            whatsApp: input.whatsApp,
            facebookMessenger: input.facebookMessenger,
            skype: input.skype,
            telegram: input.telegram,
            twitter: input.twitter,
            lastUpdated: input.lastUpdated.toISOString(),
            created: input.created.toISOString(),
            // DHIS2 2.42 exposes these at root; keep populated for compatibility
            lastLogin: input.lastLogin?.toISOString() ?? "",
            disabled: input.disabled,
            externalAuth: input.externalAuth ?? false,
            userGroups: input.userGroups,
            userRoles: input.userRoles.map(userRole => ({ id: userRole.id, name: userRole.name, authorities: [] })),
            organisationUnits: this.getApiOrgUnits(input.organisationUnits),
            dataViewOrganisationUnits: this.getApiOrgUnits(input.dataViewOrganisationUnits),
            teiSearchOrganisationUnits: this.getApiOrgUnits(input.searchOrganisationsUnits),
            access: input.access,
            userCredentials: {
                id: input.id,
                username: input.username,
                userRoles: input.userRoles.map(userRole => ({ id: userRole.id, name: userRole.name, authorities: [] })),
                lastLogin: input.lastLogin?.toISOString() ?? "",
                disabled: input.disabled,
                openId: input.openId ?? "",
                ldapId: input.ldapId ?? "",
                externalAuth: input.externalAuth ?? "",
                password: input.password ?? "",
                accountExpiry: input.accountExpiry ?? "",
                twoFA: input.twoFactorEnabled ?? false,
                ...this.getApiAuditFields(input),
            },
            ...this.getApiAuditFields(input),
        };
    }

    private getApiAuditFields(user: User): D2UserAudit {
        return {
            createdBy: user.createdBy ? { id: user.createdBy.id, displayName: user.createdBy.username } : undefined,
            lastUpdatedBy: user.lastModifiedBy
                ? {
                      id: user.lastModifiedBy.id,
                      displayName: user.lastModifiedBy.username,
                  }
                : undefined,
        };
    }

    private getDomainOrgUnits(d2OrgUnits: ApiD2OrgUnit[]): OrgUnit[] {
        return d2OrgUnits.map(d2OrgUnit => ({
            ...d2OrgUnit,
            path: d2OrgUnit.path.split("/").slice(1),
        }));
    }

    private getApiOrgUnits(orgUnits: OrgUnit[]): ApiD2OrgUnit[] {
        return _.compact(
            orgUnits.map(orgUnit => {
                return orgUnit.id === "" ? undefined : { ...orgUnit, path: joinPaths(orgUnit) };
            })
        );
    }

    public getInMyOrgUnit(): FutureData<UserIdentifier[]> {
        return apiToFuture(
            this.api.models.users.get({
                fields: { id: true, displayName: true, name: true },
                paging: false,
                userOrgUnits: "true",
                includeChildren: "true",
            })
        ).map(({ objects }) => {
            return objects.map(
                user => new UserIdentifier({ id: user.id, username: user.displayName, name: user.name })
            );
        });
    }

    private recalculatePagination(options: ListOptions, is242Plus: boolean): FutureData<Maybe<Pager>> {
        // There is a bug in v41 where the pager total and pageCount are incorrect when
        // filters are applied together with userOrgUnits=true. To work around this, we recalculate
        // the pagination based on the total number of users that match the filters.
        const { onlyUsersOrgUnits, filters = {} } = options;
        const hasActiveFilters =
            Object.entries(filters).filter(
                ([_, v]) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)
            ).length > 0;
        const calculatePager = onlyUsersOrgUnits && hasActiveFilters;

        if (!calculatePager) return Future.void();

        if (is242Plus) return Future.void(); // Bug only on v41

        return Future.fromPromise(this.api.getVersion()).flatMap(version => {
            const majorVersion = getMajorVersion(version);
            if (majorVersion !== 41) return Future.void();

            console.warn("Recalculating pagination due to known DHIS2 v41 bug with userOrgUnits and filters.");

            const optionsWithoutUserIds: ListOptions = {
                ...options,
                filters: { ...options.filters, id: undefined },
            };

            return this.listAllUserIdentifiersWithVersion(optionsWithoutUserIds, false).map(userIds => {
                return {
                    page: options.page ?? 1,
                    pageSize: options.pageSize ?? 25,
                    total: userIds.length,
                    pageCount: Math.ceil(userIds.length / (options.pageSize ?? 25)),
                };
            });
        });
    }

    @cache()
    private getIs242Plus(): FutureData<boolean> {
        return Future.fromPromise(this.api.getVersion()).map(version => getMajorVersion(version) >= 42);
    }
}

const verifyPasswordResponseCodec = Codec.interface({
    response: exactly("success", "error"),
    message: string,
});

const orgUnitsFields = { id: true, name: true, code: true, path: true } as const;

const auditFields = {
    createdBy: { id: true, displayName: true },
    lastUpdatedBy: { id: true, displayName: true },
} as const;

const fields = {
    id: true,
    name: true,
    username: true,
    firstName: true,
    surname: true,
    email: true,
    phoneNumber: true,
    whatsApp: true,
    facebookMessenger: true,
    skype: true,
    telegram: true,
    twitter: true,
    lastUpdated: true,
    created: true,
    // DHIS2 2.42 exposes some credentials fields at root
    lastLogin: true,
    disabled: true,
    externalAuth: true,
    ldapId: true,
    openId: true,
    userGroups: { id: true, name: true },
    organisationUnits: orgUnitsFields,
    dataViewOrganisationUnits: orgUnitsFields,
    teiSearchOrganisationUnits: orgUnitsFields,
    userRoles: { id: true, name: true, authorities: true },
    access: {
        manage: true,
        externalize: true,
        write: true,
        read: true,
        update: true,
        delete: true,
    },
    userCredentials: {
        id: true,
        username: true,
        userRoles: { id: true, name: true, authorities: true },
        lastLogin: true,
        disabled: true,
        twoFA: true,
        openId: true,
        ldapId: true,
        externalAuth: true,
        password: true,
        accountExpiry: true,
    },
} as const;

/** POST /api/metadata defaults to mergeMode=REPLACE: the server nulls each owned property that the
 * payload omits. Request $owner, not a whitelist, to keep the properties the app does not map, such
 * as verifiedEmail. `fields` adds what $owner does not return. */
export const savePrefetchFields = {
    $owner: true,
    ...fields,
    ...auditFields,
    userCredentials: { ...fields.userCredentials, passwordLastUpdated: true, $all: true },
} as const;

export type ApiUser = SelectedPick<D2UserSchema, typeof fields>;
/* Only requested for the current user: the list queries do not need the locale */
type ApiUserSettings = { settings?: { keyDbLocale?: string } };

export type ApiUserWithAudit = ApiUser & { userCredentials: ApiUser["userCredentials"] & D2UserAudit } & D2UserAudit &
    ApiUserSettings;

export const defaultColumns: Array<keyof User> = [
    "username",
    "firstName",
    "surname",
    "email",
    "organisationUnits",
    "lastLogin",
    "disabled",
];

// in version 2.38 stats and typeReports are inside a response object
type Dhis2Response = MetadataResponse & {
    response?: {
        status: MetadataResponse["status"];
        stats: MetadataResponse["stats"];
        typeReports: MetadataResponse["typeReports"];
    };
};

type D2UserAudit = {
    createdBy?: { id: string; displayName: string };
    lastUpdatedBy?: { id: string; displayName: string };
};

type D2UserSettings = { keyDbLocale: LocaleCode; keyUiLocale: LocaleCode };
type KeyLocale = "keyUiLocale" | "keyDbLocale";
const UI_LOCALE_KEY = "keyUiLocale";
const DB_LOCALE_KEY = "keyDbLocale";
export type D2UserGroupByKey = Record<Id, NamedRef[]>;
type D2ActionGroup = "add" | "delete";
