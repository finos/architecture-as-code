package org.finos.calm.security;

import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditEntityType;
import org.finos.calm.domain.audit.AuditLogEntry;
import org.finos.calm.domain.audit.AuditOutcome;
import org.finos.calm.store.AuditLogStore;
import org.finos.calm.testutil.LogCapture;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.logging.Level;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
public class TestAuditServiceShould {

    @Mock
    AuditLogStore auditLogStore;

    private AuditService auditService;

    @BeforeEach
    void setup() {
        auditService = new AuditService(auditLogStore);
    }

    private AuditLogEntry sampleEntry() {
        return new AuditLogEntry.AuditLogEntryBuilder()
                .setActor("alice")
                .setAction(AuditAction.CREATE)
                .setEntityType(AuditEntityType.ARCHITECTURE)
                .setOutcome(AuditOutcome.SUCCESS)
                .build();
    }

    @Test
    void write_to_store_when_store_enabled() {
        auditService.storeEnabled = true;
        auditService.logEnabled = false;

        auditService.record(sampleEntry());

        verify(auditLogStore).record(any(AuditLogEntry.class));
    }

    @Test
    void not_write_to_store_when_store_disabled() {
        auditService.storeEnabled = false;
        auditService.logEnabled = false;

        auditService.record(sampleEntry());

        verify(auditLogStore, never()).record(any(AuditLogEntry.class));
    }

    @Test
    void not_throw_when_store_write_fails() {
        auditService.storeEnabled = true;
        auditService.logEnabled = false;
        doThrow(new RuntimeException("Mongo down")).when(auditLogStore).record(any(AuditLogEntry.class));

        auditService.record(sampleEntry());
    }

    @Test
    void name_the_route_and_jti_of_an_extension_entry_when_the_store_write_fails() {
        auditService.storeEnabled = true;
        auditService.logEnabled = false;
        doThrow(new RuntimeException("Mongo down")).when(auditLogStore).record(any(AuditLogEntry.class));
        AuditLogEntry entry = new AuditLogEntry.AuditLogEntryBuilder()
                .setActor("alice")
                .setAction(AuditAction.CREATE)
                .setEntityType(AuditEntityType.EXTENSION)
                .setEntityId("team-services")
                .setOutcome(AuditOutcome.SUCCESS)
                .setRoute("add-service")
                .setJti("jti-1")
                .build();

        List<String> warnings = LogCapture.messages(AuditService.class, Level.WARNING, () -> auditService.record(entry));

        assertThat(warnings, contains(containsString("route=[add-service] jti=[jti-1]")));
    }

    @Test
    void leave_out_the_extension_fields_of_another_entry_when_the_store_write_fails() {
        auditService.storeEnabled = true;
        auditService.logEnabled = false;
        doThrow(new RuntimeException("Mongo down")).when(auditLogStore).record(any(AuditLogEntry.class));

        List<String> warnings = LogCapture.messages(AuditService.class, Level.WARNING, () -> auditService.record(sampleEntry()));

        assertThat(warnings, contains(not(containsString("route="))));
    }

    @Test
    void neither_write_nor_throw_when_both_disabled() {
        auditService.storeEnabled = false;
        auditService.logEnabled = false;

        auditService.record(sampleEntry());

        verifyNoInteractions(auditLogStore);
    }

    @Test
    void emit_a_log_line_when_log_enabled_without_touching_the_store() {
        auditService.storeEnabled = false;
        auditService.logEnabled = true;

        auditService.record(sampleEntry());

        verifyNoInteractions(auditLogStore);
    }
}
