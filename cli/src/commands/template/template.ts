import Handlebars from "handlebars";
import { promises as fs } from 'node:fs';
import { buildParameters, parseCalmDoc } from "./parse-calm.js";
import path from "node:path";


async function loadCalm(filename: string, debug: boolean) {
    if (debug)
        console.log("loading calm file from " + filename)
    
    const data = await fs.readFile(filename, { encoding: 'utf-8' });
    return JSON.parse(data);
}

async function loadTemplatesInDirectory(directory: string): Promise<{ [filename: string]: HandlebarsTemplateDelegate<any> }> {
    const files = await fs.readdir(directory);
    const loadedFiles: { [filename: string]: HandlebarsTemplateDelegate<any> } = {};

    for (const file of files) {
        const filePath = path.join(directory, file);
        const fileContent = await fs.readFile(filePath, { encoding: 'utf-8' });
        loadedFiles[file] = Handlebars.compile(fileContent);
    }

    return loadedFiles;
}

function initHandlebars() {
    Handlebars.registerHelper('helperMissing', (...args) => {
        var options = args[args.length-1];
        var sliced = Array.prototype.slice.call(args, 0, args.length-1)
        throw new Error("Missing element " + options.name)
    })
}

export default async function(filename: string, templatesPath: string, debug: boolean, output: string) {
    if (debug)
        console.log("generating from " + filename);

    initHandlebars();

    const calm = await loadCalm(filename, debug);
    if (debug) {
        console.log("Loaded CALM: ", calm);
    }

    const calmProperties = parseCalmDoc(calm);

    const parameters = buildParameters(calmProperties);

    const templates = await loadTemplatesInDirectory(templatesPath);

    if (debug) console.log(templates);

    const outputValues = new Map<string, string>();

    for (const templateName in templates) {
        const template = templates[templateName];
        outputValues.set(templateName, template(parameters));
    }

    if (!output) {
        const outputString = zipYamlDocs(Array.from(outputValues.values()));
        console.log(outputString);
    }
    else {
        await writeFiles(output, outputValues);
    }
}

async function writeFiles(outputDirectory: string, outputFiles: Map<string, string>) {
    console.log(`Writing files to directory '${outputDirectory}'`)
    await fs.mkdir(outputDirectory, { recursive: true });
    for (const [template, output] of outputFiles) {
        const outputPath = path.join(outputDirectory, template)
        await fs.writeFile(outputPath, output, { encoding: 'utf-8' });
        if (template.endsWith('.sh')) {
            await fs.chmod(outputPath, '755')
        }
    }
}

function zipYamlDocs(docs: string[]): string {
    return "---\n" + docs.join("\n---\n");
}