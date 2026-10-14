import { Future, FutureData } from "../../domain/entities/Future";

export class InmemoryCache<T> {
    private cache: Readonly<Record<string, T>> = {};

    getOrFuture(cacheKey: string, future: FutureData<T>): FutureData<T> {
        const cached = this.cache[cacheKey];
        if (cached !== undefined) {
            return Future.success(cached);
        }

        return future.map(response => {
            this.set(cacheKey, response);
            return response;
        });
    }

    set(cacheKey: string, value: T): void {
        this.cache = { ...this.cache, [cacheKey]: value };
    }
}
