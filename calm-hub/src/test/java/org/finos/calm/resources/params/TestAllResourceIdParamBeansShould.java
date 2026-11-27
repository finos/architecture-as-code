package org.finos.calm.resources.params;

import org.finos.calm.domain.GitHubResourceId;
import org.finos.calm.services.ResourceIdResolver;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.List;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Exercises every per-name id bean so each class clears the JaCoCo line threshold. */
class TestAllResourceIdParamBeansShould {

    private static final List<Class<? extends ResourceIdParam>> BEANS = List.of(
            ArchitectureIdParam.class, PatternIdParam.class, FlowIdParam.class,
            TimelineIdParam.class, StandardIdParam.class, InterfaceIdParam.class,
            ControlIdParam.class, ConfigIdParam.class, AdrIdParam.class,
            IdParam.class, UserAccessIdParam.class);

    @Test
    void bind_their_named_id_and_forward_optional_fields() throws Exception {
        GitHubResourceId expected = new GitHubResourceId("api", "prod", "calm");
        ResourceIdResolver resolver = mock(ResourceIdResolver.class);
        when(resolver.forStorage("api", "prod", "calm")).thenReturn(expected);

        for (Class<? extends ResourceIdParam> type : BEANS) {
            ResourceIdParam bean = type.getDeclaredConstructor().newInstance();
            for (Field field : allFields(type)) {
                field.setAccessible(true);
                if (!Modifier.isStatic(field.getModifiers())) {
                    field.set(bean, field.getName().equals("path") ? "prod"
                            : field.getName().equals("variant") ? "calm" : "api");
                }
            }
            assertThat(type.getSimpleName(), bean.rawId(), equalTo("api"));
            assertThat(type.getSimpleName(), bean.getPath(), equalTo("prod"));
            assertThat(type.getSimpleName(), bean.getVariant(), equalTo("calm"));
            assertThat(type.getSimpleName(), bean.toResourceId(resolver), equalTo(expected));
        }
    }

    private List<Field> allFields(Class<?> type) {
        java.util.List<Field> fields = new java.util.ArrayList<>();
        for (Class<?> current = type; current != null && current != Object.class; current = current.getSuperclass()) {
            fields.addAll(List.of(current.getDeclaredFields()));
        }
        return fields;
    }
}
