'use strict';

import * as vscode from 'vscode';
import * as proc from 'child_process';
import * as path from 'path';
import * as tmp from 'tmp';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated

    if (isEnabled() === false) {
        console.log("brittany extension disabled; not registering it.");
        return;
    } else {
        console.log("Registering brittany extension");
    }

    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider('haskell', {
        provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range): Thenable<vscode.TextEdit[]> {

            if (isEnabled() === false) {
                return new Promise((resolve, reject) => {
                    return reject([]);
                });
            }
            console.log('brittany asked to format');

            // If we're formatting the whole document
            // Brittany operates on files only, so we need to 
            // Improvement TODO: Instead of making a tmp file, pass the source code into STDIN.
            // Could also potentially unify this approach with the full-file approach.
            if (range.isEqual(fullDocumentRange(document))) {
                if (document.isDirty) {
                    vscode.commands.executeCommand('workbench.action.files.saveWithoutFormatting').then(() =>
                        vscode.commands.executeCommand('editor.action.formatDocument').then(
                            document.save));
                } else {
                    return runBrittany(document, range, document.uri.fsPath, null);
                }
            } else {
                const substring = document.getText(range);
                const tmpobj = tmp.fileSync();
                console.log('brittany: Temporary file: ', tmpobj.name);
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

            // export function write(fd: number, data: any, callback?: (err: NodeJS.ErrnoException, written: number, str: string) => void): void;

        }
    }));
}

function runBrittany(document: vscode.TextDocument, range: vscode.Range, inputFilename: string, tmpobj): Thenable<vscode.TextEdit[]> {
    return new Promise((resolve, reject) => {

        const file = document.uri.fsPath;

        const cmd = brittanyCmd() + " \"" + inputFilename + "\"" + " " + additionalFlags();
        const maybeWorkspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        const dir = maybeWorkspaceFolder !== undefined ? maybeWorkspaceFolder.uri.fsPath : path.dirname(document.uri.fsPath);
        console.log("brittany command is: " + cmd);
        console.log("brittany folder is: " + dir);

        const options = {
            encoding: 'utf8',
            // timeout: 0,
            // maxBuffer: 200 * 1024, // ?
            // killSignal: 'SIGTERM',
            cwd: dir,
            // env: null, // ?
            // gid: null,
            // uid: null,
            // shell: null,
        };

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
                    vscode.window.showErrorMessage("Failed to run brittany; see the developer tools console for details. " + error);
                    return reject([]);
                } else {
                    if (tmpobj) { tmpobj.removeCallback(); }
                    return resolve([vscode.TextEdit.replace(range, stdout)]);
                }
            }
        );
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
}

function brittanyCmd() {
    return vscode.workspace.getConfiguration("brittany")["path"];
}

function additionalFlags() {
    return vscode.workspace.getConfiguration("brittany")["additional-flags"];
}

function isEnabled() {
    return vscode.workspace.getConfiguration("brittany")["enable"];
}

function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
    const lastLineId = document.lineCount - 1;
    return new vscode.Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length);
}