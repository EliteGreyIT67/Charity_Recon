/**
 * Cloud Functions to synchronize `memberIds` array with `members` map on `checklists` documents
 * and a backfill HTTP endpoint to repair existing documents in bulk.
 *
 * - onWrite trigger `syncMemberIdsOnWrite` keeps the document canonical (no-op if already synced).
 * - HTTP endpoint `backfillMemberIds` iterates all checklists and ensures `memberIds` matches
 *   the valid keys of `members`. The endpoint is protected by a secret key (set in env).
 *
 * Deploy:
 * 1. Put this file in `functions/index.js` in your Firebase project.
 * 2. Create a secret key and set it for functions, e.g.:
 *      firebase functions:config:set backfill.key="LONG_SECRET_KEY"
 * 3. Deploy:
 *      firebase deploy --only functions
 *
 * Invoke backfill (example using curl):
 *   curl -X POST "https://<REGION>-<PROJECT>.cloudfunctions.net/backfillMemberIds?key=LONG_SECRET_KEY"
 *
 * Important notes:
 * - This function requires the Service Account used by Functions to have read/write access
 *   to Firestore (normal for deployed Cloud Functions).
 * - The onWrite trigger is safe against recursion because it checks if an update is required
 *   and only writes when memberIds differ from the computed list.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Allowed roles in members map
const ALLOWED_ROLES = new Set(['owner', 'editor', 'viewer']);

/**
 * Helper: compute canonical memberIds array from a members map
 * - Only include keys whose value is a recognized role (owner/editor/viewer)
 * - Returns a sorted array for stable comparison
 */
function computeMemberIdsFromMembersMap(membersMap) {
  if (!membersMap || typeof membersMap !== 'object') return [];
  const ids = Object.keys(membersMap).filter(uid => ALLOWED_ROLES.has(membersMap[uid]));
  ids.sort();
  return ids;
}

/**
 * Firestore onWrite trigger to synchronize memberIds.
 * Only updates when the computed memberIds differ from the stored memberIds.
 */
exports.syncMemberIdsOnWrite = functions.firestore
  .document('checklists/{checklistId}')
  .onWrite(async (change, context) => {
    const checklistId = context.params.checklistId;

    // If document was deleted, nothing to do
    if (!change.after.exists) {
      console.log(`checklist ${checklistId} deleted — skipping sync.`);
      return null;
    }

    const afterData = change.after.data();
    const membersMap = afterData.members || {};
    const existingMemberIds = Array.isArray(afterData.memberIds) ? [...afterData.memberIds].sort() : [];
    const computedMemberIds = computeMemberIdsFromMembersMap(membersMap);

    const equal =
      existingMemberIds.length === computedMemberIds.length &&
      existingMemberIds.every((v, i) => v === computedMemberIds[i]);

    if (equal) {
      // Nothing to change
      console.log(`checklist ${checklistId} already in sync (memberIds).`);
      return null;
    }

    // Update the document with canonical memberIds
    try {
      await db.collection('checklists').doc(checklistId).update({
        memberIds: computedMemberIds
      });
      console.log(`Synchronized memberIds for checklist ${checklistId}: [${computedMemberIds.join(', ')}]`);
    } catch (err) {
      console.error(`Failed to update memberIds for ${checklistId}:`, err);
    }

    return null;
  });

/**
 * HTTP endpoint to backfill/synchronize all existing checklists.
 * Protected by a key provided as query param `key` and stored in functions config as `backfill.key`.
 *
 * Behavior:
 * - Scans the `checklists` collection in pages of `pageSize` using startAfter pagination.
 * - For any document where computed memberIds !== stored memberIds, writes an update in batches.
 * - Returns a JSON summary with counts and any errors.
 *
 * Warning:
 * - This operation can be expensive depending on number of documents. It paginates and uses batches.
 * - The request will keep running until complete — consider running during low-traffic windows.
 */
exports.backfillMemberIds = functions.https.onRequest(async (req, res) => {
  try {
    // Protect the endpoint: require key matching functions config
    const providedKey = (req.query.key || req.body.key || '').toString();
    const cfg = functions.config();
    const expectedKey = (cfg && cfg.backfill && cfg.backfill.key) ? cfg.backfill.key : null;

    if (!expectedKey) {
      res.status(500).json({ error: "Backfill key not configured. Set `functions.config().backfill.key`." });
      return;
    }
    if (!providedKey || providedKey !== expectedKey) {
      res.status(403).json({ error: "Unauthorized. Provide the correct key as query param `key`." });
      return;
    }

    const pageSize = 500; // Firestore max batch size is 500
    let lastDoc = null;
    let totalScanned = 0;
    let totalUpdated = 0;
    let totalNoop = 0;
    let errors = [];

    while (true) {
      let q = db.collection('checklists').orderBy('__name__').limit(pageSize);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      // Prepare a batch and counters for this page
      let batch = db.batch();
      let opsInBatch = 0;

      for (const doc of snap.docs) {
        lastDoc = doc;
        totalScanned++;

        try {
          const data = doc.data();
          const membersMap = data.members || {};
          const existingMemberIds = Array.isArray(data.memberIds) ? [...data.memberIds].sort() : [];
          const computedMemberIds = computeMemberIdsFromMembersMap(membersMap);

          const equal =
            existingMemberIds.length === computedMemberIds.length &&
            existingMemberIds.every((v, i) => v === computedMemberIds[i]);

          if (!equal) {
            // Schedule update
            batch.update(doc.ref, { memberIds: computedMemberIds });
            opsInBatch++;
            totalUpdated++;
          } else {
            totalNoop++;
          }

          // Commit batch if near limit
          if (opsInBatch >= 450) { // leave margin
            await batch.commit();
            batch = db.batch();
            opsInBatch = 0;
          }
        } catch (err) {
          console.error(`Error processing doc ${doc.id}:`, err);
          errors.push({ id: doc.id, error: err.message || String(err) });
        }
      }

      // Commit remaining
      if (opsInBatch > 0) {
        try {
          await batch.commit();
        } catch (err) {
          console.error('Batch commit failed:', err);
          errors.push({ batchError: err.message || String(err) });
        }
      }

      // If we read fewer than pageSize documents, we are done
      if (snap.size < pageSize) break;
    }

    const result = { scanned: totalScanned, updated: totalUpdated, noop: totalNoop, errorsCount: errors.length, errors };
    console.log('Backfill completed:', result);
    res.json(result);
  } catch (err) {
    console.error('Backfill failed:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});
