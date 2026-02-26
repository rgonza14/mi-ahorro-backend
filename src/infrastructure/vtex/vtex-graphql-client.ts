import type { VtexGraphqlResponse } from './vtex.types.js';
import { HttpClient } from '../http/http-client.js';

export class VtexGraphqlClient {
    constructor(private readonly http: HttpClient) {}
    get(url: string): Promise<VtexGraphqlResponse> {
        return this.http.get<VtexGraphqlResponse>(url);
    }
}
