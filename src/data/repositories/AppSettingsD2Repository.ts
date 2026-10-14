import { D2Api } from "../../types/d2-api";
import { AppSettings } from "../../domain/entities/AppSettings";
import { FutureData } from "../../domain/entities/Future";
import { AppSettingsRepository } from "../../domain/repositories/AppSettingsRepository";
import { DataStoreStorageClient } from "../clients/storage/DataStoreStorageClient";
import { Instance } from "../entities/Instance";
import { InmemoryCache } from "../cache/InmemoryCache";
import { mergeAndAddRuntimeProps, removeRuntimeLogic } from "./common/appSettingsHelpers";

export class AppSettingsD2Repository implements AppSettingsRepository {
    private dataStorage: DataStoreStorageClient;
    private settingsKey = "settings";
    private readonly cache = new InmemoryCache<AppSettings>();

    constructor(private api: D2Api) {
        this.dataStorage = new DataStoreStorageClient("global", new Instance({ url: this.api.baseUrl }));
    }

    get(): FutureData<AppSettings> {
        return this.cache.getOrFuture(this.settingsKey, this.getSettings());
    }

    save(appSettings: AppSettings): FutureData<AppSettings> {
        const settingsToSave = removeRuntimeLogic(appSettings);
        return this.dataStorage.saveObject(this.settingsKey, settingsToSave).map(() => {
            this.cache.set(this.settingsKey, appSettings);
            return appSettings;
        });
    }

    private getSettings() {
        return this.dataStorage
            .getObject<Partial<AppSettings>>(this.settingsKey)
            .map(d2Response => mergeAndAddRuntimeProps(d2Response));
    }
}
