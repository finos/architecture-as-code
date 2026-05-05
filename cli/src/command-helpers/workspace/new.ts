import path from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';
import Handlebars from 'handlebars';

const TEMPLATES_DIR = path.resolve(__dirname, 'templates');

/**
 * Returns the list of template names available for a given document type.
 * Template names are the filenames without the `.hbs` extension.
 */
export async function getTemplatesForType(type: string): Promise<string[]> {
    const typeDir = path.join(TEMPLATES_DIR, type);
    try {
        const entries = await readdir(typeDir);
        return entries
            .filter(f => f.endsWith('.hbs'))
            .map(f => f.replace(/\.hbs$/, ''));
    } catch {
        return [];
    }
}

/**
 * Create a new CALM document in the current working directory and return its file path.
 * Renders the given Handlebars template with `id` and `name` variables.
 *
 * @param namespace The namespace for the document (e.g. "com.example")
 * @param name The name of the document (e.g. "my-service")
 * @param type The CALM document type (e.g. "architecture", "pattern")
 * @param templateName The template to use (e.g. "empty", "with-structure"); defaults to "empty"
 * @returns The absolute path to the newly created file
 */
export async function createNewDocument(namespace: string, name: string, type: string, templateName = 'empty'): Promise<string> {
    const id = `${namespace}-${type}-${name}`;
    const templatePath = path.join(TEMPLATES_DIR, type, `${templateName}.hbs`);
    const source = await readFile(templatePath, 'utf8');
    const content = Handlebars.compile(source)({ id, name });
    const filename = `${id}.json`;
    const filePath = path.join(process.cwd(), filename);
    await writeFile(filePath, content, 'utf8');
    return filePath;
}
