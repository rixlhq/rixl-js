// The README's auth path: without apiKey/token, connect() must not install the
// bearer interceptor, which would reject requests that carry no token.
import {describe, it, expect} from "vite-plus/test";
import {client} from "../generated/client.gen";
import {connect} from "../connect";

describe("connect({baseUrl}) with an X-API-Key header", () => {
  it("sends the raw key on a protected route without requiring a bearer token", async () => {
    let sent: Request | undefined;
    await connect({baseUrl: "https://api.example.com"});
    client.setConfig({
      headers: {"X-API-Key": "rxl_test-key"},
      fetch: async (request: Request) => {
        sent = request;
        return new Response(JSON.stringify({videos: [], total: "0"}), {headers: {"Content-Type": "application/json"}});
      },
    });

    const {error} = await client.get({url: "/media/v1/projects/p1/videos"});

    expect(error).toBeUndefined();
    expect(sent?.url).toBe("https://api.example.com/media/v1/projects/p1/videos");
    expect(sent?.headers.get("X-API-Key")).toBe("rxl_test-key");
    expect(sent?.headers.has("Authorization")).toBe(false);
  });
});
