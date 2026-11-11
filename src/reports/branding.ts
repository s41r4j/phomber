import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
    license: string;
    author: string;
};
export const project = { name: 'PH0MBER', version: pkg.version, license: pkg.license, author: pkg.author, repository: 'https://github.com/s41r4j/phomber', website: 'https://s41r4j.in' };
export const brandMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" aria-hidden="true" fill="none"><circle cx="30" cy="30" r="27" fill="currentColor" opacity=".07"/><circle cx="30" cy="30" r="25" stroke="currentColor" stroke-width="1.2"/><ellipse cx="30" cy="30" rx="12" ry="25" stroke="currentColor" opacity=".55"/><path d="M7 20h46M5 32h50M10 44h40M30 5v50" stroke="currentColor" opacity=".45"/><text x="19" y="38" fill="currentColor" stroke="none" font-family="Georgia,serif" font-size="25">P</text><text x="34" y="43" fill="currentColor" stroke="none" font-family="Georgia,serif" font-size="13">W</text></svg>`;
export const favicon = 'data:image/svg+xml,' + encodeURIComponent(brandMark);
