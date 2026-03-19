package org.finos.calm.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;

public class TestDecoratorShould {

    @Test
    void return_null_for_all_fields_when_built_with_no_values() {
        Decorator decorator = new Decorator.DecoratorBuilder().build();

        assertThat(decorator.getSchema(), is(nullValue()));
        assertThat(decorator.getUniqueId(), is(nullValue()));
        assertThat(decorator.getType(), is(nullValue()));
        assertThat(decorator.getTarget(), is(nullValue()));
        assertThat(decorator.getTargetType(), is(nullValue()));
        assertThat(decorator.getAppliesTo(), is(nullValue()));
        assertThat(decorator.getData(), is(nullValue()));
    }

    @Test
    void return_set_values_for_all_fields() {
        Decorator decorator = new Decorator.DecoratorBuilder()
                .setSchema("https://calm.finos.org/schemas/2024-01/decorator.json")
                .setUniqueId("finos-arch-deployment-1")
                .setType("deployment")
                .setTarget(List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .setTargetType(List.of("architecture"))
                .setAppliesTo(List.of("node-1", "node-2"))
                .setData("some-data")
                .build();

        assertThat(decorator.getSchema(), equalTo("https://calm.finos.org/schemas/2024-01/decorator.json"));
        assertThat(decorator.getUniqueId(), equalTo("finos-arch-deployment-1"));
        assertThat(decorator.getType(), equalTo("deployment"));
        assertThat(decorator.getTarget(), equalTo(List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0")));
        assertThat(decorator.getTargetType(), equalTo(List.of("architecture")));
        assertThat(decorator.getAppliesTo(), equalTo(List.of("node-1", "node-2")));
        assertThat(decorator.getData(), equalTo("some-data"));
    }

    @Test
    void be_equal_when_all_fields_are_the_same() {
        Decorator a = buildFullDecorator();
        Decorator b = buildFullDecorator();

        assertThat(a, equalTo(b));
    }

    @Test
    void not_be_equal_when_type_differs() {
        Decorator a = buildFullDecorator();
        Decorator b = new Decorator.DecoratorBuilder()
                .setSchema("https://calm.finos.org/schemas/2024-01/decorator.json")
                .setUniqueId("finos-arch-deployment-1")
                .setType("observability")
                .setTarget(List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .setTargetType(List.of("architecture"))
                .setAppliesTo(List.of("node-1"))
                .setData("some-data")
                .build();

        assertThat(a, not(equalTo(b)));
    }

    @Test
    void not_be_equal_when_unique_id_differs() {
        Decorator a = buildFullDecorator();
        Decorator b = new Decorator.DecoratorBuilder()
                .setSchema("https://calm.finos.org/schemas/2024-01/decorator.json")
                .setUniqueId("different-id")
                .setType("deployment")
                .setTarget(List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .setTargetType(List.of("architecture"))
                .setAppliesTo(List.of("node-1"))
                .setData("some-data")
                .build();

        assertThat(a, not(equalTo(b)));
    }

    @Test
    void not_be_equal_to_null() {
        assertThat(buildFullDecorator(), not(equalTo(null)));
    }

    @Test
    void not_be_equal_to_different_class() {
        assertThat(buildFullDecorator().equals("a string"), is(false));
    }

    @Test
    void have_same_hash_code_when_equal() {
        Decorator a = buildFullDecorator();
        Decorator b = buildFullDecorator();

        assertThat(a.hashCode(), equalTo(b.hashCode()));
    }

    @Test
    void have_different_hash_code_when_not_equal() {
        Decorator a = buildFullDecorator();
        Decorator b = new Decorator.DecoratorBuilder()
                .setSchema("https://calm.finos.org/schemas/2024-01/decorator.json")
                .setUniqueId("different-id")
                .setType("deployment")
                .setTarget(List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .setTargetType(List.of("architecture"))
                .setAppliesTo(List.of("node-1"))
                .setData("some-data")
                .build();

        assertThat(a.hashCode(), not(equalTo(b.hashCode())));
    }

    @Test
    void include_all_fields_in_to_string() {
        Decorator decorator = buildFullDecorator();
        String result = decorator.toString();

        assertThat(result, containsString("schema="));
        assertThat(result, containsString("uniqueId="));
        assertThat(result, containsString("type="));
        assertThat(result, containsString("target="));
        assertThat(result, containsString("targetType="));
        assertThat(result, containsString("appliesTo="));
        assertThat(result, containsString("data="));
    }

    @Test
    void be_equal_when_optional_fields_are_null() {
        Decorator a = new Decorator.DecoratorBuilder()
                .setType("deployment")
                .setTarget(List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .build();

        Decorator b = new Decorator.DecoratorBuilder()
                .setType("deployment")
                .setTarget(List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .build();

        assertThat(a, equalTo(b));
    }

    private Decorator buildFullDecorator() {
        return new Decorator.DecoratorBuilder()
                .setSchema("https://calm.finos.org/schemas/2024-01/decorator.json")
                .setUniqueId("finos-arch-deployment-1")
                .setType("deployment")
                .setTarget(List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .setTargetType(List.of("architecture"))
                .setAppliesTo(List.of("node-1"))
                .setData("some-data")
                .build();
    }
}
