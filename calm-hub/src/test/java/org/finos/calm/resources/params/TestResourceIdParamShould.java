package org.finos.calm.resources.params;

import jakarta.ws.rs.PathParam;
import org.finos.calm.domain.GitHubResourceId;
import org.finos.calm.services.ResourceIdResolver;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestResourceIdParamShould {

    @Test
    void bind_the_named_path_id_and_optional_fields() throws Exception {
        ArchitectureIdParam param = new ArchitectureIdParam();
        set(param, "architectureId", "api");
        set(param, "path", "aws/prod");
        set(param, "variant", "calm");

        ResourceIdResolver resolver = mock(ResourceIdResolver.class);
        when(resolver.forStorage("api", "aws/prod", "calm"))
                .thenReturn(new GitHubResourceId("api", "aws/prod", "calm"));

        assertThat(param.rawId(), equalTo("api"));
        assertThat(param.toResourceId(resolver), equalTo(new GitHubResourceId("api", "aws/prod", "calm")));
        assertThat(ArchitectureIdParam.class.getDeclaredField("architectureId")
                .isAnnotationPresent(PathParam.class), equalTo(true));
    }

    private void set(Object target, String fieldName, String value) throws Exception {
        Class<?> type = target.getClass();
        Field field = fieldName.equals("path") || fieldName.equals("variant")
                ? ResourceIdParam.class.getDeclaredField(fieldName)
                : type.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
