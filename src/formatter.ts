import * as path from "path";
import * as child_proc from "promisify-child-process";
import {
  CancellationToken,
  Disposable,
  DocumentFormattingEditProvider,
  DocumentRangeFormattingEditProvider,
  EndOfLine,
  FormattingOptions,
  Range,
  TextDocument,
  TextEdit,
  window,
  workspace,
  WorkspaceFolder,
  OutputChannel
} from "vscode";

export default class Formatter
  implements
  Disposable,
  DocumentRangeFormattingEditProvider,
  DocumentFormattingEditProvider {
  private disposables: Disposable[] = [];
  private keepCRLF: boolean = false;
  private isStackEnabled: boolean = false;
  private isEnabled: boolean = true;
  private additionalFlags: string = "";
  private brittanyCmd: string = "brittany";
  private showErrorNotification: boolean = false;

  private outputChannel: OutputChannel = window.createOutputChannel("Brittany");

  constructor() {
    this.loadSettings();
    this.disposables.push(this.outputChannel);
    workspace.onDidChangeConfiguration(
      (evt) => {
        if (evt.affectsConfiguration("brittany")) {
          this.loadSettings();
        }
      },
      this,
      this.disposables
    );
  }

  public dispose(): void {
    this.disposables.forEach((i) => i.dispose());
  }

  public async provideDocumentFormattingEdits(
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken
  ): Promise<TextEdit[]> {
    return await this.provideDocumentRangeFormattingEdits(
      document,
      null,
      options,
      token
    );
  }

  public async provideDocumentRangeFormattingEdits(
    document: TextDocument,
    range: Range | null,
    options: FormattingOptions,
    token: CancellationToken
  ): Promise<TextEdit[]> {
    const edits: TextEdit[] = [];
    if (!this.isEnabled) {
      throw new Error("Brittany formatter not enabled");
    }
    // if document has CRLF line endings, change it to LF.
    if (!this.keepCRLF && document.eol === EndOfLine.CRLF) {
      edits.push(TextEdit.setEndOfLine(EndOfLine.LF));
    }

    const fullRange: Range = this.fullDocumentRange(document);
    const fullDoc: boolean = !range || range === fullRange;
    let input: string | TextDocument;

    if (fullDoc) {
      if (document.isDirty) {
        input = document.getText();
      } else {
        input = document;
      }
    } else {
      input = document.getText(range);
    }

    const formatted: string = await this.runBrittany(input, document.fileName);
    edits.push(TextEdit.replace(range || fullRange, formatted));
    return edits;
  }

  private loadSettings(): void {
    const config: any = workspace.getConfiguration("brittany");
    this.keepCRLF = config.keepCRLF;
    this.isStackEnabled = config.stackEnable;
    this.isEnabled = config.enable;
    this.additionalFlags = config.additionalFlags;
    this.brittanyCmd = config.path;
    this.showErrorNotification = config.showErrorNotification;
  }

  private async runBrittany(
    input: string | TextDocument,
    inputFilename: string
  ): Promise<string> {
    let cmdName: string = this.brittanyCmd;
    const args: string[] = [];
    let stdin: string | undefined;
    let maybeWorkspaceFolder: WorkspaceFolder = null;

    if (this.isStackEnabled) {
      cmdName = "stack";
      args.push("exec", "brittany", "--");
    }
    if (this.additionalFlags.length > 0) {
      args.push(...this.additionalFlags.split(" "));
    }
    if (typeof input === "string") {
      stdin = input;
      args.push("--write-mode", "display");
      if (workspace.name !== undefined) {
        maybeWorkspaceFolder = workspace.workspaceFolders[0];
      }
    } else {
      args.push(input.uri.fsPath);
      args.push("--write-mode", "display");
      maybeWorkspaceFolder = workspace.getWorkspaceFolder(input.uri);
    }

    const dir: string =
      (maybeWorkspaceFolder !== null && maybeWorkspaceFolder !== undefined)
        ? maybeWorkspaceFolder.uri.fsPath
        : path.dirname(inputFilename);
    const options: { cwd: string; encoding: string; stdin?: string } = {
      cwd: dir,
      encoding: "utf8"
    };

    try {
      const child: child_proc.ChildProcessPromise = child_proc.execFile(cmdName, args, options);
      if (stdin && stdin.length > 0) {
        child.stdin.write(stdin);
      }
      if (child.stdin) {
        child.stdin.end();
      }
      const { stdout, stderr } = await child;
      const err: string = String(stderr);
      if (err.length > 0) {
        throw new Error(err);
      }

      return String(stdout);
    } catch (error) {
      this.outputChannel.appendLine(error);
      if (this.showErrorNotification) {
        window.showErrorMessage("Failed to run brittany; see output for details. " + error);
      }
      throw new Error("Failed to run brittany; see output for details.");
    }
  }

  private fullDocumentRange(document: TextDocument): Range {
    const last: number = document.lineCount - 1;
    return new Range(0, 0, last, document.lineAt(last).text.length);
  }
}
