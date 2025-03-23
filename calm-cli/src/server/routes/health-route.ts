import { Router, Request, Response } from 'express';


export class HealthRouter {

    constructor(router: Router) {
        router.get('/', this.healthCheck);
    }

    private healthCheck(_req: Request, res: Response<StatusResponse>) {
        res.status(200).type('json').send(new StatusResponse('OK'));
    }
    
}

class StatusResponse {
    status: string;

    constructor(status: string) {
        this.status = status;
    }
}