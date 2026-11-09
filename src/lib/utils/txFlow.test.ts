import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's direct TypeScript runner requires the .ts extension.
import { isSubmitted, hasArcpayResult, pollUntil, classifyChange, classifyOwner, classifyBuyerOwner, countPending, createRunGate, classifyTarget, summarizeTargets, sharedTxGate, planSendRange, runGroups } from './txFlow.ts';

test('createRunGate isCurrent is true for the live ticket', () => {
	const gate = createRunGate();
	const ticket = gate.tryStart()!;
	assert.equal(gate.isCurrent(ticket), true);
});

test('createRunGate isCurrent is false after end', () => {
	const gate = createRunGate();
	const ticket = gate.tryStart()!;
	gate.end(ticket);
	assert.equal(gate.isCurrent(ticket), false);
});

test('createRunGate isCurrent stays false for abandoned run after a new run starts', () => {
	const gate = createRunGate();
	const old = gate.tryStart()!;
	gate.abandon();
	assert.equal(gate.isCurrent(old), false);
	const current = gate.tryStart()!;
	assert.equal(gate.isCurrent(old), false);
	assert.equal(gate.isCurrent(current), true);
});

test('createRunGate isCurrent is false for a ticket never issued', () => {
	const gate = createRunGate();
	assert.equal(gate.isCurrent(999), false);
});

test('pollUntil abandoned before polling performs no reads', async () => {
	const gate = createRunGate();
	const ticket = gate.tryStart()!;
	gate.abandon();
	const result = await pollUntil({ read: async () => 'done', isDone: v => v === 'done', attempts: 3, delayMs: 0, sleep: async () => {}, shouldStop: () => !gate.isCurrent(ticket) });
	assert.deepEqual(result, { done: false, stopped: true, value: undefined, reads: 0 });
});

test('component must check isCurrent after poll before applying a result', async () => {
	const gate = createRunGate();
	const ticket = gate.tryStart()!;
	const result = await pollUntil({ read: async () => { gate.abandon(); return 'done'; }, isDone: v => v === 'done', attempts: 3, delayMs: 0, sleep: async () => {}, shouldStop: () => !gate.isCurrent(ticket) });
	assert.equal(result.done, true);
	assert.equal(gate.isCurrent(ticket), false);
});

test('planSendRange starts a first attempt at zero', () => assert.deepEqual(planSendRange(0, 3, false), { start: 0, end: 3 }));
test('planSendRange retries the entire failed first group', () => assert.deepEqual(planSendRange(0, 3, true), { start: 0, end: 3 }));
test('planSendRange retries only the failed second group and remaining batch', () => assert.deepEqual(planSendRange(16, 20, true), { start: 16, end: 20 }));
test('planSendRange skips to the remaining range', () => assert.deepEqual(planSendRange(16, 40, true), { start: 16, end: 40 }));
test('planSendRange permits an empty retry range', () => assert.deepEqual(planSendRange(3, 3, true), { start: 3, end: 3 }));
test('planSendRange clamps retry sentCount', () => {
	assert.deepEqual(planSendRange(20, 3, true), { start: 3, end: 3 });
	assert.deepEqual(planSendRange(-2, 3, true), { start: 0, end: 3 });
});

test('runGroups retries a rejected first group in full', async () => {
	let calls: [number, number][] = [];
	const first = await runGroups({ start: 0, end: 3, groupSize: 3, isCurrent: () => true, sendGroup: async (s, e) => { calls.push([s, e]); return false; } });
	assert.deepEqual(first, { status: 'failed', failedAt: 0, groupsSent: 0 });
	calls = [];
	const range = planSendRange(0, 3, true);
	const retry = await runGroups({ ...range, groupSize: 3, isCurrent: () => true, sendGroup: async (s, e) => { calls.push([s, e]); return true; } });
	assert.deepEqual(calls, [[0, 3]]);
	assert.deepEqual(retry, { status: 'done', groupsSent: 1 });
});

test('runGroups resumes at the failed second group', async () => {
	const calls: [number, number][] = [];
	const first = await runGroups({ start: 0, end: 20, groupSize: 16, isCurrent: () => true, sendGroup: async (s, e) => { calls.push([s, e]); return s === 0; } });
	assert.deepEqual(first, { status: 'failed', failedAt: 16, groupsSent: 1 });
	calls.length = 0;
	const retry = await runGroups({ ...planSendRange(16, 20, true), groupSize: 16, isCurrent: () => true, sendGroup: async (s, e) => { calls.push([s, e]); return true; } });
	assert.deepEqual(calls, [[16, 20]]);
	assert.deepEqual(retry, { status: 'done', groupsSent: 1 });
});

test('runGroups opens no further prompts after abandon', async () => {
	const gate = createRunGate();
	const ticket = gate.tryStart()!;
	let resolve!: (value: boolean) => void;
	const calls: [number, number][] = [];
	const pending = runGroups({ start: 0, end: 40, groupSize: 16, isCurrent: () => gate.isCurrent(ticket), sendGroup: (s, e) => { calls.push([s, e]); return new Promise<boolean>(r => resolve = r); } });
	gate.abandon();
	resolve(true);
	assert.deepEqual(await pending, { status: 'stale' });
	assert.deepEqual(calls, [[0, 16]]);
});

test('runGroups does not call sendGroup when not current at start', async () => {
	let called = false;
	assert.deepEqual(await runGroups({ start: 0, end: 1, groupSize: 1, isCurrent: () => false, sendGroup: async () => { called = true; return true; } }), { status: 'stale' });
	assert.equal(called, false);
});

test('runGroups returns stale when a failed group settles after abandon', async () => {
	let current = true;
	const result = await runGroups({ start: 0, end: 1, groupSize: 1, isCurrent: () => current, sendGroup: async () => { current = false; return false; } });
	assert.deepEqual(result, { status: 'stale' });
});

test('classifyTarget requires an intended changed value', () => {
	for (const [initial, observed, expected, result] of [
		['a', undefined, 'b', 'pending'], ['a', 'a', 'b', 'pending'],
		['a', 'b', 'b', 'confirmed'], ['a', 'c', 'b', 'unexpected'],
		['a', 'b', '', 'pending'], ['a', 'b', undefined, 'pending'], ['a', 'b', '   ', 'pending']
	] as const) assert.equal(classifyTarget(initial, observed, expected), result);
});

test('classifyTarget unchanged value equals expected is pending', () => {
	assert.equal(classifyTarget('A', 'A', 'A'), 'pending');
});

test('summarizeTargets classifies each target', () => {
	assert.deepEqual(summarizeTargets(['a', 'b'], ['x', 'y'], ['x', 'y']), { confirmed: 2, pending: 0, unexpected: 0, total: 2 });
	assert.deepEqual(summarizeTargets(['a', 'b', 'c'], ['x', 'b', 'z'], ['x', 'y', 'c']), { confirmed: 1, pending: 1, unexpected: 1, total: 3 });
	assert.deepEqual(summarizeTargets(['a'], ['x'], ['y']), { confirmed: 0, pending: 0, unexpected: 1, total: 1 });
	assert.deepEqual(summarizeTargets(['a', 'b'], ['x'], ['x', 'y']), { confirmed: 1, pending: 1, unexpected: 0, total: 2 });
	assert.deepEqual(summarizeTargets(['a', 'b'], ['x', 'y'], ['x']), { confirmed: 1, pending: 1, unexpected: 0, total: 2 });
	assert.deepEqual(summarizeTargets([], [], []), { confirmed: 0, pending: 0, unexpected: 0, total: 0 });
});

test('sharedTxGate permits one active run', () => {
	const ticket = sharedTxGate.tryStart();
	assert.equal(typeof ticket, 'number');
	assert.equal(sharedTxGate.tryStart(), null);
	sharedTxGate.end(ticket!);
});

function fakeSleep() {
	const calls: number[] = [];
	return { calls, sleep: async (ms: number) => { calls.push(ms); } };
}

test('classifyBuyerOwner: undefined buyer', () => {
	assert.equal(classifyBuyerOwner('a', 'b', undefined), 'pending');
});

test('classifyBuyerOwner: empty buyer', () => {
	assert.equal(classifyBuyerOwner('a', 'b', ''), 'pending');
});

test('classifyBuyerOwner: whitespace buyer', () => {
	assert.equal(classifyBuyerOwner('a', 'b', '   '), 'pending');
});

test('classifyBuyerOwner: buyer owns changed token', () => {
	assert.equal(classifyBuyerOwner('a', 'b', 'b'), 'confirmed');
});

test('classifyBuyerOwner: unexpected owner', () => {
	assert.equal(classifyBuyerOwner('a', 'c', 'b'), 'unexpected');
});

test('classifyBuyerOwner: unchanged owner', () => {
	assert.equal(classifyBuyerOwner('a', 'a', 'b'), 'pending');
});

test('classifyBuyerOwner: missing owner', () => {
	assert.equal(classifyBuyerOwner('a', undefined, 'b'), 'pending');
});

test('countPending: empty arrays', () => {
	assert.equal(countPending([], []), 0);
});

test('countPending: all changed', () => {
	assert.equal(countPending(['a', 'b'], ['c', 'd']), 0);
});

test('countPending: one unchanged', () => {
	assert.equal(countPending(['a', 'b'], ['a', 'd']), 1);
});

test('countPending: missing observations', () => {
	assert.equal(countPending(['a', 'b', 'c'], ['d']), 2);
});

test('countPending: all unchanged', () => {
	assert.equal(countPending(['a', 'b'], ['a', 'b']), 2);
});

test('createRunGate rejects a second active run', () => {
	const gate = createRunGate();
	assert.equal(gate.tryStart(), 1);
	assert.equal(gate.tryStart(), null);
});

test('createRunGate issues larger tickets after ending', () => {
	const gate = createRunGate();
	const first = gate.tryStart()!;
	gate.end(first);
	const second = gate.tryStart()!;
	assert.ok(second > first);
});

test('createRunGate ignores stale and unknown tickets', () => {
	const gate = createRunGate();
	const first = gate.tryStart()!;
	gate.end(first);
	const second = gate.tryStart()!;
	gate.end(first);
	assert.equal(gate.busy, true);
	assert.equal(gate.tryStart(), null);
	gate.end(second + 1);
	assert.equal(gate.busy, true);
	assert.equal(gate.tryStart(), null);
});

test('createRunGate busy follows the active run', () => {
	const gate = createRunGate();
	assert.equal(gate.busy, false);
	const ticket = gate.tryStart()!;
	assert.equal(gate.busy, true);
	gate.end(ticket);
	assert.equal(gate.busy, false);
});

test('createRunGate subscribe fires immediately with false', () => {
	const gate = createRunGate();
	const values: boolean[] = [];
	gate.subscribe(value => values.push(value));
	assert.deepEqual(values, [false]);
});

test('createRunGate subscribe fires when busy changes', () => {
	const gate = createRunGate();
	const values: boolean[] = [];
	gate.subscribe(value => values.push(value));
	const ticket = gate.tryStart()!;
	gate.end(ticket);
	assert.deepEqual(values, [false, true, false]);
});

test('createRunGate unsubscribe stops notifications', () => {
	const gate = createRunGate();
	const values: boolean[] = [];
	const unsubscribe = gate.subscribe(value => values.push(value));
	unsubscribe();
	const ticket = gate.tryStart()!;
	gate.end(ticket);
	assert.deepEqual(values, [false]);
});

test('createRunGate abandon frees a busy gate', () => {
	const gate = createRunGate();
	const abandonedTicket = gate.tryStart()!;
	gate.abandon();
	assert.equal(gate.busy, false);
	const nextTicket = gate.tryStart()!;
	assert.ok(nextTicket > abandonedTicket + 1);
});

test('createRunGate abandoned ticket cannot end a newer run', () => {
	const gate = createRunGate();
	const oldTicket = gate.tryStart()!;
	gate.abandon();
	const newTicket = gate.tryStart()!;
	gate.end(oldTicket);
	assert.equal(gate.busy, true);
	gate.end(newTicket);
});

test('createRunGate abandon on idle does not notify', () => {
	const gate = createRunGate();
	const values: boolean[] = [];
	gate.subscribe(value => values.push(value));
	gate.abandon();
	assert.deepEqual(values, [false]);
});

test('createRunGate abandon records a labelled busy run', () => {
	const gate = createRunGate();
	gate.tryStart('label');
	gate.abandon();
	assert.equal(gate.wasAbandoned('label'), true);
});

test('createRunGate abandon does not record an unlabelled busy run', () => {
	const gate = createRunGate();
	gate.tryStart();
	gate.abandon();
	assert.equal(gate.wasAbandoned('label'), false);
});

test('createRunGate abandon on idle records nothing', () => {
	const gate = createRunGate();
	gate.abandon();
	assert.equal(gate.wasAbandoned('label'), false);
});

test('createRunGate forgetAbandoned clears a label', () => {
	const gate = createRunGate();
	gate.tryStart('label');
	gate.abandon();
	gate.forgetAbandoned('label');
	assert.equal(gate.wasAbandoned('label'), false);
});

test('createRunGate normal end does not record abandonment', () => {
	const gate = createRunGate();
	const ticket = gate.tryStart('label');
	gate.end(ticket!);
	assert.equal(gate.wasAbandoned('label'), false);
});

test('createRunGate abandonment of another label does not mark a later label', () => {
	const gate = createRunGate();
	gate.tryStart('first');
	gate.abandon();
	gate.tryStart('second');
	assert.equal(gate.wasAbandoned('second'), false);
});

test('createRunGate repeated abandoned label stays marked until forgotten', () => {
	const gate = createRunGate();
	gate.tryStart('a');
	gate.abandon();
	gate.tryStart('a');
	assert.equal(gate.wasAbandoned('a'), true);
	gate.forgetAbandoned('a');
	assert.equal(gate.wasAbandoned('a'), false);
});

test('createRunGate notifies once per change', () => {
	const gate = createRunGate();
	const values: boolean[] = [];
	gate.subscribe(value => values.push(value));
	const ticket = gate.tryStart()!;
	gate.end(ticket);
	gate.end(ticket);
	assert.deepEqual(values, [false, true, false]);
});

test('isSubmitted accepts only true', () => {
	assert.equal(isSubmitted(true), true);
	for (const value of [false, undefined, null, 'true', 1, {}, []]) assert.equal(isSubmitted(value), false);
});

test('hasArcpayResult requires non-whitespace text', () => {
	assert.equal(hasArcpayResult('abc'), true);
	for (const value of [undefined, null, '', '   ', 5, {}]) assert.equal(hasArcpayResult(value), false);
});

test('pollUntil completes on first read', async () => {
	const { calls, sleep } = fakeSleep();
	const result = await pollUntil({ read: async () => 1, isDone: v => v === 1, attempts: 4, delayMs: 17, sleep });
	assert.deepEqual(result, { done: true, stopped: false, value: 1, reads: 1 });
	assert.deepEqual(calls, [17]);
});

test('pollUntil completes on third read', async () => {
	const { calls, sleep } = fakeSleep();
	let reads = 0;
	const result = await pollUntil({ read: async () => ++reads, isDone: v => v === 3, attempts: 4, delayMs: 17, sleep });
	assert.deepEqual(result, { done: true, stopped: false, value: 3, reads: 3 });
	assert.deepEqual(calls, [17, 17, 17]);
});

test('pollUntil exhausts four attempts', async () => {
	const { calls, sleep } = fakeSleep();
	let reads = 0;
	const result = await pollUntil({ read: async () => ++reads, isDone: () => false, attempts: 4, delayMs: 17, sleep });
	assert.deepEqual(result, { done: false, stopped: false, value: 4, reads: 4 });
	assert.deepEqual(calls, [17, 17, 17, 17]);
});

test('pollUntil recovers from a failed first read', async () => {
	let reads = 0;
	const result = await pollUntil({ read: async () => { if (++reads === 1) throw new Error('read'); return 2; }, isDone: v => v === 2, attempts: 3, delayMs: 17, sleep: fakeSleep().sleep });
	assert.deepEqual(result, { done: true, stopped: false, value: 2, reads: 2 });
});

test('pollUntil tolerates every read throwing', async () => {
	let reads = 0;
	const result = await pollUntil({ read: async () => { reads++; throw new Error('read'); }, isDone: () => true, attempts: 3, delayMs: 17, sleep: fakeSleep().sleep });
	assert.deepEqual(result, { done: false, stopped: false, value: undefined, reads: 3 });
	assert.equal(reads, 3);
});

test('pollUntil performs no reads for zero attempts', async () => {
	const { calls, sleep } = fakeSleep();
	const result = await pollUntil({ read: async () => { assert.fail('unexpected read'); }, isDone: () => true, attempts: 0, delayMs: 17, sleep });
	assert.deepEqual(result, { done: false, stopped: false, value: undefined, reads: 0 });
	assert.deepEqual(calls, []);
});

test('pollUntil performs no reads for negative attempts', async () => {
	const { calls, sleep } = fakeSleep();
	const result = await pollUntil({ read: async () => { assert.fail('unexpected read'); }, isDone: () => true, attempts: -1, delayMs: 17, sleep });
	assert.deepEqual(result, { done: false, stopped: false, value: undefined, reads: 0 });
	assert.deepEqual(calls, []);
});

test('pollUntil stops before sleeping', async () => {
	const { calls, sleep } = fakeSleep();
	const result = await pollUntil({ read: async () => { assert.fail('unexpected read'); }, isDone: () => true, attempts: 3, delayMs: 17, sleep, shouldStop: () => true });
	assert.deepEqual(result, { done: false, stopped: true, value: undefined, reads: 0 });
	assert.deepEqual(calls, []);
});

test('pollUntil stops after sleeping without reading', async () => {
	const { calls, sleep } = fakeSleep();
	const result = await pollUntil({ read: async () => { assert.fail('unexpected read'); }, isDone: () => true, attempts: 3, delayMs: 17, sleep, shouldStop: () => calls.length > 0 });
	assert.deepEqual(result, { done: false, stopped: true, value: undefined, reads: 0 });
	assert.deepEqual(calls, [17]);
});

test('pollUntil stops between reads and keeps the value of the read in flight', async () => {
	const { calls, sleep } = fakeSleep();
	let reads = 0;
	const result = await pollUntil({ read: async () => { reads++; return 7; }, isDone: () => false, attempts: 3, delayMs: 17, sleep, shouldStop: () => reads > 0 });
	assert.deepEqual(result, { done: false, stopped: true, value: 7, reads: 1 });
	assert.equal(reads, 1);
	assert.deepEqual(calls, [17]);
});

test('pollUntil reports done even if shouldStop turns true during the finishing read', async () => {
	const { calls, sleep } = fakeSleep();
	let stop = false;
	const result = await pollUntil({ read: async () => { stop = true; return 7; }, isDone: v => v === 7, attempts: 3, delayMs: 17, sleep, shouldStop: () => stop });
	assert.equal(result.done, true);
	assert.equal(result.reads, 1);
	assert.deepEqual(calls, [17]);
});

test('pollUntil keeps last good value after a read throws', async () => {
	let reads = 0;
	const result = await pollUntil({ read: async () => { if (++reads > 1) throw new Error('read'); return 7; }, isDone: () => false, attempts: 2, delayMs: 17, sleep: fakeSleep().sleep });
	assert.deepEqual(result, { done: false, stopped: false, value: 7, reads: 2 });
});

test('classifyChange distinguishes pending and confirmed', () => {
	for (const [initial, observed, expected] of [
		['a', undefined, 'pending'], ['a', 'a', 'pending'], ['a', 'b', 'confirmed'], ['a', '', 'confirmed']
	] as const) assert.equal(classifyChange(initial, observed), expected);
});

test('classifyOwner checks the expected buyer after a change', () => {
	for (const [initial, observed, expected, result] of [
		['a', 'b', undefined, 'confirmed'], ['a', 'b', 'b', 'confirmed'],
		['a', 'b', 'c', 'unexpected'], ['a', undefined, 'b', 'pending'],
		['a', 'a', 'b', 'pending'], ['a', '', '', 'confirmed'], ['a', 'b', '', 'unexpected']
	] as const) assert.equal(classifyOwner(initial, observed, expected), result);
});

