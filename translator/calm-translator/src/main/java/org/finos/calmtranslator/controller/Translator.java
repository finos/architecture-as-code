package org.finos.calmtranslator.controller;

import com.structurizr.Workspace;
import org.finos.calmtranslator.calm.Core;
import org.finos.calmtranslator.translators.C4ModelTranslator;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

@RequestMapping("/translate")
public class Translator {

	private C4ModelTranslator c4ModelTranslator;

	public Translator(C4ModelTranslator c4ModelTranslator) {
		this.c4ModelTranslator = c4ModelTranslator;
	}

	@PostMapping("/")
	public Workspace modelledLanguage(
			@RequestBody Core calmModel
	) {
		var model = c4ModelTranslator.translate(calmModel);

		return model;
	}
}
