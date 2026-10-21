import { describe, expect, it } from "vitest";
import { defaultUserProps, newUserProps } from "../UserProps";

describe("newUserProps", () => {
    it("does not assign an identifier before the user becomes a domain entity", () => {
        const user = newUserProps();

        expect(user.id).toBeUndefined();
    });

    it("sets its own creation and update dates", () => {
        const beforeCreation = new Date();
        const user = newUserProps();
        const afterCreation = new Date();

        expect(user.created.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
        expect(user.created.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
        expect(user.lastUpdated).toEqual(user.created);
        expect(user.created).not.toBe(defaultUserProps.created);
        expect(user.lastUpdated).not.toBe(defaultUserProps.lastUpdated);
    });

    it("starts without references, authorities or password", () => {
        const user = newUserProps();

        expect({
            userRoles: user.userRoles,
            userGroups: user.userGroups,
            organisationUnits: user.organisationUnits,
            dataViewOrganisationUnits: user.dataViewOrganisationUnits,
            searchOrganisationsUnits: user.searchOrganisationsUnits,
            authorities: user.authorities,
            password: user.password,
            createdBy: user.createdBy,
            lastModifiedBy: user.lastModifiedBy,
        }).toEqual({
            userRoles: [],
            userGroups: [],
            organisationUnits: [],
            dataViewOrganisationUnits: [],
            searchOrganisationsUnits: [],
            authorities: [],
            password: "",
            createdBy: undefined,
            lastModifiedBy: undefined,
        });
    });
});
