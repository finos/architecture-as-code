import { execFileSync } from 'child_process';
import path from 'path';
import { waitForHub } from './harness/hub-ready';

const COMPOSE_FILE = path.resolve(__dirname, 'docker-compose.yml');
export const SMOKE_HUB_URL = 'http://localhost:8080';

function compose(args: string[]): void {
    execFileSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], { stdio: 'inherit' });
}

/**
 * Vitest globalSetup: bring up one shared CalmHub for the whole smoke run and
 * tear it down (wiping the Mongo volume) afterwards.
 */
export default async function setup(): Promise<() => Promise<void>> {
    try {
        execFileSync('docker', ['image', 'inspect', 'calm-hub:smoke'], { stdio: 'ignore' });
    } catch {
        throw new Error(
            'calm-hub:smoke image not found. Build it first: bash scripts/build-hub-smoke-image.sh'
        );
    }

    try {
        compose(['up', '-d']);
        await waitForHub(SMOKE_HUB_URL);
    } catch (err) {
        try {
            compose(['logs']);
        } catch {
            // Best-effort diagnostics; never let a logs failure skip teardown.
        }
        try {
            compose(['down', '-v']);
        } catch {
            // Best-effort teardown; never let a down failure mask the original error.
        }
        throw err;
    }

    return async () => {
        compose(['down', '-v']);
    };
}
