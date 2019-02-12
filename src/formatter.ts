import * as path from "path";
import * as child_proc from "promisify-child-process";
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
    console.log(`Formatting entire doc!`);
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
      `Formatting (partially) with brittany: ${JSON.stringify({
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
    console.log(`Edits: ${JSON.stringify(edits)}`);
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
      maybeWorkspaceFolder !== null
        ? maybeWorkspaceFolder.uri.fsPath
        : path.dirname(inputFilename);
    const options: { cwd: string; encoding: string; stdin?: string } = {
      cwd: dir,
      encoding: "utf8"
    };

    console.log("brittany command is: " + cmdName);
    console.log("brittany folder is: " + dir);

    try {
      console.log(`Invoking with: ${JSON.stringify([cmdName, args, options])}`);
      const child: any = child_proc.execFile(cmdName, args, options);
      if (stdin && stdin.length > 0) {
        child.stdin.write(stdin);
      }
      if (child.stdin) {
        child.stdin.end();
      }
      const { stdout, stderr }: any = await child;
      console.log(`Result: ${stdout}`);
      const err: string = String(stderr);
      if (err.length > 0) {
        console.error(`Error: ${err}`);
      }

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
