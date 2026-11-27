package org.finos.calm.domain;

import org.junit.jupiter.api.Test;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;

public class TestResourceMappingShould {

    @Test
    void build_resource_mapping_with_all_fields() {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos")
                .setCustomId("api-gateway-pattern")
                .setResourceType(ResourceType.PATTERN)
                .setNumericId(42)
                .build();

        assertThat(mapping.getNamespace(), is("finos"));
        assertThat(mapping.getCustomId(), is("api-gateway-pattern"));
        assertThat(mapping.getResourceType(), is(ResourceType.PATTERN));
        assertThat(mapping.getNumericId(), is(42));
    }

    @Test
    void equal_another_mapping_with_same_fields() {
        ResourceMapping mapping1 = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos")
                .setCustomId("api-gateway")
                .setResourceType(ResourceType.ARCHITECTURE)
                .setNumericId(1)
                .build();

        ResourceMapping mapping2 = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos")
                .setCustomId("api-gateway")
                .setResourceType(ResourceType.ARCHITECTURE)
                .setNumericId(1)
                .build();

        assertThat(mapping1, is(mapping2));
        assertThat(mapping1.hashCode(), is(mapping2.hashCode()));
    }

    @Test
    void treat_path_and_variant_as_part_of_identity() {
        ResourceMapping aws = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api").setResourceType(ResourceType.ARCHITECTURE)
                .setNumericId(1).setPath("aws").build();
        ResourceMapping azure = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api").setResourceType(ResourceType.ARCHITECTURE)
                .setNumericId(1).setPath("azure").build();
        ResourceMapping awsVariant = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api").setResourceType(ResourceType.ARCHITECTURE)
                .setNumericId(1).setPath("aws").setVariant("calm").build();
        ResourceMapping same = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api").setResourceType(ResourceType.ARCHITECTURE)
                .setNumericId(1).setPath("aws").build();

        assertThat(aws.equals(azure), is(false));
        assertThat(aws.equals(awsVariant), is(false));
        assertThat(aws, is(same));
        assertThat(aws.hashCode(), is(same.hashCode()));
        assertThat(aws.toString(), containsString("aws"));
        assertThat(awsVariant.toString(), containsString("calm"));
    }

    @Test
    void produce_readable_to_string() {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos")
                .setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN)
                .setNumericId(5)
                .build();

        String result = mapping.toString();
        assertThat(result.contains("finos"), is(true));
        assertThat(result.contains("api-gateway"), is(true));
        assertThat(result.contains("PATTERN"), is(true));
    }
}
