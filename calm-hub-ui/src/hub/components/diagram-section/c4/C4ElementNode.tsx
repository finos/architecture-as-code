import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { colors } from '../../../../theme/colors.js';
import { C4_EXTERNAL_LABEL, C4_KIND_LABEL, c4Fill } from './c4Display.js';
import { C4_ELEMENT_HEIGHT, C4_ELEMENT_WIDTH, type C4ElementData } from './c4Layout.js';

const SIDES = [
    { id: 't', position: Position.Top },
    { id: 'b', position: Position.Bottom },
    { id: 'l', position: Position.Left },
    { id: 'r', position: Position.Right },
];

function Chip({ background, text }: { background: string; text: string }) {
    return (
        <span style={{ background, color: colors.c4.onFill, fontSize: 10, borderRadius: 9, padding: '1px 7px', whiteSpace: 'nowrap' }}>
            {text}
        </span>
    );
}

export function C4ElementNode({ data }: NodeProps<Node<C4ElementData>>) {
    const { element, canOpen } = data;
    const background = c4Fill(element);
    const onComponent = background === colors.c4.component;
    const guessed = element.source === 'structure';
    const kind = element.source === 'implicit' ? 'Software System, implicit' : (C4_KIND_LABEL[element.kind] ?? element.kind);
    const typeLine = `[${kind}${element.nodeType ? `: ${element.nodeType}` : ''}]`;
    return (
        <div
            data-testid={`c4-element-${element.id}`}
            title={[canOpen ? 'Click to open the next level' : '', ...element.notes].filter(Boolean).join('\n') || undefined}
            style={{
                width: C4_ELEMENT_WIDTH,
                height: C4_ELEMENT_HEIGHT,
                background,
                color: onComponent ? colors.c4.onComponent : colors.c4.onFill,
                borderRadius: element.kind === 'person' ? 28 : 8,
                border: guessed ? `2px dashed ${colors.c4.guessed}` : '1px solid rgba(0,0,0,0.25)',
                padding: '12px 12px 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxSizing: 'border-box',
                position: 'relative',
                cursor: canOpen ? 'pointer' : 'default',
            }}
        >
            {SIDES.map(({ id, position }) => (
                <span key={id}>
                    <Handle id={`${id}-s`} type="source" position={position} style={{ opacity: 0 }} isConnectable={false} />
                    <Handle id={`${id}-t`} type="target" position={position} style={{ opacity: 0 }} isConnectable={false} />
                </span>
            ))}
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: '18px' }}>{element.name}</div>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>{typeLine}</div>
            <div
                style={{
                    fontSize: 11,
                    lineHeight: '14px',
                    marginTop: 6,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}
            >
                {element.description}
            </div>
            {(guessed || element.external.length > 0) && (
                <div style={{ position: 'absolute', top: -10, right: 8, display: 'flex', gap: 4 }}>
                    {guessed && <Chip background={colors.c4.guessed} text="guessed" />}
                    {element.external.map((reason) => (
                        <Chip key={reason} background="#374151" text={C4_EXTERNAL_LABEL[reason] ?? reason} />
                    ))}
                </div>
            )}
        </div>
    );
}
