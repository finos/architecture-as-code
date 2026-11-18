import { ExtensionScreen } from '../../model/extensions.js';

/** A blocks reply that this UI can render: the extension's contract version, and a list of blocks. */
export function isBlocksReply(reply: unknown, hubApi: number): reply is ExtensionScreen {
    const value = reply as ExtensionScreen | null;
    return !!value && value.hubApi === hubApi && Array.isArray(value.blocks);
}
