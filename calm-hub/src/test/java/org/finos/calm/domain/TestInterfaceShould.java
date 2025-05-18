package org.finos.calm.domain;

import org.junit.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

public class TestInterfaceShould {

    private static final String INTERFACE_JSON = "{\"test\":\"test\"}";
    private static final String VERSION = "1.0.0";
    private static final String NAMESPACE = "finos";
    private static final String NAME = "interface-name";
    private static final String DESCRIPTION = "an interface description";
    private static final int ID = 1;
    private static final Interface.InterfaceBuilder INTERFACE = new Interface.InterfaceBuilder()
            .setInterfaceJson(INTERFACE_JSON)
            .setId(ID)
            .setName(NAME)
            .setVersion(VERSION)
            .setNamespace(NAMESPACE)
            .setDescription(DESCRIPTION);

    @Test
    public void return_built_interface() {
        Interface builtInterface = INTERFACE.build();

        assertThat(builtInterface.getId(), equalTo(ID));
        assertThat(builtInterface.getInterfaceJson(), equalTo(INTERFACE_JSON));
        assertThat(builtInterface.getVersion(), equalTo(VERSION));
        assertThat(builtInterface.getNamespace(), equalTo(NAMESPACE));
        assertThat(builtInterface.getName(), equalTo(NAME));
        assertThat(builtInterface.getDescription(), equalTo(DESCRIPTION));

    }

    @Test
    public void be_equal_for_the_same_values() {
        Interface interface1 = INTERFACE.build();
        Interface interface2 = INTERFACE.build();

        assertEquals(interface1, interface2);
        assertEquals(interface1.hashCode(), interface2.hashCode());
    }

    @Test
    public void not_be_equal_for_different_values() {
        Interface interface1 = INTERFACE.build();
        Interface interface2 = new Interface.InterfaceBuilder()
                .setInterfaceJson(INTERFACE_JSON)
                .setId(2)
                .setName("another")
                .setVersion(VERSION)
                .setNamespace(NAMESPACE)
                .setDescription(DESCRIPTION)
                .build();

        assertNotEquals(interface1, interface2);
        assertNotEquals(interface1.hashCode(), interface2.hashCode());
    }

    @Test
    public void not_be_equal_to_null() {
        Interface interface1 = INTERFACE.build();
        assertNotEquals(null, interface1);
    }

    @Test
    public void not_be_equal_to_a_different_Type() {
        Interface interface1 = INTERFACE.build();
        assertNotEquals(new Object(), interface1);
    }


}