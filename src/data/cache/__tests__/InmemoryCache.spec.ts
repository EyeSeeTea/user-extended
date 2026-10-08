import { Future } from "../../../domain/entities/Future";
import { InmemoryCache } from "../InmemoryCache";

const KEY = "settings";

describe("InmemoryCache", () => {
    it("returns the value from the source when the key is not cached", async () => {
        const cache = new InmemoryCache();

        const result = await cache.getOrFuture(KEY, Future.success(4)).runAsync();

        expect(result.data).toBe(4);
    });

    it("returns the cached value without running the source again", async () => {
        const cache = new InmemoryCache();
        const source = givenACountingSource([4, 5]);

        await cache.getOrFuture(KEY, source.future).runAsync();
        const result = await cache.getOrFuture(KEY, source.future).runAsync();

        expect(result.data).toBe(4);
        expect(source.runs()).toBe(1);
    });

    it("keeps a cached falsy value instead of asking the source again", async () => {
        const cache = new InmemoryCache();
        const source = givenACountingSource([false, true]);

        await cache.getOrFuture(KEY, source.future).runAsync();
        const result = await cache.getOrFuture(KEY, source.future).runAsync();

        expect(result.data).toBe(false);
        expect(source.runs()).toBe(1);
    });

    it("does not remember a failed read, so the next read asks the source again", async () => {
        const cache = new InmemoryCache();

        const failed = await cache.getOrFuture(KEY, Future.error<string, number>("server error")).runAsync();
        const retried = await cache.getOrFuture(KEY, Future.success(4)).runAsync();

        expect(failed.error).toBe("server error");
        expect(retried.data).toBe(4);
    });
});

function givenACountingSource<T>(values: T[]) {
    let runs = 0;
    const future = Future.fromComputation<string, T>(resolve => {
        const value = values[runs] as T;
        runs += 1;
        resolve(value);
        return Future.noCancel;
    });

    return { future, runs: () => runs };
}
