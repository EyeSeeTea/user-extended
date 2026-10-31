import { describe, it, expect } from "vitest";
import { resolveUserGroupDescription } from "../UserGroupD2Repository";
import { Maybe } from "../../../types/utils";

const DEFAULT_DESCRIPTION = "Users of Abbs Project";
const FRENCH_DESCRIPTION = "Utilisateurs du projet Abbs";
const PORTUGUESE_DESCRIPTION = "Usuários do projeto Abbs";

const translatedValue = JSON.stringify({
    default: DEFAULT_DESCRIPTION,
    translations: { fr: FRENCH_DESCRIPTION, pt: PORTUGUESE_DESCRIPTION },
});

describe("resolveUserGroupDescription", () => {
    describe("with the translations setting off", () => {
        it("returns the raw value untouched when it is plain text", () => {
            expect(resolve({ rawValue: DEFAULT_DESCRIPTION, hasTranslations: false })).toBe(DEFAULT_DESCRIPTION);
        });

        it("returns the raw value untouched when it is a JSON with translations", () => {
            expect(resolve({ rawValue: translatedValue, hasTranslations: false, localeCode: "fr" })).toBe(
                translatedValue
            );
        });
    });

    describe("with the translations setting on", () => {
        it("resolves the translation of the exact locale", () => {
            expect(resolve({ rawValue: translatedValue, localeCode: "fr" })).toBe(FRENCH_DESCRIPTION);
        });

        it("resolves the base language when the locale carries a region", () => {
            expect(resolve({ rawValue: translatedValue, localeCode: "pt_BR" })).toBe(PORTUGUESE_DESCRIPTION);
        });

        it("falls back to the default when there is no translation for the locale", () => {
            expect(resolve({ rawValue: translatedValue, localeCode: "es" })).toBe(DEFAULT_DESCRIPTION);
        });

        it("falls back to the default when the translation of the locale is blank", () => {
            const rawValue = JSON.stringify({ default: DEFAULT_DESCRIPTION, translations: { fr: "   " } });

            expect(resolve({ rawValue, localeCode: "fr" })).toBe(DEFAULT_DESCRIPTION);
        });

        it("returns undefined for a value that is not valid JSON", () => {
            expect(resolve({ rawValue: DEFAULT_DESCRIPTION, localeCode: "fr" })).toBeUndefined();
        });

        it("returns undefined for a valid JSON that does not match the expected shape", () => {
            expect(resolve({ rawValue: JSON.stringify({ default: 5 }), localeCode: "fr" })).toBeUndefined();
        });

        it("returns undefined when neither a translation nor a default applies", () => {
            const rawValue = JSON.stringify({ translations: { fr: FRENCH_DESCRIPTION } });

            expect(resolve({ rawValue, localeCode: "es" })).toBeUndefined();
        });
    });

    describe("for an attribute without a value", () => {
        it("returns undefined for a blank value", () => {
            expect(resolve({ rawValue: "   " })).toBeUndefined();
        });

        it("returns undefined for a missing value", () => {
            expect(resolve({ rawValue: undefined })).toBeUndefined();
            expect(resolve({ rawValue: null })).toBeUndefined();
        });
    });
});

function resolve(options: { rawValue: Maybe<string>; hasTranslations?: boolean; localeCode?: string }): Maybe<string> {
    return resolveUserGroupDescription({
        rawValue: options.rawValue,
        hasTranslations: options.hasTranslations ?? true,
        localeCode: options.localeCode ?? "en",
    });
}
