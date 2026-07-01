import path from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
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
 * Renders the given Handlebars template with `id` (the document `$id`) and `name` variables.
 *
 * @param documentId The CalmHub `$id` for the document
 * @param name The human-readable title of the document
 * @param type The CALM document type (e.g. "architecture", "pattern")
 * @param slug A short, filename-safe slug for the document (e.g. the mapping id)
 * @param templateName The template to use (e.g. "empty", "with-structure"); defaults to "empty"
 * @returns The absolute path to the newly created file
 */
export async function createNewDocument(documentId: string, name: string, type: string, slug: string, templateName = 'empty'): Promise<string> {
    if (/[/\\]|\.\./.test(slug)) {
        throw new Error(`Invalid slug '${slug}': must not contain path separators or '..'.`);
    }

    const templatePath = path.join(TEMPLATES_DIR, type, `${templateName}.hbs`);
    const source = await readFile(templatePath, 'utf8');
    const content = Handlebars.compile(source)({ id: documentId, name });
    const filename = `${slug}.${type}.json`;
    const filePath = path.join(process.cwd(), filename);

    if (existsSync(filePath)) {
        throw new Error(`File already exists: ${filePath}. Choose a different slug or remove the existing file first.`);
    }

    await writeFile(filePath, content, 'utf8');
    return filePath;
}
