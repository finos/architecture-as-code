package org.finos.calm.testutil;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;

/** Collects the log records of one class at a level or above, in plain unit tests (slf4j goes to JBoss LogManager). */
public final class LogCapture {

    private LogCapture() {
    }

    public static List<LogRecord> records(Class<?> source, Level level, Runnable action) {
        Logger logger = Logger.getLogger(source.getName());
        List<LogRecord> records = new ArrayList<>();
        Handler handler = new Handler() {
            @Override
            public void publish(LogRecord logRecord) {
                if (logRecord.getLevel().intValue() >= level.intValue()) {
                    records.add(logRecord);
                }
            }

            @Override
            public void flush() {
            }

            @Override
            public void close() {
            }
        };
        Level previous = logger.getLevel();
        logger.setLevel(level);
        logger.addHandler(handler);
        try {
            action.run();
        } finally {
            logger.removeHandler(handler);
            logger.setLevel(previous);
        }
        return records;
    }

    // The message, then any parameters that the log manager has not put into it.
    public static List<String> messages(Class<?> source, Level level, Runnable action) {
        return records(source, level, action).stream()
                .map(r -> r.getParameters() == null || r.getParameters().length == 0
                        ? r.getMessage() : r.getMessage() + " " + Arrays.toString(r.getParameters()))
                .toList();
    }
}
