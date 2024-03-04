import * as joint from "@joint/core";
import { Node } from './Types';

export class ShapeFactory {
    constructor(private graph: joint.dia.Graph) {}

    public createRectangleNode(node: Node): joint.shapes.standard.Rectangle {
        return new joint.shapes.standard.Rectangle({ z: 2 })
            .resize(200, 40)
            .attr({
                body: {
                    fill: '#44CCFF'
                },
                label: {
                    text: node.name,
                    fill: 'black'
                }
            }).prop('extra', node.extras)
            .addTo(this.graph);
    }
    
    public createInternalNetworkNode(node: Node): joint.shapes.standard.Rectangle {
        return new joint.shapes.standard.Rectangle({ z: 1 })
            .attr({
                body: {
                    strokeDasharray: '10,2',
                },
                label: {
                    text: node.name,
                    fill: 'black',
                    yAlignment: 'top',
                    refY: -20
                }
            }).prop('extra', node.extras)
            .addTo(this.graph);
    }
    
    public createCircleNode(node: Node): joint.shapes.standard.Circle {
        return new joint.shapes.standard.Circle()
            .resize(100, 100)
            .attr({
                body: {
                    fill: '#66DD33'
                },
                label: {
                    text: node.name,
                    fill: 'black'
                }
            }).prop('extra', node.extras)
            .addTo(this.graph);
    }
}
