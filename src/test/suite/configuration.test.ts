import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Configuration Test Suite', () => {
    test('Default configuration values should be correct', () => {
        const config = vscode.workspace.getConfiguration('rholang');

        assert.strictEqual(config.get('server.path'), 'rholang-language-server');
        assert.strictEqual(config.get('server.logLevel'), 'info');
        assert.strictEqual(config.get('server.wireLog'), false);
        assert.strictEqual(config.get('validatorBackend'), 'rust');
        assert.strictEqual(config.get('grpcAddress'), 'localhost:40402');
        assert.strictEqual(config.get('rnode.autoStart'), true);
    });

    test('Completion configuration should have correct defaults', () => {
        const config = vscode.workspace.getConfiguration('rholang');

        assert.strictEqual(config.get('completion.forceIncomplete'), true);
        assert.strictEqual(config.get('completion.preserveSortText'), true);
        assert.strictEqual(config.get('completion.ensureFilterText'), true);
    });

    test('Extra args should default to empty array', () => {
        const config = vscode.workspace.getConfiguration('rholang');
        const extraArgs = config.get<string[]>('server.extraArgs');

        assert.ok(Array.isArray(extraArgs));
        assert.strictEqual(extraArgs!.length, 0);
    });
});
