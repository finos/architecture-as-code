import { CalmChoice, CalmOption, extractOptions as extractOptions } from '@finos/calm-shared/commands/generate/components/options';
import logger from 'winston';
import inquirer from 'inquirer';

logger.configure({
    transports: [
        new logger.transports.Console({
            //This seems odd, but we want to allow users to parse JSON output from the STDOUT. We can't do that if it's polluted.
            stderrLevels: ['error', 'warn', 'info'],
        })
    ],
    level: 'debug',
    format: logger.format.combine(
        logger.format.label({ label: 'calm' }),
        logger.format.cli(),
        logger.format.splat(),
        logger.format.errors({ stack: true }),
        logger.format.printf(({ level, message, stack, label }) => {
            if (stack) {
                return `${level} [${label}]: ${message} - ${stack}`;
            }
            return `${level} [${label}]: ${message}`;
        }, ),
    ),
    
});

export async function promptUserForOptions(pattern: object): Promise<CalmChoice[]> {
    const patternOptions: CalmOption[] = extractOptions(pattern);
    logger.debug('Pattern options found: [%O]', patternOptions);
            
    const questions = [];
    
    for(const option of patternOptions) {
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
    const answers: string[] = await inquirer.prompt(questions)
        .then(answers => Object.values(answers).flatMap(val => val));
    logger.debug('User choice these options: [%O]', answers);
    
    const chosenChoices: CalmChoice[] = patternOptions.flatMap(option =>
        option.choices.filter(choice => answers.find(answer => answer === choice.description))
    );

    return chosenChoices;
}