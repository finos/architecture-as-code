package org.finos.calmtranslator.controller;

import com.structurizr.Workspace;
import com.structurizr.util.WorkspaceUtils;
import org.finos.calmtranslator.calm.Core;
import org.finos.calmtranslator.translators.C4ModelTranslator;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/translate")
public class Translator {

	private final C4ModelTranslator c4ModelTranslator;

	public Translator(C4ModelTranslator c4ModelTranslator) {
		this.c4ModelTranslator = c4ModelTranslator;
	}

	@PostMapping("/c4")
	@ResponseStatus(HttpStatus.CREATED)
	public String c4Translation(
			@RequestBody Core calmModel

	) throws Exception {
		// Currently a Structurizr json format
		final Workspace workspace = c4ModelTranslator.translate(calmModel);
		return WorkspaceUtils.toJson(workspace, true);
	}
}
