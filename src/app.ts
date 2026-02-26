import 'module-alias/register';
import { join } from 'node:path';
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload';
import { FastifyPluginAsync, FastifyServerOptions } from 'fastify';
import servicesPlugin from './plugins/services.js';
import productSchemaPlugin from './plugins/product.schema.js';
import cors from '@fastify/cors';

export interface AppOptions
    extends FastifyServerOptions, Partial<AutoloadPluginOptions> {}

const options: AppOptions = {};

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts) => {
    await fastify.register(import('@fastify/rate-limit'), {
        max: 100,
        timeWindow: '1 minute'
    });

    await fastify.register(cors, { origin: true });

    await fastify.register(servicesPlugin);
    await fastify.register(productSchemaPlugin);

    await fastify.register(AutoLoad, {
        dir: join(__dirname, 'plugins'),
        options: opts,
        ignorePattern: /(services|product\.schema)\.(ts|js)$/i
    });

    await fastify.register(AutoLoad, {
        dir: join(__dirname, 'routes'),
        options: opts,
        ignorePattern: /(^|\/)(schemas|_schemas)\//
    });
};

export default app;
export { app, options };
