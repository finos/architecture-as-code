import * as joint from "@joint/core";

export const TextElement = joint.dia.Element.define('TextElement', {
    attrs: {
        label: {
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
            fontSize: 16
        },
        r: {
            strokeWidth: 1,
            stroke: '#000000',
            fill: '#FFFFFF'
        }
    }
}, {
    markup: [{
        tagName: 'rect',
        selector: 'r'
    }, {
        tagName: 'text',
        selector: 'label'
    }]
});