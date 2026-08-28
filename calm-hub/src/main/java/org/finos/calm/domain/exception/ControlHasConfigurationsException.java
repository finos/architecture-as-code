package org.finos.calm.domain.exception;

/**
 * Thrown when a control requirement cannot be deleted because it still has
 * configurations associated with it. Carries the raw control id and configuration
 * count as fields rather than a formatted message — the resource layer (see
 * {@code ControlResource#controlHasConfigurationsResponse}) is solely responsible
 * for composing the user-facing message, so it isn't duplicated here.
 */
public class ControlHasConfigurationsException extends Exception {
    private final int controlId;
    private final int configurationCount;

    /**
     * @param controlId          the control that could not be deleted because it still has configurations
     * @param configurationCount how many configurations exist under the control
     */
    public ControlHasConfigurationsException(int controlId, int configurationCount) {
        super("Control not empty: " + controlId);
        this.controlId = controlId;
        this.configurationCount = configurationCount;
    }

    public int getControlId() {
        return controlId;
    }

    public int getConfigurationCount() {
        return configurationCount;
    }
}
