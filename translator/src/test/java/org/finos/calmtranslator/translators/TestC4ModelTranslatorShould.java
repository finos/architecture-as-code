package org.finos.calmtranslator.translators;

import java.io.File;
import java.io.IOException;
import java.util.Set;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.structurizr.Workspace;
import com.structurizr.model.Container;
import com.structurizr.model.Model;
import com.structurizr.model.Person;
import com.structurizr.model.Relationship;
import com.structurizr.model.SoftwareSystem;
import com.structurizr.util.WorkspaceUtils;
import org.finos.calmtranslator.calm.Core;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
class TestC4ModelTranslatorShould {

	private C4ModelTranslator translator;
	private Core traderxCalmModel;
	private Core crossCommunicationModel;

	@BeforeEach
	void setUp() throws IOException {
		this.translator = new C4ModelTranslator();
		this.traderxCalmModel = new ObjectMapper().readValue(this.getClass().getClassLoader().getResourceAsStream("traderx-calm.json"), Core.class);
		this.crossCommunicationModel = new ObjectMapper().readValue(this.getClass().getClassLoader()
				.getResourceAsStream("cross-communication.json"), Core.class);
	}

	@Test
	void addCalmActorAsC4Person() {
		final Workspace workspace = translator.translate(traderxCalmModel);
		assertThat(workspace.getModel().getPeople())
				.singleElement()
				.hasFieldOrPropertyWithValue("name", "Trader")
				.hasFieldOrPropertyWithValue(
						"description", "Person who manages accounts and executes trades");

//		assertIterableEquals(Set.of(expectedPerson), workspace.getModel().getPeople());
	}

	@Test
	void addCalmSystemAsC4System() {
		final Workspace workspace = translator.translate(traderxCalmModel);
		assertThat(workspace.getModel().getSoftwareSystems())
				.anyMatch(
						softwareSystem -> softwareSystem.getDescription().equals("Simple Trading System") &&
						softwareSystem.getName().equals("TraderX"))

		;
	}

	@Test
	void addCalmContainedServicesAsC4Containers() {
		final SoftwareSystem expectedWorkspace = new Workspace("", "").getModel().addSoftwareSystem("exectedSystem");
		expectedWorkspace.addContainer("Web GUI", "Allows employees to manage accounts and book trades", "service");
		expectedWorkspace.addContainer("Web Client", "Browser based web interface for TraderX", "webclient");
		expectedWorkspace.addContainer("Position Service", "Server process which processes trading activity and updates positions", "service");
		expectedWorkspace.addContainer("TraderX DB", "Database which stores account, trade and position state", "database");

		final Set<Container> exectedContainerSet = expectedWorkspace.getContainers();

		final Workspace workspace = translator.translate(traderxCalmModel);

		assertThat(workspace.getModel().getSoftwareSystemWithName("TraderX").getContainers())
				.usingRecursiveFieldByFieldElementComparatorOnFields("name", "description", "technology")
				.containsAll(exectedContainerSet);
//				.containsExactlyInAnyOrderElementsOf(exectedContainerSet);
	}

	@Test
	void addCalmRelationshipConnectionsAsC4Interaction() {

		final Model model = new Workspace("", "").getModel();
		final SoftwareSystem expectedSoftwareSystem = model.addSoftwareSystem("expectedSystem");

		final Container webGui = expectedSoftwareSystem.addContainer("Web GUI", "Allows employees to manage accounts and book trades");
		final Container positionService = expectedSoftwareSystem.addContainer("Position Service", "Server process which processes trading activity and updates positions");
		webGui.uses(positionService, "Load positions for account.", "HTTPS");

		final Container tradeFeed = expectedSoftwareSystem.addContainer("Trade Feed", "Message bus for streaming updates to trades and positions");
		final Container tradeProcessor = expectedSoftwareSystem.addContainer("Trade Processor", "Process incoming trade requests, settle and persist");
		tradeProcessor.uses(tradeFeed, "Processes incoming trade requests, persist and publish updates.", "SocketIO");

		final Iterable<Relationship> expectedRelationship = model.getRelationships();
		final Workspace workspace = translator.translate(traderxCalmModel);
		assertThat(workspace.getModel().getRelationships())
				.usingRecursiveFieldByFieldElementComparatorOnFields("description", "technology", "source.name", "destination.name", "source.description", "destination.description")
				.containsAll(expectedRelationship);
	}

	@Test
	void addCalmRelationshipsInteractionAsC4Interaction() {
		final Model model = new Workspace("", "").getModel();
		final SoftwareSystem expectedSoftwareSystem = model.addSoftwareSystem("expectedSystem");
		final Container webClient = expectedSoftwareSystem.addContainer("Web Client", "Browser based web interface for TraderX", "service");
		final Person trader = model.addPerson("Trader", "Person who manages accounts and executes trades");
		trader.uses(webClient, "Executes Trades");

		final Iterable<Relationship> expectedRelationship = model.getRelationships();
		final Workspace workspace = translator.translate(traderxCalmModel);
		assertThat(workspace.getModel().getRelationships())
				.usingRecursiveFieldByFieldElementComparatorOnFields("description", "source.name", "destination.name", "source.description", "destination.description")
				.containsAll(expectedRelationship);
	}

	@Test
	void processMultipleSystems() {
		final Model model = new Workspace("", "").getModel();
		final SoftwareSystem system1 = model.addSoftwareSystem("System1");
		final Container service1 = system1.addContainer("Service1", "service1", "service");
		final SoftwareSystem system2 = model.addSoftwareSystem("System2");
		final Container service2 = system2.addContainer("Service2", "service2", "service");
		final Container service3 = system2.addContainer("Service3", "service3", "service");

		service1.uses(service2, "Service 1 to Service 2");
		service2.uses(service3, "Service 2 to Service 3");
		final Iterable<Relationship> expectedRelationship = model.getRelationships();
		final Workspace workspace = translator.translate(crossCommunicationModel);
		assertThat(workspace.getModel().getRelationships())
				.usingRecursiveFieldByFieldElementComparatorOnFields("description", "source.name", "destination.name", "source.description", "destination.description")
				.containsAll(expectedRelationship);
	}
}
