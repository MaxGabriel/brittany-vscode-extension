## 0.0.1
- Initial release

## 0.0.2
- Adds a configuration option, `stackEnable` to run Brittany via `stack exec` [#5](https://github.com/MaxGabriel/brittany-vscode-extension/pull/5) by @mnxn
- Saves the file before formatting. This prevents recent changes from being lost [#4](https://github.com/MaxGabriel/brittany-vscode-extension/pull/4) by @mnxn

## 0.0.3
- By default, files with CRLF line endings (Windows standard) will be replaced with LF to avoid upstream issues with the Brittany executable inserting extra newlines.
- Adds a configuration option, `keepCRLF` to keep CRLF line endings instead of replacing them with LF [#12](https://github.com/MaxGabriel/brittany-vscode-extension/pull/12) by @mnxn

## 0.0.4
- Update to latest VSCode formatting API
- No longer create temporary files 

## 0.0.5
- Get `additionalFlags` working again 