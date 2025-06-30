package org.finos.calm.mcp.api.model.adr;

import java.util.Objects;

/**
 * Represents an ADR and the associated namespace, id, and revision.
 * The ADR is represented as a String in JSON format.
 */
public class AdrMeta {
    private String namespace;
    private int id;
    private int revision;
    private Adr adr;

    public AdrMeta() {

    }

    public AdrMeta(String namespace, int id, int revision, Adr adr) {
        this.namespace = namespace;
        this.id = id;
        this.revision = revision;
        this.adr = adr;
    }

    public String getNamespace() {
        return namespace;
    }

    public int getId() {
        return id;
    }

    public int getRevision() {
        return revision;
    }

    public Adr getAdr() {
        return adr;
    }

    @Override
    public boolean equals(Object obj) {
        if(obj == this) return true;
        if(obj == null || obj.getClass() != this.getClass()) return false;
        var that = (AdrMeta) obj;
        return Objects.equals(this.namespace, that.namespace) &&
                this.id == that.id &&
                this.revision == that.revision &&
                Objects.equals(this.adr, that.adr);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, id, revision, adr);
    }

    @Override
    public String toString() {
        return "AdrMeta[" +
                "namespace=" + namespace + ", " +
                "id=" + id + ", " +
                "revision=" + revision + ", " +
                "adr=" + adr + ']';
    }

    public static class AdrMetaBuilder {

        private String namespace;
        private int id;
        private int revision;
        private Adr adr;


        public AdrMetaBuilder() {

        }

        public AdrMetaBuilder(AdrMeta adrMeta) {
            this.namespace = adrMeta.getNamespace();
            this.id = adrMeta.getId();
            this.revision = adrMeta.getRevision();
            this.adr = adrMeta.getAdr();
        }

        public AdrMetaBuilder setNamespace(String namespace) {
            this.namespace = namespace;
            return this;
        }

        public AdrMetaBuilder setId(int id) {
            this.id = id;
            return this;
        }

        public AdrMetaBuilder setRevision(int revision) {
            this.revision = revision;
            return this;
        }

        public AdrMetaBuilder setAdr(Adr adr) {
            this.adr = adr;
            return this;
        }

        public AdrMeta build() {
            return new AdrMeta(namespace, id, revision, adr);
        }
    }

}
