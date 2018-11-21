"use strict";

import * as proc from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {

    if (isEnabled() === false) {
        console.log("brittany extension disabled; not registering it.");
        return;
    } else {
        console.log("registering brittany extension");
    }

    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider("haskell", {
        provideDocumentRangeFormattingEdits(document: vscode.TextDocument,
                                            range: vscode.Range): Thenable<vscode.TextEdit[]> {

            if (isEnabled() === false) {
                return new Promise((resolve, reject) => {
                    return reject([]);
                });
            }

            // if document has CRLF line endings, change it to LF for the duration of the format.
            if (document.eol === vscode.EndOfLine.CRLF) {
                console.log("temporarily changing line endings to LF");
                const LF: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
                const CRLF: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
                LF.set(document.uri, [vscode.TextEdit.setEndOfLine(vscode.EndOfLine.LF)]);
                CRLF.set(document.uri, [vscode.TextEdit.setEndOfLine(vscode.EndOfLine.CRLF)]);
                vscode.workspace.applyEdit(LF)
                    .then(() => vscode.commands.executeCommand("workbench.action.files.saveWithoutFormatting"))
                    .then(() => vscode.commands.executeCommand("editor.action.formatDocument"))
                    .then(() => vscode.workspace.applyEdit(CRLF))
                    .then(() => vscode.commands.executeCommand("workbench.action.files.saveWithoutFormatting"));
                return;
            }

            console.log("brittany asked to format");

            // if we're formatting the whole document
            // brittany operates on files only, so we need to
            // improvement TODO: Instead of making a tmp file, pass the source code into STDIN.
            // could also potentially unify this approach with the full-file approach.
            if (range.isEqual(fullDocumentRange(document))) {
                if (document.isDirty) {
                    vscode.commands.executeCommand("workbench.action.files.saveWithoutFormatting")
                        .then(() => vscode.commands.executeCommand("editor.action.formatDocument"))
                        .then(() => vscode.commands.executeCommand("workbench.action.files.saveWithoutFormatting"));
                } else {
                    return runBrittany(document, range, document.uri.fsPath, null);
                }
            } else {
                const substring: string = document.getText(range);
                const tmpobj: tmp.SynchrounousResult = tmp.fileSync();
                console.log("brittany: Temporary file: ", tmpobj.name);
                return new Promise((resolve, reject) => {
                    fs.write(tmpobj.fd, substring, (err: NodeJS.ErrnoException, written: number, str: string) => {
                        if (err) {
                            return reject(err);
                        } else {
                            return resolve(runBrittany(document, range, tmpobj.name, tmpobj));
                        }
                    });
                });
            }
        },
    }));
}

function runBrittany(document: vscode.TextDocument, range: vscode.Range,
                     inputFilename: string, tmpobj: tmp.SynchrounousResult): Thenable<vscode.TextEdit[]> {
    return new Promise((resolve, reject) => {

        const cmd: string = isStackEnabled()
            ? `stack exec brittany \"${inputFilename}\" --  ${additionalFlags()}`
            : `${brittanyCmd()} \"${inputFilename}\" ${additionalFlags()}`;
        const maybeWorkspaceFolder: vscode.WorkspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const dir: string = maybeWorkspaceFolder !== undefined
            ? maybeWorkspaceFolder.uri.fsPath
            : path.dirname(document.uri.fsPath);
        const options
            : { cwd: string, encoding: string }
            = { cwd: dir, encoding: "utf8" };

        console.log("brittany command is: " + cmd);
        console.log("brittany folder is: " + dir);

        proc.exec(
            cmd,
            options,
            (error: Error, stdout: string, stderr: string) => {
                if (error) {
                    if (tmpobj) { tmpobj.removeCallback(); }
                    console.error("Error running brittany:");
                    console.error(error);
                    console.error(stdout);
                    console.error(stderr);
                    vscode.window.showErrorMessage(
                        "Failed to run brittany; see the developer tools console for details. " +
                        error
                    );
                    return reject([]);
                } else {
                    if (tmpobj) { tmpobj.removeCallback(); }
                    return resolve([vscode.TextEdit.replace(range, stdout)]);
                }
            },
        );
    });
}

function brittanyCmd(): string {
    return vscode.workspace.getConfiguration("brittany").path;
}

function additionalFlags(): string {
    return vscode.workspace.getConfiguration("brittany").additionalFlags;
}

function isEnabled(): boolean {
    return vscode.workspace.getConfiguration("brittany").enable;
}

function isStackEnabled(): boolean {
    return vscode.workspace.getConfiguration("brittany").stackEnable;
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
    const lastLineId: number = document.lineCount - 1;
    return new vscode.Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length);
}
