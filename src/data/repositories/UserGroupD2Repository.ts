import _ from "lodash";
import { Codec, GetType, optional, record, string } from "purify-ts";
import { D2Api } from "../../types/d2-api";
import { Future, FutureData } from "../../domain/entities/Future";
import { PaginatedResponse } from "../../domain/entities/PaginatedResponse";
import { UserGroup } from "../../domain/entities/UserGroup";
import { apiToFuture } from "../../utils/futures";
import { GetUsersGroupsOptions, UserGroupRepository } from "../../domain/repositories/UserGroupRepository";
import { Id } from "../../domain/entities/Ref";
import { LocaleCode } from "../../domain/entities/UserProps";
import { Maybe } from "../../types/utils";

export class UserGroupD2Repository implements UserGroupRepository {
    constructor(private api: D2Api) {}

    getAll(): FutureData<UserGroup[]> {
        return apiToFuture(
            this.api.models.userGroups
                .get({ fields: { id: true, displayName: true }, paging: false })
                .map(res =>
                    res.data.objects.map(({ id, displayName }) =>
                        UserGroup.create({ id, name: displayName, description: undefined, users: [] })
                    )
                )
        );
    }

    get(options: GetUsersGroupsOptions): FutureData<PaginatedResponse<UserGroup>> {
        const groupsToHide = options.hideGroups ? options.hideGroups : [];
        return apiToFuture(
            this.api.models.userGroups.get({
                fields: { id: true, displayName: true, users: { id: true, displayName: true } },
                filter: {
                    name: { ilike: options.search },
                    "users.id": { in: options.usersIds ?? undefined },
                    id: { "!in": groupsToHide.length > 0 ? groupsToHide : undefined },
                    users: options.hideEmptyUsers ? { gt: "0" } : undefined,
                },
                rootJunction: "OR",
                page: options.page,
                pageSize: options.pageSize,
                order: `${options.sorting.field}:${options.sorting.order}`,
            })
        ).map(response => {
            return {
                objects: response.objects.map(d2Group => {
                    return UserGroup.create({
                        id: d2Group.id,
                        name: d2Group.displayName,
                        description: undefined,
                        users: _(d2Group.users)
                            .map(d2User => {
                                if (options.hideUsers?.includes(d2User.id)) return undefined;
                                return { id: d2User.id, name: d2User.displayName };
                            })
                            .compact()
                            .sortBy(user => user.name)
                            .value(),
                    });
                }),
                pager: response.pager,
            };
        });
    }

    getAllBy(options: {
        hideUsers: Id[];
        hideGroups: Id[];
        descriptionSource: Maybe<string>;
        descriptionHasTranslations: boolean;
        localeCode: LocaleCode;
    }): FutureData<UserGroup[]> {
        return this.getAllUserGroups({
            initialPage: 1,
            pageSize: 100,
            descriptionSource: options.descriptionSource,
        }).map(d2UserGroups => {
            return d2UserGroups
                .filter(group => !options.hideGroups.includes(group.id))
                .map(group => {
                    const filteredUsers = group.users.filter(user => !options.hideUsers.includes(user.id));
                    return UserGroup.create({
                        id: group.id,
                        name: group.displayName,
                        description: getDescription(group, {
                            descriptionSource: options.descriptionSource,
                            hasTranslations: options.descriptionHasTranslations,
                            localeCode: options.localeCode,
                        }),
                        users: filteredUsers.map(user => ({ id: user.id, name: user.displayName })),
                    });
                });
        });
    }

    private getAllUserGroups(options: {
        initialPage: number;
        pageSize: number;
        descriptionSource: Maybe<string>;
    }): FutureData<D2ApiUserGroup[]> {
        const { initialPage, pageSize, descriptionSource } = options;

        const fetchByPage = (page: number): FutureData<D2ApiUserGroup[]> => {
            return this.getUserGroupsPage({ page, pageSize, descriptionSource }).flatMap(response => {
                const userGroups = response.objects;
                if (response.pager.page < response.pager.pageCount) {
                    return fetchByPage(page + 1).map(nextUserGroups => userGroups.concat(nextUserGroups));
                } else {
                    return Future.success(userGroups);
                }
            });
        };

        return fetchByPage(initialPage);
    }

    /* attributeValues is only needed to resolve the description, so instances without a configured
     * source do not pay for that extra payload on every load of the tab. */
    private getUserGroupsPage(options: {
        page: number;
        pageSize: number;
        descriptionSource: Maybe<string>;
    }): FutureData<D2ApiUserGroupsPage> {
        const { page, pageSize, descriptionSource } = options;
        const fields = { id: true, displayName: true, users: { id: true, displayName: true } };

        return descriptionSource
            ? apiToFuture(
                  this.api.models.userGroups.get({
                      fields: { ...fields, attributeValues: { value: true, attribute: { id: true } } },
                      page,
                      pageSize,
                  })
              )
            : apiToFuture(this.api.models.userGroups.get({ fields, page, pageSize }));
    }
}

type D2ApiUserGroupsPage = {
    objects: D2ApiUserGroup[];
    pager: { page: number; pageCount: number };
};

type D2ApiUserGroup = {
    id: string;
    displayName: string;
    users: Array<{
        id: string;
        displayName: string;
    }>;
    /* Only present when a description source is configured */
    attributeValues?: Array<{
        value: string;
        attribute: { id: string };
    }>;
};

/* The description source is an opaque handle for the domain: here it is resolved
 * as the id of the metadata attribute holding the description. */
function getDescription(
    d2UserGroup: D2ApiUserGroup,
    options: { descriptionSource: Maybe<string>; hasTranslations: boolean; localeCode: LocaleCode }
): Maybe<string> {
    const { descriptionSource, hasTranslations, localeCode } = options;
    if (!descriptionSource) return undefined;

    const rawValue = d2UserGroup.attributeValues?.find(
        attributeValue => attributeValue.attribute.id === descriptionSource
    )?.value;

    return resolveUserGroupDescription({ rawValue, hasTranslations, localeCode });
}

const translatedDescriptionCodec = Codec.interface({
    default: optional(string),
    translations: optional(record(string, string)),
});

type TranslatedDescription = GetType<typeof translatedDescriptionCodec>;

/* A locale code can carry a region (pt_BR), while translations are usually keyed by
 * language only, so the base language is tried too. */
const LOCALE_SEPARATORS = /[_-]/;

export function resolveUserGroupDescription(options: {
    rawValue: Maybe<string>;
    hasTranslations: boolean;
    localeCode: LocaleCode;
}): Maybe<string> {
    const { rawValue, hasTranslations, localeCode } = options;

    if (!hasTranslations) return rawValue;

    return translatedDescriptionCodec
        .decode(parseJson(rawValue))
        .map(description => resolveTranslation(description, localeCode))
        .orDefault(undefined);
}

/* An attribute holding plain text while the setting is on is not an error the admin
 * can act on from the table, so the cell stays empty instead of showing the raw value. */
function parseJson(rawValue: Maybe<string>): unknown {
    try {
        return JSON.parse(rawValue ?? "");
    } catch {
        return undefined;
    }
}

function resolveTranslation(description: TranslatedDescription, localeCode: LocaleCode): Maybe<string> {
    const translations = description.translations ?? {};
    const baseLanguage = localeCode.split(LOCALE_SEPARATORS)[0] ?? localeCode;

    return [translations[localeCode], translations[baseLanguage], description.default]
        .map(candidate => candidate?.trim())
        .find(candidate => Boolean(candidate));
}
