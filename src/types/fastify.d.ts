import 'fastify';
import { CompareService } from '../application/compare/compare.service';
import { SearchService } from '../application/search/search.service';

declare module 'fastify' {
    interface FastifyInstance {
        services: {
            compare: CompareService;
            search: SearchService;
        };
    }
}
