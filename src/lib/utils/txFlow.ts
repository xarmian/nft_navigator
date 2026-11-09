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

export function classifyTarget(initial: string, observed: string | undefined, expected: string | undefined): 'confirmed' | 'unexpected' | 'pending' {
	if (expected === undefined || expected.trim().length === 0 || observed === undefined || observed === initial) return 'pending';
	return observed === expected ? 'confirmed' : 'unexpected';
}

export function summarizeTargets(initial: string[], observed: (string | undefined)[], expected: (string | undefined)[]): { confirmed: number; pending: number; unexpected: number; total: number } {
	let confirmed = 0, pending = 0, unexpected = 0;
	for (let i = 0; i < initial.length; i++) {
		const result = classifyTarget(initial[i], observed[i], expected[i]);
		if (result === 'confirmed') confirmed++;
		else if (result === 'unexpected') unexpected++;
		else pending++;
	}
	return { confirmed, pending, unexpected, total: initial.length };
}

export function classifyOwner(initial: string, observed: string | undefined, expected?: string): 'confirmed' | 'unexpected' | 'pending' {
	if (observed === undefined || observed === initial) return 'pending';
	if (expected !== undefined && observed !== expected) return 'unexpected';
	return 'confirmed';
}

export function classifyBuyerOwner(initial: string, observed: string | undefined, buyer: string | undefined): 'confirmed' | 'unexpected' | 'pending' {
	if (buyer === undefined || buyer.trim().length === 0) return 'pending';
	return classifyOwner(initial, observed, buyer);
}

export function countPending(initial: string[], observed: (string | undefined)[]): number {
	return initial.filter((value, i) => classifyChange(value, observed[i]) === 'pending').length;
}

export function createRunGate(): { tryStart(label?: string): number | null; end(ticket: number): void; subscribe(fn: (busy: boolean) => void): () => void; abandon(): void; wasAbandoned(label: string): boolean; isCurrent(ticket: number): boolean; readonly busy: boolean } {
	let latest = 0;
	let active = false;
	let activeLabel: string | undefined;
	const abandonedLabels = new Set<string>();
	const subscribers = new Set<(busy: boolean) => void>();
	const notify = () => subscribers.forEach(fn => fn(active));
	return {
		tryStart(label?: string) {
			if (active) return null;
			active = true;
			activeLabel = label;
			notify();
			return ++latest;
		},
		end(ticket: number) {
			if (ticket === latest && active) {
				active = false;
				activeLabel = undefined;
				notify();
			}
		},
		subscribe(fn: (busy: boolean) => void) {
			subscribers.add(fn);
			fn(active);
			return () => subscribers.delete(fn);
		},
		abandon() {
			if (!active) return;
			if (activeLabel !== undefined) abandonedLabels.add(activeLabel);
			active = false;
			activeLabel = undefined;
			latest++;
			notify();
		},
		wasAbandoned(label: string) { return abandonedLabels.has(label); },
		isCurrent(ticket: number) { return active && ticket === latest; },
		get busy() { return active; },
	};
}

export function planSendRange(sentCount: number, total: number, retry: boolean): { start: number; end: number } {
	if (!retry) return { start: 0, end: total };
	const end = Math.max(0, total);
	return { start: Math.min(end, Math.max(0, sentCount)), end };
}

export function createRunSwitch(): { begin(): number; stop(): void; isLive(id: number): boolean } {
	let latest = 0;
	let stopped = true;
	return {
		begin() { stopped = false; return ++latest; },
		stop() { stopped = true; },
		isLive(id: number) { return !stopped && id === latest; },
	};
}

export function skipGroup(sentCount: number, total: number, groupSize: number): { skipped: { start: number; end: number }; next: number } {
	const start = Math.min(Math.max(sentCount, 0), total);
	const end = Math.min(start + groupSize, total);
	return { skipped: { start, end }, next: end };
}

export function splitSkipped(total: number, skipped: { start: number; end: number }[]): { sendIndices: number[]; skippedIndices: number[] } {
	const skippedIndices: number[] = [];
	const sendIndices: number[] = [];
	for (let i = 0; i < total; i++) {
		if (skipped.some(range => i >= Math.max(0, range.start) && i < Math.min(total, range.end))) skippedIndices.push(i);
		else sendIndices.push(i);
	}
	return { sendIndices, skippedIndices };
}

export function finalSendView(skippedCount: number, summary: { confirmed: number; pending: number; unexpected: number }): 'unexpected' | 'pending' | 'partial' | 'sent' {
	if (summary.unexpected > 0) return 'unexpected';
	if (summary.pending > 0) return 'pending';
	if (skippedCount > 0) return 'partial';
	return 'sent';
}

export function nextBuyView(live: boolean, classification: 'confirmed' | 'unexpected' | 'pending'): 'sent' | 'error' | 'pending' | 'none' {
	if (!live) return 'none';
	if (classification === 'confirmed') return 'sent';
	if (classification === 'unexpected') return 'error';
	return 'pending';
}

export async function runGroups(opts: { start: number; end: number; groupSize: number; sendGroup: (groupStart: number, groupEnd: number) => Promise<boolean>; isCurrent: () => boolean }): Promise<{ status: 'done' | 'failed' | 'stale'; failedAt?: number; groupsSent?: number }> {
	let groupsSent = 0;
	for (let groupStart = opts.start; groupStart < opts.end; groupStart += opts.groupSize) {
		if (!opts.isCurrent()) return { status: 'stale' };
		const sent = await opts.sendGroup(groupStart, Math.min(groupStart + opts.groupSize, opts.end));
		if (!opts.isCurrent()) return { status: 'stale' };
		if (!sent) return { status: 'failed', failedAt: groupStart, groupsSent };
		groupsSent++;
	}
	return { status: 'done', groupsSent };
}

// Used from event handlers and from component init after a click; never at module load, and the modals render only after a click, so SSR is unaffected.
export const sharedTxGate = createRunGate();

