import { UserProps } from "../entities/UserProps";

export function isUniqueOpenId(users: Array<Pick<UserProps, "openId">>): boolean {
    const allOpenIds = users.filter(user => Boolean(user.openId)).map(user => user.openId);
    return new Set(allOpenIds).size === allOpenIds.length;
}
