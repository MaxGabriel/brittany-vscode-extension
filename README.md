# brittany VSCode extension

This extension calls the [`brittany`](https://github.com/lspitzner/brittany) program to format Haskell source code. It's implemented with the [VSCode formatting API](https://code.visualstudio.com/blogs/2016/11/15/formatters-best-practices), and supports both full-document and specific ranges.

Because it's based on VSCode's formatting API, you use it via VSCode's standard formatting commands:

* To format a full-page document, open the command palette and choose "Format Document".
* To format a selection, select some text, open the command palette, and choose "Format Selection".
* To format on save, open User Preferences (⌘ , or Ctrl ,), then add: `"editor.formatOnSave": true` 

Source code for this extension is available [on Github](https://github.com/MaxGabriel/brittany-vscode-extension).

## Requirements

The `brittany` formatter must be installed as a command line program. See the [`brittany` README](https://github.com/lspitzner/brittany#installation) for details.

To work with the formatting API, VSCode must recognize your source code file as a `haskell` file. Add this to your User Preferences (⌘ , or Ctrl ,) to set this up:

```
"files.associations": {
    "*.hs": "haskell",
}
```

I'm not familiar with `brittany`'s support for literate Haskell (.lhs) or Haskell C interface code (.hsc), so I don't know if it would work for those.

## Extension Settings

* `brittany.path`: Path to the brittany executable. This will be wrapped in double quotes to escape it, so your path can e.g. include spaces. Default: `brittany` (so if `brittany` is on your $PATH, it should work without any configuration).
* `brittany.enable`: A boolean value to enable or disable the extension. Default: `true`.
* `brittany.additionalFlags`: Additional flags to pass to brittany, e.g. --indent AMOUNT. These are unescaped. They should not attempt to change the input or output files. This option mostly exists as an escape hatch—you should generally prefer editing your brittany config file if possible.
* `brittany.stackEnable`: A boolean value to enable or disable brittany through stack (stack exec brittany). Default: `false`.

## brittany Configuration

`brittany` itself can be configured globally at `~/.config/brittany/config.yaml`, as well as `brittany.yaml` in the directory `brittany` is called from. For standalone files, `brittany` is called from the same directory as the file being formatted. If your file is part of a workspace, `brittany` will be called from the root directory of that workspace. 

## Caveats

* While `brittany` can sometimes format partial selections of code, this functionality is limited based on what it can parse. For example, in this code:
    ```
    where fib n = fib (n-1) + fib (n-2)
    ```
    The selection `fib n = fib (n-1) + fib (n-2)` can be formatted by `brittany`, but the whole line `where fib n = fib (n-1) + fib (n-2)` cannot be.

* This is my first VSCode extension, and I'm not an experienced Node/Typescript developer. If you spot a bug or can make an improvement, issues and PRs are welcome.
