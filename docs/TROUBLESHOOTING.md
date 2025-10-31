# Troubleshooting Guide

This guide helps you diagnose and fix common issues with the Rholang VSCode extension.

## Table of Contents

- [Server Issues](#server-issues)
- [RNode Connection Problems](#rnode-connection-problems)
- [LSP Feature Problems](#lsp-feature-problems)
- [Performance Issues](#performance-issues)
- [Configuration Problems](#configuration-problems)
- [Debugging Tips](#debugging-tips)

---

## Server Issues

### Server Won't Start

**Symptoms:**
- Extension activates but no features work
- Status bar shows "Disconnected"
- Error notification on startup

**Diagnosis:**
1. Open the output panel: `View` → `Output` → Select "Rholang"
2. Look for error messages in the logs

**Solutions:**

#### Server Binary Not Found
```
Error: spawn rholang-language-server ENOENT
```

**Fix:**
1. Download the server from [releases](https://github.com/F1R3FLY-io/rholang-language-server/releases)
2. Either:
   - Add to PATH, or
   - Set `rholang.server.path` to the full path

**Verify:**
```bash
# Should print version info
rholang-language-server --version
```

#### Permission Issues (Linux/macOS)
```
Error: spawn rholang-language-server EACCES
```

**Fix:**
```bash
chmod +x /path/to/rholang-language-server
```

#### Server Crashes on Startup

**Check logs for:**
- Rust backtrace
- Missing dependencies
- Port conflicts

**Try:**
1. Restart VSCode
2. Check no other instance is running:
   ```bash
   ps aux | grep rholang-language-server
   killall rholang-language-server  # If found
   ```
3. Update to latest server version

### Server Keeps Restarting

**Symptoms:**
- Frequent "Server crashed" notifications
- Features intermittently stop working

**Diagnosis:**
```
Check logs for crash patterns
Look for "maxRestartCount reached" message
```

**Solutions:**

1. **Check server compatibility:**
   - Ensure server version matches extension requirements
   - Update both to latest versions

2. **Reduce load:**
   - Close large `.rho` files
   - Disable `rholang.server.wireLog` if enabled
   - Lower `rholang.server.logLevel` to `warn` or `error`

3. **Check system resources:**
   - Ensure sufficient memory (server needs ~100-500MB)
   - Check disk space for log files

---

## RNode Connection Problems

### Cannot Connect to RNode (gRPC Backend)

**Symptoms:**
- Using gRPC backend but features don't work
- Warning: "RNode is not available"
- Fallback to parser-only mode

**Diagnosis:**
```bash
# Check RNode is running
curl http://localhost:40403/status

# Check gRPC port is listening
netstat -an | grep 40402  # Linux/macOS
netstat -an | findstr 40402  # Windows
```

**Solutions:**

#### RNode Not Running
```bash
# Start RNode in standalone mode
rnode run --standalone

# Or let extension auto-start (if rholang.rnode.autoStart is true)
```

#### Wrong Address/Port
1. Check RNode's actual gRPC port (default: 40402)
2. Update `rholang.grpcAddress` if different
3. Restart language server

#### RNode Startup Timeout
- RNode takes 30-60 seconds to become ready
- Extension waits up to 30 seconds
- If RNode is slow, start it manually before opening VSCode

#### Firewall Blocking Connection
```bash
# Linux: Allow local connections
sudo ufw allow from 127.0.0.1

# Windows: Check Windows Firewall settings
```

### Auto-Start Not Working

**Check:**
1. `rholang.rnode.autoStart` is `true`
2. `rnode` binary is in PATH or `rholang.rnode.path` is set
3. Permissions to execute `rnode`

**Verify:**
```bash
which rnode  # Linux/macOS
where rnode  # Windows
```

---

## LSP Feature Problems

### No Code Completions

**Symptoms:**
- `Ctrl+Space` shows no suggestions
- Or only shows VSCode's word-based completions

**Diagnosis:**
1. Check file extension is `.rho`
2. Verify server is running (status bar)
3. Try in a simple file:
   ```rholang
   new test in {
     // Type 'te' here and press Ctrl+Space
   }
   ```

**Solutions:**

1. **Server not ready:**
   - Wait a few seconds after opening file
   - Large workspaces need time to index

2. **Completion middleware disabled:**
   - Check `rholang.completion.forceIncomplete` is `true`
   - Restart server after changing

3. **VSCode settings conflict:**
   ```json
   {
     // Ensure these are enabled
     "editor.quickSuggestions": true,
     "editor.suggestOnTriggerCharacters": true
   }
   ```

### Go To Definition Not Working

**Check:**
1. Symbol is defined in workspace
2. Files are saved (unsaved changes may not be indexed)
3. Server has finished indexing (check logs)

**Known limitations:**
- Cross-file navigation requires saved files
- Some built-in symbols may not have definitions

### Find References Shows Nothing

**Possible causes:**
1. Symbol has no references
2. References are in unsaved files
3. Workspace indexing incomplete

**Try:**
1. Save all files
2. Wait for indexing to complete
3. Check server logs for errors

### Hover Shows No Information

**This is normal if:**
- Server hasn't analyzed the symbol yet
- Symbol is not in scope
- Hovering over whitespace/comments

**Try:**
- Wait a moment after typing
- Hover over a known symbol (like a contract name)

---

## Performance Issues

### Slow Completions

**Causes:**
- Large workspace with many `.rho` files
- `forceIncomplete` causing many server queries

**Solutions:**
1. **Reduce re-queries:**
   ```json
   {
     "rholang.completion.forceIncomplete": false
   }
   ```
   Note: This reduces server influence on results

2. **Limit workspace scope:**
   - Open specific folder, not entire project
   - Use `.vscode/settings.json` for project-specific config

### High CPU Usage

**Check:**
1. Server process CPU usage
2. Number of `.rho` files in workspace

**Reduce load:**
```json
{
  "rholang.server.logLevel": "warn",
  "rholang.server.wireLog": false
}
```

### Memory Leaks

**Symptoms:**
- VSCode becomes slow over time
- System runs out of memory

**Solutions:**
1. Restart language server: "Rholang: Restart Language Server"
2. Restart VSCode
3. Check for server updates (may have fixes)
4. Report issue with logs

---

## Configuration Problems

### Settings Not Taking Effect

**Check:**
1. Which settings file you're editing:
   - **User settings**: `~/.config/Code/User/settings.json` (global)
   - **Workspace settings**: `.vscode/settings.json` (project-specific)

2. **Some settings require restart:**
   - `server.extraArgs`
   - `server.wireLog`
   - `server.path`
   - `validatorBackend`

   **Use:** "Rholang: Restart Language Server"

3. **Some settings are runtime:**
   - `server.logLevel` (immediate effect)
   - `completion.*` settings (immediate effect)

### Invalid Configuration Warning

**Example:**
```
Invalid gRPC address format: "localhost"
Expected format: "host:port"
```

**Fix:**
```json
{
  "rholang.grpcAddress": "localhost:40402"  // Add port
}
```

### Extra Args Conflicts

**Warning:**
```
Extra arguments may conflict with built-in flags: --log-level
```

**Why:**
- Extension passes `--log-level` automatically
- Your `extraArgs` also includes `--log-level`
- Last one wins (your override takes effect)

**Solution:**
- Remove conflicting arg from `extraArgs`, or
- Keep it if you want to override built-in value

---

## Debugging Tips

### Enable Wire Logging

**What it does:**
Logs all LSP protocol messages (JSON-RPC) to `wire.log`

**Enable:**
1. Run command: "Rholang: Toggle Wire Logging"
2. Restart server when prompted
3. Check server directory for `wire.log`

**What to look for:**
- Request/response pairs
- Error responses from server
- Timing of messages

**Example:**
```json
--> textDocument/completion
{"jsonrpc":"2.0","id":1,"method":"textDocument/completion",...}

<-- textDocument/completion
{"jsonrpc":"2.0","id":1,"result":{"items":[...]}}
```

### View Server Logs

**Access:**
1. Command: "Rholang: Show Server Output"
2. Or: `View` → `Output` → Select "Rholang"

**Log levels:**
```json
{
  "rholang.server.logLevel": "trace"  // Most verbose
}
```

**What to look for:**
- Initialization messages
- File parsing events
- Error messages
- Performance metrics

### Check Server Info

**Run:** "Rholang: Show Server Information"

**Shows:**
- Server path
- Current backend
- Configuration values
- Server capabilities
- Connection status

### Test in Clean Environment

**Create minimal repro:**
1. Create new folder
2. Create simple `.rho` file:
   ```rholang
   contract test(@x) = { Nil }
   ```
3. Open in VSCode
4. Test if issue persists

**If it works:**
- Issue is workspace-specific
- Check workspace settings
- Check for conflicting extensions

### Collect Diagnostic Info

**For bug reports, include:**
1. **VSCode version:** `Help` → `About`
2. **Extension version:** Extensions panel
3. **Server version:** `rholang-language-server --version`
4. **OS:** Linux/macOS/Windows + version
5. **Logs:** Server output (sanitize sensitive info)
6. **Config:** Relevant `settings.json` entries
7. **Repro steps:** Minimal example to reproduce

---

## Still Having Issues?

### Check Known Issues
- [Extension Issues](https://github.com/F1R3FLY-io/rholang-vscode-client/issues)
- [Server Issues](https://github.com/F1R3FLY-io/rholang-language-server/issues)

### Report a Bug

**Include:**
1. Diagnostic info (see above)
2. Screenshots/GIFs if UI issue
3. Wire log excerpt (if relevant)
4. Minimal reproduction case

**Where:**
- Extension issues → [vscode-client](https://github.com/F1R3FLY-io/rholang-vscode-client/issues)
- LSP feature issues → [language-server](https://github.com/F1R3FLY-io/rholang-language-server/issues)

---

## Workarounds

### Temporary Disable Extension

```bash
# Via command line
code --disable-extension F1R3FLY-io.f1r3fly-io-rholang
```

Or: Extensions panel → Disable

### Use Parser-Only Mode

```json
{
  "rholang.validatorBackend": "rust",
  // No RNode needed, faster startup
}
```

### Reduce Features for Performance

```json
{
  "rholang.completion.forceIncomplete": false,
  "rholang.server.logLevel": "error",
  "rholang.server.wireLog": false
}
```

---

**Last Updated:** 2025-01-09
**Extension Version:** 0.0.4+
