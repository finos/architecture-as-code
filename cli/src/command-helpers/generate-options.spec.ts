import { CalmChoice } from '@finos/calm-shared';
import { promptUserForOptions, loadChoicesFromInput } from './generate-options';

const mocks = vi.hoisted(() => {
    return {
        extractOptions: vi.fn(),
        select: vi.fn(),
        checkbox: vi.fn(),
        existsSync: vi.fn(),
        readFileSync: vi.fn()
    };
});

vi.mock('@finos/calm-shared', async () => {
    const actual = await vi.importActual<typeof import('@finos/calm-shared')>('@finos/calm-shared');
    return {
        ...actual,
        extractOptions: mocks.extractOptions
    };
});

vi.mock('@inquirer/prompts', () => ({
    select: mocks.select,
    checkbox: mocks.checkbox
}));

vi.mock('fs', () => ({
    existsSync: mocks.existsSync,
    readFileSync: mocks.readFileSync
}));

const choice1 = { description: 'Option 1', nodes: ['option1'], relationships: ['relationship1'] };
const choice2 = { description: 'Option 2', nodes: ['option2'], relationships: ['relationship2'] };

const choiceA = { description: 'Option A', nodes: ['optionA'], relationships: ['relationshipA'] };
const choiceB = { description: 'Option B', nodes: ['optionB'], relationships: ['relationshipB'] };

const pattern = {}; // pattern doesn't matter since we're mocking the extractOptions function

describe('loadChoicesFromInput', () => {
    beforeEach(() => {
        mocks.extractOptions.mockReturnValue([
            { optionType: 'oneOf', optionId: 'option-1', prompt: 'Choose an option:', choices: [choice1, choice2] },
            { optionType: 'anyOf', optionId: 'option-a', prompt: 'Select any:', choices: [choiceA, choiceB] }
        ]);
    });

    it('should resolve choices from inline JSON string', () => {
        mocks.existsSync.mockReturnValue(false);
        const result = loadChoicesFromInput('{"option-1": "Option 1", "option-a": "Option A"}', pattern);
        expect(result).toEqual([choice1, choiceA]);
    });

    it('should resolve choices from a JSON file', () => {
        mocks.existsSync.mockReturnValue(true);
        mocks.readFileSync.mockReturnValue('{"option-1": "Option 2"}');
        const result = loadChoicesFromInput('choices.json', pattern);
        expect(result).toEqual([choice2]);
    });

    it('should return empty object when given empty object', () => {
        mocks.existsSync.mockReturnValue(false);
        const result = loadChoicesFromInput('{}', pattern);
        expect(result).toEqual([]);
    });

    it('should throw when the option id is not in the pattern', () => {
        mocks.existsSync.mockReturnValue(false);
        expect(() => loadChoicesFromInput('{"invalid-option": "Option 1"}', pattern))
            .toThrow('The option id [invalid-option] is not a valid option in the pattern.');
    });

    it('should throw when a choice description is not valid for the option', () => {
        mocks.existsSync.mockReturnValue(false);
        expect(() => loadChoicesFromInput('{"option-1": "Invalid Choice"}', pattern))
            .toThrow('The choice of [Invalid Choice] is not a valid choice for option [option-1].');
    });

    it('should throw when input is not a JSON object', () => {
        mocks.existsSync.mockReturnValue(false);
        expect(() => loadChoicesFromInput('["Option 1"]', pattern))
            .toThrow('Option choices must be a JSON object mapping option ids to choice descriptions.');
    });

    it('should throw when input is invalid JSON', () => {
        mocks.existsSync.mockReturnValue(false);
        expect(() => loadChoicesFromInput('not-json', pattern))
            .toThrow('Failed to parse option choices:');
    });
});

describe('promptUserForOptions', () => {
    it('should prompt user for options and return selected choices', async () => {
        mocks.extractOptions.mockReturnValue([
            {
                optionType: 'oneOf',
                optionId: 'option-1',
                prompt: 'Choose an option:',
                choices: [choice1, choice2]
            },
            {
                optionType: 'anyOf',
                optionId: 'option-a',
                prompt: 'Select any of these options:',
                choices: [choiceA, choiceB]
            }
        ]);
        mocks.select.mockReturnValue(Promise.resolve('Option 1'));
        mocks.checkbox.mockReturnValue(Promise.resolve(['Option A']));

        const expectedChoices: CalmChoice[] = [choice1, choiceA];
        await expect(promptUserForOptions(pattern)).resolves.toEqual(expectedChoices);
    });

    it('should return empty list when user selects nothing', async () => {
        mocks.extractOptions.mockReturnValue([{
            optionType: 'anyOf',
            optionId: 'option-a',
            prompt: 'Select any of these options:',
            choices: [choiceA, choiceB]
        }]);
        mocks.checkbox.mockReturnValue(Promise.resolve([])); // user selects nothing

        await expect(promptUserForOptions(pattern)).resolves.toEqual([]);
    });

    it('should throw an error when user selects an option thats not in the pattern', async () => {
        mocks.extractOptions.mockReturnValue([{
            optionType: 'oneOf',
            optionId: 'option-1',
            prompt: 'Choose an option:',
            choices: [choice1, choice2]
        }]);
        mocks.select.mockReturnValue(Promise.resolve('Invalid Option'));

        await expect(promptUserForOptions(pattern)).rejects.toThrow('The choice of [Invalid Option] is not a valid choice in the pattern.');
    });
});