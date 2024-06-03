package org.finos.calmtranslator.translators;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.structurizr.Workspace;
import com.structurizr.model.Container;
import com.structurizr.model.Model;
import com.structurizr.model.Person;
import com.structurizr.model.SoftwareSystem;
import org.finos.calmtranslator.calm.ComposedOfType;
import org.finos.calmtranslator.calm.ConnectsType;
import org.finos.calmtranslator.calm.Core;
import org.finos.calmtranslator.calm.InteractsType;
import org.finos.calmtranslator.calm.Node;
import org.finos.calmtranslator.calm.Relationship;
import org.finos.calmtranslator.calm.RelationshipType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Service;
/**
 *
 */
@Service
public class C4ModelTranslator implements ModelTranslator<Workspace> {

	private static final Logger LOG = LoggerFactory.getLogger(C4ModelTranslator.class);

	@Override
	public Workspace translate(final Core calmModel) {
		final Workspace c4Workspace = new Workspace("calm-to-c4", "CALM model to c4 model");
		final Model c4Model = c4Workspace.getModel();
		Map<String, String> nodeNameToC4Id = new HashMap<>(calmModel.getNodes().size());

		// Add all persons
		calmModel.getNodes().forEach(node -> {
			if (Objects.requireNonNull(node.getNodeType()) == Node.NodeTypeDefinition.ACTOR) {
				final Person person = c4Model.addPerson(node.getName(), node.getDescription());
				nodeNameToC4Id.put(person.getName(), person.getId());
			}
		});

		// Add all containers to the software systems
		for (var relationships : calmModel.getRelationships()) {
			final ComposedOfType composedOf = relationships.getRelationshipType().getComposedOf();
			if (composedOf == null) {
				continue;
			}

			final Node containerSystemNode = getNodeFromUniqueName(calmModel, composedOf.getContainer());
			LOG.info("Add new Software system [{}], unique-id [{}]", containerSystemNode.getName(), containerSystemNode.getUniqueId());
			final SoftwareSystem softwareSystem = addNodeAsSoftwareSystem(containerSystemNode, c4Model, nodeNameToC4Id);
			final List<String> containedNodes = composedOf.getNodes();
			for (String containedNodeStr : containedNodes) {
				final Node containedNode = getNodeFromUniqueName(calmModel, containedNodeStr);
				LOG.info("Adding node [{}] with unique-id [{}] to software system [{}]", containedNode.getName(), containedNode.getUniqueId(), containerSystemNode.getName());
				addNodeAsContainer(containedNode, softwareSystem, nodeNameToC4Id);
			}
		}

		// Add all the relationships
		for (var relationship : calmModel.getRelationships()) {
			final RelationshipType relationshipType = relationship.getRelationshipType();
			if (Objects.nonNull(relationshipType.getInteracts())) {
				addInteractsRelationship(relationship, calmModel, c4Model, nodeNameToC4Id);
			}
			else if (Objects.nonNull(relationshipType.getConnects())) {
				addConnectsRelationship(relationship, calmModel, c4Model, nodeNameToC4Id);
			}
		}
		addViewsToWorkspace(c4Workspace);
		return c4Workspace;
	}

	private void addConnectsRelationship(Relationship relationship, final Core calmModel, final Model c4Model, final Map<String, String> nodeNameToC4Id) {
		final RelationshipType relationshipType = relationship.getRelationshipType();
		final ConnectsType connects = relationshipType.getConnects();
		final Node sourceNode = getNodeFromUniqueName(calmModel, connects.getSource().getNode());
		final Node destinationNode = getNodeFromUniqueName(calmModel, connects.getDestination().getNode());

		String srcC4Id = nodeNameToC4Id.get(sourceNode.getName());
		if (Objects.isNull(srcC4Id)) {
			LOG.warn("Adding unknown source node as a new Software System [{}]", sourceNode.getName());
			addNodeAsSoftwareSystem(sourceNode, c4Model, nodeNameToC4Id);
			srcC4Id = nodeNameToC4Id.get(destinationNode.getName());
		}
		String dstC4Id = nodeNameToC4Id.get(destinationNode.getName());
		if (Objects.isNull(dstC4Id)) {
			LOG.warn("Adding unknown destination node as a new Software System [{}]", destinationNode.getName());
			addNodeAsSoftwareSystem(destinationNode, c4Model, nodeNameToC4Id);
			dstC4Id = nodeNameToC4Id.get(destinationNode.getName());
		}

		//Add relationship
		final SoftwareSystem sourceSoftwareSystem = c4Model.getSoftwareSystemWithId(srcC4Id);
		final SoftwareSystem destinationSoftwareSystem = c4Model.getSoftwareSystemWithId(dstC4Id);
		if (sourceSoftwareSystem == null) {
			final Container sContainer = (Container) c4Model.getElement(srcC4Id);
			if (destinationSoftwareSystem == null) {
				final Container dContainer = (Container) c4Model.getElement(dstC4Id);
				sContainer.uses(dContainer,
						relationship.getDescription(),
						Objects.isNull(relationship.getProtocol()) ? null : relationship.getProtocol().value());
			}
			else {
				sContainer.uses(destinationSoftwareSystem,
						relationship.getDescription(),
						Objects.isNull(relationship.getProtocol()) ? null : relationship.getProtocol().value());
			}
		}
		else {
			if (destinationSoftwareSystem == null) {
				final Container dContainer = (Container) c4Model.getElement(dstC4Id);
				sourceSoftwareSystem.uses(dContainer,
						relationship.getDescription(),
						Objects.isNull(relationship.getProtocol()) ? null : relationship.getProtocol().value());
			}
			else {
				sourceSoftwareSystem.uses(destinationSoftwareSystem,
						relationship.getDescription(),
						Objects.isNull(relationship.getProtocol()) ? null : relationship.getProtocol().value());
			}
		}
	}

	private SoftwareSystem addNodeAsSoftwareSystem(final Node node, Model c4Model, final Map<String, String> nodeNameToC4Id) {
		final SoftwareSystem softwareSystem = c4Model.addSoftwareSystem(node.getName(), node.getDescription());
		nodeNameToC4Id.put(softwareSystem.getName(), softwareSystem.getId());
		return softwareSystem;
	}

	private void addInteractsRelationship(Relationship relationship, final Core calmModel, final Model c4Model, final Map<String, String> nodeNameToC4Id) {
		final InteractsType interacts = relationship.getRelationshipType().getInteracts();
		final String actorStr = interacts.getActor();
		final List<String> nodes = interacts.getNodes();
		final Node actorNode = getNodeFromUniqueName(calmModel, actorStr);
		final Person actor = c4Model.getPersonWithName(actorNode.getName());
		for (String node : nodes) {
			final String id = nodeNameToC4Id.get(this.getNodeFromUniqueName(calmModel, node).getName());
			actor.uses((Container) c4Model.getElement(id), relationship.getDescription());
		}
	}

	private void addViewsToWorkspace(final Workspace workspace) {
		workspace.getViews().createDefaultViews();
	}

	private static Container addNodeAsContainer(final Node node, final SoftwareSystem softwareSystem, final Map<String, String> nodeNameToC4Id) {
		final Container container = softwareSystem.addContainer(node.getName(), node.getDescription(), node.getNodeType().value());
		nodeNameToC4Id.put(container.getName(), container.getId());
		return container;
	}

	private Node getNodeFromUniqueName(final Core calmModel, final String nodeUniqueName) {
		LOG.debug("Looking up container [{}]", nodeUniqueName);
		return calmModel.getNodes().stream()
				.filter(node -> nodeUniqueName.equals(node.getUniqueId()))
				.findFirst().get();
	}
}
