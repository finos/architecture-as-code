package org.finos.calmtranslator.translators;

import io.fabric8.kubernetes.api.model.Namespace;
import io.fabric8.kubernetes.api.model.NamespaceBuilder;
import io.fabric8.kubernetes.api.model.Service;
import io.fabric8.kubernetes.api.model.ServiceBuilder;
import io.fabric8.kubernetes.api.model.ServicePort;
import io.fabric8.kubernetes.client.utils.Serialization;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.finos.calmtranslator.calm.Core;
import org.finos.calmtranslator.calm.Node;
import org.finos.calmtranslator.calm.RelationshipType;

public class K8sModelTranslator implements ModelTranslator<String> {
    @Override
    public String translate(final Core calmModel) {

        // List of namespaces in calm model
        List<String> namespaces = new ArrayList<>();

        // Map of Service (unique ID) to Namespace
        Map <String,String> serviceToNamespaceMap = new HashMap<>();

        //Populate Collections
        calmModel.getRelationships().forEach(relationship -> {
            final RelationshipType relationshipType = relationship.getRelationshipType();
            if (Objects.nonNull(relationshipType.getComposedOf())) {
                String namespace = relationshipType.getComposedOf().getContainer();
                namespaces.add(namespace);
                relationshipType.getComposedOf().getNodes().forEach( node -> {
                    serviceToNamespaceMap.put(node ,namespace);
                });
            }
        });

        StringBuilder response = new StringBuilder();

        //Build Namespaces
        response.append(
            namespaces.stream().map(ns -> createNamespace(ns)).collect(Collectors.joining("")));

        //Build Services 
        response.append(
        calmModel.getNodes().stream()
            .filter(node -> node.getNodeType() == Node.NodeTypeDefinition.SERVICE)
            .map(service -> createService(
                    service,serviceToNamespaceMap)).collect(Collectors.joining("")));
        return response.toString();
    }

    private String createNamespace(String namespaceAsString) {
        Namespace namespace = new NamespaceBuilder().withNewMetadata()
            .withName(formatName(namespaceAsString))
            .endMetadata().build();
        return Serialization.asYaml(namespace);
    }

    private String createService(Node serviceNode, Map <String,String> serviceToNamespaceMap ) {

        String serviceName = formatName(serviceNode.getName());
        String namespace = serviceToNamespaceMap.get(serviceNode.getUniqueId());

        //TODO: need to revisit where this information is derived from as not everything runs from 8080!
        ServicePort servicePort = new ServicePort();
        servicePort.setPort(8080);

        Service service = new ServiceBuilder().withNewMetadata()
            .withName(serviceName)
            .withNamespace(formatName(namespace))
            .endMetadata()
            .withNewSpec()
            .addToSelector("app", serviceName)
            .addToPorts(servicePort)
            .endSpec()
            .build();
        return Serialization.asYaml(service);
    }

    private String formatName (String input) {
        return  input == null ? "" : input.toLowerCase().trim().replace(" ", "-") ; 
    }

}

