package org.finos.calm.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.finos.calm.model.canonical.CalmArchitectureSchema;
import org.finos.calm.model.canonical.CalmMetadataHelper;

import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class CalmArchitecture {

    private final List<CalmNode> nodes;
    private final List<CalmRelationship> relationships;
    private final List<CalmFlow> flows;
    private final Optional<CalmControls> controls;
    private final Map<String, Object> metadata;
    private final List<String> adrs;
    private final ObjectMapper mapper;

    private CalmArchitecture(List<CalmNode> nodes, List<CalmRelationship> relationships,
                              List<CalmFlow> flows, Optional<CalmControls> controls,
                              Map<String, Object> metadata, List<String> adrs,
                              ObjectMapper mapper) {
        this.nodes = List.copyOf(nodes);
        this.relationships = List.copyOf(relationships);
        this.flows = List.copyOf(flows);
        this.controls = controls;
        this.metadata = Map.copyOf(metadata);
        this.adrs = List.copyOf(adrs);
        this.mapper = mapper;
    }

    public static CalmArchitecture parse(String json) {
        return parse(json, defaultMapper());
    }

    public static CalmArchitecture parse(String json, ObjectMapper mapper) {
        try {
            CalmArchitectureSchema schema = mapper.readValue(json, CalmArchitectureSchema.class);
            return from(schema, mapper);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse CALM architecture JSON", e);
        }
    }

    static CalmArchitecture from(CalmArchitectureSchema schema, ObjectMapper mapper) {
        List<CalmNode> nodes = schema.getNodes() == null ? List.of() :
            schema.getNodes().stream().map(n -> CalmNode.from(n, mapper)).toList();
        List<CalmRelationship> relationships = schema.getRelationships() == null ? List.of() :
            schema.getRelationships().stream().map(r -> CalmRelationship.from(r, mapper)).toList();
        List<CalmFlow> flows = schema.getFlows() == null ? List.of() :
            schema.getFlows().stream().map(f -> CalmFlow.from(f, mapper)).toList();
        Optional<CalmControls> controls = schema.getControls() != null
            ? Optional.of(CalmControls.from(schema.getControls(), mapper))
            : Optional.empty();
        return new CalmArchitecture(
            nodes, relationships, flows, controls,
            CalmMetadataHelper.flatten(schema.getMetadataRaw(), mapper),
            schema.getAdrs() == null ? List.of() : schema.getAdrs(),
            mapper
        );
    }

    private static ObjectMapper defaultMapper() {
        return new ObjectMapper().registerModule(new JavaTimeModule());
    }

    public List<CalmNode> getNodes() { return nodes; }
    public List<CalmRelationship> getRelationships() { return relationships; }
    public List<CalmFlow> getFlows() { return flows; }
    public Optional<CalmControls> getControls() { return controls; }
    public List<String> getAdrs() { return adrs; }

    public Optional<CalmNode> findNodeById(String uniqueId) {
        return nodes.stream().filter(n -> n.uniqueId().equals(uniqueId)).findFirst();
    }

    public List<CalmNode> findNodesByType(String nodeType) {
        return nodes.stream().filter(n -> n.nodeType().equals(nodeType)).toList();
    }

    public List<CalmRelationship> getRelationships(String nodeUniqueId) {
        return relationships.stream()
            .filter(r -> relationshipInvolvesNode(r, nodeUniqueId))
            .toList();
    }

    public List<CalmNode> getLinkedNodes(String nodeUniqueId) {
        return getRelationships(nodeUniqueId).stream()
            .flatMap(r -> linkedNodeIds(r, nodeUniqueId).stream())
            .distinct()
            .map(this::findNodeById)
            .filter(Optional::isPresent)
            .map(Optional::get)
            .toList();
    }

    private boolean relationshipInvolvesNode(CalmRelationship rel, String nodeId) {
        return switch (rel.relationshipType()) {
            case CalmConnectsType c ->
                c.source().node().equals(nodeId) || c.destination().node().equals(nodeId);
            case CalmInteractsType i ->
                i.actor().equals(nodeId) || i.nodes().contains(nodeId);
            case CalmDeployedInType d ->
                d.container().equals(nodeId) || d.nodes().contains(nodeId);
            case CalmComposedOfType c ->
                c.container().equals(nodeId) || c.nodes().contains(nodeId);
            case CalmOptionsType o -> false;
        };
    }

    private List<String> linkedNodeIds(CalmRelationship rel, String fromNodeId) {
        return switch (rel.relationshipType()) {
            case CalmConnectsType c -> c.source().node().equals(fromNodeId)
                ? List.of(c.destination().node()) : List.of(c.source().node());
            case CalmInteractsType i -> i.actor().equals(fromNodeId)
                ? List.copyOf(i.nodes()) : List.of(i.actor());
            case CalmDeployedInType d -> d.container().equals(fromNodeId)
                ? List.copyOf(d.nodes()) : List.of(d.container());
            case CalmComposedOfType c -> c.container().equals(fromNodeId)
                ? List.copyOf(c.nodes()) : List.of(c.container());
            case CalmOptionsType o -> List.of();
        };
    }

    public Optional<Object> getMetadata(String key) {
        return Optional.ofNullable(metadata.get(key));
    }

    public <T> Optional<T> parseMetadata(Class<T> type) {
        if (metadata.isEmpty()) return Optional.empty();
        try {
            return Optional.of(mapper.convertValue(metadata, type));
        } catch (Exception e) {
            throw new CalmExtensionParseException(
                "Failed to parse architecture metadata as " + type.getSimpleName(), e);
        }
    }
}
