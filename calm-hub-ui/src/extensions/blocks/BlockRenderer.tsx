import { ScreenBlock } from '../../model/extensions.js';
import { FormBlock, FormSlot } from '../forms/FormBlock.js';
import type { HeadingLevel } from '../Heading.js';
import { alertClass } from '../tone.js';
import { CardsBlock } from './CardsBlock.js';
import { KeyValueBlock } from './KeyValueBlock.js';
import { LinksBlock } from './LinksBlock.js';
import { MarkdownBlock } from './MarkdownBlock.js';
import { StatsBlock } from './StatsBlock.js';
import { TableBlock } from './TableBlock.js';

interface BlockRendererProps {
    block: ScreenBlock;
    /** The level of the slot title: headings in the block go below it. */
    headingLevel?: HeadingLevel;
    /** The slot that shows the block. Without it, such as in a landing card, a form block does not show. */
    formSlot?: FormSlot;
}

export function BlockRenderer({ block, headingLevel = 2, formSlot }: BlockRendererProps) {
    switch (block.type) {
        case 'markdown':
            return <MarkdownBlock text={block.text} headingLevel={headingLevel} />;
        case 'keyValue':
            return <KeyValueBlock items={block.items} />;
        case 'stats':
            return <StatsBlock items={block.items} />;
        case 'table':
            return <TableBlock block={block} />;
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
        case 'form':
            return formSlot ? (
                <FormBlock formId={block.form} slot={formSlot} headingLevel={headingLevel} />
            ) : (
                <p className="text-sm text-base-content/50 italic">This place cannot show a form.</p>
            );
        default:
            return <p className="text-sm text-base-content/50 italic">This screen has a block type that this CALM Hub cannot show.</p>;
    }
}
