import React from "react";
import styled from "styled-components";
import { Dropdown, DropdownItem } from "@eyeseetea/d2-ui-components";
import { FormControlLabel, Switch, Typography } from "@material-ui/core";
import i18n from "../../../utils/i18n";
import { NamedRef } from "../../../domain/entities/Ref";
import { Maybe } from "../../../types/utils";
import { useAppContext } from "../../contexts/app-context";

type UserGroupDescriptionSourceSelectProps = {
    value: Maybe<string>;
    onChange: (value: Maybe<string>) => void;
    hasTranslations: boolean;
    onHasTranslationsChange: (value: boolean) => void;
};

const TRANSLATIONS_EXAMPLE =
    '{"default": "Users of Abbs Project", "translations": {"fr": "Utilisateurs du projet Abbs", "es": "Usuarios del proyecto Abbs"}}';

export const UserGroupDescriptionSourceSelect: React.FC<UserGroupDescriptionSourceSelectProps> = React.memo(props => {
    const { value, onChange, hasTranslations, onHasTranslationsChange } = props;
    const { compositionRoot } = useAppContext();
    const [sources, setSources] = React.useState<NamedRef[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        return compositionRoot.userGroups.getDescriptionSources().run(
            sources => {
                setSources(sources);
                setIsLoading(false);
            },
            error => {
                console.error(error);
                setIsLoading(false);
            }
        );
    }, [compositionRoot.userGroups]);

    const items = React.useMemo((): DropdownItem[] => {
        return sources.map(source => ({ value: source.id, text: source.name }));
    }, [sources]);

    const hasNoSources = !isLoading && sources.length === 0;

    /* The attribute may have been deleted in DHIS2 after being configured here: the dropdown
     * shows an empty value and the description column stays empty, so warn about it. */
    const isSourceMissing = !isLoading && !!value && !sources.some(source => source.id === value);

    return (
        <Container>
            <Row>
                <DropdownContainer>
                    <Dropdown
                        items={items}
                        label={i18n.t("User group description")}
                        onChange={onChange}
                        value={value ?? undefined}
                    />
                </DropdownContainer>
                <FormControlLabel
                    control={
                        <Switch
                            checked={hasTranslations}
                            disabled={!value}
                            onChange={event => onHasTranslationsChange(event.target.checked)}
                        />
                    }
                    label={i18n.t("Attribute in JSON format with translations")}
                />
            </Row>
            {isSourceMissing && (
                <Typography variant="caption" color="error">
                    {i18n.t(
                        "The configured attribute no longer exists in this instance. Select another one or the Description column will stay empty."
                    )}
                </Typography>
            )}
            {hasTranslations && (
                <>
                    <Example>{TRANSLATIONS_EXAMPLE}</Example>
                    <Typography variant="caption">
                        {i18n.t(
                            "The value of the attribute is read as a JSON with translations, shown in the database language of each user. Without a translation for that language it falls back to the default of the JSON, and a plain text value leaves the Description column empty."
                        )}
                    </Typography>
                </>
            )}
            <Typography variant="caption">
                {hasNoSources
                    ? i18n.t(
                          "This instance has no attributes for user groups. Create one in the Maintenance app to be able to show descriptions."
                      )
                    : i18n.t("Attribute used as the description of a user group. Without one, the column is hidden.")}
            </Typography>
        </Container>
    );
});

const Container = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    max-width: 45em;
    padding-block-end: 1.5em;
    position: relative;
`;

/* The label is long enough to wrap onto the value when the dropdown shrinks in the row */
const DropdownContainer = styled.div`
    min-width: 20em;
`;

const Row = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 1em;
`;

const Example = styled.code`
    font-family: monospace;
    font-size: 0.75em;
    overflow-wrap: anywhere;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    padding: 0.5em;
`;
