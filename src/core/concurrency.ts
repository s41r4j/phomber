/** Bounded I/O concurrency. Wait for started work to settle even on cancellation. */
export async function concurrentMap<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>, signal?: AbortSignal): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0, failure: unknown;
  const workers = Array.from({length:Math.min(Math.max(1,limit),items.length)},async()=>{
    while (next < items.length && !failure) {
      try { signal?.throwIfAborted(); const index = next++; results[index] = await work(items[index]!,index); }
      catch (error) {failure ||= error;}
    }
  });
  await Promise.all(workers);
  if (failure) throw failure;
  return results;
}
