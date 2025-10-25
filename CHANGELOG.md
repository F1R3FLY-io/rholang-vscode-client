# Change Log

All notable changes to the "rholang" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
- Automatic RNode startup when using gRPC validator backend
  - New `rholang.rnode.path` configuration to specify RNode executable location
  - New `rholang.rnode.autoStart` configuration to enable/disable automatic startup (default: true)
  - RNode readiness check via HTTP status endpoint before starting language server
  - Automatic RNode process cleanup on extension deactivation
  - RNode is only stopped on deactivation if it was started by the extension
- Graceful fallback to parser-only validation when RNode is unavailable
  - If gRPC backend is selected but RNode cannot be started or connected to, the extension
    automatically falls back to `--no-rnode` mode instead of crashing
  - Clear logging messages indicate when fallback occurs and why

### Changed
- Updated license from Sovereign Source License (SSL) to Apache 2.0

### Fixed
- Fixed bug where `--validator-backend rust` was incorrectly being passed to the language server,
  causing it to try to connect to gRPC even when Rust backend was selected. The extension now
  only passes `--validator-backend` when using the gRPC backend, allowing the language server
  to use its default Rust backend when no option is specified.
- Fixed infinite restart loop by reducing `maxRestartCount` from unlimited to 5. Previously,
  if the language server crashed, it would restart infinitely creating thousands of log files.
- Added detailed configuration logging on startup to help debug issues

### Initial Release
- Initial release with basic Rholang language support
- Configuration option to optionally disable RNode integration
