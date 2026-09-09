/**
 * pingSequence.ts
 *
 * Sequence numbers for location pings sent from JavaScript.
 *
 * A ping's sequence is its idempotency key: the server stores it under a unique
 * (session, seq) and recognises a re-sent fix instead of inserting it twice. Without one, a
 * request that the server committed but whose reply was lost to a flaky connection had its whole
 * queue re-inserted on retry — the route walked the same road twice and the day's distance was
 * counted twice with it.
 *
 * Two properties matter, and both are easy to get wrong:
 *
 *   • MONOTONIC, and never reset. A counter that restarts can hand out a number the server
 *     already holds for this session, and the collision is silently absorbed as a duplicate —
 *     which loses a real fix. Uniqueness only has to hold within a session, so a
 *     forever-increasing counter is trivially safe.
 *
 *   • DISJOINT from the native service's range. The native foreground service keeps its own
 *     counter in SharedPreferences/UserDefaults, which is a different store from AsyncStorage;
 *     two independent counters starting at 1 would collide constantly. JS therefore allocates
 *     from a high offset that the native counter cannot reach in any realistic lifetime.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SEQ_KEY = 'tracking_ping_seq_js';

/**
 * Start of the JavaScript sequence range. The native service counts up from 1 at roughly six
 * fixes a minute; reaching a billion would take over three centuries of continuous tracking, so
 * the two ranges cannot meet.
 */
const JS_SEQ_BASE = 1_000_000_000;

/** In-memory counter so a burst of pings cannot race on the same stored value. */
let cached: number | null = null;
let pending: Promise<number> = Promise.resolve(0);

/**
 * Allocates the next sequence. Serialised through a promise chain: two concurrent callers
 * reading the same stored value would both get the same number, and one of the two fixes would
 * then be dropped by the server as a duplicate of the other.
 */
export const nextPingSeq = async (): Promise<number> => {
  pending = pending.then(async () => {
    if (cached === null) {
      const raw = await AsyncStorage.getItem(SEQ_KEY);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      cached = Number.isFinite(parsed) && parsed >= JS_SEQ_BASE ? parsed : JS_SEQ_BASE;
    }
    cached += 1;
    // Persisted before the caller sends. If the app dies between allocation and delivery the
    // number is simply skipped, which is harmless; re-using it would not be.
    await AsyncStorage.setItem(SEQ_KEY, String(cached));
    return cached;
  });
  return pending;
};
