# Rholang for Visual Studio Code

> Professional language support for Rholang process calculus

[![Version](https://img.shields.io/vscode-marketplace/v/F1R3FLY-io.f1r3fly-io-rholang)](https://marketplace.visualstudio.com/items?itemName=F1R3FLY-io.f1r3fly-io-rholang)
[![Installs](https://img.shields.io/vscode-marketplace/i/F1R3FLY-io.f1r3fly-io-rholang)](https://marketplace.visualstudio.com/items?itemName=F1R3FLY-io.f1r3fly-io-rholang)
[![License](https://img.shields.io/github/license/F1R3FLY-io/rholang-vscode-client)](https://github.com/F1R3FLY-io/rholang-vscode-client/blob/main/LICENSE)

Full-featured IDE support for Rholang via the [rholang-language-server](https://github.com/f1R3FLY-io/rholang-language-server), including intelligent code completion, go-to-definition, find references, and more.

## ✨ Features

### Language Server Protocol (LSP) Features
- **🔍 Go to Definition** - Jump to symbol definitions across files
- **📝 Code Completion** - Intelligent completions with fuzzy matching support
- **💡 Hover Information** - Type information and documentation on hover
- **✍️ Signature Help** - Parameter hints for contract calls
- **🔎 Find References** - Find all usages of symbols across workspace
- **🏷️ Document Symbols** - Outline view with hierarchical symbols
- **🔎 Workspace Symbols** - Fast symbol search across all files
- **🖊️ Rename** - Rename symbols across the workspace
- **🌈 Document Highlighting** - Highlight all occurrences of symbol under cursor
- **🎨 Semantic Highlighting** - Enhanced syntax highlighting for embedded languages

### Validation & Diagnostics
- **Dual Backend Support:**
  - **Rust Interpreter** (default): Fast, embedded validation with no dependencies
  - **gRPC to RNode**: Legacy RChain compatibility
- **Real-time Diagnostics** - Syntax errors, type errors, unbound variables
- **Incremental Validation** - Fast re-validation on file changes

### Developer Experience
- **📚 58 Code Snippets** - Quick insertion of common patterns (contracts, channels, collections, methods, etc.)
- **🔄 One-Click Server Restart** - No need to reload VSCode window
- **📊 Status Bar Integration** - See backend status and server health at a glance
- **⚡ Quick Server Menu** - Fast access to common operations
- **🔧 Comprehensive Configuration** - Fine-tune every aspect of the extension
- **📋 Server Information Panel** - View all server capabilities and settings
- **🐛 Wire-Level Logging** - Debug LSP protocol communication
- **✅ Settings Validation** - Helpful warnings for configuration issues

### Automatic RNode Management
- Auto-start RNode when using gRPC backend
- Health checking before server startup
- Graceful fallback to parser-only mode if RNode unavailable
- Automatic cleanup on extension deactivation

## Requirements
- **Rholang LSP Server**: The `rholang-language-server` binary must be available
  on your PATH or configured via `rholang.server.path`
- **RNode** (optional): Only required if using the gRPC validator backend.
  The extension can automatically start RNode if it's available on your PATH.
- **VS Code**: Version 1.96.2 or later

## Installation
1. Install the extension via the VS Code Marketplace or a `.vsix` file
2. Ensure the Rholang LSP server binary (`rholang-language-server`) is in your
   `$PATH` or set its path in the `rholang.server.path` configuration
3. (Optional) If using the gRPC validator backend:
   - Install RNode and ensure it's on your `$PATH`, or
   - Set the path to RNode in the `rholang.rnode.path` configuration
   - The extension will automatically start RNode when needed (can be disabled
     via `rholang.rnode.autoStart`)

## Configuration

### Server Settings
- `rholang.server.path`: Path to the `rholang-language-server` executable
  (default: `"rholang-language-server"`)

- `rholang.server.logLevel`: Log level for the language server
  (default: `"info"`)
  - `"error"`: Only log errors
  - `"warn"`: Log warnings and errors
  - `"info"`: Log informational messages, warnings, and errors
  - `"debug"`: Log debug information and above
  - `"trace"`: Log all messages including trace-level details
  - **Note:** Changes take effect immediately without restarting the server

- `rholang.server.wireLog`: Enable wire-level logging of LSP protocol messages
  (default: `false`)
  - When enabled, logs all inputs and outputs between the client and server
  - Passes `--wire-log` flag to the language server
  - Useful for debugging LSP communication issues
  - **Note:** Changes require restarting the language server

- `rholang.server.extraArgs`: Additional command-line arguments to pass to the
  language server (default: `[]`)
  - Accepts an array of strings representing flags and options
  - Arguments are appended after built-in arguments, allowing overrides
  - Changes require restarting the language server
  - **Example:** `["--max-threads", "4", "--enable-experimental"]`

### Validator Backend
- `rholang.validatorBackend`: Choose validation backend
  - `"rust"` (default): Use the embedded Rust interpreter
  - `"grpc"`: Use gRPC to connect to RNode server

### RNode Settings (for gRPC backend)
- `rholang.rnode.path`: Path to the `rnode` executable (default: `"rnode"`)
- `rholang.rnode.autoStart`: Automatically start RNode when using gRPC backend
  (default: `true`)
- `rholang.grpcAddress`: Address of the RNode gRPC server
  (default: `"localhost:40402"`)

### Code Completion Settings
The extension implements workarounds to maximize reliance on the LSP server's
completion results, working around VSCode's client-side filtering and sorting
limitations:

- `rholang.completion.forceIncomplete` (default: `true`): Forces completion
  lists to be marked as incomplete, triggering re-queries to the LSP server on
  each keystroke. This ensures the server has the opportunity to provide
  contextually relevant completions based on what you've typed.

- `rholang.completion.preserveSortText` (default: `true`): Ensures `sortText`
  is set on completion items to help preserve the server's intended ordering.
  Items without `sortText` will use their label as the sort key.

- `rholang.completion.ensureFilterText` (default: `true`): Ensures `filterText`
  is set on completion items to influence VSCode's client-side filtering. Items
  without `filterText` will use their label as the filter key.

**Important Note:** Even with these workarounds enabled, VSCode will still apply
its own client-side filtering and sorting based on prefix matching once you
start typing. This is hardcoded behavior in VSCode that cannot be fully bypassed.
However, these settings maximize the influence of the LSP server's results within
VSCode's constraints.

### Advanced Debugging
- `rholang.trace.server`: Traces the communication between VSCode and the
  language server (default: `"off"`)
  - `"off"`: No tracing
  - `"messages"`: Trace all messages sent to/from the server
  - `"verbose"`: Verbose message tracing with additional details
  - This is a built-in VSCode LSP setting useful for debugging LSP protocol issues
  - **Note:** Different from `rholang.server.wireLog` which enables server-side
    wire logging

## 🚀 Quick Start

1. **Install the extension** from the VSCode Marketplace
2. **Install rholang-language-server**:
   ```bash
   # Download from releases
   # https://github.com/F1R3FLY-io/rholang-language-server/releases
   ```
3. **Open a `.rho` file** - The extension activates automatically
4. **Start coding!** - Enjoy full LSP features out of the box

## 📖 Usage

### Basic Workflow
1. Open or create a `.rho` file
2. Start typing - see completions, diagnostics, and hover information
3. Use `Ctrl+Space` for manual completion invocation
4. Use `F12` (Go to Definition), `Shift+F12` (Find References), `F2` (Rename)

### Using Snippets
Type a snippet prefix and press `Tab`:
- `contract` → Contract definition
- `new` → New channel declaration
- `for` → Input guard (for comprehension)
- `send` → Send on channel
- `match` → Pattern matching
- `select` → Select/choice expression
- `list.*` / `map.*` / `set.*` → Collection methods
- And 50+ more!

### Commands
Access via Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `Rholang: Restart Language Server` | Restart the server without reloading window |
| `Rholang: Show Server Menu` | Quick access to server operations |
| `Rholang: Show Server Information` | View server capabilities and configuration |
| `Rholang: Show Server Output` | Open language server logs |
| `Rholang: Toggle Wire Logging` | Enable/disable LSP protocol logging |

### Status Bar
Click the Rholang status bar item (bottom-right) to:
- View current backend (Rust/gRPC)
- Restart the server
- Change validator backend
- Open server logs

## ❓ Troubleshooting

### Server Not Starting
1. **Check server path**: Ensure `rholang-language-server` is in PATH or configured correctly
2. **View logs**: Run "Rholang: Show Server Output" command
3. **Restart server**: Run "Rholang: Restart Language Server" command

### No Completions/IntelliSense
1. **Check file extension**: Must be `.rho`
2. **Verify server is running**: Check status bar (should show "✓ Rholang: Rust" or similar)
3. **Try manual trigger**: Press `Ctrl+Space`

### RNode Connection Issues
1. **Verify RNode is running**: `curl http://localhost:40403/status`
2. **Check gRPC address**: Default is `localhost:40402`
3. **Switch to Rust backend**: Faster and no dependencies

### Wire Logging Not Working
- Wire logging requires server restart after enabling
- Use "Rholang: Toggle Wire Logging" command for easy toggling

For more detailed troubleshooting, see [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md).

## 💡 Tips & Tricks

- **Faster validation**: Use Rust backend (default) instead of gRPC
- **Better completions**: Enable all completion middleware options (default)
- **Debug LSP issues**: Enable wire logging and check server output
- **Organize code**: Use `// #region` and `// #endregion` for code folding
- **Quick backend switch**: Click status bar → "Change Validator Backend"

## 🤝 Contributing

Contributions are welcome! Please see the [GitHub repository](https://github.com/F1R3FLY-io/rholang-vscode-client) for details.

## 📜 License

Apache 2.0 - See [LICENSE](LICENSE) for details.

## 🔗 Links

- [Language Server Repository](https://github.com/F1R3FLY-io/rholang-language-server)
- [Report Issues](https://github.com/F1R3FLY-io/rholang-vscode-client/issues)
- [RChain Cooperative](https://rchain.coop/)

## Building from Source
1. Clone the repository
2. Install dependencies: `npm install`
3. Compile: `npm run build`
4. Run tests: `npm test`
5. Package: `vsce package`

---

**Enjoy coding in Rholang! 🚀**
