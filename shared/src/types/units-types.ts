export type CalmTimeUnitSchema = {
    unit:
        | 'nanoseconds'
        | 'microseconds'
        | 'milliseconds'
        | 'seconds'
        | 'minutes'
        | 'hours'
        | 'days'
        | 'weeks'
        | 'months'
        | 'quarters'
        | 'years';
    value: number;
};

export type CalmRateUnitSchema = {
    rate: number;
    per:
        | 'nanosecond'
        | 'microsecond'
        | 'millisecond'
        | 'second'
        | 'minute'
        | 'hour'
        | 'day'
        | 'week'
        | 'month'
        | 'quarter'
        | 'year';
};

export type CalmCronExpressionSchema = string;
