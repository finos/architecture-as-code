package org.finos.calmtranslator.controller;

import com.structurizr.Workspace;
import com.structurizr.util.WorkspaceUtils;

import io.fabric8.kubernetes.api.model.KubernetesResource;

import java.util.List;

import org.finos.calmtranslator.calm.Core;
import org.finos.calmtranslator.translators.C4ModelTranslator;
import org.finos.calmtranslator.translators.K8sModelTranslator;
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
	private final K8sModelTranslator k8sModelTranslator;

	public Translator(C4ModelTranslator c4ModelTranslator, K8sModelTranslator k8sModelTranslator) {
		this.c4ModelTranslator = c4ModelTranslator;
		this.k8sModelTranslator = k8sModelTranslator;
	}

	@PostMapping("/c4")
	@ResponseStatus(HttpStatus.CREATED)
	public Workspace c4Translation(@RequestBody Core calmModel) {
		return c4ModelTranslator.translate(calmModel);
	}

	@PostMapping("/k8s")
	@ResponseStatus(HttpStatus.CREATED)
	public List<KubernetesResource> k8sManifestTranslation(
			@RequestBody Core calmModel

	) throws Exception {
		// Currently a Structurizr json format
		final List<KubernetesResource> kubernetesResources = k8sModelTranslator.translate(calmModel);
		return kubernetesResources;
	}
}
