import { Maybe } from "../../types/utils";
import { FutureData } from "../entities/Future";
import { CommonFilterParams, PaginatedResponse } from "../entities/PaginatedResponse";
import { Id } from "../entities/Ref";
import { UserGroup } from "../entities/UserGroup";
import { LocaleCode, UserProps } from "../entities/UserProps";

export interface UserGroupRepository {
    getAll(): FutureData<UserGroup[]>;
    get(options: GetUsersGroupsOptions): FutureData<PaginatedResponse<UserGroup>>;
    getAllBy(options: {
        hideUsers: Maybe<Id[]>;
        hideGroups: Maybe<Id[]>;
        descriptionSource: Maybe<string>;
        descriptionHasTranslations: boolean;
        localeCode: LocaleCode;
    }): FutureData<UserGroup[]>;
}

export type GetUsersGroupsOptions = CommonFilterParams & {
    excludeUsersOutsideOrgUnits: boolean;
    usersIds: Maybe<Id[]>;
    hideUsers: Maybe<Id[]>;
    hideGroups: Maybe<Id[]>;
    user: UserProps;
    hideEmptyUsers: boolean;
};
