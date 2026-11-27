package org.finos.calm.store.mongo;

import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceMappingView;
import org.finos.calm.domain.ResourceType;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;

/** Guards the "no MongoDB migration" contract of the string-id change. */
class TestMongoMappingCompatibilityShould {

    @Test
    void keep_the_stored_mapping_shape_and_both_indexes() throws IOException {
        String seed = Files.readString(Path.of("mongo", "init-mongo.js"));
        assertThat(seed, containsString("resourceType: 1, customId: 1 }, { unique: true }"));
        assertThat(seed, containsString("resourceType: 1, numericId: 1"));
        assertThat(seed, containsString("numericId: NumberInt("));
    }

    @Test
    void expose_a_numeric_id_and_no_tags_for_a_mongo_mapping() {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api").setResourceType(ResourceType.ARCHITECTURE)
                .setNumericId(12).build();

        ResourceMappingView view = ResourceMappingView.from(mapping, false);

        assertThat(view.getId(), equalTo("12"));
        assertThat(view.getNumericId(), equalTo(12));
        assertThat(view.getTags(), nullValue());
    }

    @Test
    void omit_the_numeric_id_for_a_github_mapping() {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api").setResourceType(ResourceType.ARCHITECTURE)
                .setNumericId(ResourceMapping.NO_NUMERIC_ID).setPath("aws/prod").setVariant("calm").build();

        ResourceMappingView view = ResourceMappingView.from(mapping, true);

        assertThat(view.getId(), equalTo("api"));
        assertThat(view.getNumericId(), nullValue());
        assertThat(view.getTags(), not(nullValue()));
        assertThat(view.getTags().path(), equalTo("aws/prod"));
        assertThat(view.getTags().variant(), equalTo("calm"));
    }
}
