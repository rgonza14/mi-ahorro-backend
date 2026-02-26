import Fastify from 'fastify';
import app from './app.js';

const fastify = Fastify({ logger: true });

async function start() {
    await fastify.register(app);

    fastify.get('/test', async () => ({ ok: true }));

    const port = Number(process.env.PORT || 3000);

    await fastify.listen({ port, host: '0.0.0.0' });

    fastify.log.info(`server listening on 0.0.0.0:${port}`);
}

start().catch(err => {
    fastify.log.error(err);
    process.exit(1);
});
