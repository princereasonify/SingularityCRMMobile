import AsyncStorage from '@react-native-async-storage/async-storage';
import { nextPingSeq } from '../src/services/pingSequence';

/**
 * A ping's sequence is its idempotency key: the server stores it under a unique (session, seq)
 * and recognises a re-sent fix instead of counting it twice. Two properties carry that guarantee,
 * and both fail silently when broken — a duplicate is absorbed by the server, so a collision
 * shows up only as a fix that quietly never arrived.
 */
describe('nextPingSeq', () => {
  /**
   * Loads a fresh copy of the module together with the storage mock it will read.
   *
   * They have to come from the SAME isolated registry: `jest.resetModules()` hands the new module
   * a new AsyncStorage mock with its own empty store, so seeding the outer mock and reading from
   * the inner one tests nothing except that two empty maps are both empty.
   */
  const freshModule = () => {
    let mod!: typeof import('../src/services/pingSequence');
    let storage!: typeof AsyncStorage;
    jest.isolateModules(() => {
      // The published mock is a CommonJS object with no `default`; the real package has one.
      // Accept either so this does not break if the mock's shape changes.
      const required = require('@react-native-async-storage/async-storage');
      storage = required.default ?? required;
      mod = require('../src/services/pingSequence');
    });
    return { mod, storage };
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('increases on every call', async () => {
    const seqs = [await nextPingSeq(), await nextPingSeq(), await nextPingSeq()];
    expect(seqs[1]).toBeGreaterThan(seqs[0]);
    expect(seqs[2]).toBeGreaterThan(seqs[1]);
  });

  it('never hands out the same number twice under concurrent callers', async () => {
    // Two fixes captured in the same tick would otherwise read the same stored value and both
    // take it, and the server would drop one of them as a duplicate of the other.
    const seqs = await Promise.all(Array.from({ length: 25 }, () => nextPingSeq()));
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  it('allocates from a range the native services cannot reach', async () => {
    // The native foreground service keeps its own counter, in a different store, counting up
    // from 1. Independent counters both starting at 1 would collide constantly.
    expect(await nextPingSeq()).toBeGreaterThan(1_000_000_000);
  });

  it('resumes from the stored value rather than restarting', async () => {
    // A counter that restarts can re-issue a number the server already holds for this session,
    // and that fix is then silently dropped as a duplicate.
    const { mod, storage } = freshModule();
    await storage.setItem('tracking_ping_seq_js', '1000000500');
    expect(await mod.nextPingSeq()).toBe(1_000_000_501);
  });

  it('recovers from a corrupt stored value without reusing low numbers', async () => {
    const { mod, storage } = freshModule();
    await storage.setItem('tracking_ping_seq_js', 'not-a-number');
    expect(await mod.nextPingSeq()).toBeGreaterThan(1_000_000_000);
  });

  it('persists each allocation, so a restart cannot repeat one', async () => {
    const { mod, storage } = freshModule();
    const issued = await mod.nextPingSeq();
    // The value is written before the caller sends. A process death between allocating and
    // delivering merely skips a number, which is harmless; re-using one is not.
    expect(await storage.getItem('tracking_ping_seq_js')).toBe(String(issued));
  });
});
