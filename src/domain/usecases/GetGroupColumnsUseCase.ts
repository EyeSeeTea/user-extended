import { FutureData } from "../entities/Future";
import { AppSettingsRepository } from "../repositories/AppSettingsRepository";
import { UserProps } from "../entities/UserProps";
import { GroupColumnRepository } from "../repositories/GroupColumnRepository";
import { GroupColumnSetting } from "../entities/GroupColumn";
import { resolveColumns } from "./common/columns";

export class GetGroupColumnsUseCase {
    constructor(
        private columnRepository: GroupColumnRepository,
        private appSettingsRepository: AppSettingsRepository
    ) {}

    execute(user: UserProps, options: { hasNativeDescription: boolean }): FutureData<GroupColumnSetting[]> {
        return this.appSettingsRepository.get().flatMap(appSettings => {
            return this.columnRepository.get().map(groupColumnsPreferences => {
                return resolveColumns({
                    columnsConfig: appSettings.availableGroupColumns(options.hasNativeDescription),
                    preferences: groupColumnsPreferences,
                    user: user,
                    buildColumn: (fieldName, state, position) => ({ fieldName, state, position }),
                });
            });
        });
    }
}
