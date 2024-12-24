import CalmModelGenerator from './calm-model-generator';
const inputDirectory = process.argv[2] || '../calm/draft/2024-12/meta';
const outputDirectory = process.argv[3] || 'build/calm/2024-12';

const generator = new CalmModelGenerator();
generator.execute(inputDirectory, outputDirectory);