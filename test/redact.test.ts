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
