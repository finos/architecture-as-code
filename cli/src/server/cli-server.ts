


import express, { Application } from 'express';
import { CLIServerRoutes } from './routes/routes';

export function startServer(options: { port: string, schemaDirectory: string, verbose: boolean }) {
    const app: Application = express();
    const cliServerRoutesInstance = new CLIServerRoutes(options.schemaDirectory, options.verbose);
    const allRoutes = cliServerRoutesInstance.router;

    app.use(express.json());
    app.use('/', allRoutes);

    const port = options.port;

    app.listen(port, () => {
        console.log(`CALM Server is running on http://localhost:${port}`);
    });
}