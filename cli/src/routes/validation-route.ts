import { getFormattedOutput, validate, SchemaDirectory, CALM_META_SCHEMA_DIRECTORY } from '@finos/calm-shared';
import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { log } from 'console';

export class ValidationRouter {

    private schemaDirectoryPath: string;
    private schemaDirectory: SchemaDirectory;

    constructor(router: Router, schemaDirectoryPath: string) {
        this.schemaDirectory = new SchemaDirectory(true)
        this.schemaDirectoryPath = schemaDirectoryPath
        this.initializeRoutes(router);
    }

    private initializeRoutes(router: Router) {
        router.post('/', this.validateSchema);
        router.get('/health', this.healthCheck);
    }

    private validateSchema = async (req: Request, res: Response) => {
        const schema = req.body['$schema'];
        if (!schema) {
            return res.status(400).json({ error: 'The "$schema" field is missing from the request body.' });
        }
        console.info("Path loading schemas is " + this.schemaDirectoryPath)

        await this.schemaDirectory.loadSchemas(this.schemaDirectoryPath)
        console.info("Loaded schemas: " + this.schemaDirectory.getLoadedSchemas())
        const foundSchema = this.schemaDirectory.getSchema(schema)
        if (foundSchema == undefined) {
            return res.status(400).json({ error: 'The "$schema" field referenced is not available to the server' });
        }
        const tempInstantiation = await createTemporaryFile()
        const tempPattern = await createTemporaryFile()
        try {

            await fs.writeFile(tempInstantiation, JSON.stringify(req.body, null, 4));
            await fs.writeFile(tempPattern, JSON.stringify(foundSchema, null, 4));

            const outcome = await validate(tempInstantiation, tempPattern, this.schemaDirectoryPath, true);
            const content = getFormattedOutput(outcome, 'json');
            res.status(201).type('json').send(content);
        } catch (error) {
            res.status(500).json({ error: error.message });
        } finally {
            [tempInstantiation, tempPattern].forEach(element => {
                fs.unlink(element).catch(() => { });
                fs.rmdir(element).catch(() => { });
            });
        }
    };

    private healthCheck(_req: Request, res: Response) {
        res.status(200).json({ status: 'OK' });
    }
}



async function createTemporaryFile(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'calm-'));
    const tempFilePath = path.join(tempDir, `calm-instantiation-${uuidv4()}.json`);
    return tempFilePath
}

