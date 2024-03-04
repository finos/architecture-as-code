import './App.css'
import { JointGraph } from './JointGraph';
import { ComposedOfRelationship, ConnectsRelationship, DeployedInRelationship, InteractsRelationship, Node, Relationship } from './Types'
import * as calmSpec from './assets/traderx-calm.json';

function App() {
    const nodes: Node[] = calmSpec.nodes.map(node => {
        return {
            name: node.name,
            class: 'box',
            uniqueId: node.uniqueId,
            nodeType: node['node-type'],
            extras: node
        }
    });

    const relationships: Relationship[] = calmSpec.relationships.map(relationship => {
        if (relationship['relationship-type'] === 'connects') {
            return {
                relationshipType: 'connects',
                uniqueId: relationship.uniqueId,
                protocol: relationship.protocol,
                authentication: relationship.authentication!,
                parties: relationship.parties
            } as ConnectsRelationship;
        } else if (relationship['relationship-type'] === 'deployed-in') {
            return {
                relationshipType: 'deployed-in',
                uniqueId: relationship.uniqueId,
                parties: relationship.parties
            } as DeployedInRelationship;
        } else if (relationship['relationship-type'] === 'interacts') {
            return {
                relationshipType: 'interacts',
                uniqueId: relationship.uniqueId,
                parties: relationship.parties
            } as InteractsRelationship;
        } else if (relationship['relationship-type'] === 'composed-of') {
            return {
                relationshipType: 'composed-of',
                uniqueId: relationship.uniqueId,
                parties: relationship.parties
            } as ComposedOfRelationship;
        } else {
            throw new Error('Unknown relationship type!');
        }
    });

    return (
        <div style={{
            backgroundColor: 'white',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            <JointGraph nodes={nodes} relationships={relationships} />
        </div>
    );
}

export default App;
