import Fastify from 'fastify';
import app from './app';

const port = Number(process.env.PORT || 3000);

const fastify = Fastify({
    logger: true
});

const start = async () => {
    try {
        await fastify.register(app);
        fastify.listen({ port, host: '0.0.0.0' }, function (err, address) {
            if (err) {
                fastify.log.error(err);
                process.exit(1);
            }
            fastify.log.info(`server listening on ${address}`);
        });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
