package org.finos.calm.domain.adr;

import java.util.Objects;

/**
 * Represents an ADR and the associated namespace, id, slug, and revision.
 *
 * <p>The slug lives here, on the envelope, not on {@link Adr}: it is assigned once from
 * revision 1's title and never changes, whereas the body changes with every revision. On
 * create, a slug set here is the caller's requested slug.</p>
 */
public class AdrMeta {
    private String namespace;
    private int id;
    private String slug;
    private int revision;
    private Adr adr;

    public AdrMeta() {

    }

    public AdrMeta(String namespace, int id, int revision, Adr adr) {
        this(namespace, id, null, revision, adr);
    }

    public AdrMeta(String namespace, int id, String slug, int revision, Adr adr) {
        this.namespace = namespace;
        this.id = id;
        this.slug = slug;
        this.revision = revision;
        this.adr = adr;
    }

    public String getNamespace() {
        return namespace;
    }

    public int getId() {
        return id;
    }

    public String getSlug() {
        return slug;
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
                Objects.equals(this.slug, that.slug) &&
                this.revision == that.revision &&
                Objects.equals(this.adr, that.adr);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, id, slug, revision, adr);
    }

    @Override
    public String toString() {
        return "AdrMeta[" +
                "namespace=" + namespace + ", " +
                "id=" + id + ", " +
                "slug=" + slug + ", " +
                "revision=" + revision + ", " +
                "adr=" + adr + ']';
    }

    public static class AdrMetaBuilder {

        private String namespace;
        private int id;
        private String slug;
        private int revision;
        private Adr adr;


        public AdrMetaBuilder() {

        }

        public AdrMetaBuilder(AdrMeta adrMeta) {
            this.namespace = adrMeta.getNamespace();
            this.id = adrMeta.getId();
            this.slug = adrMeta.getSlug();
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

        public AdrMetaBuilder setSlug(String slug) {
            this.slug = slug;
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
            return new AdrMeta(namespace, id, slug, revision, adr);
        }
    }

}
