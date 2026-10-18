// Rules for the account, without any screen code, so they can be tested.

// Everything a person has stored online in their own areas, as database paths. "Delete my
// account" deletes these, after other features' 'account.cleanup' (friendships and the friend
// code). Whatever is stored online must be covered by one or the other (and firebase/firestore.rules).
export function onlineData(uid) {
  return [`users/${uid}/private/main`, `users/${uid}/private/profile`, `shared/${uid}`];
}

// The few things the app keeps about the signed-in person, from Firebase's user.
export function toUser(firebaseUser) {
  if (!firebaseUser?.uid) return null;
  const email = firebaseUser.email || '';
  return {
    uid: firebaseUser.uid,
    name: firebaseUser.displayName || email.split('@')[0] || 'You',
    email,
    photo: /^https:\/\//.test(firebaseUser.photoURL || '') ? firebaseUser.photoURL : null,
  };
}

// What went wrong while signing in or out, in plain words, or null if there's nothing to say
// (for example, the person closed the Google window themselves).
export function explain(err) {
  const message = String(err?.message || err?.errorMessage || '');
  // Google's Android sign-in says things in its own words.
  if (/cancel/i.test(message)) return null;
  if (/no credentials available|no account/i.test(message)) {
    return 'There\'s no Google account on this phone. Add one in Android Settings → Accounts, then try again.';
  }
  if (/developer_error|\b10:|no-plugin|no-token/i.test(message)) {
    return 'Google sign-in isn\'t set up for this version of the app yet.';
  }
  switch (err?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return "Couldn't reach Google. Check you're online and try again.";
    case 'auth/unauthorized-domain':
      return "Signing in isn't allowed from this web address yet.";
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes and try again.';
    case 'auth/user-disabled':
      return 'This account has been switched off.';
    default:
      return message === 'load'
        ? "Couldn't load Google sign-in. Check you're online and try again."
        : 'Something went wrong while signing in. Please try again.';
  }
}
