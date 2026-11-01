import { describe, expect, it } from 'vitest';
import { extractJson } from '../text';

describe('extractJson', () => {
  it('keeps plain JSON as is', () => {
    expect(JSON.parse(extractJson('{"a":1}'))).toEqual({ a: 1 });
  });

  it('strips code fences', () => {
    expect(JSON.parse(extractJson('```json\n{"a":1}\n```'))).toEqual({ a: 1 });
  });

  it('drops reasoning blocks and prose around the object', () => {
    const reply = '<think>maybe {"a":0}?</think>\nSure! Here it is:\n{"a":{"b":[1,2]}}\nHope that helps.';
    expect(JSON.parse(extractJson(reply))).toEqual({ a: { b: [1, 2] } });
  });
});
