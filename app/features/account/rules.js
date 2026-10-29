// Rules for the account, without any screen code, so they can be tested.

// Everything a person has stored online in their own areas, as database paths. "Delete my
// account" deletes these, after other features' 'account.cleanup' (friendships and the friend
// code). Whatever is stored online must be covered by one or the other (and firebase/firestore.rules).
export function onlineData(uid) {
  return [`users/${uid}/private/main`, `users/${uid}/private/profile`, `shared/${uid}`];
}

// Ways to sign in, and the names Firebase gives them.
export const PROVIDERS = { 'google.com': 'google', 'apple.com': 'apple' };

// Which ways to sign in to offer where. Apple's sign-in needs Firebase's own Android code,
// which the app doesn't use, so the Android app has only Google's.
export function methodsFor(platform) {
  if (platform === 'ios') return ['apple', 'google'];
  if (platform === 'android') return ['google'];
  return ['google', 'apple'];
}

// Apple lets people hide their email, giving an address like abc123@privaterelay.appleid.com.
export const hiddenEmail = (email) => /@privaterelay\.appleid\.com$/i.test(email || '');

// The few things the app keeps about the signed-in person, from Firebase's user. `via` is how
// they signed in: 'google' or 'apple'.
export function toUser(firebaseUser) {
  if (!firebaseUser?.uid) return null;
  const email = firebaseUser.email || '';
  const providers = (firebaseUser.providerData || []).map((p) => PROVIDERS[p?.providerId]).filter(Boolean);
  return {
    uid: firebaseUser.uid,
    name: firebaseUser.displayName || (!hiddenEmail(email) && email.split('@')[0]) || 'You',
    email,
    photo: /^https:\/\//.test(firebaseUser.photoURL || '') ? firebaseUser.photoURL : null,
    via: providers[0] || 'google',
  };
}

// What went wrong while signing in or out, in plain words, or null if there's nothing to say
// (for example, the person closed the Google window themselves).
export function explain(err) {
  const message = String(err?.message || err?.errorMessage || '');
  // Google's Android sign-in and Apple's iPhone sign-in say things in their own words.
  // Apple's error 1001 is closing its sign-in yourself; 1000 usually means the app wasn't
  // given Sign in with Apple.
  if (/cancel|AuthorizationError error 1001/i.test(message)) return null;
  if (/AuthorizationError error 1000/i.test(message)) return 'Sign in with Apple isn\'t set up for this version of the app yet.';
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
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/network-request-failed':
      return "Couldn't reach the sign-in service. Check you're online and try again.";
    case 'auth/operation-not-allowed':
      return 'This way of signing in isn\'t switched on yet. Try another one.';
    case 'auth/account-exists-with-different-credential':
      return 'You already have an account with this email address. Sign in the way you did before (probably with Google).';
    case 'auth/unauthorized-domain':
      return "Signing in isn't allowed from this web address yet.";
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a few minutes and try again.';
    case 'auth/user-disabled':
      return 'This account has been switched off.';
    default:
      return message === 'load'
        ? "Couldn't load the sign-in. Check you're online and try again."
        : 'Something went wrong while signing in. Please try again.';
  }
}
