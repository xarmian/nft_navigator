import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's direct TypeScript runner requires the .ts extension.
import { isSubmitted, hasArcpayResult, pollUntil, classifyChange, classifyOwner } from './txFlow.ts';

function fakeSleep() {
	const calls: number[] = [];
	return { calls, sleep: async (ms: number) => { calls.push(ms); } };
}

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

