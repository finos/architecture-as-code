import type { LensBadge, LensNode, Paint, Part, Shape } from '../../model/lens.js';
import type { Tone } from '../../model/extensions.js';
import { FONT_SIZE, placePart, placeSlot, slotText, textWidth, type Fitted, type PlacedText } from './geometry.js';
import { DASH, type ComputedElementStyle, type ComputedGroupStyle } from './styles.js';

type Colours = Pick<ComputedElementStyle, 'background' | 'color' | 'stroke'> & { accent?: string };

function paint(value: Paint | undefined, colours: Colours, fallback: string): string {
    const chosen = value ?? fallback;
    switch (chosen) {
        case 'background':
        case 'stroke':
        case 'color':
            return colours[chosen];
        case 'accent':
            return colours.accent ?? colours.stroke;
        default:
            return chosen;
    }
}

/** The parts of a shape as SVG elements, built from the data: no markup from the notation reaches the page. */
export function ShapeParts({ shape, fit, style }: { shape: Shape; fit: Fitted; style: Colours & { strokeWidth: number; border: ComputedElementStyle['border'] } }) {
    return (
        <>
            {shape.parts.map((part: Part, index) => {
                const placed = placePart(part, fit, shape.viewBox);
                if (!placed) return null;
                const scale = part.pin ? 1 : Math.min(fit.sx, fit.sy);
                const props = {
                    fill: paint(part.fill, style, 'none'),
                    stroke: paint(part.stroke, style, 'stroke'),
                    strokeWidth: part.strokeWidth !== undefined ? part.strokeWidth * scale : style.strokeWidth,
                    strokeDasharray: DASH[part.dash ?? style.border],
                    opacity: part.opacity,
                };
                switch (placed.kind) {
                    case 'path':
                        return <path key={index} d={placed.d} {...props} />;
                    case 'rect':
                        return <rect key={index} x={placed.x} y={placed.y} width={placed.width} height={placed.height} rx={placed.rx} ry={placed.ry} {...props} />;
                    case 'ellipse':
                        return <ellipse key={index} cx={placed.cx} cy={placed.cy} rx={placed.rx} ry={placed.ry} {...props} />;
                    case 'line':
                        return <line key={index} x1={placed.x1} y1={placed.y1} x2={placed.x2} y2={placed.y2} {...props} />;
                    case 'polyline':
                        return <polyline key={index} points={placed.points} {...props} />;
                    case 'polygon':
                        return <polygon key={index} points={placed.points} {...props} />;
                }
            })}
        </>
    );
}

export function SvgText({ text, fill }: { text: PlacedText; fill: string }) {
    return (
        <>
            {text.lines.map((line, index) => (
                <text key={index} x={line.x} y={line.y} textAnchor={text.anchor} fontSize={text.size} fontWeight={text.bold ? 700 : 400} fill={fill}>
                    {line.text}
                </text>
            ))}
        </>
    );
}

const ICON = /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;

/** A `data:` image only. In an SVG image element, an SVG icon cannot run a script or load a URL. */
export function Icon({ href, x, y, size }: { href?: string; x: number; y: number; size: number }) {
    if (!href || !ICON.test(href)) return null;
    return <image href={href} x={x} y={y} width={size} height={size} preserveAspectRatio="xMidYMid meet" />;
}

const BADGE: Record<Tone, string> = { neutral: '#475569', info: '#1d4ed8', positive: '#15803d', warning: '#b45309', negative: '#b91c1c' };

/** Pills on the top edge, from the right. */
function Badges({ badges, width }: { badges: LensBadge[]; width: number }) {
    const widths = badges.map((badge) => textWidth(badge.text, FONT_SIZE.small - 1) + 14);
    const lefts = widths.map((_, index) => width - 8 - widths.slice(0, index + 1).reduce((sum, w) => sum + w + 4, -4));
    return (
        <>
            {badges.map((badge, index) => {
                const w = widths[index];
                return (
                    <g key={index} transform={`translate(${lefts[index]},-9)`} data-badge={badge.text}>
                        <rect width={w} height={18} rx={9} fill={BADGE[badge.tone ?? 'neutral']} />
                        <text x={w / 2} y={12.5} textAnchor="middle" fontSize={FONT_SIZE.small - 1} fill="#ffffff">
                            {badge.text}
                        </text>
                    </g>
                );
            })}
        </>
    );
}

/** A node: the parts of its shape, its text in the slots, its icon and its badges, in node pixels. */
export function NodeShape({ node, shape, fit, style }: { node: LensNode; shape: Shape; fit: Fitted; style: ComputedElementStyle }) {
    const slots = Object.entries(shape.slots ?? {});
    const iconSlot = shape.slots?.icon;
    return (
        <>
            <ShapeParts shape={shape} fit={fit} style={style} />
            {slots.map(([name, slot]) => {
                if (name === 'icon') return null;
                const text = placeSlot(slot, fit, slot.kind === 'list' ? node.sections?.[name] : slotText(node, name, style));
                return text && <SvgText key={name} text={text} fill={style.color} />;
            })}
            {iconSlot ? (
                <Icon href={style.icon} x={fit.x(iconSlot.x)} y={fit.y(iconSlot.y)} size={Math.min(fit.x(iconSlot.x + iconSlot.width) - fit.x(iconSlot.x), fit.y(iconSlot.y + iconSlot.height) - fit.y(iconSlot.y))} />
            ) : (
                <Icon href={style.icon} x={6} y={6} size={18} />
            )}
            {node.badges && <Badges badges={node.badges} width={fit.width} />}
        </>
    );
}

/** A group: its shape, or a plain outline, stretched to its bounds, with the label at the top left. */
export function GroupShape({ label, shape, fit, style }: { label?: string; shape?: Shape; fit: Fitted; style: ComputedGroupStyle }) {
    const colours = { background: style.background ?? 'none', color: style.color, stroke: style.stroke };
    const dash = DASH[style.border];
    const left = style.icon ? 30 : 10;
    return (
        <>
            {shape ? (
                <ShapeParts shape={shape} fit={fit} style={{ ...colours, strokeWidth: style.strokeWidth, border: style.border }} />
            ) : (
                <rect width={fit.width} height={fit.height} rx={6} fill={colours.background} stroke={style.stroke} strokeWidth={style.strokeWidth} strokeDasharray={dash} />
            )}
            <Icon href={style.icon} x={8} y={6} size={18} />
            {label && (
                <text x={left} y={20} fontSize={FONT_SIZE.normal} fontWeight={700} fill={style.color}>
                    {label}
                </text>
            )}
        </>
    );
}
