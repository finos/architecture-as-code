package org.finos.calmtranslator.translators;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import com.structurizr.Workspace;
import com.structurizr.model.Container;
import com.structurizr.model.Model;
import com.structurizr.model.Person;
import com.structurizr.model.SoftwareSystem;
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
 * Convert CALM to a C4 Model
 */
@Service
public class C4ModelTranslator implements ModelTranslator<Workspace> {

	private static final Logger LOG = LoggerFactory.getLogger(C4ModelTranslator.class);

	private Core calmModel;
	private SoftwareSystem softwareSystem;

	@Override
	public Workspace translate(final Core calmModel) {
		this.calmModel = calmModel;
		final Workspace c4Workspace = new Workspace("calm-to-c4", "calm to c4");
		final Model c4Model = c4Workspace.getModel();
		Map<String, String> nodeNameToC4Id = new HashMap<>();
		final Map<Node, List<Node>> systemMap = this.getSystemNodeRelationships(calmModel);
		systemMap.forEach((systemNode, relationshipNodes) -> {
			this.softwareSystem = c4Model.addSoftwareSystem(systemNode.getName(), systemNode.getDescription());
			nodeNameToC4Id.put(softwareSystem.getName(), softwareSystem.getId());
			relationshipNodes
					.forEach(node -> addNodeAsContainer(node, softwareSystem, nodeNameToC4Id));
		});

		calmModel.getNodes().forEach(node -> {
			if (Objects.requireNonNull(node.getNodeType()) == Node.NodeTypeDefinition.ACTOR) {
				final Person person = c4Model.addPerson(node.getName(), node.getDescription());
				nodeNameToC4Id.put(person.getName(), person.getId());
			}
		});

		calmModel.getRelationships()
				.forEach(relationship -> {
					final RelationshipType relationshipType = relationship.getRelationshipType();
					if (Objects.nonNull(relationshipType.getInteracts())) {
						final InteractsType interacts = relationshipType.getInteracts();
						final String actorStr = interacts.getActor();
						final List<String> nodes = interacts.getNodes();
						final Node actorNode = getNodeFromUniqueName(actorStr);
						final Person actor = c4Model.getPersonWithName(actorNode.getName());
						for (String node : nodes) {
							final String id = nodeNameToC4Id.get(this.getNodeFromUniqueName(node).getName());
							actor.uses((Container) c4Model.getElement(id), relationship.getDescription());
						}
					}
					else if (Objects.nonNull(relationshipType.getConnects())) {

						final ConnectsType connects = relationshipType.getConnects();
						final Node sourceNode = getNodeFromUniqueName(connects.getSource());
						final Node destinationNode = getNodeFromUniqueName(connects.getDestination());

						String srcC4Id = nodeNameToC4Id.get(sourceNode.getName());
						if (Objects.isNull(srcC4Id)) {
							LOG.warn("Adding new source node that does not exist in composed-of [{}]", sourceNode);
							addNodeAsContainer(sourceNode, softwareSystem, nodeNameToC4Id);
							srcC4Id = nodeNameToC4Id.get(sourceNode.getName());
						}
						String dstC4Id = nodeNameToC4Id.get(destinationNode.getName());
						if (Objects.isNull(dstC4Id)) {
							LOG.warn("Adding new destination node that does not exist in composed-of [{}]", destinationNode);
							addNodeAsContainer(destinationNode, softwareSystem, nodeNameToC4Id);
							dstC4Id = nodeNameToC4Id.get(destinationNode.getName());
						}
						final Container sContainer = (Container) c4Model.getElement(srcC4Id);
						final Container dContainer = (Container) c4Model.getElement(dstC4Id);

						if (Objects.isNull(relationship.getProtocol())) {
							sContainer.uses(dContainer, relationship.getDescription());
						}
						else {
							sContainer.uses(dContainer, relationship.getDescription(), relationship.getProtocol().value());
						}
					}
					else if (Objects.nonNull(relationshipType.getComposedOf())) {
						// The top level is defined ahead of time
					}
					else if (Objects.nonNull(relationshipType.getDeployedIn())) {
						// We don't use the network boundaries in C4
					}
					else {
						throw new RuntimeException("Unknown relationship type");
					}
				});
		addViewsToWorkspace(c4Workspace);
		return c4Workspace;
	}

	private void addViewsToWorkspace(final Workspace workspace) {
		workspace.getViews().createDefaultViews();
	}

	private static void addNodeAsContainer(final Node node, final SoftwareSystem softwareSystem, final Map<String, String> nodeNameToC4Id) {
		final Container container = softwareSystem.addContainer(node.getName(), node.getDescription(), node.getNodeType().value());
		nodeNameToC4Id.put(container.getName(), container.getId());
	}

	private Map<Node, List<Node>> getSystemNodeRelationships(final Core calmModel) {
		final List<Relationship> connections = new ArrayList<>();
		final List<Relationship> interacts = new ArrayList<>();
		final List<Relationship> deployedIn = new ArrayList<>();
		final List<Relationship> composedOf = new ArrayList<>();

		calmModel.getRelationships().forEach(relationship -> {
			final RelationshipType relationshipType = relationship.getRelationshipType();
			if (Objects.nonNull(relationshipType.getInteracts())) {
				interacts.add(relationship);
			}
			else if (Objects.nonNull(relationshipType.getConnects())) {
				connections.add(relationship);
			}
			else if (Objects.nonNull(relationshipType.getComposedOf())) {
				composedOf.add(relationship);
			}
			else if (Objects.nonNull(relationshipType.getDeployedIn())) {
				deployedIn.add(relationship);
			}
			else {
				throw new RuntimeException("Unknown relationship type");
			}
		});

		return containsSystem(composedOf);
	}

	private Map<Node, List<Node>> containsSystem(final List<Relationship> composedOf) {
		final Map<Node, List<Node>> systemComposedOf = new HashMap<>();
		composedOf.forEach(relationship -> {
			final String systemContainerName = relationship.getRelationshipType().getComposedOf().getContainer();
			final Node systemContainerNode = getNodeFromUniqueName(systemContainerName);
			final List<Node> containedInNodes = relationship.getRelationshipType().getComposedOf().getNodes().stream()
					.map(this::getNodeFromUniqueName)
					.collect(Collectors.toList());
			systemComposedOf.put(systemContainerNode, containedInNodes);
		});
		return systemComposedOf;
	}

	private Node getNodeFromUniqueName(final String systemContainer) {
		LOG.debug("Looking up container [{}]", systemContainer);
		return calmModel.getNodes().stream()
				.filter(node -> systemContainer.equals(node.getUniqueId()))
				.findFirst().get();
	}
}
