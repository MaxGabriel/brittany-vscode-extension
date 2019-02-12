"use strict";

import { ExtensionContext, languages } from "vscode";
import Formatter from "./formatter";

export function activate(context: ExtensionContext): void {
  const fmt: Formatter = new Formatter();
  context.subscriptions.push(fmt);

  context.subscriptions.push(
    languages.registerDocumentRangeFormattingEditProvider("haskell", fmt),
    languages.registerDocumentFormattingEditProvider("haskell", fmt)
  );
}
