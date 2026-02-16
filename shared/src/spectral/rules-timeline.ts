import { RulesetDefinition } from '@stoplight/spectral-core';
import { truthy } from '@stoplight/spectral-functions';
import { currentMomentRequiredWhenMomentsNonEmpty } from './functions/timeline/current-moment-required-when-moments-non-empty';
import { idsAreUnique } from './functions/timeline/ids-are-unique';
import { momentIdExists } from './functions/timeline/moment-id-exists';
import { momentsMustBeNonEmpty } from './functions/timeline/moments-must-be-non-empty';
import { momentsSortedByValidFrom } from './functions/timeline/moments-sorted-by-valid-from';
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
        },

        'current-moment-required-when-moments-non-empty': {
            description: 'Current-moment must be defined when moments are present.',
            severity: 'warn',
            message: '{{error}}',
            given: '$',
            then: {
                function: currentMomentRequiredWhenMomentsNonEmpty
            }
        },

        'timeline-moments-must-be-non-empty': {
            description: 'Timeline must define at least one moment.',
            severity: 'warn',
            message: '{{error}}',
            given: '$',
            then: {
                function: momentsMustBeNonEmpty
            }
        },

        'moments-must-be-sorted-by-valid-from': {
            description: 'Moments with valid-from must be sorted by date.',
            severity: 'error',
            message: '{{error}}',
            given: '$',
            then: {
                function: momentsSortedByValidFrom
            }
        }
    }
};

export default timelineRules;