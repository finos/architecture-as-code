import { ScreenBlock } from '../../model/extensions.js';
import type { HeadingLevel } from '../Heading.js';
import { alertClass } from '../tone.js';
import { CardsBlock } from './CardsBlock.js';
import { KeyValueBlock } from './KeyValueBlock.js';
import { LinksBlock } from './LinksBlock.js';
import { MarkdownBlock } from './MarkdownBlock.js';
import { StatsBlock } from './StatsBlock.js';
import { TableBlock } from './TableBlock.js';

/** `headingLevel` is the level of the slot title: headings in the block go below it. */
export function BlockRenderer({ block, headingLevel = 2 }: { block: ScreenBlock; headingLevel?: HeadingLevel }) {
    switch (block.type) {
        case 'markdown':
            return <MarkdownBlock text={block.text} headingLevel={headingLevel} />;
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
                <div role="alert" className={`alert ${alertClass(block.tone)}`}>
                    <span>{block.text}</span>
                </div>
            );
        case 'links':
            return <LinksBlock items={block.items} />;
        default:
            return <p className="text-sm text-base-content/50 italic">This screen has a block type that this CALM Hub cannot show.</p>;
    }
}
