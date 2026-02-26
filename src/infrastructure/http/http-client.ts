import axios, { type AxiosResponse } from 'axios';

export class HttpClient {
    async get<T>(url: string): Promise<T> {
        const response: AxiosResponse<T, any, {}> = await axios.get<T>(url, {
            timeout: 15000,
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        });
        return response.data;
    }
}
