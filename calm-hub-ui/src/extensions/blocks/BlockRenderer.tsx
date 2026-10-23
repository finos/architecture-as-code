import { ScreenBlock } from '../../model/extensions.js';
import { AdrMarkdown } from '../../hub/components/adr-renderer/AdrMarkdown.js';
import { ALERT_CLASS } from '../tone.js';
import { CardsBlock } from './CardsBlock.js';
import { KeyValueBlock } from './KeyValueBlock.js';
import { LinksBlock } from './LinksBlock.js';
import { StatsBlock } from './StatsBlock.js';
import { TableBlock } from './TableBlock.js';

export function BlockRenderer({ block }: { block: ScreenBlock }) {
    switch (block.type) {
        case 'markdown':
            return <AdrMarkdown label="Extension">{block.text}</AdrMarkdown>;
        case 'keyValue':
            return <KeyValueBlock items={block.items} />;
        case 'stats':
            return <StatsBlock items={block.items} />;
        case 'table':
            return <TableBlock columns={block.columns} rows={block.rows} />;
        case 'cards':
            return <CardsBlock items={block.items} />;
        case 'alert':
            return (
                <div role="alert" className={`alert ${ALERT_CLASS[block.tone ?? 'info']}`}>
                    <span>{block.text}</span>
                </div>
            );
        case 'links':
            return <LinksBlock items={block.items} />;
        default:
            return (
                <p className="text-sm text-base-content/50 italic">
                    This screen has a block type that this CALM Hub cannot show.
                </p>
            );
    }
}
