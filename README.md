# Rholang VSCode Client

Provides language support for Rholang (.rho) files in VS Code, including
diagnostics via an LSP-based language server
([rholang-language-server](https://github.com/f1R3FLY-io/rholang-language-server)).

## Features
- Syntax validation for Rholang files using an external `rnode` server.
- Diagnostics for errors (e.g., syntax errors, unbound variables).
- Incremental text synchronization for efficient editing.

## Requirements
- **Rholang LSP Server**: Compile the server from the source (requires Rust and
  Cargo).
- **rnode**: Run `rnode run --standalone` to provide gRPC validation.
- **VS Code**: Version 1.99.1 or later.

## Installation
1. Install the extension via the VS Code Marketplace or a `.vsix` file.
2. Ensure the Rholang LSP server binary (`rholang-language-server`) is in the
   extension’s `$PATH` or set its path in the extension's `rholang.server.path`
   configuration.
3. Start the `rnode` server: `rnode run --standalone`.

## Usage
- Open a `.rho` file in VS Code.
- Edit the file to see diagnostics for Rholang errors.

## Building from Source
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Compile: `npm run compile`.
4. Package: `vsce package`.
