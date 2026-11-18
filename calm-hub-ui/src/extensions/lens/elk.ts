import type { ELK, ELKConstructorArguments } from 'elkjs/lib/elk-api.js';

type ElkConstructor = new (args?: ELKConstructorArguments) => ELK;

// elkjs is CJS, so the default export can be nested, as in calm-diagram.
const constructorOf = (module: { default: unknown }): ElkConstructor => {
    const value = module.default as ElkConstructor & { default?: ElkConstructor };
    return value.default ?? value;
};

let shared: Promise<ELK> | undefined;

/**
 * ELK in a web worker, so that a large layout does not block the page. Where there is no Worker, as in tests, ELK
 * runs on the main thread. Each import loads only when a lens opens.
 */
export function sharedElk(): Promise<ELK> {
    shared ??= (typeof Worker === 'undefined'
        ? import('elkjs/lib/elk.bundled.js').then((module) => new (constructorOf(module))())
        : Promise.all([import('elkjs/lib/elk-api.js'), import('elkjs/lib/elk-worker.min.js?url')]).then(
              ([module, { default: workerUrl }]) => new (constructorOf(module))({ workerUrl }),
          )
    ).catch((error) => {
        shared = undefined;
        return Promise.reject(error);
    });
    return shared;
}

/** Stops the worker after a layout that ran too long. The next layout starts a new one. */
export function resetElk() {
    const current = shared;
    shared = undefined;
    void current?.then((elk) => elk.terminateWorker?.()).catch(() => undefined);
}
