import * as proc from "child_process";
import * as path from "path";
import * as tmp from "tmp";
import * as util from "util";
import {
  CancellationToken,
  commands,
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
  WorkspaceEdit,
  WorkspaceFolder
} from "vscode";

declare module "util" {
  export function promisify<T>(
    func: (data: any, cb: (err: NodeJS.ErrnoException, data?: T) => void,
  ) => void): (...input: any[]) => Promise<T>;
}

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

  constructor() {
    console.log(`Awoken`);
    this.loadSettings();
    console.log("Loaded Brittanies");
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
    console.log(`Formatting`);
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
    console.log(
      `Formatting with brittany: ${JSON.stringify({
        document,
        options,
        range,
        token
      })}`
    );
    const edits: TextEdit[] = [];
    if (!this.isEnabled) {
      throw new Error("Brittany formatter not enabled");
    }
    // if document has CRLF line endings, change it to LF.
    if (!this.keepCRLF && document.eol === EndOfLine.CRLF) {
      console.log("changing line endings to LF");
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
  }

  private async runBrittany(
    input: string | TextDocument,
    inputFilename: string
  ): Promise<string> {
    let cmdName: string = "brittany";
    const args: string[] = [];
    let stdin: string | undefined;
    let maybeWorkspaceFolder: WorkspaceFolder = null;

    if (this.isStackEnabled) {
      cmdName = "stack";
      args.push("exec", "brittany", "--");
    }
    if (typeof input === "string") {
      stdin = input;
      args.push("--write-mode", "display");
    } else {
      args.push(input.uri.fsPath);
      args.push("--write-mode", "display");
      maybeWorkspaceFolder = workspace.getWorkspaceFolder(input.uri);
    }

    const dir: string =
      maybeWorkspaceFolder !== undefined
        ? maybeWorkspaceFolder.uri.fsPath
        : workspace.rootPath;
    const options: { cwd: string; encoding: string; stdin?: string } = {
      cwd: dir,
      encoding: "utf8",
      stdin
    };

    console.log("brittany command is: " + cmdName);
    console.log("brittany folder is: " + dir);

    try {
      const { stdout }: any = await util.promisify(proc.execFile)(
        cmdName,
        args,
        options
      );

      return String(stdout);
    } catch (error) {
      {
        console.error("Error running brittany:");
        console.error(error);
        window.showErrorMessage(
          "Failed to run brittany; see the developer tools console for details. " +
            error
        );
        throw new Error(
          "Failed to run brittany; see the developer tools console for details."
        );
      }
    }
  }

  private fullDocumentRange(document: TextDocument): Range {
    const last: number = document.lineCount - 1;
    return new Range(0, 0, last, document.lineAt(last).text.length);
  }
}
