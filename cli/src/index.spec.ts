import { vi } from 'vitest';

// Mock commander and setupCLI
vi.mock('commander', () => ({
    program: { parseAsync: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('./cli', () => ({
    setupCLI: vi.fn(),
}));

// Import after mocks so the code runs with mocks in place
import { program } from 'commander';
import { setupCLI } from './cli';
import './index';

test('calls setupCLI and program.parseAsync', () => {
    expect(setupCLI).toHaveBeenCalledWith(program);
    expect(program.parseAsync).toHaveBeenCalled();
});
