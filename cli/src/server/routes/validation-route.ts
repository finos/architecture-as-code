import {SchemaDirectory,  initLogger, validate} from '@finos/calm-shared';
import { Router, Request, Response } from 'express';
import winston from 'winston';
import { ValidationOutcome } from '@finos/calm-shared';
import rateLimit from 'express-rate-limit';

export class ValidationRouter {

    private schemaDirectoryPath: string;
    private schemaDirectory: SchemaDirectory;
    private logger: winston.Logger;

    constructor(router: Router, schemaDirectoryPath: string, schemaDirectory: SchemaDirectory, debug: boolean = false) {
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
        });
        this.schemaDirectory = schemaDirectory;
        this.schemaDirectoryPath = schemaDirectoryPath;
        this.logger = initLogger(debug, 'calm-server');
        router.use(limiter);
        this.initializeRoutes(router);
    }

    private initializeRoutes(router: Router) {
        router.post('/', this.validateSchema);
    }

    private validateSchema = async (req: Request<ValidationRequest>, res: Response<ValidationOutcome | ErrorResponse>) => {
        let architecture;
        try {
            architecture = JSON.parse(req.body.architecture);
        } catch (error) {
            this.logger.error('Invalid JSON format for architecture ' + error);
            return res.status(400).type('json').send(new ErrorResponse('Invalid JSON format for architecture'));
        }
        
        const schema = architecture['$schema'];
        if (!schema) {
            return res.status(400).type('json').send(new ErrorResponse('The "$schema" field is missing from the request body'));
        }
        
        try {
            await this.schemaDirectory.loadSchemas();
        } catch (error) {
            this.logger.error('Failed to load schemas: ' + error);
            return res.status(500).type('json').send(new ErrorResponse('Failed to load schemas'));
        }
        let foundSchema;
        try {
            foundSchema = await this.schemaDirectory.getSchema(schema);
            if (!foundSchema) {
                this.logger.error('Schema with $id ' + schema + ' not found');
                return res.status(400).type('json').send(new ErrorResponse('The "$schema" field referenced is not available to the server'));
            }
        } catch(err) {
            this.logger.error('Failed to load schema: ' + err);
            return res.status(500).type('json').send(new ErrorResponse('Failed to load schema: ' + err));
        }
        // const tempInstantiation = await createTemporaryFile();
        // const tempPattern = await createTemporaryFile();
        try {

            // await fs.writeFile(tempInstantiation, JSON.stringify(architecture, null, 4), { mode: 0o600 });
            // await fs.writeFile(tempPattern, JSON.stringify(foundSchema, null, 4), { mode: 0o600 });
            const outcome = await validate(architecture, foundSchema, this.schemaDirectoryPath, true);
            return res.status(201).type('json').send(outcome);
        } catch (error) {
            return res.status(500).type('json').send(new ErrorResponse(error.message));
        } finally {
            // [tempInstantiation, tempPattern].forEach(element => {
            //     fs.unlink(element).catch((reason) => {
            //         this.logger.warn('Failed to delete temporary file ' + element + ' with error: ' + reason);
            //     });
            // });
        }
    };
}

// async function createTemporaryFile(): Promise<string> {
//     const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'calm-'));
//     const tempFilePath = path.join(tempDir, `calm-instantiation-${uuidv4()}.json`);
//     return tempFilePath;
// }


class ErrorResponse {
    error: string;
    constructor(error: string) {
        this.error = error;
    }
};

class ValidationRequest {
    architecture: string;
}
