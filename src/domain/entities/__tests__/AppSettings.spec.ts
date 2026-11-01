import { describe, it, expect } from "vitest";
import { AppSettings, SettingsGroupColumn } from "../AppSettings";
import { Maybe } from "../../../types/utils";

const descriptionSource = "attribute-id";

describe("AppSettings", () => {
    describe("availableGroupColumns", () => {
        it("removes the description column when no source is configured", () => {
            const settings = givenSettings({
                groupColumns: [
                    { field: "name", value: "mandatory" },
                    { field: "description", value: "visible" },
                    { field: "users", value: "optional" },
                ],
            });

            expect(settings.availableGroupColumns).toEqual([
                { field: "name", value: "mandatory" },
                { field: "users", value: "optional" },
            ]);
        });

        it("keeps every column, disabled ones included, when a source is configured", () => {
            const settings = givenSettings({
                groupColumns: [
                    { field: "name", value: "mandatory" },
                    { field: "description", value: "disabled" },
                    { field: "users", value: "optional" },
                ],
                descriptionSource: descriptionSource,
            });

            expect(settings.availableGroupColumns).toEqual([
                { field: "name", value: "mandatory" },
                { field: "description", value: "disabled" },
                { field: "users", value: "optional" },
            ]);
        });
    });

    describe("userGroupDescriptionHasTranslations", () => {
        it("is off in the default settings, so the attribute is read as plain text", () => {
            expect(AppSettings.defaultSettings("active").userGroupDescriptionHasTranslations).toBe(false);
        });

        it("is turned on by its updater without touching the configured source", () => {
            const settings = givenSettings({
                groupColumns: [{ field: "description", value: "visible" }],
                descriptionSource: descriptionSource,
            }).updateUserGroupDescriptionHasTranslations(true);

            expect(settings.userGroupDescriptionHasTranslations).toBe(true);
            expect(settings.userGroupDescriptionSource).toBe(descriptionSource);
        });
    });

    describe("searchableGroupColumns", () => {
        it("excludes the columns disabled in the settings", () => {
            const settings = givenSettings({
                groupColumns: [
                    { field: "name", value: "mandatory" },
                    { field: "description", value: "disabled" },
                    { field: "users", value: "optional" },
                ],
                descriptionSource: descriptionSource,
            });

            expect(settings.searchableGroupColumns).toEqual(["name", "users"]);
        });

        it("includes the description when it is enabled and has a source", () => {
            const settings = givenSettings({
                groupColumns: [
                    { field: "name", value: "mandatory" },
                    { field: "description", value: "optional" },
                    { field: "users", value: "visible" },
                ],
                descriptionSource: descriptionSource,
            });

            expect(settings.searchableGroupColumns).toEqual(["name", "description", "users"]);
        });

        it("excludes the description when it is enabled but has no source", () => {
            const settings = givenSettings({
                groupColumns: [
                    { field: "name", value: "mandatory" },
                    { field: "description", value: "visible" },
                    { field: "users", value: "visible" },
                ],
            });

            expect(settings.searchableGroupColumns).toEqual(["name", "users"]);
        });
    });
});

function givenSettings(options: {
    groupColumns: SettingsGroupColumn[];
    descriptionSource?: Maybe<string>;
}): AppSettings {
    return AppSettings.defaultSettings("active")
        .updateGroupColumns(options.groupColumns)
        .updateUserGroupDescriptionSource(options.descriptionSource);
}
