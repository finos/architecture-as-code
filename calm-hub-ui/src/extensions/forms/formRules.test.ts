import { describe, expect, it } from 'vitest';
import { ExtensionForm } from '../../model/extensions.js';
import { checkValues, FieldValue, formTarget, initialValues, newSubmissionId, own, targetName } from './formRules.js';
// The same cases as TestExtensionFormsShould, so the UI shows the message that Hub would return.
import SHARED from '../../../../calm-hub/src/test/resources/extensions-test/form-input.json' with { type: 'json' };
// The strings that TestExtensionFormsShould expects Hub to write as JavaScript does.
import NUMBERS from '../../../../calm-hub/src/test/resources/extensions-test/javascript-numbers.json' with { type: 'json' };

const form = SHARED.form as ExtensionForm;
const RESOURCE = { namespace: 'finos', resourceType: 'architectures', resourceId: '7', version: '1.0.0' };

describe('checkValues', () => {
    it.each(SHARED.cases)('$name', ({ input, errors }) => {
        // The UI holds a number as the text that the user typed.
        const values = Object.fromEntries(
            Object.entries(input).map(([id, value]) => [id, typeof value === 'number' ? String(value) : value])
        ) as Record<string, FieldValue>;
        expect(checkValues(form, values).errors).toEqual(errors);
    });

    it('sends numbers as numbers, an unticked box as false, and leaves out empty optional fields', () => {
        const { input, errors } = checkValues(form, {
            reviewType: 'design',
            note: 'Check the ledger',
            title: '',
            priority: ' 4 ',
            budget: '1e1',
            confirm: true,
        });
        expect(errors).toEqual({});
        expect(input).toEqual({ reviewType: 'design', note: 'Check the ledger', priority: 4, budget: 10, confirm: true });
    });

    it('refuses text that JavaScript reads as a number but JSON does not', () => {
        for (const text of ['0x10', 'Infinity', '1_000', '']) {
            const { errors } = checkValues({ ...form, fields: [{ id: 'n', type: 'number', label: 'N', required: true }] }, { n: text });
            expect(errors.n, text).toBe(text === '' ? 'Enter a value.' : 'Enter a number.');
        }
    });

    it('takes only a whole number in the safe range of a JSON number in JavaScript, of either sign', () => {
        const field = { id: 'n', type: 'number', label: 'N', integer: true } as const;
        const check = (text: string) => checkValues({ ...form, fields: [field] }, { n: text });
        for (const text of ['9007199254740991', '-9007199254740991', '+42', ' 007 ', '0', '-0']) {
            expect(check(text).errors, text).toEqual({});
            expect(String(check(text).input.n), text).toBe(String(Number(text)));
        }
        expect(check('9007199254740991').input.n).toBe(Number.MAX_SAFE_INTEGER);
        expect(check('-9007199254740991').input.n).toBe(Number.MIN_SAFE_INTEGER);
        for (const text of ['9007199254740992', '9007199254740993', '-9007199254740992', '-9007199254740993', '123456789012345678901']) {
            expect(check(text).errors.n, text).toBe('Enter a whole number from -9007199254740991 to 9007199254740991.');
            expect(check(text).input, text).toEqual({});
        }
        // A fraction or an exponent that would round to a whole number is not a whole number.
        for (const text of ['9007199254740990.5', '3.0000000000000001', '1e3', '5.0']) {
            expect(check(text).errors.n, text).toBe('Enter a whole number.');
        }
        // A range in the manifest comes first, as in Hub.
        expect(checkValues({ ...form, fields: [{ ...field, maximum: 10 }] }, { n: '9007199254740993' }).errors.n).toBe('Enter 10 or less.');
    });

    it('reads only the values of its own fields, so a field can be called constructor or toString', () => {
        const fields = ['constructor', 'toString', 'hasOwnProperty', 'valueOf'].map((id) => ({ id, type: 'text', label: id }) as const);
        expect(checkValues({ ...form, fields }, {})).toEqual({ input: {}, errors: {} });
        const checkbox = { ...form, fields: [{ id: 'toString', type: 'checkbox', label: 'T', required: true } as const] };
        expect(checkValues(checkbox, {}).errors).toEqual({ toString: 'Tick this box to continue.' });
        expect(checkValues(checkbox, { toString: true })).toEqual({ input: { toString: true }, errors: {} });
        expect(own({ note: 'a' }, 'constructor')).toBeUndefined();
        expect(own({ constructor: 'a' }, 'constructor')).toBe('a');
    });

    it('refuses a lone surrogate, as Hub does', () => {
        expect(checkValues(form, { reviewType: 'design', note: 'Bad \ud800 text', title: 'a\udc00', confirm: true }).errors).toEqual({
            note: 'Remove the control characters.',
            title: 'Enter one line of text.',
        });
    });

    it('starts from the field defaults', () => {
        expect(initialValues(form)).toEqual({
            reviewType: 'security',
            note: '',
            title: '',
            priority: '3',
            budget: '',
            sequence: '',
            confirm: false,
        });
    });
});

describe('a number in a manifest', () => {
    it.each(NUMBERS.cases)('$literal is $javascript in JavaScript', ({ literal, javascript }) => {
        const number = JSON.parse(literal) as number;
        expect(String(number)).toBe(javascript);
        if (Number.isFinite(number)) expect(JSON.stringify(number)).toBe(javascript);
        // A default shows, and sends, as JavaScript writes it, so Hub must check the number of that string.
        const numberForm: ExtensionForm = { ...form, fields: [{ id: 'n', type: 'number', label: 'N', default: number }] };
        expect(initialValues(numberForm)).toEqual({ n: javascript });
    });
});

describe('formTarget', () => {
    it('gives a resource form the resource and keeps a selected node', () => {
        expect(formTarget(form, { ...RESOURCE, selectedElement: 'api' })).toEqual({
            ...RESOURCE,
            resource: 'architectures/7',
            selectedElement: 'api',
        });
    });

    it('waits for each value that the target needs', () => {
        expect(formTarget(form, { ...RESOURCE, version: undefined })).toBeUndefined();
        expect(formTarget({ ...form, target: 'element' }, RESOURCE)).toBeUndefined();
        expect(formTarget({ ...form, target: 'none' }, undefined)).toEqual({});
    });

    it('names a target in one line', () => {
        expect(targetName(formTarget({ ...form, target: 'element' }, { ...RESOURCE, selectedElement: 'api' })!)).toBe(
            'finos architectures/7 1.0.0, node api'
        );
    });
});

describe('newSubmissionId', () => {
    it('makes a lower-case version 4 UUID, which Hub requires', () => {
        expect(newSubmissionId((bytes) => bytes.fill(0xff))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
        expect(newSubmissionId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(newSubmissionId()).not.toBe(newSubmissionId());
    });
});
