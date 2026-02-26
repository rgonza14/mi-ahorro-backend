import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

const schemasPlugin: FastifyPluginAsync = async fastify => {
    fastify.addSchema({
        $id: 'Product',
        type: 'object',
        properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            listPrice: { type: 'number' },
            link: { type: 'string' },
            image: { type: 'string' },
            retailer: { type: 'string' }
        }
    });
};

export default fp(schemasPlugin);
