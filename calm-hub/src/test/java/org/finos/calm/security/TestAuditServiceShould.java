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

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.LogRecord;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
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
    void name_the_route_jti_and_shared_resource_of_an_extension_entry_when_the_store_write_fails() {
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
                .setResourceType("architectures")
                .setResourceId("7")
                .build();

        List<String> warnings = LogCapture.messages(AuditService.class, Level.WARNING, () -> auditService.record(entry));

        assertThat(warnings, contains(containsString("route=[add-service] jti=[jti-1] resourceType=[architectures] resourceId=[7]")));
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
    void write_only_the_log_line_on_a_read_only_hub() {
        auditService.storeEnabled = true;
        auditService.logEnabled = true;
        auditService.readOnly = true;
        AuditLogEntry chat = new AuditLogEntry.AuditLogEntryBuilder()
                .setActor("alice")
                .setAction(AuditAction.READ)
                .setEntityType(AuditEntityType.EXTENSION)
                .setEntityId("assistant")
                .setRoute("ask")
                .setJti("jti-1")
                .setOutcome(AuditOutcome.SUCCESS)
                .setNamespace("finos")
                .setResourceType("architectures")
                .setResourceId("7")
                .setVersion("1.0.0")
                .setTimestamp(LocalDateTime.of(2026, 1, 2, 12, 34, 56))
                .build();
        List<LogRecord> lines = new ArrayList<>();

        List<String> warnings = LogCapture.messages(AuditService.class, Level.WARNING,
                () -> lines.addAll(LogCapture.records("org.finos.calm.audit", Level.INFO, () -> auditService.record(chat))));

        verifyNoInteractions(auditLogStore);
        assertThat(warnings, is(empty()));
        assertThat(lines.size(), is(1));
        assertThat(rendered(lines.getFirst()), is("AUDIT actor=[alice] action=[READ] entityType=[EXTENSION] namespace=[finos] "
                + "domain=[null] entityId=[assistant] version=[1.0.0] outcome=[SUCCESS] sourceIp=[null] "
                + "timestamp=[2026-01-02T12:34:56] route=[ask] jti=[jti-1] resourceType=[architectures] resourceId=[7]"));
    }

    /** The line as the log shows it, whether or not the log manager has put the parameters into the message. */
    private static String rendered(LogRecord record) {
        String text = record.getMessage();
        for (Object parameter : record.getParameters() == null ? new Object[0] : record.getParameters()) {
            text = text.replaceFirst("\\{}", java.util.regex.Matcher.quoteReplacement(String.valueOf(parameter)));
        }
        return text;
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
