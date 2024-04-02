package org.finos.calmtranslator.translators;

import com.fasterxml.jackson.databind.ObjectMapper;

import io.fabric8.kubernetes.api.model.KubernetesResource;
import io.fabric8.kubernetes.api.model.Namespace;
import io.fabric8.kubernetes.api.model.Service;

import java.io.IOException;
import java.util.List;

import org.finos.calmtranslator.calm.Core;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TestK8sModelTranslatorShould {

    private K8sModelTranslator translator;
    private Core traderxCalmModel;

    @BeforeEach
    void setUp() throws IOException {
        this.translator = new K8sModelTranslator();
        this.traderxCalmModel = new ObjectMapper().readValue(this.getClass().getClassLoader().getResourceAsStream("traderx-calm.json"), Core.class);
    }

    @Test
    void generateServices() {
        List<KubernetesResource> k8sResources =  translator.translate(traderxCalmModel);
        
		Namespace namespace = this.translator.createNamespace( "traderx-system");
        //Simple namespace generation check
        assertThat(k8sResources).contains(namespace);

        Service service = this.translator.createService("position-service" , "traderx-system");
		assertThat(k8sResources).contains(service);

		Service randomService = this.translator.createService("random-service" , "traderx-system");
		assertThat(k8sResources).doesNotContain(randomService);
    }

}

