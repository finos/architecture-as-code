import path from 'path';
import { writeFile } from 'fs/promises';

/**
 * Create a new CALM document in the current working directory and return its file path.
 * The document is a minimal stub containing just a `$id` and initial version,
 * ready to be expanded from a template in a later step.
 *
 * @param namespace The namespace for the document (e.g. "com.example")
 * @param name The name of the document (e.g. "my-service")
 * @param type The CALM document type (e.g. "architecture", "pattern")
 * @returns The absolute path to the newly created file
 */
export async function createNewDocument(namespace: string, name: string, type: string): Promise<string> {
    const id = `${namespace}-${type}-${name}`;
    const document = {
        '$id': id,
        'version': '1.0.0'
    };
    const filename = `${id}.json`;
    const filePath = path.join(process.cwd(), filename);
    await writeFile(filePath, JSON.stringify(document, null, 2), 'utf8');
    return filePath;
}
