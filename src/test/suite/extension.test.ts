import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('F1R3FLY-io.f1r3fly-io-rholang'));
    });

    test('Extension should activate', async () => {
        const ext = vscode.extensions.getExtension('F1R3FLY-io.f1r3fly-io-rholang');
        assert.ok(ext);
        await ext!.activate();
        assert.strictEqual(ext!.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('rholang.restartServer'));
        assert.ok(commands.includes('rholang.showServerMenu'));
    });
});
