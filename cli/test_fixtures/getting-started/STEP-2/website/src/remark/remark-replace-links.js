import { visit } from 'unist-util-visit';
/* eslint-disable no-undef */
module.exports = function remarkReplaceLinks() {
    return (tree) => {
        visit(tree, 'link', (node) => {
            if (node.url && node.url.startsWith('https://calm.finos.org/traderx/control-requirements/')) {
                const lastSegment = node.url.split('/').pop();
                node.url = `/control-requirements/${lastSegment}`;

                // Ensure node.properties exists before setting attributes
                node.data = node.data || {};
                node.data.hProperties = node.data.hProperties || {};
                node.data.hProperties.target = '_blank';
                node.data.hProperties.rel = 'noopener noreferrer';
            }
        });
    };
};
