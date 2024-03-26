package org.finos.calmtranslator.translators;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
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
        String k8sManifest =  translator.translate(traderxCalmModel);
        
        //Simple namespace generation check
        assertThat(k8sManifest).contains("Namespace");
        assertThat(k8sManifest).contains("traderx-system");

        //Simple service generation check
        assertThat(k8sManifest).contains("Service");
        assertThat(k8sManifest).contains("position-service");

    }

}

