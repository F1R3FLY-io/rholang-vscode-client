# Change Log

All notable changes to the "rholang" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.0] - 2025-01-29

### Added

#### Foundation Features (Phase 1)
- **Restart Language Server** command (`rholang.restartServer`)
  - Restart server without reloading entire VSCode window
  - Accessible via command palette: "Rholang: Restart Language Server"
  - Useful after changing `wireLog` or `extraArgs` settings
  - Progress feedback during restart operation
- **Status Bar Integration**
  - Dynamic backend display (Rust/gRPC) with visual indicators
  - Click action opens quick server menu
  - Connection state monitoring with color-coded status
  - Tooltip shows backend info and available actions
- **Testing Infrastructure**
  - Mocha test framework setup with VSCode Test Electron
  - Extension activation tests
  - Configuration validation tests
  - Multi-platform CI support

#### Developer Experience (Phase 2)
- **24 Code Snippets** for rapid development
  - `contract` - Contract definition
  - `new` - New channel declaration
  - `for`, `for!` - Input guards (regular and persistent)
  - `send` - Send on channel
  - `par` - Parallel composition
  - `match` - Pattern matching
  - `bundle+`, `bundle-`, `bundle0` - Bundle operations
  - `stdout` - Print to standard output
  - `method` - Method call
  - `list`, `map`, `set`, `tuple` - Data structures
  - `if` - Conditional expression
  - `unforgeable` - Unforgeable name creation
  - `registry.insert`, `registry.lookup` - Registry operations
  - And more common patterns!
- **5 Custom Commands**
  - `rholang.restartServer` - Restart language server
  - `rholang.showServerMenu` - Quick access menu for common operations
  - `rholang.showServerOutput` - Open language server logs
  - `rholang.toggleWireLog` - Toggle wire logging with restart prompt
  - `rholang.showServerInfo` - Webview panel with full server information
- **Enhanced Language Configuration**
  - Code folding markers (`// #region`, `// #endregion`)
  - Smart indentation rules for braces, brackets, parentheses
  - Auto-closing pairs with context awareness
  - Auto-close before specific characters
  - On-enter rules for block comments
  - Improved word pattern for better selection

#### User Experience (Phase 3)
- **Settings Validation**
  - Validates gRPC address format (host:port)
  - Checks server path existence and executability
  - Detects extra args conflicts with built-in flags
  - Actionable error messages with "Fix Now" buttons
  - Direct links to settings editor and server downloads
- **Enhanced Error Handling**
  - Progress notifications during server startup
  - Detailed error messages for startup failures
  - RNode connection failure guidance
  - Backend switch suggestions
  - Links to troubleshooting documentation
  - Graceful degradation messages
- **Code Completion Middleware** - Maximize reliance on LSP server results
  - `rholang.completion.forceIncomplete`: Force re-querying server on each keystroke (default: true)
  - `rholang.completion.preserveSortText`: Maintain server-side ordering (default: true)
  - `rholang.completion.ensureFilterText`: Control client-side filtering (default: true)
  - Works around VSCode's client-side filtering and sorting limitations

#### Configuration & Flexibility
- **Server Log Level Configuration** (`rholang.server.logLevel`)
  - Supported levels: error, warn, info, debug, trace (default: info)
  - Changes take effect immediately without restarting server
  - Uses `workspace/didChangeConfiguration` for runtime updates
- **Wire Logging** (`rholang.server.wireLog`)
  - Enable wire-level logging of LSP protocol messages (default: false)
  - Passes `--wire-log` flag to language server
  - Logs all inputs/outputs between client and server
  - Useful for debugging LSP communication issues
  - Requires server restart to take effect
- **Custom Server Arguments** (`rholang.server.extraArgs`)
  - Pass arbitrary command-line flags and options to language server
  - Accepts array of strings (e.g., `["--max-threads", "4", "--enable-experimental"]`)
  - Arguments appended after built-in arguments, allowing overrides
  - Validation and filtering of invalid arguments
  - Requires server restart to take effect
- **Automatic RNode Management**
  - New `rholang.rnode.path` configuration to specify RNode executable location
  - New `rholang.rnode.autoStart` configuration to enable/disable automatic startup (default: true)
  - RNode readiness check via HTTP status endpoint before starting language server
  - Automatic RNode process cleanup on extension deactivation
  - RNode is only stopped on deactivation if it was started by the extension
- **Graceful Fallback**
  - If gRPC backend is selected but RNode cannot be started or connected to, the extension
    automatically falls back to `--no-rnode` mode instead of crashing
  - Clear logging messages indicate when fallback occurs and why

#### Documentation (Phase 4)
- **Comprehensive README.md**
  - Professional header with badges
  - Complete feature list with descriptions
  - Quick Start guide
  - Usage examples and workflow
  - Commands reference table
  - Status bar documentation
  - Configuration reference
  - Tips & tricks section
  - Contributing guidelines
- **TROUBLESHOOTING.md Guide** (560+ lines)
  - Server issues (won't start, crashes, restarts)
  - RNode connection problems
  - LSP feature problems (completions, goto, references, hover)
  - Performance issues (slow completions, CPU, memory)
  - Configuration problems
  - Debugging tips (wire logging, logs, server info)
  - Bug reporting guidelines

#### Quality Assurance (Phase 6)
- **GitHub Actions CI/CD Pipeline**
  - Multi-OS testing (Ubuntu, Windows, macOS)
  - Multi-Node.js version testing (18.x, 20.x)
  - Automated linting, building, and packaging
  - VSIX artifact upload
  - Auto-release on version bump
- **ESLint Configuration**
  - TypeScript-specific rules
  - Naming conventions enforcement
  - Code style consistency

### Changed
- Updated license from Sovereign Source License (SSL) to Apache 2.0
- Improved configuration synchronization using `synchronize.configurationSection`
  - Automatic `workspace/didChangeConfiguration` notifications from VSCode
  - Removed redundant manual configuration change listener
- Enhanced logging with structured configuration display on startup
  - Shows all configuration values at startup
  - Logs wire logging and extra arguments status
- Better user feedback for server lifecycle events
  - Success/failure notifications for server restart
  - Clear error messages with actionable information
- Bundle size increased minimally (12 KB, 1.5%) despite significant feature additions

### Fixed
- Fixed bug where `--validator-backend rust` was incorrectly being passed to the language server,
  causing it to try to connect to gRPC even when Rust backend was selected. The extension now
  only passes `--validator-backend` when using the gRPC backend, allowing the language server
  to use its default Rust backend when no option is specified.
- Fixed infinite restart loop by reducing `maxRestartCount` from unlimited to 5. Previously,
  if the language server crashed, it would restart infinitely creating thousands of log files.
- Removed redundant manual `workspace/didChangeConfiguration` sending (now handled automatically by VSCode)
- Fixed TypeScript compilation errors in test suite

### Initial Release
- Initial release with basic Rholang language support
- Configuration option to optionally disable RNode integration
