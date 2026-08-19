package org.finos.calm.domain.documents;

import java.util.Objects;

public class CreateDocumentRequest {
    private String name;
    private String description;
    private String documentMarkdown;

    public CreateDocumentRequest() { }
    public CreateDocumentRequest(String name, String description, String documentMarkdown) {
        this.name = name; this.description = description; this.documentMarkdown = documentMarkdown;
    }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getDocumentMarkdown() { return documentMarkdown; }
    public void setDocumentMarkdown(String documentMarkdown) { this.documentMarkdown = documentMarkdown; }
    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CreateDocumentRequest that)) return false;
        return Objects.equals(name, that.name) && Objects.equals(description, that.description)
                && Objects.equals(documentMarkdown, that.documentMarkdown);
    }
    @Override public int hashCode() { return Objects.hash(name, description, documentMarkdown); }
}
