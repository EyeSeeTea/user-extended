import _ from "lodash";
import { Instance } from "../data/entities/Instance";
import { OrgUnit } from "../domain/entities/OrgUnit";
import { D2Api } from "../types/d2-api";

export function getMajorVersion(version: string): number {
    const apiVersion = _.get(version.split("."), 1);
    if (!apiVersion) throw new Error(`Invalid version: ${version}`);
    return Number(apiVersion);
}

/* DHIS2 2.43 added a native description field to user groups, the source that replaces
 * the metadata attribute configured in the settings. */
export function hasNativeUserGroupDescription(version: string): boolean {
    return getMajorVersion(version) >= 43;
}

export function getD2ApiFromInstance(instance: Instance) {
    return new D2Api({ baseUrl: instance.url, auth: instance.auth, backend: "fetch" });
}

export const orgUnitListParams = {
    fields: {
        id: true,
        level: true,
        displayName: true,
        path: true,
        children: true,
        shortName: true,
    },
};

export const orgUnitControls = {
    filterByLevel: false,
    filterByGroup: false,
    filterByProgram: false,
    selectAll: false,
};

export function joinPaths(orgUnit: OrgUnit): string {
    return `/${orgUnit.path.join("/")}`;
}

export function extractIdFromPath(orgUnitPath?: string): string {
    return _(orgUnitPath).split("/").last() ?? "";
}

export function extractIdsFromPaths(orgUnitPaths: string[]): string[] {
    return orgUnitPaths.map(extractIdFromPath);
}
