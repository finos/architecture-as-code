import { useCallback, useEffect, useState } from 'react';
import {
    ControlConfigDetail,
    ControlConfigurationDoc,
    ControlData,
    ControlRequirementDoc,
} from '../../../model/control.js';
import { ControlService } from '../../../service/control-service.js';
import { sortVersionsDescending } from '../../../model/version.js';

/** A value with the key of the request or choice it belongs to. */
interface Keyed<T> {
    key: string;
    value: T;
}

const NONE: never[] = [];

function valueFor<T>(entry: Keyed<T> | null, key: string): T | undefined {
    return entry?.key === key ? entry.value : undefined;
}

/**
 * Loads the requirement and configuration documents of a control. Each result and
 * choice is kept with the key it belongs to, so a change of control or configuration
 * resets the selection during render and a late response for an earlier key is ignored.
 * Until the user chooses, the latest version and the first configuration are selected.
 */
export function useControlDocuments(controlService: ControlService, { domain, controlId }: ControlData) {
    const controlKey = `${domain}|${controlId}`;

    const [requirementVersionsResult, setRequirementVersionsResult] = useState<Keyed<string[]> | null>(null);
    const [chosenReqVersion, setChosenReqVersion] = useState<Keyed<string> | null>(null);
    const [requirementResult, setRequirementResult] = useState<Keyed<ControlRequirementDoc | undefined> | null>(null);

    const [configsResult, setConfigsResult] = useState<Keyed<ControlConfigDetail[]> | null>(null);
    const [chosenConfigId, setChosenConfigId] = useState<Keyed<number> | null>(null);
    const [configVersionsResult, setConfigVersionsResult] = useState<Keyed<string[]> | null>(null);
    const [chosenConfigVersion, setChosenConfigVersion] = useState<Keyed<string> | null>(null);
    const [configResult, setConfigResult] = useState<Keyed<ControlConfigurationDoc | undefined> | null>(null);

    const requirementVersions = valueFor(requirementVersionsResult, controlKey) ?? NONE;
    const selectedReqVersion = valueFor(chosenReqVersion, controlKey) ?? requirementVersions[0] ?? '';
    const requirementKey = `${controlKey}|${selectedReqVersion}`;
    const requirementJson = valueFor(requirementResult, requirementKey);

    const configs = valueFor(configsResult, controlKey) ?? NONE;
    const selectedConfigId = valueFor(chosenConfigId, controlKey) ?? configs[0]?.id ?? null;
    const configKey = `${controlKey}|${selectedConfigId}`;
    const configVersions = valueFor(configVersionsResult, configKey) ?? NONE;
    const selectedConfigVersion = valueFor(chosenConfigVersion, configKey) ?? configVersions[0] ?? '';
    const configVersionKey = `${configKey}|${selectedConfigVersion}`;
    const configJson = valueFor(configResult, configVersionKey);

    useEffect(() => {
        let cancelled = false;
        controlService.fetchRequirementVersions(domain, controlId)
            .then(sortVersionsDescending)
            .catch((error): string[] => {
                console.error('%s', 'Failed to load requirement versions:', error);
                return [];
            })
            .then((versions) => {
                if (!cancelled) setRequirementVersionsResult({ key: controlKey, value: versions });
            });
        controlService.fetchConfigurationsForControl(domain, controlId)
            .catch((error): ControlConfigDetail[] => {
                console.error('%s', 'Failed to load configurations:', error);
                return [];
            })
            .then((list) => {
                if (!cancelled) setConfigsResult({ key: controlKey, value: list });
            });
        return () => {
            cancelled = true;
        };
    }, [controlService, domain, controlId, controlKey]);

    useEffect(() => {
        if (!selectedReqVersion) return;
        let cancelled = false;
        controlService.fetchRequirementForVersion(domain, controlId, selectedReqVersion)
            .catch((error): undefined => {
                console.error('%s', 'Failed to load control requirement:', error);
                return undefined;
            })
            .then((doc) => {
                if (!cancelled) setRequirementResult({ key: requirementKey, value: doc });
            });
        return () => {
            cancelled = true;
        };
    }, [controlService, domain, controlId, selectedReqVersion, requirementKey]);

    useEffect(() => {
        if (selectedConfigId === null) return;
        let cancelled = false;
        controlService.fetchConfigurationVersions(domain, controlId, selectedConfigId)
            .then(sortVersionsDescending)
            .catch((error): string[] => {
                console.error('%s', 'Failed to load configuration versions:', error);
                return [];
            })
            .then((versions) => {
                if (!cancelled) setConfigVersionsResult({ key: configKey, value: versions });
            });
        return () => {
            cancelled = true;
        };
    }, [controlService, domain, controlId, selectedConfigId, configKey]);

    useEffect(() => {
        if (selectedConfigId === null || !selectedConfigVersion) return;
        let cancelled = false;
        controlService.fetchConfigurationForVersion(domain, controlId, selectedConfigId, selectedConfigVersion)
            .catch((error): undefined => {
                console.error('%s', 'Failed to load configuration:', error);
                return undefined;
            })
            .then((doc) => {
                if (!cancelled) setConfigResult({ key: configVersionKey, value: doc });
            });
        return () => {
            cancelled = true;
        };
    }, [controlService, domain, controlId, selectedConfigId, selectedConfigVersion, configVersionKey]);

    const selectReqVersion = useCallback(
        (version: string) => setChosenReqVersion({ key: controlKey, value: version }),
        [controlKey]
    );
    const selectConfig = useCallback(
        (configId: number) => setChosenConfigId({ key: controlKey, value: configId }),
        [controlKey]
    );
    const selectConfigVersion = useCallback(
        (version: string) => {
            if (selectedConfigId !== null) setChosenConfigVersion({ key: configKey, value: version });
        },
        [selectedConfigId, configKey]
    );

    return {
        controlKey,
        requirementVersions,
        selectedReqVersion,
        requirementJson,
        configs,
        selectedConfigId,
        configVersions,
        selectedConfigVersion,
        configJson,
        selectReqVersion,
        selectConfig,
        selectConfigVersion,
    };
}
