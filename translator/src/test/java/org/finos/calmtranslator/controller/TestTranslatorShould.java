package org.finos.calmtranslator.controller;

import java.io.IOException;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.structurizr.Workspace;
import org.finos.calmtranslator.calm.Core;
import org.finos.calmtranslator.translators.C4ModelTranslator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(Translator.class)
@AutoConfigureWebTestClient()
class TestTranslatorShould {

	@MockBean
	C4ModelTranslator mockTranslator;

	@Autowired
	private MockMvc mockMvc;
	private Core traderxCalmModel;

	@BeforeEach
	void setUp() throws IOException {
		this.traderxCalmModel = new ObjectMapper().readValue(this.getClass().getClassLoader().getResourceAsStream("traderx-calm.json"), Core.class);
	}

	@Test
	void return_c4_json_when_a_valid_calm_model_is_passed() throws Exception {
		when(mockTranslator.translate(any()))
				.thenReturn(new Workspace("", ""));
		mockMvc.perform(
						MockMvcRequestBuilders.post("/translate/c4")
								.accept(MediaType.APPLICATION_JSON)
								.contentType(MediaType.APPLICATION_JSON)
								.content(new ObjectMapper().writeValueAsString(traderxCalmModel))

				)
				.andExpect(status().isCreated())
				.andExpect(content().contentType(MediaType.APPLICATION_JSON))
				.andExpect(content().json("{\"id\":0,\"configuration\":{},\"model\":{},\"documentation\":{},\"views\":{\"configuration\":{\"branding\":{},\"styles\":{},\"terminology\":{}}}}"));
	}

	@Test
	void return_bad_request_when_invalid_calm_model_is_passed() throws Exception {
		mockMvc.perform(
						MockMvcRequestBuilders.post("/translate/c4")
								.accept(MediaType.APPLICATION_JSON)
								.contentType(MediaType.APPLICATION_JSON)
								.content(new ObjectMapper().writeValueAsString("""
										{
										  "$schema": "https://raw.githubusercontent.com/finos-labs/architecture-as-code/main/calm/draft/2024-03/meta/calm.json",
										  "nodes": [
										  ]
										}"""))

				)
				.andExpect(status().isBadRequest());
		verifyNoInteractions(mockTranslator);
	}
}
