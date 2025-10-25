"use strict";

import fs from 'fs';
import * as vscode from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import which from "which";
import { ChildProcess, spawn } from 'child_process';
import http from 'http';

let client: LanguageClient;
let logger: vscode.LogOutputChannel;
let rnodeProcess: ChildProcess | null = null;
let rnodeStartedByUs: boolean = false;

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

export async function activate(context: vscode.ExtensionContext) {
    logger = vscode.window.createOutputChannel('Rholang', {
        log: true
    });

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

        logger.info('=== Rholang Extension Configuration ===');
        logger.info(`Validator backend: ${validatorBackend}`);
        logger.info(`gRPC address: ${grpcAddress}`);
        logger.info(`Auto-start RNode: ${autoStartRNode}`);
        logger.info(`Server path: ${serverPath}`);

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
            }
        }

        const args: string[] = [
            "--no-color",  // Disable ANSI color escape codes
            "--client-process-id", process.pid.toString()
        ];

        // Add validator backend configuration
        // NOTE: We only pass --validator-backend when using gRPC AND RNode is available
        if (validatorBackend === 'grpc' && rnodeAvailable) {
            args.push("--validator-backend", `grpc:${grpcAddress}`);
            logger.info(`Starting language server with gRPC backend at ${grpcAddress}`);
        } else if (validatorBackend === 'grpc' && !rnodeAvailable) {
            // User wanted gRPC but RNode is not available - use --no-rnode for parser-only validation
            args.push("--no-rnode");
            logger.info('Starting language server with --no-rnode (parser-only validation)');
        } else if (validatorBackend !== 'rust') {
            logger.warn(`Unknown validator backend '${validatorBackend}', defaulting to 'rust'`);
        } else {
            // validatorBackend === 'rust' - don't pass --validator-backend (use language server default)
            logger.info('Starting language server with Rust backend (default)');
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
                fileEvents: vscode.workspace.createFileSystemWatcher('**/*.rho'),
            },
            outputChannel: logger,
            connectionOptions: {
                maxRestartCount: 5,  // Limit restarts to prevent infinite loops
            },
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

        client.start();
        logger.info('Rholang extension activated!');
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
