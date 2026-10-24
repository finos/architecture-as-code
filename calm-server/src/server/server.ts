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

    // Express 5 passes listen errors, such as EADDRINUSE, to this callback instead of emitting them.
    return app.listen(parseInt(port), host, (error?: Error) => {
        const logger = initLogger(verbose, 'calm-server');
        if (error) {
            logger.error(`CALM Server failed to start on http://${host}:${port}: ${error.message}`);
            process.exit(1);
            return;
        }
        logger.info(`CALM Server is running on http://${host}:${port}`);
    });
}
