"use strict";

import fs from 'fs';
import * as vscode from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import type {
    CompletionItem,
    CompletionList,
    CompletionParams
} from 'vscode-languageserver-protocol';
import which from "which";
import { ChildProcess, spawn } from 'child_process';
import http from 'http';

let client: LanguageClient;
let logger: vscode.LogOutputChannel;
let rnodeProcess: ChildProcess | null = null;
let rnodeStartedByUs: boolean = false;
let statusBarItem: vscode.StatusBarItem;

async function isExecutable(path: string): Promise<boolean> {
    try {
        const stats = await fs.promises.stat(path);
        return stats.isFile() && (stats.mode & 0o111) !== 0;
    } catch (err: any) {
        if (err.code !== 'ENOENT') {
            throw err; // Other errors
        }
    }
    return false;
}

async function findRNodeExecutable(): Promise<string | null> {
    const config = vscode.workspace.getConfiguration('rholang');
    let rnodePath: string | undefined = config.get<string>('rnode.path');

    if (!rnodePath) {
        rnodePath = 'rnode';
    }

    // If it's just "rnode", try to find it on PATH
    if (rnodePath === 'rnode') {
        try {
            return await which('rnode');
        } catch (err) {
            logger.debug('rnode not found on PATH');
            return null;
        }
    }

    // Otherwise check if the specified path is executable
    if (await isExecutable(rnodePath)) {
        return rnodePath;
    }

    logger.debug(`rnode path not executable: ${rnodePath}`);
    return null;
}

async function checkRNodeStatus(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const options = {
            hostname: host,
            port: port,
            path: '/status',
            method: 'GET',
            timeout: 2000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                // RNode is ready if we get any response from /status
                resolve(res.statusCode === 200);
            });
        });

        req.on('error', () => {
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

async function waitForRNodeReady(host: string, port: number, maxAttempts: number = 30): Promise<boolean> {
    logger.info(`Waiting for RNode to be ready at ${host}:${port}...`);

    for (let i = 0; i < maxAttempts; i++) {
        if (await checkRNodeStatus(host, port)) {
            logger.info('RNode is ready!');
            return true;
        }

        // Wait 1 second between attempts
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    logger.warn(`RNode did not become ready after ${maxAttempts} seconds`);
    return false;
}

async function startRNode(rnodePath: string): Promise<boolean> {
    logger.info(`Starting RNode from: ${rnodePath}`);

    try {
        rnodeProcess = spawn(rnodePath, ['run', '--standalone'], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        rnodeProcess.stdout?.on('data', (data) => {
            logger.debug(`[RNode stdout] ${data.toString().trim()}`);
        });

        rnodeProcess.stderr?.on('data', (data) => {
            logger.debug(`[RNode stderr] ${data.toString().trim()}`);
        });

        rnodeProcess.on('error', (err) => {
            logger.error(`RNode process error: ${err.message}`);
        });

        rnodeProcess.on('exit', (code, signal) => {
            logger.info(`RNode process exited with code ${code}, signal ${signal}`);
            rnodeProcess = null;
            rnodeStartedByUs = false;
        });

        logger.info('RNode process started');
        rnodeStartedByUs = true;
        return true;
    } catch (err: any) {
        logger.error(`Failed to start RNode: ${err.message}`);
        return false;
    }
}

function stopRNode(): void {
    if (rnodeProcess && rnodeStartedByUs) {
        logger.info('Stopping RNode process (started by extension)...');
        rnodeProcess.kill('SIGTERM');
        rnodeProcess = null;
        rnodeStartedByUs = false;
    }
}

/**
 * Middleware to maximize reliance on LSP server's completion results.
 *
 * This middleware implements workarounds for VSCode's client-side filtering and sorting:
 *
 * 1. Sets isIncomplete: true to force re-querying on each keystroke
 * 2. Ensures filterText is set to label if not provided (preserves server's intent)
 * 3. Ensures sortText is set to label if not provided (maintains server ordering)
 *
 * Note: Even with these workarounds, VSCode will still apply client-side filtering
 * based on prefix matching. This is hardcoded behavior that cannot be fully bypassed.
 */
function createCompletionMiddleware(config: vscode.WorkspaceConfiguration) {
    const forceIncomplete = config.get<boolean>('completion.forceIncomplete') ?? true;
    const preserveSortText = config.get<boolean>('completion.preserveSortText') ?? true;
    const ensureFilterText = config.get<boolean>('completion.ensureFilterText') ?? true;

    return {
        provideCompletionItem: async (
            document: vscode.TextDocument,
            position: vscode.Position,
            context: vscode.CompletionContext,
            token: vscode.CancellationToken,
            next: any
        ) => {
            // Call the language server's completion handler
            const result = await next(document, position, context, token);

            if (!result) {
                return result;
            }

            // Handle both CompletionList and CompletionItem[] responses
            let completionList: CompletionList;
            let items: CompletionItem[];

            if ('items' in result && Array.isArray(result.items)) {
                // It's already a CompletionList
                completionList = result as CompletionList;
                items = completionList.items;
            } else if (Array.isArray(result)) {
                // It's a CompletionItem[] - convert to CompletionList
                items = result as CompletionItem[];
                completionList = {
                    isIncomplete: false,
                    items: items
                };
            } else {
                // Single completion item - wrap it
                items = [result as CompletionItem];
                completionList = {
                    isIncomplete: false,
                    items: items
                };
            }

            // Workaround 1: Force isIncomplete to trigger re-querying on each keystroke
            // This ensures the LSP server is called for every character typed
            if (forceIncomplete) {
                completionList.isIncomplete = true;
            }

            // Workaround 2 & 3: Ensure filterText and sortText are set
            // This helps VSCode's filtering use the server's intended values
            for (const item of items) {
                if (ensureFilterText && !item.filterText) {
                    // Use label as filterText if not set by server
                    item.filterText = item.label;
                }

                if (preserveSortText && !item.sortText) {
                    // Use label as sortText if not set by server
                    // This maintains the server's ordering
                    item.sortText = item.label;
                }
            }

            return completionList;
        }
    };
}

/**
 * Validate configuration settings and provide helpful feedback
 */
async function validateConfiguration(config: vscode.WorkspaceConfiguration): Promise<boolean> {
    let hasErrors = false;

    // Validate grpcAddress format
    const grpcAddress = config.get<string>('grpcAddress');
    if (grpcAddress && !grpcAddress.match(/^[a-zA-Z0-9.-]+:\d+$/)) {
        vscode.window.showWarningMessage(
            `Invalid gRPC address format: "${grpcAddress}". Expected format: "host:port" (e.g., "localhost:40402")`,
            'Fix Now'
        ).then(choice => {
            if (choice === 'Fix Now') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'rholang.grpcAddress');
            }
        });
        hasErrors = true;
    }

    // Validate server path exists
    const serverPath = config.get<string>('server.path');
    if (serverPath && serverPath !== 'rholang-language-server') {
        if (!await isExecutable(serverPath)) {
            vscode.window.showErrorMessage(
                `Rholang language server not found at: ${serverPath}`,
                'Download Server', 'Open Settings'
            ).then(choice => {
                if (choice === 'Download Server') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/F1R3FLY-io/rholang-language-server/releases'));
                } else if (choice === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'rholang.server.path');
                }
            });
            hasErrors = true;
        }
    }

    // Validate extraArgs for conflicts
    const extraArgs = config.get<string[]>('server.extraArgs') ?? [];
    const builtInFlags = ['--no-color', '--client-process-id', '--log-level', '--wire-log', '--validator-backend', '--no-rnode'];
    const conflicts = extraArgs.filter(arg => {
        return builtInFlags.some(flag => arg.startsWith(flag));
    });

    if (conflicts.length > 0) {
        vscode.window.showWarningMessage(
            `Extra arguments may conflict with built-in flags: ${conflicts.join(', ')}. These may be overridden.`,
            'View Settings'
        ).then(choice => {
            if (choice === 'View Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'rholang.server.extraArgs');
            }
        });
    }

    return !hasErrors;
}

/**
 * Update the status bar item to reflect current server state
 */
function updateStatusBar(backend: string, isConnected: boolean = true) {
    if (!statusBarItem) {
        return;
    }

    const backendIcon = backend === 'rust' ? '$(zap)' : '$(server)';
    const backendName = backend === 'rust' ? 'Rust' : 'gRPC';
    const statusIcon = isConnected ? '$(check)' : '$(x)';

    statusBarItem.text = `${backendIcon} Rholang: ${backendName}`;
    statusBarItem.tooltip = isConnected
        ? `Rholang language server (${backendName} backend)\nClick to change backend or restart server`
        : `Rholang language server disconnected\nClick to restart`;
    statusBarItem.color = isConnected ? undefined : new vscode.ThemeColor('statusBarItem.errorForeground');
}

export async function activate(context: vscode.ExtensionContext) {
    logger = vscode.window.createOutputChannel('Rholang', {
        log: true
    });

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'rholang.showServerMenu';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();

    let serverPath: string | undefined | null =
        vscode.workspace.getConfiguration('rholang').get<string>('server.path');

    const serverExecutable: string = "rholang-language-server";
    if (serverPath === serverExecutable) {
        try {
            serverPath = await which(serverExecutable);
        } catch (err: any) {
            logger.error(`Failed to locate ${serverExecutable} on the PATH:`, err);
        }
    }

    if (!!serverPath && await isExecutable(serverPath)) {
        // Read configuration for validator backend
        const config = vscode.workspace.getConfiguration('rholang');
        let validatorBackend: string = config.get<string>('validatorBackend') ?? 'rust';
        let grpcAddress: string = config.get<string>('grpcAddress') ?? 'localhost:40402';
        let autoStartRNode: boolean = config.get<boolean>('rnode.autoStart') ?? true;
        let logLevel: string = config.get<string>('server.logLevel') ?? 'info';
        let wireLog: boolean = config.get<boolean>('server.wireLog') ?? false;
        let extraArgs: string[] = config.get<string[]>('server.extraArgs') ?? [];

        logger.info('=== Rholang Extension Configuration ===');
        logger.info(`Validator backend: ${validatorBackend}`);
        logger.info(`gRPC address: ${grpcAddress}`);
        logger.info(`Auto-start RNode: ${autoStartRNode}`);
        logger.info(`Server log level: ${logLevel}`);
        logger.info(`Wire logging: ${wireLog ? 'enabled' : 'disabled'}`);
        logger.info(`Server path: ${serverPath}`);
        if (extraArgs.length > 0) {
            logger.info(`Extra server arguments: ${extraArgs.join(' ')}`);
        }

        // Validate configuration
        await validateConfiguration(config);

        // Update status bar with current backend
        updateStatusBar(validatorBackend, false); // Will update to connected after client starts

        let rnodeAvailable = false;

        // Check if RNode is available when using gRPC backend
        if (validatorBackend === 'grpc') {
            // Parse gRPC address to get host and port
            const [grpcHost, grpcPortStr] = grpcAddress.split(':');
            const grpcPort = parseInt(grpcPortStr, 10);

            // HTTP status port is typically gRPC port + 1
            const httpPort = grpcPort + 1;

            // Check if RNode is already running
            rnodeAvailable = await checkRNodeStatus(grpcHost, httpPort);

            if (rnodeAvailable) {
                logger.info('RNode is already running and available');
            } else if (autoStartRNode) {
                // Try to start RNode if autoStart is enabled
                const rnodePath = await findRNodeExecutable();
                if (rnodePath) {
                    logger.info('RNode executable found, attempting to start...');

                    // Start RNode
                    if (await startRNode(rnodePath)) {
                        // Wait for RNode to be ready
                        rnodeAvailable = await waitForRNodeReady(grpcHost, httpPort);
                        if (!rnodeAvailable) {
                            logger.warn('RNode did not become ready in time');
                        }
                    } else {
                        logger.warn('Failed to start RNode');
                    }
                } else {
                    logger.warn('RNode executable not found on PATH or configured location');
                }
            }

            // If we're supposed to use gRPC but RNode is not available, warn the user
            if (!rnodeAvailable) {
                logger.warn('gRPC backend selected but RNode is not available');
                logger.warn('Falling back to parser-only validation (--no-rnode)');

                vscode.window.showWarningMessage(
                    `RNode is not available at ${grpcAddress}. Using parser-only validation.`,
                    'Start RNode', 'Switch to Rust Backend', 'Ignore'
                ).then(choice => {
                    if (choice === 'Start RNode') {
                        vscode.window.showInformationMessage(
                            'To start RNode, ensure it is installed and run: rnode run --standalone',
                            'View Documentation'
                        ).then(docChoice => {
                            if (docChoice === 'View Documentation') {
                                vscode.env.openExternal(vscode.Uri.parse('https://rchain.coop/'));
                            }
                        });
                    } else if (choice === 'Switch to Rust Backend') {
                        config.update('validatorBackend', 'rust', vscode.ConfigurationTarget.Workspace).then(() => {
                            vscode.window.showInformationMessage('Switched to Rust backend. Restart required.', 'Restart Now').then(restartChoice => {
                                if (restartChoice === 'Restart Now') {
                                    vscode.commands.executeCommand('rholang.restartServer');
                                }
                            });
                        });
                    }
                });
            }
        }

        const args: string[] = [
            "--no-color",  // Disable ANSI color escape codes
            "--client-process-id", process.pid.toString(),
            "--log-level", logLevel
        ];

        // Add wire logging flag if enabled
        if (wireLog) {
            args.push("--wire-log");
            logger.info('Wire logging enabled - LSP protocol messages will be logged');
        }

        // Always pass validator backend explicitly
        if (validatorBackend === 'grpc') {
            args.push("--validator-backend", `grpc:${grpcAddress}`);
            logger.info(`Starting language server with gRPC backend at ${grpcAddress}`);
        } else if (validatorBackend === 'rust') {
            args.push("--validator-backend", "rust");
            logger.info('Starting language server with Rust backend');
        } else {
            // Unknown backend - default to rust
            logger.warn(`Unknown validator backend '${validatorBackend}', defaulting to 'rust'`);
            args.push("--validator-backend", "rust");
        }

        // Add extra user-specified arguments at the end
        // This allows users to override built-in arguments if needed
        if (extraArgs.length > 0) {
            // Validate that extraArgs is actually an array of strings
            const validatedArgs = extraArgs.filter(arg => typeof arg === 'string' && arg.length > 0);
            if (validatedArgs.length !== extraArgs.length) {
                logger.warn(`Some extra arguments were invalid and ignored. Expected strings, got: ${JSON.stringify(extraArgs)}`);
            }
            if (validatedArgs.length > 0) {
                args.push(...validatedArgs);
                logger.debug(`Added ${validatedArgs.length} extra argument(s)`);
            }
        }

        const serverOptions: ServerOptions = {
            command: serverPath,
            args: args,
            transport: TransportKind.stdio,
            options: {
                env: {
                    RUST_BACKTRACE: '1'
                }
            }
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                {
                    scheme: 'file',
                    language: 'rholang',
                },
            ],
            synchronize: {
                // Automatically synchronize the 'rholang' configuration section to the server
                // This causes VSCode to send workspace/didChangeConfiguration notifications
                // when any rholang.* setting changes
                configurationSection: 'rholang',
                fileEvents: vscode.workspace.createFileSystemWatcher('**/*.rho'),
            },
            outputChannel: logger,
            connectionOptions: {
                maxRestartCount: 5,  // Limit restarts to prevent infinite loops
            },
            middleware: createCompletionMiddleware(config),
        };

        const indentSize: number = 4;
        logger.debug(`serverOptions: ${JSON.stringify(serverOptions, undefined, indentSize)}`);
        logger.debug(`clientOptions: ${JSON.stringify(clientOptions, undefined, indentSize)}`);

        client = new LanguageClient(
            'Rholang',
            'Rholang',
            serverOptions,
            clientOptions,
        );

        // Show progress notification while starting
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Starting Rholang language server...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0 });

            try {
                await client.start();
                progress.report({ increment: 100, message: "Server started successfully" });
                logger.info('Rholang extension activated!');
            } catch (err: any) {
                logger.error(`Failed to start language server: ${err.message}`);
                vscode.window.showErrorMessage(
                    `Failed to start Rholang language server: ${err.message}`,
                    'View Logs', 'Check Settings'
                ).then(choice => {
                    if (choice === 'View Logs') {
                        logger.show();
                    } else if (choice === 'Check Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'rholang');
                    }
                });
                throw err;
            }
        });

        // Update status bar to show connected state
        updateStatusBar(validatorBackend, true);

        // Register server menu command
        context.subscriptions.push(
            vscode.commands.registerCommand('rholang.showServerMenu', async () => {
                const items: vscode.QuickPickItem[] = [
                    {
                        label: '$(sync) Restart Language Server',
                        description: 'Restart the Rholang language server'
                    },
                    {
                        label: '$(output) Show Server Output',
                        description: 'Open the Rholang output channel'
                    },
                    {
                        label: '$(server) Change Validator Backend',
                        description: `Current: ${validatorBackend}`
                    }
                ];

                const selection = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Rholang Language Server'
                });

                if (!selection) {
                    return;
                }

                if (selection.label.includes('Restart')) {
                    vscode.commands.executeCommand('rholang.restartServer');
                } else if (selection.label.includes('Output')) {
                    logger.show();
                } else if (selection.label.includes('Backend')) {
                    const backend = await vscode.window.showQuickPick(
                        [
                            { label: 'Rust', description: 'Fast, embedded interpreter' },
                            { label: 'gRPC', description: 'Connect to RNode server' }
                        ],
                        { placeHolder: 'Select validator backend' }
                    );

                    if (backend) {
                        const configBackend = backend.label.toLowerCase();
                        await config.update('validatorBackend', configBackend, vscode.ConfigurationTarget.Workspace);
                        vscode.window.showInformationMessage(
                            `Validator backend changed to ${backend.label}. Restart the language server for changes to take effect.`,
                            'Restart Now'
                        ).then(choice => {
                            if (choice === 'Restart Now') {
                                vscode.commands.executeCommand('rholang.restartServer');
                            }
                        });
                    }
                }
            })
        );

        // Register command to restart the language server
        context.subscriptions.push(
            vscode.commands.registerCommand('rholang.restartServer', async () => {
                if (!client) {
                    vscode.window.showErrorMessage('Rholang language server is not running');
                    return;
                }

                try {
                    logger.info('Restarting language server...');
                    vscode.window.showInformationMessage('Restarting Rholang language server...');

                    // Update status bar to show disconnected
                    const currentConfig = vscode.workspace.getConfiguration('rholang');
                    const currentBackend = currentConfig.get<string>('validatorBackend') ?? 'rust';
                    updateStatusBar(currentBackend, false);

                    await client.stop();
                    await client.start();

                    // Update status bar to show connected
                    updateStatusBar(currentBackend, true);

                    logger.info('Language server restarted successfully');
                    vscode.window.showInformationMessage('Rholang language server restarted successfully');
                } catch (err: any) {
                    logger.error(`Failed to restart language server: ${err.message}`);
                    vscode.window.showErrorMessage(`Failed to restart Rholang language server: ${err.message}`);

                    // Update status bar to show error state
                    const currentConfig = vscode.workspace.getConfiguration('rholang');
                    const currentBackend = currentConfig.get<string>('validatorBackend') ?? 'rust';
                    updateStatusBar(currentBackend, false);
                }
            })
        );

        // Register command to show server output
        context.subscriptions.push(
            vscode.commands.registerCommand('rholang.showServerOutput', () => {
                logger.show();
            })
        );

        // Register command to toggle wire logging
        context.subscriptions.push(
            vscode.commands.registerCommand('rholang.toggleWireLog', async () => {
                const currentValue = config.get<boolean>('server.wireLog') ?? false;
                await config.update('server.wireLog', !currentValue, vscode.ConfigurationTarget.Workspace);

                const newValue = !currentValue;
                vscode.window.showInformationMessage(
                    `Wire logging ${newValue ? 'enabled' : 'disabled'}. Restart the language server for changes to take effect.`,
                    'Restart Now'
                ).then(choice => {
                    if (choice === 'Restart Now') {
                        vscode.commands.executeCommand('rholang.restartServer');
                    }
                });
            })
        );

        // Register command to show server information
        context.subscriptions.push(
            vscode.commands.registerCommand('rholang.showServerInfo', async () => {
                const currentBackend = config.get<string>('validatorBackend') ?? 'rust';
                const currentLogLevel = config.get<string>('server.logLevel') ?? 'info';
                const wireLogEnabled = config.get<boolean>('server.wireLog') ?? false;
                const extraArgs = config.get<string[]>('server.extraArgs') ?? [];
                const grpcAddr = config.get<string>('grpcAddress') ?? 'localhost:40402';

                const info = [
                    '**Rholang Language Server Information**',
                    '',
                    `**Server Path:** \`${serverPath}\``,
                    `**Validator Backend:** ${currentBackend}`,
                    currentBackend === 'grpc' ? `**gRPC Address:** ${grpcAddr}` : '',
                    `**Log Level:** ${currentLogLevel}`,
                    `**Wire Logging:** ${wireLogEnabled ? 'Enabled' : 'Disabled'}`,
                    extraArgs.length > 0 ? `**Extra Arguments:** \`${extraArgs.join(' ')}\`` : '',
                    '',
                    `**Client Status:** ${client && client.isRunning() ? '✓ Connected' : '✗ Disconnected'}`,
                    '',
                    '**Server Capabilities:**',
                    '- ✓ Completion',
                    '- ✓ Hover',
                    '- ✓ Signature Help',
                    '- ✓ Go to Definition',
                    '- ✓ Find References',
                    '- ✓ Document Symbols',
                    '- ✓ Workspace Symbols',
                    '- ✓ Document Highlighting',
                    '- ✓ Rename',
                    '- ✓ Semantic Tokens (embedded languages)',
                ].filter(line => line !== '').join('\n');

                const panel = vscode.window.createWebviewPanel(
                    'rholangServerInfo',
                    'Rholang Server Information',
                    vscode.ViewColumn.One,
                    {}
                );

                panel.webview.html = `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Server Information</title>
                    <style>
                        body {
                            font-family: var(--vscode-font-family);
                            padding: 20px;
                            color: var(--vscode-foreground);
                            background-color: var(--vscode-editor-background);
                        }
                        code {
                            background-color: var(--vscode-textCodeBlock-background);
                            padding: 2px 6px;
                            border-radius: 3px;
                            font-family: var(--vscode-editor-font-family);
                        }
                        h1 {
                            border-bottom: 1px solid var(--vscode-panel-border);
                            padding-bottom: 10px;
                        }
                        ul {
                            line-height: 1.8;
                        }
                    </style>
                </head>
                <body>
                    ${info.split('\n').map(line => {
                        if (line.startsWith('**') && line.endsWith('**')) {
                            return `<h1>${line.replace(/\*\*/g, '')}</h1>`;
                        } else if (line.startsWith('**')) {
                            return `<p>${line.replace(/\*\*/g, '<strong>').replace(/\*\*/g, '</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`;
                        } else if (line.startsWith('- ')) {
                            return `<li>${line.substring(2)}</li>`;
                        } else if (line === '') {
                            return '<br/>';
                        } else {
                            return `<p>${line}</p>`;
                        }
                    }).join('\n')}
                </body>
                </html>`;
            })
        );
    } else {
        logger.info('Failed to find rholang.server.path:', serverPath);
    }
}

export function deactivate(): Thenable<void> | undefined {
    // Stop RNode if it's running
    stopRNode();

    if (!client) {
        return undefined;
    }
    // Stop the client and server
    return client.stop();
}
