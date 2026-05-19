import { CalmChoice, CalmOption, extractOptions, initLogger } from '@finos/calm-shared';
import { select, checkbox } from '@inquirer/prompts';
import { readFileSync, existsSync } from 'fs';

/**
 * Loads pre-defined option choices from a file path or inline JSON string.
 * The input should be a JSON object mapping option unique-ids to choice descriptions.
 * For oneOf options supply a single string; for anyOf options supply a string or string[].
 * e.g. {"connection-options": "Application A connects to C", "node-options": ["Node 1", "Node 2"]}
 */
export function loadChoicesFromInput(optionChoicesInput: string, pattern: object, debug: boolean = false): CalmChoice[] {
    const logger = initLogger(debug, 'calm-generate-options');

    let choiceMap: Record<string, string | string[]>;
    try {
        const jsonString = existsSync(optionChoicesInput)
            ? readFileSync(optionChoicesInput, 'utf-8')
            : optionChoicesInput;
        const parsed = JSON.parse(jsonString);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('Option choices must be a JSON object mapping option ids to choice descriptions.');
        }
        choiceMap = parsed;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to parse option choices: ${message}`);
    }

    const patternOptions: CalmOption[] = extractOptions(pattern);

    logger.debug('Resolving pre-defined choices: ' + JSON.stringify(choiceMap));

    const resolved: CalmChoice[] = [];
    for (const [optionId, value] of Object.entries(choiceMap)) {
        const option = patternOptions.find(opt => opt.optionId === optionId);
        if (!option) {
            throw new Error(`The option id [${optionId}] is not a valid option in the pattern.`);
        }
        if (Array.isArray(value) && option.optionType === 'oneOf') {
            throw new Error(`The option [${optionId}] is a oneOf option and only accepts a single choice, not an array.`);
        }
        const descriptions = Array.isArray(value) ? value : [value];
        for (const description of descriptions) {
            const found = option.choices.find(choice => choice.description === description);
            if (!found) {
                throw new Error(`The choice of [${description}] is not a valid choice for option [${optionId}].`);
            }
            resolved.push(found);
        }
    }

    return resolved;
}

export async function promptUserForOptions(pattern: object, debug: boolean = false): Promise<CalmChoice[]> {
    const logger = initLogger(debug, 'calm-generate-options');

    const patternOptions: CalmOption[] = extractOptions(pattern);
    logger.debug('Pattern options extracted from pattern: ' + JSON.stringify(patternOptions));

    const compactChoices: Record<string, string | string[]> = {};
    const allChosenChoices: CalmChoice[] = [];

    for (const option of patternOptions) {
        const choiceDescriptions = option.choices.map(c => c.description);

        if (option.optionType === 'oneOf') {
            const answer = await select<string>({ message: option.prompt, choices: choiceDescriptions });
            compactChoices[option.optionId] = answer;
            const found = option.choices.find(c => c.description === answer);
            if (!found) {
                throw new Error(`The choice of [${answer}] is not a valid choice in the pattern.`);
            }
            allChosenChoices.push(found);
        } else {
            const answers = await checkbox<string>({ message: option.prompt, choices: choiceDescriptions });
            compactChoices[option.optionId] = answers;
            for (const answer of answers) {
                const found = option.choices.find(c => c.description === answer);
                if (!found) {
                    throw new Error(`The choice of [${answer}] is not a valid choice in the pattern.`);
                }
                allChosenChoices.push(found);
            }
        }
    }

    logger.info('Selected choices (reusable with --option-choices): ' + JSON.stringify(compactChoices));
    return allChosenChoices;
}
