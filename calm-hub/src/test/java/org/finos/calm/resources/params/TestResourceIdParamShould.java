package org.finos.calm.resources.params;

import jakarta.validation.constraints.Pattern;
import jakarta.ws.rs.PathParam;
import org.finos.calm.domain.GitHubResourceId;
import org.finos.calm.services.ResourceIdResolver;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.finos.calm.resources.ResourceValidationConstants.PATH_QUERY_PARAM_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.VARIANT_QUERY_PARAM_REGEX;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.is;
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

    @Test
    void validate_path_and_variant_at_the_request_edge() throws Exception {
        assertThat(ResourceIdParam.class.getDeclaredField("path").getAnnotation(Pattern.class).regexp(),
                is(PATH_QUERY_PARAM_REGEX));
        assertThat(ResourceIdParam.class.getDeclaredField("variant").getAnnotation(Pattern.class).regexp(),
                is(VARIANT_QUERY_PARAM_REGEX));

        for (String path : new String[]{"aws/prod", "v1.2/api", ""}) {
            assertThat(path, path.matches(PATH_QUERY_PARAM_REGEX), is(true));
        }
        for (String path : new String[]{"../../x", "/abs", "aws//prod", "aws/.", "aws/..", "aws/prod/"}) {
            assertThat(path, path.matches(PATH_QUERY_PARAM_REGEX), is(false));
        }
        for (String variant : new String[]{"calm", "v1-2", ""}) {
            assertThat(variant, variant.matches(VARIANT_QUERY_PARAM_REGEX), is(true));
        }
        for (String variant : new String[]{"a/b", "a.b", "a b"}) {
            assertThat(variant, variant.matches(VARIANT_QUERY_PARAM_REGEX), is(false));
        }
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
