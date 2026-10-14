import { D2Api } from "../../types/d2-api";
import { AppSettings, CONSTANT_SETTINGS_CODE } from "../../domain/entities/AppSettings";
import { FutureData } from "../../domain/entities/Future";
import { AppSettingsRepository } from "../../domain/repositories/AppSettingsRepository";
import { apiToFuture } from "../../utils/futures";
import { Maybe } from "../../types/utils";
import { getUid } from "../../utils/uid";
import { InmemoryCache } from "../cache/InmemoryCache";
import { mergeAndAddRuntimeProps, removeRuntimeLogic } from "./common/appSettingsHelpers";

export class AppSettingsD2ConstantRepository implements AppSettingsRepository {
    private constantCode = CONSTANT_SETTINGS_CODE;
    private readonly cacheKey = "settings";
    private readonly cache = new InmemoryCache<AppSettings>();

    constructor(private api: D2Api) {}

    get(): FutureData<AppSettings> {
        return this.cache.getOrFuture(this.cacheKey, this.getSettings());
    }

    save(appSettings: AppSettings): FutureData<AppSettings> {
        const settingsToSave = removeRuntimeLogic(appSettings);

        return apiToFuture(
            this.api.models.constants.get({
                fields: { $owner: true },
                filter: { code: { eq: this.constantCode } },
                paging: false,
            })
        ).flatMap(response => {
            const d2Constant = response.objects[0];
            const name = "User Extended settings storage";
            const constantToSave = {
                ...(d2Constant || {}),
                id: d2Constant?.id ?? getUid("appsettings"),
                code: this.constantCode,
                name,
                shortName: name,
                description: JSON.stringify(settingsToSave, null, 2),
                value: 1,
            };
            return apiToFuture(this.api.metadata.post({ constants: [constantToSave] })).map(() => {
                this.cache.set(this.cacheKey, appSettings);
                return appSettings;
            });
        });
    }

    private getSettings() {
        return this.getConstant().map(d2Response => mergeAndAddRuntimeProps(d2Response));
    }

    private getConstant(): FutureData<Maybe<AppSettings>> {
        return apiToFuture(
            this.api.models.constants.get({
                fields: { id: true, description: true, code: true, name: true },
                filter: {
                    code: { eq: this.constantCode },
                },
            })
        ).map(response => {
            const d2Constant = response.objects[0];
            if (!d2Constant) return undefined;
            return JSON.parse(d2Constant.description) as AppSettings; //TODO: Type checking with Codec
        });
    }
}
