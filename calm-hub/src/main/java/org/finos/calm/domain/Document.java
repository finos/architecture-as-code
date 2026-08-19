package org.finos.calm.domain;

import org.finos.calm.domain.documents.CreateDocumentRequest;

public class Document {
    private String name;
    private String description;
    private String documentMarkdown;
    private Integer id;
    private String version;
    public Document() { }
    public Document(CreateDocumentRequest request) { name = request.getName(); description = request.getDescription(); documentMarkdown = request.getDocumentMarkdown(); }
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getDocumentMarkdown() { return documentMarkdown; }
}
