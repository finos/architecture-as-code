package org.finos.calm.domain;

import org.junit.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;

public class TestInterfaceShould {

    @Test
    public void return_built_interface() {
        int expectedId = 1;
        String expectedInterfaceJson = "{\"test\":\"test\"}";
        String expectedVersion = "1.0.0";
        String expectedNamespace = "finos";
        String expectedName = "interface-name";
        String expectedDescription = "an interface description";

        Interface.InterfaceBuilder interfaceBuilder = new Interface.InterfaceBuilder()
                .setInterfaceJson(expectedInterfaceJson)
                .setId(expectedId)
                .setName(expectedName)
                .setVersion(expectedVersion)
                .setNamespace(expectedNamespace)
                .setDescription(expectedDescription);

        Interface builtInterface = new Interface(interfaceBuilder);

        assertThat(builtInterface.getId(), equalTo(expectedId));
        assertThat(builtInterface.getInterfaceJson(), equalTo(expectedInterfaceJson));
        assertThat(builtInterface.getVersion(), equalTo(expectedVersion));
        assertThat(builtInterface.getNamespace(), equalTo(expectedNamespace));
        assertThat(builtInterface.getName(), equalTo(expectedName));
        assertThat(builtInterface.getDescription(), equalTo(expectedDescription));

    }
}