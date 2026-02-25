// Defines all the schema versions to test against.
export const TEST_ALL_SCHEMA = [['1.0'], ['1.1'], ['1.2']];
export const TEST_1_2_SCHEMA_AND_ABOVE = TEST_ALL_SCHEMA.filter(s => s[0] >= '1.2');
