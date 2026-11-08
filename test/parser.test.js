// test/parser.test.js — SMS parser unit tests, driven by fixtures.
// Covers all 4 methods: bKash, Nagad, Rocket, Upay (+ one unparseable case).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseSms } = require('../src/smsParser');

const samples = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'fixtures', 'sms-samples.json'), 'utf8')
);

for (const sample of samples) {
  test(`parser: ${sample.name}`, () => {
    const result = parseSms(sample.text, sample.sender);
    if (sample.expected.error) {
      assert.equal(result.error, sample.expected.error);
      return;
    }
    assert.equal(result.error, undefined);
    assert.equal(result.method, sample.expected.method);
    assert.equal(result.trxid, sample.expected.trxid);
    assert.equal(result.amountPoisha, sample.expected.amountPoisha);
    assert.equal(result.senderNumber, sample.expected.senderNumber);
  });
}

test('parser: Rocket sender id is case-insensitive', () => {
  const r = parseSms(
    'You have received Tk 100.00 from 01711112222. TrxID: ROCKETCASE1.',
    'ROCKET'
  );
  assert.equal(r.method, 'rocket');
  assert.equal(r.trxid, 'ROCKETCASE1');
});

test('parser: Upay sender id is case-insensitive', () => {
  const r = parseSms(
    'You have received Tk 100.00 from 01711112222. TrxID: UPAYCASE12.',
    'upay'
  );
  assert.equal(r.method, 'upay');
  assert.equal(r.trxid, 'UPAYCASE12');
});

test('parser: unknown sender is unparseable', () => {
  const r = parseSms('You have received Tk 100.00 from 01711112222. TrxID: UNKNOWN123.', 'Unknown');
  assert.equal(r.error, 'UNPARSEABLE');
});

test('parser: empty text is unparseable', () => {
  assert.equal(parseSms('', 'bKash').error, 'UNPARSEABLE');
});
