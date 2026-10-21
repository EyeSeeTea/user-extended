import { UseCase } from "../../CompositionRoot";
import i18n from "../../utils/i18n";
import { Future, FutureData } from "../entities/Future";
import { UserToSave } from "../entities/UserProps";
import { User } from "../entities/User";
import { UserRepository } from "../repositories/UserRepository";
import { MetadataResponse } from "../../types/d2-api";
import { isUniqueOpenId } from "../utils/isUniqueOpenId";
import { makeErrorMessageFromValidationErrors, ValidationError } from "../errors/Errors";

export class SaveUsersUseCase implements UseCase {
    constructor(private userRepository: UserRepository) {}

    public execute(usersToSave: UserToSave[]): FutureData<MetadataResponse> {
        if (!isUniqueOpenId(usersToSave)) return Future.error(i18n.t("Open IDs must be unique"));

        const results = usersToSave.map((userProps, index) => {
            const result = userProps.id === undefined ? User.createNew(userProps) : User.createExisted(userProps);
            return { index, userProps, result };
        });
        const errors = results.flatMap(({ index, userProps, result }) =>
            result.match({
                success: () => [],
                error: validationErrors => [formatUserErrors(userProps, index, validationErrors)],
            })
        );

        return errors.length > 0
            ? Future.error(errors.join("\n"))
            : this.userRepository.save(results.map(({ result }) => result.getOrThrow()));
    }
}

function formatUserErrors(user: UserToSave, index: number, errors: ValidationError<User>[]): string {
    const identifier = user.username || user.name || i18n.t("Row {{row}}", { row: index + 1 });
    return `${identifier}: ${makeErrorMessageFromValidationErrors(errors)}`;
}
