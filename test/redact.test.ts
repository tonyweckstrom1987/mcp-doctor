import { describe, expect, it } from "vitest";
import { redactArgs } from "../src/redact.js";

describe("redactArgs: salaisuudet peitetään tulostettavasta komennosta", () => {
  it.each([
    [["node", "s.js", "--token", "abc123"], "node s.js --token ***"],
    [["node", "s.js", "--api-key=abc123"], "node s.js --api-key=***"],
    [["node", "s.js", "--apiKey", "abc123"], "node s.js --apiKey ***"],
    [["node", "s.js", "--password", "p4ss", "--port", "3000"], "node s.js --password *** --port 3000"],
    [["node", "s.js", "--client_secret=x"], "node s.js --client_secret=***"],
    [["env", "GITHUB_TOKEN=ghp_abc", "node", "s.js"], "env GITHUB_TOKEN=*** node s.js"],
    [["node", "s.js", "https://user:pw@api.example.com/v1?key=abc"], "node s.js https://***@api.example.com/v1?***"],
    [["node", "s.js", "--db", "postgres://u:p@db:5432/x"], "node s.js --db postgres://***@db:5432/x"],
    [["node", "s.js", "--db=postgres://u:p@db:5432/x"], "node s.js --db=postgres://***@db:5432/x"],
    [["env", "DATABASE_URL=postgres://u:p@db/x", "node", "s.js"], "env DATABASE_URL=postgres://***@db/x node s.js"],
    [["npx", "mcp-remote", "https://h.example/mcp", "--header", "Authorization: Bearer abc123"], "npx mcp-remote https://h.example/mcp --header Authorization: ***"],
    [["npx", "mcp-remote", "https://h.example/mcp", "--header", "Authorization:Bearer abc123"], "npx mcp-remote https://h.example/mcp --header Authorization:***"],
    [["npx", "mcp-remote", "https://h.example/mcp", "--header=X-Api-Key: abc123"], "npx mcp-remote https://h.example/mcp --header=X-Api-Key: ***"],
    [["node", "s.js", "-H", "Cookie: session=abc123"], "node s.js -H Cookie: ***"],
    [["node", "s.js", "--auth-header-value", "Bearer abc123"], "node s.js --auth-header-value ***"],
    [["node", "s.js", "--value", "Bearer abc123"], "node s.js --value Bearer ***"],
    [["node", "s.js", "--header", "X_API_KEY: abc123"], "node s.js --header X_API_KEY: ***"],
    [["node", "s.js", "--callback=https://h.example/cb#access_token=abc123"], "node s.js --callback=https://h.example/cb#***"],
  ])("%j", (argv, expected) => {
    const joined = redactArgs(argv).join(" ");
    expect(joined).toBe(expected);
    for (const secret of ["abc123", "p4ss", "ghp_abc", "user:pw", "key=abc", "u:p@"]) expect(joined).not.toContain(secret);
  });

  it.each([
    [["node", "server.js"]],
    [["npx", "-y", "@scope/server-memory"]],
    [["node", "s.js", "--port", "3000", "--verbose"]],
    [["node", "s.js", "https://api.example.com/v1"]],
    [["python", "-m", "server", "MODE=dev"]],
    [["node", "s.js", "--port=3000", "--mode=read-only"]],
    [["node", "s.js", "--header", "Accept: application/json"]],
    [["node", "s.js", "--root=/srv/data", "BASE_URL=https://api.example.com/v1"]],
    [["node", "s.js", "--name", "token"]],
    [["docker", "run", "auth-service:latest"]],
    [["node", "s.js", "auth:login", "oauth-proxy:3000"]],
    [["node", "s.js", "--mode=basic auth", "--prompt=Token limits apply"]],
    [["node", "s.js", "https://h.example/docs#section-2"]],
  ])("tavalliset argumentit pysyvät ennallaan: %j", (argv) => {
    expect(redactArgs(argv)).toEqual(argv);
  });

  it("salaisen lipun jälkeinen arvo peitetään, vaikka se olisi viimeinen argumentti -- ei kaadu", () => {
    expect(redactArgs(["node", "s.js", "--token"])).toEqual(["node", "s.js", "--token"]);
  });

  it("ei muuta syötetaulukkoa (palvelin käynnistetään alkuperäisillä argumenteilla)", () => {
    const argv = ["node", "s.js", "--token", "abc"];
    redactArgs(argv);
    expect(argv).toEqual(["node", "s.js", "--token", "abc"]);
  });
});
