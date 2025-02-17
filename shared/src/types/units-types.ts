export type CalmTimeUnitSchema = {
    unit: 'nanoseconds' | 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';
    value: number;
};

export type CalmCronExpressionSchema = string;
