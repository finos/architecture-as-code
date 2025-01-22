package org.finos.calm.domain;

import java.util.Objects;

public class Flow {
    private final String namespace;
    private final int id;
    private final String version;
    private final String flow;

    private Flow(FlowBuilder builder) {
        this.namespace = builder.namespace;
        this.id = builder.id;
        this.version = builder.version;
        this.flow = builder.flow;
    }

    public String getNamespace() {
        return namespace;
    }

    public int getId() {
        return id;
    }

    public String getDotVersion() {
        return version;
    }

    public String getMongoVersion() {
        return version.replace('.', '-');
    }

    public String getFlowJson() {
        return flow;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Flow flow1 = (Flow) o;
        return id == flow1.id && Objects.equals(namespace, flow1.namespace) && Objects.equals(version, flow1.version) && Objects.equals(flow, flow1.flow);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, id, version, flow);
    }

    @Override
    public String toString() {
        return "Flow{" +
                "namespace='" + namespace + '\'' +
                ", id=" + id +
                ", version='" + version + '\'' +
                ", flow='" + flow + '\'' +
                '}';
    }

    public static class FlowBuilder {
        private String namespace;
        private int id;
        private String version;
        private String flow;

        public FlowBuilder setNamespace(String namespace) {
            this.namespace = namespace;
            return this;
        }

        public FlowBuilder setId(int id) {
            this.id = id;
            return this;
        }

        public FlowBuilder setVersion(String version) {
            this.version = version;
            return this;
        }

        public FlowBuilder setFlow(String flow) {
            this.flow = flow;
            return this;
        }

        public Flow build() {
            return new Flow(this);
        }
    }
}
