# Rholang VSCode Client

Provides language support for Rholang (.rho) files in VS Code, including
diagnostics via an LSP-based language server
([rholang-language-server](https://github.com/f1R3FLY-io/rholang-language-server)).

## Features
- Syntax validation for Rholang files using either:
  - Built-in Rust interpreter (fast, no external dependencies)
  - External `rnode` server via gRPC (legacy support)
- Diagnostics for errors (e.g., syntax errors, unbound variables)
- Incremental text synchronization for efficient editing
- Automatic RNode startup and management when using gRPC backend

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

## Usage
- Open a `.rho` file in VS Code
- Edit the file to see diagnostics for Rholang errors
- The default Rust validator provides fast feedback without external dependencies
- Switch to gRPC backend in settings if you need RNode compatibility

## Building from Source
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Compile: `npm run compile`.
4. Package: `vsce package`.
