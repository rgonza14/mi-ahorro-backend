import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyPluginAsync } from 'fastify';

const swaggerPlugin: FastifyPluginAsync = async app => {
    // @ts-ignore
    await app.register(swagger, {
        openapi: {
            openapi: '3.0.0',
            info: {
                title: 'PreciAR API',
                description: 'Comparador de precios',
                version: '1.0.0'
            },
            servers: [{ url: 'http://localhost:3000' }]
        },
        refResolver: {
            buildLocalReference(json, baseUri, fragment, i) {
                return json.$id || `my-fragment-${i}`;
            }
        }
    });

    await app.register(swaggerUi, {
        routePrefix: '/docs'
    });

    app.get('/openapi.json', async () => app.swagger());
};

export default fp(swaggerPlugin);
