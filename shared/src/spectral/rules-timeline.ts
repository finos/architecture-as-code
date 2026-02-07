import { RulesetDefinition } from '@stoplight/spectral-core';
import { truthy } from '@stoplight/spectral-functions';
import { idsAreUnique } from './functions/timeline/ids-are-unique';
import { momentIdExists } from './functions/timeline/moment-id-exists';
import { validFromNotAfterCurrentMoment } from './functions/timeline/valid-from-not-after-current-moment';

const timelineRules: RulesetDefinition = {
    rules: {
        'timeline-has-no-empty-properties': {
            description: 'Must not contain string properties set to the empty string or numerical properties set to zero',
            message: 'All properties must be set to a nonempty, nonzero value.',
            severity: 'error',
            given: '$..*',
            then: {
                function: truthy,
            },
        },

        'current-moment-must-reference-moment-in-timeline': {
            description: 'Current-moment must reference a moment',
            severity: 'error',
            message: '{{error}}',
            given: '$.current-moment',
            then: {
                function: momentIdExists
            },
        },

        'unique-ids-must-be-unique-in-timeline': {
            description: 'Unique IDs cannot be reused.',
            severity: 'error',
            message: '{{error}}',
            given: '$',
            then: {
                function: idsAreUnique
            },
        },

        'moments-after-current-moment-may-not-have-valid-from': {
            description: 'A moment with a valid-from must not be after the current-moment.',
            severity: 'warn',
            message: '{{error}}',
            given: '$.current-moment',
            then: {
                function: validFromNotAfterCurrentMoment
            }
        }
    }
};

export default timelineRules;