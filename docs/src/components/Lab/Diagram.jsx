import React from 'react';
import styles from './lab.module.css';

const NODE_W = 170;
const NODE_H = 64;
const GAP_X = 64;
const GAP_Y = 56;
const PAD = 24;
const PER_ROW = 3;

function truncate(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function edgeEndpoints(a, b) {
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const halfW = NODE_W / 2 + 6;
    const halfH = NODE_H / 2 + 6;
    const exit = (delta) =>
        Math.min(
            delta.x !== 0 ? halfW / Math.abs(delta.x) : Infinity,
            delta.y !== 0 ? halfH / Math.abs(delta.y) : Infinity,
            0.45,
        );
    const t = exit({x: dx, y: dy});
    return {
        x1: a.cx + dx * t,
        y1: a.cy + dy * t,
        x2: b.cx - dx * t,
        y2: b.cy - dy * t,
    };
}

export default function Diagram({jsonText}) {
    let doc = null;
    try {
        doc = JSON.parse(jsonText);
    } catch {
        doc = null;
    }

    const nodes = Array.isArray(doc?.nodes)
        ? doc.nodes.filter((node) => node && typeof node === 'object')
        : [];

    let body;
    if (!doc) {
        body = <div className={styles.diagramEmpty}>fix the JSON to see the diagram</div>;
    } else if (nodes.length === 0) {
        body = <div className={styles.diagramEmpty}>add a node to see the diagram</div>;
    } else {
        const positions = new Map();
        nodes.forEach((node, index) => {
            const col = index % PER_ROW;
            const row = Math.floor(index / PER_ROW);
            const x = PAD + col * (NODE_W + GAP_X);
            const y = PAD + row * (NODE_H + GAP_Y);
            const id = node['unique-id'];
            const position = {x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2};
            if (typeof id === 'string' && !positions.has(id)) {
                positions.set(id, position);
            }
            positions.set(`#${index}`, position);
        });

        const relationships = Array.isArray(doc.relationships) ? doc.relationships : [];
        const edges = [];
        relationships.forEach((relationship, index) => {
            const connects = relationship?.['relationship-type']?.connects;
            const source = positions.get(connects?.source?.node);
            const destination = positions.get(connects?.destination?.node);
            if (source && destination && source !== destination) {
                edges.push({key: `edge-${index}`, ...edgeEndpoints(source, destination)});
            }
        });

        const cols = Math.min(nodes.length, PER_ROW);
        const rows = Math.ceil(nodes.length / PER_ROW);
        const width = PAD * 2 + cols * NODE_W + (cols - 1) * GAP_X;
        const height = PAD * 2 + rows * NODE_H + (rows - 1) * GAP_Y;

        body = (
            <svg
                className={styles.diagramSvg}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Live diagram of the nodes and relationships in your CALM architecture">
                <defs>
                    <marker
                        id="lab-arrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#4da3ff" />
                    </marker>
                </defs>
                {edges.map((edge) => (
                    <line
                        key={edge.key}
                        x1={edge.x1}
                        y1={edge.y1}
                        x2={edge.x2}
                        y2={edge.y2}
                        stroke="#4da3ff"
                        strokeWidth="1.6"
                        strokeDasharray="5 4"
                        markerEnd="url(#lab-arrow)"
                    />
                ))}
                {nodes.map((node, index) => {
                    const position = positions.get(`#${index}`);
                    const label = node.name || node['unique-id'] || `node ${index + 1}`;
                    return (
                        <g key={index}>
                            <rect
                                x={position.x}
                                y={position.y}
                                width={NODE_W}
                                height={NODE_H}
                                rx="10"
                                fill="#101743"
                                stroke="#2bbf9a"
                                strokeWidth="1.5"
                            />
                            <text
                                x={position.cx}
                                y={position.cy - 4}
                                textAnchor="middle"
                                fill="#e6ecff"
                                fontSize="13"
                                fontWeight="600">
                                {truncate(String(label), 20)}
                            </text>
                            <text
                                x={position.cx}
                                y={position.cy + 16}
                                textAnchor="middle"
                                fill="#8b96c9"
                                fontSize="11"
                                fontFamily="var(--ifm-font-family-monospace)">
                                {truncate(String(node['node-type'] || ''), 24)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        );
    }

    return (
        <div className={styles.diagramPane}>
            <div className={styles.paneHeader}>
                <span className={styles.paneDots} aria-hidden="true">
                    <i /><i /><i />
                </span>
                diagram
            </div>
            <div className={styles.diagramBox}>{body}</div>
            <div className={styles.diagramCaption}>live preview — rendered from your file</div>
        </div>
    );
}
