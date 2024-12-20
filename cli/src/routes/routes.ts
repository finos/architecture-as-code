import express from 'express';

import { validationRouter } from './validation-route';

import { Router } from 'express';

export const allRoutes: Router = express.Router();

allRoutes.use('/api/validate', validationRouter);