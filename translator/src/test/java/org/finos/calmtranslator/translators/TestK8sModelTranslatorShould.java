package org.finos.calmtranslator.translators;

import java.io.IOException;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.finos.calmtranslator.calm.Core;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
class TestK8sModelTranslatorShould {

	private K8sModelTranslator translator;
	private Core traderxCalmModel;

	@BeforeEach
	void setUp() throws IOException {
		this.translator = new K8sModelTranslator();
		this.traderxCalmModel = new ObjectMapper().readValue(this.getClass().getClassLoader().getResourceAsStream("traderx-calm.json"), Core.class);
	}

	@Test
	void addCalmActorAsC4Person() {
		translator.translate(traderxCalmModel);
//		assertIterableEquals(Set.of(expectedPerson), workspace.getModel().getPeople());
	}

}
