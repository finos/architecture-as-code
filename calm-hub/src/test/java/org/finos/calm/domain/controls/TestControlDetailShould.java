package org.finos.calm.domain.controls;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class TestControlDetailShould {

    @Test
    public void test_default_constructor() {
        ControlDetail detail = new ControlDetail();
        assertNull(detail.getId());
        assertNull(detail.getName());
        assertNull(detail.getDescription());
    }

    @Test
    public void test_parameterized_constructor() {
        ControlDetail detail = new ControlDetail(1, "Test Control", "Test Description");
        assertEquals(1, detail.getId());
        assertEquals("Test Control", detail.getName());
        assertEquals("Test Description", detail.getDescription());
    }

    @Test
    public void test_getters_and_setters() {
        ControlDetail detail = new ControlDetail();
        detail.setId(42);
        detail.setName("My Control");
        detail.setDescription("My Description");

        assertEquals(42, detail.getId());
        assertEquals("My Control", detail.getName());
        assertEquals("My Description", detail.getDescription());
    }

    @Test
    public void test_equals_same_object() {
        ControlDetail detail = new ControlDetail(1, "Test", "Description");
        assertEquals(detail, detail);
    }

    @Test
    public void test_equals_null() {
        ControlDetail detail = new ControlDetail(1, "Test", "Description");
        assertNotEquals(detail, null);
    }

    @Test
    public void test_equals_different_class() {
        ControlDetail detail = new ControlDetail(1, "Test", "Description");
        assertNotEquals(detail, "String");
    }

    @Test
    public void test_equals_same_values() {
        ControlDetail detail1 = new ControlDetail(1, "Test", "Description");
        ControlDetail detail2 = new ControlDetail(1, "Test", "Description");
        assertEquals(detail1, detail2);
    }

    @Test
    public void test_equals_different_id() {
        ControlDetail detail1 = new ControlDetail(1, "Test", "Description");
        ControlDetail detail2 = new ControlDetail(2, "Test", "Description");
        assertNotEquals(detail1, detail2);
    }

    @Test
    public void test_equals_different_name() {
        ControlDetail detail1 = new ControlDetail(1, "Test1", "Description");
        ControlDetail detail2 = new ControlDetail(1, "Test2", "Description");
        assertNotEquals(detail1, detail2);
    }

    @Test
    public void test_equals_different_description() {
        ControlDetail detail1 = new ControlDetail(1, "Test", "Description1");
        ControlDetail detail2 = new ControlDetail(1, "Test", "Description2");
        assertNotEquals(detail1, detail2);
    }

    @Test
    public void test_hashCode_consistency() {
        ControlDetail detail = new ControlDetail(1, "Test", "Description");
        int hash1 = detail.hashCode();
        int hash2 = detail.hashCode();
        assertEquals(hash1, hash2);
    }

    @Test
    public void test_hashCode_equal_objects() {
        ControlDetail detail1 = new ControlDetail(1, "Test", "Description");
        ControlDetail detail2 = new ControlDetail(1, "Test", "Description");
        assertEquals(detail1.hashCode(), detail2.hashCode());
    }
}
