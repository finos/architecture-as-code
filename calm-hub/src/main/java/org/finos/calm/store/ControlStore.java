package org.finos.calm.store;

import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.ControlConfigurationNotFoundException;
import org.finos.calm.domain.exception.ControlConfigurationVersionNotFoundException;
import org.finos.calm.domain.exception.ControlConfigurationVersionExistsException;
import org.finos.calm.domain.exception.ControlNotFoundException;
import org.finos.calm.domain.exception.ControlRequirementVersionExistsException;
import org.finos.calm.domain.exception.ControlRequirementVersionNotFoundException;
import org.finos.calm.domain.exception.DomainNotFoundException;

import java.util.List;

public interface ControlStore {
    List<ControlDetail> getControlsForDomain(String domain) throws DomainNotFoundException;
    ControlDetail createControlRequirement(CreateControlRequirement request, String domain) throws DomainNotFoundException;

    List<String> getRequirementVersions(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException;
    String getRequirementForVersion(String domain, int controlId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionNotFoundException;
    void createRequirementForVersion(String domain, int controlId, String version, String requirementJson) throws DomainNotFoundException, ControlNotFoundException, ControlRequirementVersionExistsException;

    List<Integer> getConfigurationsForControl(String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException;
    int createControlConfiguration(CreateControlConfiguration request, String domain, int controlId) throws DomainNotFoundException, ControlNotFoundException;

    List<String> getConfigurationVersions(String domain, int controlId, int configurationId) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException;
    String getConfigurationForVersion(String domain, int controlId, int configurationId, String version) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionNotFoundException;
    void createConfigurationForVersion(String domain, int controlId, int configurationId, String version, String configurationJson) throws DomainNotFoundException, ControlNotFoundException, ControlConfigurationNotFoundException, ControlConfigurationVersionExistsException;
}
