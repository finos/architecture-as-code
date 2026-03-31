import { CalmChoice, CalmOption, extractOptions, initLogger } from '@finos/calm-shared';
import { select, checkbox } from '@inquirer/prompts';
import { readFileSync, existsSync } from 'fs';

type InquirerQuestion = {
    type: 'list' | 'checkbox',
    name: string,
    message: string,
    choices: string[]
}

function createQuestionsFromPatternOptions(patternOptions: CalmOption[]): InquirerQuestion[] {
    const questions: InquirerQuestion[] = [];

    for (const option of patternOptions) {
        const choiceDescriptions = option.choices.map(choice => choice.description);
        questions.push(
            {
                type: option.optionType === 'oneOf' ? 'list' : 'checkbox',
                name: `${patternOptions.indexOf(option)}`,
                message: option.prompt,
                choices: choiceDescriptions
            }
        );
    }

    return questions;
}

async function getAnswersFromUser(questions: InquirerQuestion[]): Promise<string[]> {
    const answers = [];
    for (const question of questions) {
        if (question.type === 'list') {
            const answer = await select<string>({
                message: question.message,
                choices: question.choices
            });
            answers.push(answer);
        } else if (question.type === 'checkbox') {
            const answer = await checkbox<string>({
                message: question.message,
                choices: question.choices,
            });
            answers.push(...answer);
        }
    }
    return answers;
}

/**
 * Loads pre-defined option choices from a file path or inline JSON string.
 * The input should be a JSON object mapping option unique-ids to choice descriptions,
 * e.g. {"connection-options": "Application A connects to C"}
 */
export function loadChoicesFromInput(optionChoicesInput: string, pattern: object, debug: boolean = false): CalmChoice[] {
    const logger = initLogger(debug, 'calm-generate-options');

    let choiceMap: Record<string, string>;
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
    for (const [optionId, choiceDescription] of Object.entries(choiceMap)) {
        const option = patternOptions.find(opt => opt.optionId === optionId);
        if (!option) {
            throw new Error(`The option id [${optionId}] is not a valid option in the pattern.`);
        }
        const found = option.choices.find(choice => choice.description === choiceDescription);
        if (!found) {
            throw new Error(`The choice of [${choiceDescription}] is not a valid choice for option [${optionId}].`);
        }
        resolved.push(found);
    }

    return resolved;
}

export async function promptUserForOptions(pattern: object, debug: boolean = false): Promise<CalmChoice[]> {
    const logger = initLogger(debug, 'calm-generate-options');

    const patternOptions: CalmOption[] = extractOptions(pattern);
    logger.debug('Pattern options extracted from pattern: ' + JSON.stringify(patternOptions));

    const questions = createQuestionsFromPatternOptions(patternOptions);
    const answers: string[] = await getAnswersFromUser(questions);

    const allChoices: CalmChoice[] = patternOptions.flatMap(option => option.choices);

    // this shouldn't happen, but in case something goes wrong and the user is able to select an invalid option, we throw an error
    answers.forEach(answer => {
        const found = allChoices.find(choice => choice.description === answer);
        if (!found) {
            throw new Error(`The choice of [${answer}] is not a valid choice in the pattern.`);
        }
    });

    const allChosenChoices: CalmChoice[] = allChoices.filter(choice => answers.find(answer => answer === choice.description));
    return allChosenChoices;
}