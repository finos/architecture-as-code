import { Router, Request, Response } from 'express';


export class HealthRouter {

    constructor(router: Router) {
        router.get('/', this.healthCheck);
    }

    private healthCheck(_req: Request, res: Response) {
        res.status(200).type('json').send({ status: 'OK' });
    }
    

}