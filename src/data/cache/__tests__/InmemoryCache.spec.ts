import { Future } from "../../../domain/entities/Future";
import { InmemoryCache } from "../InmemoryCache";

const KEY = "settings";

describe("InmemoryCache", () => {
    it("returns the value from the source when the key is not cached", async () => {
        const cache = new InmemoryCache();

        const result = await cache.getOrFuture(KEY, Future.success(4)).runAsync();

        expect(result.data).toBe(4);
    });
});
