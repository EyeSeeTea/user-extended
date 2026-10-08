import { Future, FutureData } from "../../domain/entities/Future";

export class InmemoryCache {
    private cache: Record<string, unknown> = {};

    getOrFuture<T>(cacheKey: string, future: FutureData<T>): FutureData<T> {
        if (this.cache[cacheKey] !== undefined) {
            return Future.success(this.cache[cacheKey] as T);
        }

        return future.map(response => {
            this.cache[cacheKey] = response;
            return response;
        });
    }

    set<T>(cacheKey: string, value: T): void {
        this.cache[cacheKey] = value;
    }
}
