package org.finos.calm.mcp.api.model;

public class CreateAdrResponse {
    private boolean success;

    public CreateAdrResponse(boolean success) {
        this.success = success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    @Override
    public String toString() {
        return "CreateAdrResponse{" +
                "success=" + success +
                '}';
    }
}
