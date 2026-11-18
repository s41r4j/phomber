import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
  license: string;
  author: string;
  homepage: string;
  repository: { url: string };
};

export const project = {
  name: "PH0MBER",
  generation: "Gen2",
  tagline: "OSINT Researcher",
  version: pkg.version,
  license: pkg.license,
  author: pkg.author,
  repository: pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, ""),
  website: pkg.homepage,
};
