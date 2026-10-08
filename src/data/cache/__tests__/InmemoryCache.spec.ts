import { Future } from "../../../domain/entities/Future";
import { InmemoryCache } from "../InmemoryCache";

const KEY = "settings";

describe("InmemoryCache", () => {
    it("returns the value from the source when the key is not cached", async () => {
        const cache = new InmemoryCache<number>();

        const result = await cache.getOrFuture(KEY, Future.success(4)).runAsync();

        expect(result.data).toBe(4);
    });

    it("returns the cached value without running the source again", async () => {
        const cache = new InmemoryCache<number>();
        const source = givenACountingSource(4, 5);

        await cache.getOrFuture(KEY, source.future).runAsync();
        const result = await cache.getOrFuture(KEY, source.future).runAsync();

        expect(result.data).toBe(4);
        expect(source.runs()).toBe(1);
    });

    it("keeps a cached falsy value instead of asking the source again", async () => {
        const cache = new InmemoryCache<boolean>();
        const source = givenACountingSource(false, true);

        await cache.getOrFuture(KEY, source.future).runAsync();
        const result = await cache.getOrFuture(KEY, source.future).runAsync();

        expect(result.data).toBe(false);
        expect(source.runs()).toBe(1);
    });

    it("does not remember a failed read, so the next read asks the source again", async () => {
        const cache = new InmemoryCache<number>();

        const failed = await cache.getOrFuture(KEY, Future.error<string, number>("server error")).runAsync();
        const retried = await cache.getOrFuture(KEY, Future.success(4)).runAsync();

        expect(failed.error).toBe("server error");
        expect(retried.data).toBe(4);
    });

    it("serves a value set by the caller without running the source", async () => {
        const cache = new InmemoryCache<number>();
        const source = givenACountingSource(4, 5);

        cache.set(KEY, 7);
        const result = await cache.getOrFuture(KEY, source.future).runAsync();

        expect(result.data).toBe(7);
        expect(source.runs()).toBe(0);
    });
});

function givenACountingSource<T>(first: T, later: T) {
    let runs = 0;
    const future = Future.fromComputation<string, T>(resolve => {
        const value = runs === 0 ? first : later;
        runs += 1;
        resolve(value);
        return Future.noCancel;
    });

    return { future, runs: () => runs };
}
