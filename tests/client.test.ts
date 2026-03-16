import { describe, expect, test } from "bun:test"
import { EsClient } from "../src/client.ts"

// Test read-only guards without needing a real ES connection.
// The client will fail to connect, but we can test the guard logic
// by catching the connection error vs the guard error.

const client = new EsClient({ host: "https://localhost:19222" })

describe("EsClient read-only guards", () => {
  test("blocks PUT requests", async () => {
    await expect(client.raw("PUT", "/test")).rejects.toThrow("Blocked: PUT requests are not allowed")
  })

  test("blocks DELETE requests", async () => {
    await expect(client.raw("DELETE", "/test")).rejects.toThrow("Blocked: DELETE requests are not allowed")
  })

  test("blocks PATCH requests", async () => {
    await expect(client.raw("PATCH", "/test")).rejects.toThrow("Blocked: PATCH requests are not allowed")
  })

  test("blocks case-insensitive methods", async () => {
    await expect(client.raw("put", "/test")).rejects.toThrow("Blocked: PUT requests are not allowed")
    await expect(client.raw("Delete", "/test")).rejects.toThrow("Blocked: DELETE requests are not allowed")
  })

  test("blocks POST to non-search endpoints", async () => {
    await expect(client.raw("POST", "/my-index/_doc")).rejects.toThrow("Blocked: POST to /my-index/_doc is not a known read-only operation")
  })

  test("blocks POST to _bulk", async () => {
    await expect(client.raw("POST", "/_bulk")).rejects.toThrow("Blocked: POST to /_bulk is not a known read-only operation")
  })

  test("blocks POST to _update", async () => {
    await expect(client.raw("POST", "/my-index/_update/1")).rejects.toThrow("Blocked")
  })

  test("blocks POST to _delete_by_query", async () => {
    await expect(client.raw("POST", "/my-index/_delete_by_query")).rejects.toThrow("Blocked")
  })

  // Query-string suffix bypass: /_bulk?pipeline=my_search should NOT pass
  test("blocks POST with query string that ends in allowed suffix", async () => {
    await expect(client.raw("POST", "/_bulk?pipeline=my_search")).rejects.toThrow("Blocked")
  })

  // Document ID suffix bypass: /_create/doc_search should NOT pass
  test("blocks POST to _create with ID ending in _search", async () => {
    await expect(client.raw("POST", "/my-index/_create/doc_search")).rejects.toThrow("Blocked")
  })

  test("blocks POST to _update with ID ending in _count", async () => {
    await expect(client.raw("POST", "/my-index/_update/doc_count")).rejects.toThrow("Blocked")
  })

  // Mutating GET endpoints
  test("blocks GET to _refresh", async () => {
    await expect(client.raw("GET", "/my-index/_refresh")).rejects.toThrow("Blocked")
  })

  test("blocks GET to _flush", async () => {
    await expect(client.raw("GET", "/my-index/_flush")).rejects.toThrow("Blocked")
  })

  test("blocks GET to _forcemerge", async () => {
    await expect(client.raw("GET", "/my-index/_forcemerge")).rejects.toThrow("Blocked")
  })

  test("blocks GET to _cache/clear", async () => {
    await expect(client.raw("GET", "/my-index/_cache/clear")).rejects.toThrow("Blocked")
  })

  // These should NOT throw a guard error — they'll fail with connection error instead
  test("allows GET requests (fails on connection, not guard)", async () => {
    await expect(client.raw("GET", "/_cluster/health")).rejects.not.toThrow("Blocked")
  })

  test("allows POST to _search (fails on connection, not guard)", async () => {
    await expect(client.raw("POST", "/my-index/_search")).rejects.not.toThrow("Blocked")
  })

  test("allows POST to _count (fails on connection, not guard)", async () => {
    await expect(client.raw("POST", "/my-index/_count")).rejects.not.toThrow("Blocked")
  })

  test("allows POST to _msearch (fails on connection, not guard)", async () => {
    await expect(client.raw("POST", "/_msearch")).rejects.not.toThrow("Blocked")
  })

  test("allows POST to _mget (fails on connection, not guard)", async () => {
    await expect(client.raw("POST", "/_mget")).rejects.not.toThrow("Blocked")
  })

  test("allows POST to _field_caps (fails on connection, not guard)", async () => {
    await expect(client.raw("POST", "/my-index/_field_caps")).rejects.not.toThrow("Blocked")
  })
})
