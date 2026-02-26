import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { CompareService, SearchService } from '../application';
import { ProductMatchingService, Retailer, RetailerPort } from '../domain';
import {
    CachedRetailerAdapter,
    CarrefourAdapter,
    DiaAdapter,
    HttpClient,
    JumboAdapter,
    LimitedRetailerAdapter,
    VeaAdapter,
    VtexGraphqlClient
} from '../infrastructure';

const servicesPlugin: FastifyPluginAsync = async fastify => {
    const http = new HttpClient();
    const gql = new VtexGraphqlClient(http);

    const rawRetailers: RetailerPort[] = [
        new CarrefourAdapter(gql),
        new DiaAdapter(http),
        new JumboAdapter(http),
        new VeaAdapter(gql)
    ];

    const concurrencyByRetailer: Partial<Record<Retailer, number>> = {
        dia: 1,
        carrefour: 2,
        jumbo: 2,
        vea: 2
    };
    const retailers: RetailerPort[] = rawRetailers.map(r => {
        const concurrency = concurrencyByRetailer[r.retailer] ?? 1;

        const limited = new LimitedRetailerAdapter(r, concurrency);

        return new CachedRetailerAdapter(limited, {
            ttlMs: 10 * 60 * 1000, // 10min cache positiva
            maxEntries: 2000,
            negativeTtlMs: 90 * 1000 // 90s cache negativa
        });
    });
    const matcher = new ProductMatchingService();
    const search = new SearchService(retailers, matcher);
    const compare = new CompareService(search);
    fastify.decorate('services', {
        compare,
        search
    });
};

export default fp(servicesPlugin, { name: 'services' });
