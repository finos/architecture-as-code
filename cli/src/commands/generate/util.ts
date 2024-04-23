import _ from 'lodash'

// TODO remove lodash
export function mergeSchemas(s1: object, s2: object) {
    return _.merge({}, s1, s2)
}