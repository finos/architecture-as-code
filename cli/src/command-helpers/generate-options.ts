import { CalmChoice, CalmOption, extractOptions } from '@finos/calm-shared/dist/commands/generate/components/options';
import { initLogger } from '@finos/calm-shared';
import { select, checkbox } from '@inquirer/prompts';

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

export async function promptUserForOptions(pattern: object, debug: boolean = false): Promise<CalmChoice[]> {
    const logger = initLogger(debug, 'calm-generate-options');

    const patternOptions: CalmOption[] = extractOptions(pattern);
    logger.debug('Pattern options extracted from pattern: ' + patternOptions);

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