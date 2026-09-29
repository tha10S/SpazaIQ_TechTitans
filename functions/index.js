const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const functionsV1 = require('firebase-functions/v1');

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const region = 'us-central1';

function userReference(userId) {
  return db.collection('users').doc(userId);
}

function storeReference(storeId) {
  return db.collection('stores').doc(storeId);
}

async function deleteAuthUserIfPresent(userId) {
  try {
    await auth.deleteUser(userId);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
  }
}

async function recursivelyDeleteStore(storeId) {
  const reference = storeReference(storeId);
  const snapshot = await reference.get();
  if (snapshot.exists) {
    const ownerId = snapshot.data().ownerId;
    if (ownerId !== storeId) {
      throw new Error('Refusing to delete a store whose owner does not match its ID.');
    }

    await reference.update({
      deletionSource: 'account-cleanup',
      deletionStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Subcollections can remain after someone deletes the parent store document.
  await db.recursiveDelete(reference);
}

exports.deleteMyAccount = onCall({ region }, async (request) => {
  const userId = request.auth?.uid;
  if (!userId) throw new HttpsError('unauthenticated', 'Sign in before deleting your account.');

  const authTime = Number(request.auth.token.auth_time || 0);
  if (!authTime || Date.now() / 1000 - authTime > 300) {
    throw new HttpsError('failed-precondition', 'Reauthenticate and try again.');
  }

  const profileRef = userReference(userId);
  const profileSnapshot = await profileRef.get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
  const storeId = profile.defaultStoreId || userId;
  if (storeId !== userId) {
    throw new HttpsError('failed-precondition', 'This account is not configured for the current one-user, one-store setup.');
  }

  if (profileSnapshot.exists) {
    await profileRef.update({
      deletionSource: 'callable',
      deletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  try {
    await recursivelyDeleteStore(storeId);
    if (profileSnapshot.exists) await profileRef.delete();
    await deleteAuthUserIfPresent(userId);
    return { success: true };
  } catch (error) {
    console.error('Account deletion failed', { userId, code: error.code, message: error.message });
    throw new HttpsError('internal', 'Account deletion did not complete. No test collection data was deleted. Contact support before retrying if your store data is partially missing.');
  }
});

exports.deleteAuthUserWhenProfileIsDeleted = onDocumentDeleted(
  { document: 'users/{userId}', region, retry: true },
  async (event) => {
    const userId = event.params.userId;
    const deletedProfile = event.data?.data();
    if (deletedProfile?.deletionSource === 'callable') return;

    await recursivelyDeleteStore(userId);
    await deleteAuthUserIfPresent(userId);
  }
);

exports.deleteAuthUserWhenStoreIsDeleted = onDocumentDeleted(
  { document: 'stores/{storeId}', region, retry: true },
  async (event) => {
    const storeId = event.params.storeId;
    const deletedStore = event.data?.data();
    if (!deletedStore || deletedStore.ownerId !== storeId || deletedStore.deletionSource === 'account-cleanup') return;

    const profileRef = userReference(storeId);
    const profileSnapshot = await profileRef.get();
    if (profileSnapshot.exists) {
      await profileRef.delete();
      return;
    }

    await recursivelyDeleteStore(storeId);
    await deleteAuthUserIfPresent(storeId);
  }
);

exports.deleteStoreWhenAuthUserIsDeleted = functionsV1
  .region(region)
  .auth.user()
  .onDelete(async (user) => {
    const userId = user.uid;
    await recursivelyDeleteStore(userId);
    const profileRef = userReference(userId);
    const profileSnapshot = await profileRef.get();
    if (profileSnapshot.exists) await profileRef.delete();
  });
