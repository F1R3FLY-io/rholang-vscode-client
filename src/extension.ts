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

let client: LanguageClient;
let logger: vscode.LogOutputChannel;

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
        const serverOptions: ServerOptions = {
            command: serverPath,
            args: [
              "--no-color",  // Disable ANSI color escape codes
            ],
            transport: TransportKind.stdio
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
                maxRestartCount: Number.MAX_SAFE_INTEGER,
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
    if (!client) {
        return undefined;
    }
    // Stop the client and server
    return client.stop();
}
