import express, { Application } from 'express';
import { ServerRoutes } from './routes/routes';
import { initLogger, SchemaDirectory } from '@finos/calm-shared';
import { Server } from 'http';

export function startServer(
    port: string,
    host: string,
    schemaDirectory: SchemaDirectory,
    verbose: boolean,
    rateLimitWindowMs: number = 900000, // 15 minutes
    rateLimitMaxRequests: number = 100
): Server {
    const app: Application = express();
    const serverRoutesInstance = new ServerRoutes(
        schemaDirectory,
        verbose,
        rateLimitWindowMs,
        rateLimitMaxRequests
    );
    const allRoutes = serverRoutesInstance.router;

    app.use(express.json());
    app.use('/', allRoutes);

    return app.listen(parseInt(port), host, () => {
        const logger = initLogger(verbose, 'calm-server');
        logger.info(`CALM Server is running on http://${host}:${port}`);
    });
}
