package org.finos.calmtranslator.translators;

import io.fabric8.kubernetes.api.model.KubernetesResource;
import io.fabric8.kubernetes.api.model.Namespace;
import io.fabric8.kubernetes.api.model.NamespaceBuilder;
import io.fabric8.kubernetes.api.model.Service;
import io.fabric8.kubernetes.api.model.ServiceBuilder;
import io.fabric8.kubernetes.api.model.ServicePort;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.finos.calmtranslator.calm.Core;
import org.finos.calmtranslator.calm.Node;
import org.finos.calmtranslator.calm.RelationshipType;

public class K8sModelTranslator implements ModelTranslator<List<KubernetesResource>> {
    @Override
    public List<KubernetesResource> translate(final Core calmModel) {

		List<KubernetesResource> response = new ArrayList<>();

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


        //Build Namespaces
        response.addAll(namespaces.stream().map(ns -> createNamespace(ns)).toList());

        //Build Services 
        response.addAll(
        calmModel.getNodes().stream()
            .filter(node -> node.getNodeType() == Node.NodeTypeDefinition.SERVICE)
            .map(service -> createService(
				formatName(service.getName()),
				serviceToNamespaceMap.get(service.getUniqueId())
			)).toList());
        return response;
    }

    Namespace createNamespace(String namespaceAsString) {
        Namespace namespace = new NamespaceBuilder().withNewMetadata()
            .withName(formatName(namespaceAsString))
            .endMetadata().build();
        return namespace;
    }

    Service createService(String serviceName , String namespace ) {

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
        return service;
    }

    private String formatName (String input) {
        return  input == null ? "" : input.toLowerCase().trim().replace(" ", "-") ; 
    }

}

