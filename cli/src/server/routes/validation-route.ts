import { validate, SchemaDirectory, initLogger } from '@finos/calm-shared';
import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import { ValidationOutcome } from '@finos/calm-shared/commands/validate/validation.output';


export class ValidationRouter {

    private schemaDirectoryPath: string;
    private schemaDirectory: SchemaDirectory;
    private logger: winston.Logger;

    constructor(router: Router, schemaDirectoryPath: string, debug: boolean = false) {
        this.schemaDirectory = new SchemaDirectory(true);
        this.schemaDirectoryPath = schemaDirectoryPath;
        this.logger = initLogger(debug);
        this.initializeRoutes(router);
    }

    private initializeRoutes(router: Router) {
        router.post('/', this.validateSchema);
    }

    private validateSchema = async (req: Request<string>, res: Response<ValidationOutcome | ErrorResponse>) => {
        const schema = req.body['$schema'];
        if (!schema) {
            return res.status(400).type('json').send(new ErrorResponse('The "$schema" field is missing from the request body'));
        }
        console.info('Path loading schemas is ' + this.schemaDirectoryPath);

        await this.schemaDirectory.loadSchemas(this.schemaDirectoryPath);
        console.info('Loaded schemas: ' + this.schemaDirectory.getLoadedSchemas());
        const foundSchema = this.schemaDirectory.getSchema(schema);
        if (!foundSchema) {
            // return res.status(400).json({ error: 'The "$schema" field referenced is not available to the server' });
            return res.status(400).type('json').send(new ErrorResponse('The "$schema" field referenced is not available to the server'));
        }
        const tempInstantiation = await createTemporaryFile();
        const tempPattern = await createTemporaryFile();
        try {

            await fs.writeFile(tempInstantiation, JSON.stringify(req.body, null, 4), { mode: 0o600 });
            await fs.writeFile(tempPattern, JSON.stringify(foundSchema, null, 4), { mode: 0o600 });

            const outcome = await validate(tempInstantiation, tempPattern, this.schemaDirectoryPath, true);
            return res.status(201).type('json').send(outcome);
        } catch (error) {
            return res.status(500).type('json').send(new ErrorResponse(error.message));
        } finally {
            [tempInstantiation, tempPattern].forEach(element => {
                fs.unlink(element).catch(() => {
                    this.logger.warn('Failed to delete temporary file ' + element);
                });
            });
        }
    };
}

async function createTemporaryFile(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'calm-'));
    const tempFilePath = path.join(tempDir, `calm-instantiation-${uuidv4()}.json`);
    return tempFilePath;
}


class ErrorResponse {
    error: string;
    constructor(error: string) {
        this.error = error;
    }
};
