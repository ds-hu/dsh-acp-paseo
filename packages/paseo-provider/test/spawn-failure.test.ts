import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AcpSessionClient } from '../server/acp-client.js';
import { createDeepseekHarnessProvider } from '../server/provider.js';

function missingCommand(label: string): string {
  return join(tmpdir(), `missing-dsh-${label}-${process.pid}-${Date.now()}`);
}

describe('spawn failures', () => {
  it('reports a spawn failure and rejects the pending request instead of crashing', async () => {
    const log: string[] = [];
    const client = new AcpSessionClient({
      onUpdate: () => undefined,
      onPermission: async () => ({ outcome: { outcome: 'cancelled' } }),
      onQuestions: async () => ({ answers: [] }),
      onLog: (message) => log.push(message),
    });
    client.connectToProcess({ command: [missingCommand('client')], env: {}, cwd: tmpdir() });

    await expect(client.initialize()).rejects.toThrow();
    expect(log.join('\n')).toContain('dsh spawn failed');
    await client.close();
  });

  it('falls back to default probe capabilities when the launch command cannot be spawned', async () => {
    const errors: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    try {
      const provider = createDeepseekHarnessProvider();
      const connection = await provider.connect({
        versions: [1],
        capabilities: [],
        launch: { command: missingCommand('probe'), args: [], env: {} },
      } as any);
      expect(connection).toBeDefined();
      expect(errors.some((args) => String(args[0]).includes('spawn failed'))).toBe(true);
      await connection.close();
    } finally {
      spy.mockRestore();
    }
  });
});
