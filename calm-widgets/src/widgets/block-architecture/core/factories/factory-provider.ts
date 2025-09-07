import { VMNodeFactory, VMEdgeFactory } from './vm-factory-interfaces';
import { StandardVMNodeFactory } from './node-factory';
import { StandardVMEdgeFactory } from './edge-factory';

/**
 * Factory provider for creating standard VM factories with default implementations.
 * Provides a centralized way to obtain factory instances with dependency injection support.
 */
export class VMFactoryProvider {
    private static nodeFactory: VMNodeFactory = new StandardVMNodeFactory();
    private static edgeFactory: VMEdgeFactory = new StandardVMEdgeFactory();

    static getNodeFactory(): VMNodeFactory {
        return this.nodeFactory;
    }

    static getEdgeFactory(): VMEdgeFactory {
        return this.edgeFactory;
    }

    /**
     * Allows injection of custom factory implementations for testing or customization
     */
    static setFactories(nodeFactory?: VMNodeFactory, edgeFactory?: VMEdgeFactory): void {
        if (nodeFactory) this.nodeFactory = nodeFactory;
        if (edgeFactory) this.edgeFactory = edgeFactory;
    }

    /**
     * Resets to default factory implementations
     */
    static resetToDefaults(): void {
        this.nodeFactory = new StandardVMNodeFactory();
        this.edgeFactory = new StandardVMEdgeFactory();
    }
}
