declare module 'svg-parser' {
    interface RootNode {
        type: 'root';
        children: ElementNode[];
    }

    interface ElementNode {
        type: 'element';
        tagName: string;
        properties: Record<string, string | number>;
        children: (ElementNode | TextNode)[];
        metadata?: string;
    }

    interface TextNode {
        type: 'text';
        value: string;
    }

    function parse(source: string): RootNode;
}
