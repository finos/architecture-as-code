package org.finos.calmtranslator.translators;

import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.PodBuilder;
import io.fabric8.kubernetes.client.utils.Serialization;
import org.finos.calmtranslator.calm.Core;
public class K8sModelTranslator implements ModelTranslator<String> {
	@Override
	public String translate(final Core calmModel) {

		Pod p = new PodBuilder().withNewMetadata()
				.withName("excj496")
				.endMetadata()
				.build();
		// Get YAML string
		System.out.println(Serialization.asYaml(p));
		// Get JSON string
		System.out.println(Serialization.asJson(p));
		return null;
	}
}
