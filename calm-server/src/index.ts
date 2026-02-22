/**
 * CALM Server - A server implementation for the Common Architecture Language Model
 */

import { version } from '../package.json';

const main = async () => {
    console.log(`CALM Server v${version}`);
    console.log('Server is starting...');
};

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
