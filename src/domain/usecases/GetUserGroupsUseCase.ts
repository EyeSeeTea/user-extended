import { AppSettings } from "../entities/AppSettings";
import { Future, FutureData } from "../entities/Future";
import { UserGroup } from "../entities/UserGroup";
import { LocaleCode, UserProps } from "../entities/UserProps";
import { AppSettingsRepository } from "../repositories/AppSettingsRepository";
import { UserGroupRepository } from "../repositories/UserGroupRepository";
import { UserRepository } from "../repositories/UserRepository";
import { getAppSettings } from "./common/settings";
import { excludeUsers } from "./common/utils";

export class GetUserGroupsUseCase {
    constructor(
        private userGroupRepository: UserGroupRepository,
        private appSettingsRepository: AppSettingsRepository,
        private userRepository: UserRepository
    ) {}

    execute(options: { user: UserProps; excludeUsersOutsideOrgUnits: boolean }): FutureData<UserGroup[]> {
        return getAppSettings(this.appSettingsRepository, options.user).flatMap(appSettings => {
            if (!options.excludeUsersOutsideOrgUnits) return this.getGroups(appSettings, options.user.dbLocale);

            return this.getOrgUnitsAndGroups(appSettings, options.user.dbLocale).map(({ usersInMyOrgUnit, groups }) => {
                const groupsWithOutUsers = excludeUsers(usersInMyOrgUnit, groups);
                return groupsWithOutUsers;
            });
        });
    }

    private getOrgUnitsAndGroups(appSettings: AppSettings, localeCode: LocaleCode) {
        return Future.joinObj({
            usersInMyOrgUnit: this.userRepository.getInMyOrgUnit(),
            groups: this.getGroups(appSettings, localeCode),
        });
    }

    private getGroups(appSettings: AppSettings, localeCode: LocaleCode): FutureData<UserGroup[]> {
        return this.userGroupRepository.getAllBy({
            hideUsers: appSettings.hide.users,
            hideGroups: appSettings.hide.userGroups,
            descriptionSource: appSettings.userGroupDescriptionSource,
            descriptionHasTranslations: appSettings.userGroupDescriptionHasTranslations,
            localeCode,
        });
    }
}
