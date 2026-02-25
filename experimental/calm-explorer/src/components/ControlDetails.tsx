import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Shield, AlertCircle, Loader2 } from 'lucide-react';
import type { CALMControl, ControlConfiguration } from '@/types/calm';
import { ControlCategoryBadge } from './ControlBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface ControlDetailsProps {
  controlName: string;
  control: CALMControl;
  resolvedConfigs?: ControlConfiguration[];
  loading?: boolean;
}

export function ControlDetails({
  controlName,
  control,
  resolvedConfigs = [],
  loading = false,
}: ControlDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="mb-3">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="text-green-600" size={18} />
              {controlName}
            </CardTitle>
            <CardDescription className="mt-1 text-sm">
              {control.description}
            </CardDescription>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="animate-spin" size={16} />
              Loading control configurations...
            </div>
          ) : resolvedConfigs.length > 0 ? (
            <div className="space-y-4">
              {resolvedConfigs.map((config, index) => (
                <ControlConfigurationDetails key={index} config={config} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle size={16} />
              Control configurations not resolved. Upload file-mappings.json to view details.
            </div>
          )}

          {/* Requirements */}
          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-2">Requirements</h4>
            <div className="space-y-2">
              {control.requirements.map((req, index) => (
                <div
                  key={index}
                  className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 dark:text-gray-400">Config:</span>
                    <a
                      href={req['config-url']}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 flex-1"
                    >
                      {req['config-url']}
                      <ExternalLink size={10} />
                    </a>
                  </div>
                  {req['implementation-section'] && (
                    <div className="flex items-start gap-2 mt-1">
                      <span className="text-gray-500 dark:text-gray-400">Section:</span>
                      <code className="text-xs">{req['implementation-section']}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface ControlConfigurationDetailsProps {
  config: ControlConfiguration;
}

function ControlConfigurationDetails({ config }: ControlConfigurationDetailsProps) {
  const [showImplementation, setShowImplementation] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-2">
            {config['control-id']} - {config['control-name']}
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {config.description}
          </p>
        </div>
        <ControlCategoryBadge category={config.category} />
      </div>

      {/* Mitigated Risks */}
      {config['mitigates-risks'] && config['mitigates-risks'].length > 0 && (
        <div className="mt-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Mitigates Risks:
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {config['mitigates-risks'].map(risk => (
              <Badge key={risk} variant="outline" className="text-xs">
                {risk}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Related Mitigations */}
      {config['related-mitigations'] && config['related-mitigations'].length > 0 && (
        <div className="mt-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Related Mitigations:
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {config['related-mitigations'].map(mitigation => (
              <Badge key={mitigation} variant="secondary" className="text-xs">
                {mitigation}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Reference Link */}
      {config['reference-url'] && (
        <div className="mt-2">
          <a
            href={config['reference-url']}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            View Documentation
            <ExternalLink size={12} />
          </a>
        </div>
      )}

      {/* Implementation Requirements (collapsible) */}
      {config['implementation-requirements'] && (
        <div className="mt-3">
          <button
            onClick={() => setShowImplementation(!showImplementation)}
            className="text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 flex items-center gap-1"
          >
            {showImplementation ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Implementation Requirements
          </button>
          {showImplementation && (
            <pre className="mt-2 text-xs bg-white dark:bg-gray-950 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(config['implementation-requirements'], null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
