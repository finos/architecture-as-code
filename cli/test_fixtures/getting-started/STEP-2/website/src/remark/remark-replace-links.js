import { visit } from 'unist-util-visit';

export default function remarkReplaceLinks() {
    return (tree) => {
        visit(tree, 'link', (node) => {
            if (node.url ) {
                const lastSegment = node.url.split('/').pop();
                node.url = `/control-requirements/${lastSegment}`;

                node.data = node.data || {};
                node.data.hProperties = node.data.hProperties || {};
                node.data.hProperties.target = '_blank';
                node.data.hProperties.rel = 'noopener noreferrer';
            }
        });
    };
};