package org.finos.calm.model.canonical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CalmNodeInterfaceSchema {
    private String node;
    private List<String> interfaces;

    public String getNode() { return node; }
    public List<String> getInterfaces() { return interfaces; }
}
