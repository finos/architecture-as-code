import express, { Application } from 'express';
import { CLIServerRoutes } from './routes/routes';
import { initLogger, SchemaDirectory } from '@finos/calm-shared';
import { Server } from 'http';

export function startServer(port: string, schemaDirectory: SchemaDirectory, verbose: boolean): Server {
    const app: Application = express();
    const cliServerRoutesInstance = new CLIServerRoutes(schemaDirectory, verbose);
    const allRoutes = cliServerRoutesInstance.router;

    app.use(express.json());
    app.use('/', allRoutes);

    return app.listen(port, () => {
        const logger = initLogger(verbose, 'calm-server');
        logger.info(`CALM Server is running on http://localhost:${port}`);
    });
}