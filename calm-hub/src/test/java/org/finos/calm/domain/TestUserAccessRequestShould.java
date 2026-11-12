package org.finos.calm.domain;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.hibernate.validator.messageinterpolation.ParameterMessageInterpolator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;

public class TestUserAccessRequestShould {

    private static ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void setupValidator() {
        validatorFactory = Validation.byDefaultProvider()
                .configure()
                .messageInterpolator(new ParameterMessageInterpolator())
                .buildValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        validatorFactory.close();
    }

    @Test
    void default_subject_type_to_user() {
        assertThat(new UserAccessRequest().getSubjectType(), is(UserAccess.SubjectType.user));
    }

    @Test
    void treat_a_null_subject_type_as_user() {
        UserAccessRequest request = new UserAccessRequest();
        request.setSubjectType(UserAccess.SubjectType.group);
        request.setSubjectType(null);

        assertThat(request.getSubjectType(), is(UserAccess.SubjectType.user));
    }

    @Test
    void accept_a_group_request() {
        assertThat(validator.validate(request("architects", UserAccess.SubjectType.group)), is(empty()));
    }

    @Test
    void accept_a_wildcard_user_request() {
        assertThat(validator.validate(request("*", UserAccess.SubjectType.user)), is(empty()));
    }

    @Test
    void reject_a_wildcard_group_request() {
        Set<ConstraintViolation<UserAccessRequest>> violations =
                validator.validate(request("*", UserAccess.SubjectType.group));

        assertThat(violations, hasSize(1));
        assertThat(violations.iterator().next().getMessage(), is("The '*' wildcard is not a valid group name"));
    }

    private static UserAccessRequest request(String username, UserAccess.SubjectType subjectType) {
        UserAccessRequest request = new UserAccessRequest();
        request.setUsername(username);
        request.setPermission(UserAccess.Permission.read);
        request.setSubjectType(subjectType);
        return request;
    }
}
