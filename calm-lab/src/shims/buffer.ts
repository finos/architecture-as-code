// Stands in for `buffer` in the browser bundle. Nothing on the browser path constructs a Buffer;
// the export exists only so `import { Buffer } from 'buffer'` resolves.
export const Buffer = undefined;
export default { Buffer };
