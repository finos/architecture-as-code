package org.finos.calm.store;

import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.exception.DomainNotFoundException;

import java.util.List;

public interface ControlStore {
    List<ControlDetail> getControlsForDomain(String domain) throws DomainNotFoundException;
}
