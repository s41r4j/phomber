import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Workspace, atomicJSON } from '../workspace/index.js';
export interface Collection {
    id: string;
    name: string;
    description: string;
    profile_ids: string[];
    created_at: string;
    updated_at: string;
    archived: boolean;
}
export class Collections {
    private pending: Promise<unknown> = Promise.resolve();
    constructor(private workspace: Workspace) { }
    async read(): Promise<Collection[]> {
        try {
            const data = JSON.parse(await readFile(join(this.workspace.root, 'collections.json'), 'utf8'));
            if (!Array.isArray(data) || data.length > 1000)
                throw new Error('Invalid collections');
            const seen = new Set<string>();
            for (const c of data) {
                if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !/^collection-[a-f0-9-]{36}$/.test(c.id) || seen.has(c.id) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 120 || typeof c.description !== 'string' || c.description.length > 2000 || !Array.isArray(c.profile_ids) || c.profile_ids.length > 1000 || c.profile_ids.some((id: unknown) => typeof id !== 'string' || !/^profile-[a-f0-9-]{36}$/.test(id)) || typeof c.archived !== 'boolean' || !Number.isFinite(Date.parse(c.created_at)) || !Number.isFinite(Date.parse(c.updated_at)))
                    throw new Error('Invalid collection record');
                seen.add(c.id);
            }
            return data;
        }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT')
                return [];
            throw e;
        }
    }
    save(form: URLSearchParams, known: Set<string>): Promise<string> {
        const op = this.pending.then(async () => {
            const all = await this.read(), id = form.get('id'), existing = all.find(c => c.id === id);
            if (id && !existing)
                throw new Error('Unknown collection');
            const name = (form.get('name') || '').trim(), description = (form.get('description') || '').trim(), ids = [...new Set(form.getAll('profiles'))];
            if (!name || name.length > 120 || description.length > 2000 || ids.length > 1000 || ids.some(p => !known.has(p)))
                throw new Error('Invalid collection');
            if (!existing && all.length >= 1000)
                throw new Error('Collection limit reached');
            const now = new Date().toISOString(), c: Collection = { id: existing?.id || 'collection-' + randomUUID(), name, description, profile_ids: ids, created_at: existing?.created_at || now, updated_at: now, archived: form.get('archived') === 'yes' };
            if (existing)
                all[all.indexOf(existing)] = c;
            else
                all.push(c);
            await atomicJSON(join(this.workspace.root, 'collections.json'), all);
            return c.id;
        });
        this.pending = op.catch(() => { });
        return op;
    }
}
