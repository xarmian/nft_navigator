export function isSubmitted(status: unknown): boolean {
	return status === true;
}

export function hasArcpayResult(result: unknown): result is string {
	return typeof result === 'string' && result.trim().length > 0;
}

export type PollResult<T> = { done: boolean; stopped: boolean; value: T | undefined; reads: number };

export async function pollUntil<T>(opts: {
	read: () => Promise<T>;
	isDone: (value: T) => boolean;
	attempts: number;
	delayMs: number;
	sleep?: (ms: number) => Promise<void>;
	shouldStop?: () => boolean;
}): Promise<PollResult<T>> {
	const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
	let value: T | undefined;
	let reads = 0;
	for (let i = 0; i < opts.attempts; i++) {
		if (opts.shouldStop?.()) return { done: false, stopped: true, value, reads };
		await sleep(opts.delayMs);
		if (opts.shouldStop?.()) return { done: false, stopped: true, value, reads };
		reads++;
		try {
			value = await opts.read();
		} catch {
			continue;
		}
		if (opts.isDone(value)) return { done: true, stopped: false, value, reads };
	}
	return { done: false, stopped: false, value, reads };
}

export function classifyChange(initial: string, observed: string | undefined): 'confirmed' | 'pending' {
	return observed !== undefined && observed !== initial ? 'confirmed' : 'pending';
}

export function classifyOwner(initial: string, observed: string | undefined, expected?: string): 'confirmed' | 'unexpected' | 'pending' {
	if (observed === undefined || observed === initial) return 'pending';
	if (expected !== undefined && observed !== expected) return 'unexpected';
	return 'confirmed';
}

