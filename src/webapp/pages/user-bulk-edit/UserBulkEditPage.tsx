import { Button, ButtonStrip, CenteredContent, NoticeBox } from "@dhis2/ui";
import { Paper } from "@material-ui/core";
import { Delete, ViewColumn } from "@material-ui/icons";
import { IconButton } from "material-ui";
import React from "react";
import { Form } from "react-final-form";
import { Navigate } from "react-router";
import AutoSizer from "react-virtualized-auto-sizer";
import { VariableSizeGrid as Grid } from "react-window";
import styled from "styled-components";
import i18n from "../../../utils/i18n";
import { ColumnSelectorDialog } from "../../components/column-selector-dialog/ColumnSelectorDialog";
import { ImportSummary } from "../../components/import-summary/ImportSummary";
import { PageHeader } from "../../components/page-header/PageHeader";
import { RenderUserImportField } from "../../components/user-form/UserForm";
import { getUserFieldName, userFormFields } from "../../components/user-form/utils";
import { UserBulkEditFormValues, useUserBulkEdit } from "./useUserBulkEdit";

const rowHeight = (index: number) => (index === 0 ? 30 : 70);
const columnWidth = (index: number) => (index === 0 ? 50 : 250);

export const UserBulkEditPage: React.FC = () => {
    const {
        shouldRedirect,
        form,
        columns,
        columnSelectorOpen,
        summary,
        addUser,
        removeUser,
        isNewUser,
        save,
        goBack,
        close,
        changeColumns,
        openColumnSelector,
        closeColumnSelector,
        closeSummary,
    } = useUserBulkEdit();

    if (shouldRedirect) return <Navigate replace to="/" />;

    return (
        <Wrapper>
            <PageHeader onBackClick={goBack} title={i18n.t("Edit users")}>
                <IconButton
                    tooltip={i18n.t("Column settings")}
                    onClick={openColumnSelector}
                    style={{ float: "inline-end" }}
                >
                    <ViewColumn />
                </IconButton>
            </PageHeader>
            {summary ? <ImportSummary results={summary} onClose={closeSummary} /> : null}

            {columnSelectorOpen && (
                <ColumnSelectorDialog
                    columns={userFormFields}
                    visibleColumns={columns}
                    onChange={changeColumns}
                    getName={getUserFieldName}
                    onCancel={closeColumnSelector}
                />
            )}
            <Container>
                <Form<UserBulkEditFormValues>
                    autocomplete="off"
                    form={form}
                    onSubmit={save}
                    render={({ handleSubmit, values, submitError }) => (
                        <StyledForm onSubmit={handleSubmit}>
                            <MaxHeight>
                                <AutoSizer>
                                    {({ height, width }: { height: number; width: number }) => (
                                        <Grid
                                            height={height}
                                            width={width}
                                            rowCount={values.users.length + 1}
                                            columnCount={columns.length + 1}
                                            estimatedColumnWidth={250}
                                            estimatedRowHeight={70}
                                            rowHeight={rowHeight}
                                            columnWidth={columnWidth}
                                            itemData={{ columns, isNewUser, removeUser }}
                                        >
                                            {Row}
                                        </Grid>
                                    )}
                                </AutoSizer>
                            </MaxHeight>

                            {submitError && (
                                <NoticeBox title={i18n.t("Error saving users")} error={true}>
                                    {submitError}
                                </NoticeBox>
                            )}

                            <ButtonsRow middle>
                                <Button name={i18n.t("Add user")} onClick={addUser} primary>
                                    {i18n.t("Add user")}
                                </Button>
                            </ButtonsRow>

                            <ButtonsRow middle>
                                <Button type="submit" primary>
                                    {i18n.t("Save")}
                                </Button>

                                <Button type="reset" onClick={close}>
                                    {i18n.t("Close")}
                                </Button>
                            </ButtonsRow>
                        </StyledForm>
                    )}
                />
            </Container>
        </Wrapper>
    );
};

const MaxHeight = styled.div`
    height: 95%;
`;

const ButtonsRow = styled(ButtonStrip)`
    padding: 20px;

    button:focus::after {
        border-color: transparent !important;
    }
`;

const Row: React.FC<RowItemProps & { style: object }> = ({ style, ...props }) => (
    <div style={style}>
        <RowItem {...props} />
    </div>
);

interface RowItemProps {
    data: { columns: string[]; isNewUser: (row: number) => boolean; removeUser: (row: number) => void };
    columnIndex: number;
    rowIndex: number;
}

const RowItem: React.FC<RowItemProps> = ({ data, columnIndex, rowIndex }) => {
    const headerRow = rowIndex === 0;
    const deleteRow = columnIndex === 0;
    const row = rowIndex - 1;
    const field = data.columns[columnIndex - 1];

    if (deleteRow) {
        return headerRow ? null : (
            <CenteredContent>
                <IconButton
                    tooltip={i18n.t("Delete")}
                    tooltipPosition="top-center"
                    onClick={() => data.removeUser(row)}
                >
                    <Delete />
                </IconButton>
            </CenteredContent>
        );
    }

    if (!field) return null;

    if (headerRow) {
        return (
            <CenteredContent>
                <Title>{getUserFieldName(field)}</Title>
            </CenteredContent>
        );
    }

    return (
        <Item>
            <RenderUserImportField row={row} field={field} isEdit={!data.isNewUser(row)} />
        </Item>
    );
};

const Wrapper = styled.div`
    margin: 20px;
`;

const StyledForm = styled.form`
    height: 71vh;
`;

const Container = styled(Paper)`
    margin: 20px;
    padding: 40px;
`;

const Item = styled.div`
    margin-block: 4px;
    margin-inline: 0;
    padding: 10px;
`;

const Title = styled.b``;
