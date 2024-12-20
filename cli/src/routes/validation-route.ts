// import { CALM_META_SCHEMA_DIRECTORY, getFormattedOutput, validate } from '@finos/calm-shared';
import { Router } from 'express';

export const validationRouter: Router = Router();


validationRouter.get('/example', (req, res) => {
    // const { patternFile, instantiationFile, verbose } = req.body;
    // console.error('req.body', req.body);
    // const outcome = await validate(patternFile, instantiationFile, CALM_META_SCHEMA_DIRECTORY, verbose);
    // const content = getFormattedOutput(outcome, 'json');
    // res.status(200).json({requestBody: req.body}});
    console.log(req.body);
    res.status(200).json({ requestBody: req.body });
});

validationRouter.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK' });
});