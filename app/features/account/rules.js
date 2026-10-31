// Rules for the account, without any screen code, so they can be tested.

// Everything a person has stored online in their own areas, as database paths. "Delete my
// account" deletes these, after other features' 'account.cleanup' (friendships and the friend
// code). Whatever is stored online must be covered by one or the other (and firebase/firestore.rules).
export function onlineData(uid) {
  return [
    `users/${uid}/private/main`, `users/${uid}/private/profile`, `shared/${uid}`,
    // A business's link to its place on Spots, and its request to be listed (the shop feature).
    `shopOwners/${uid}`, `spotRequests/${uid}`,
  ];
}

// Ways to sign in, by the names Firebase gives them.
const PROVIDERS = { 'google.com': 'google', password: 'email' };

// The few things the app keeps about the signed-in person, from Firebase's user. `via` is how
// they signed in ('google' or 'email'), and `verified` whether their email address is confirmed
// (always for Google; for email, once they've tapped the link Firebase sent them).
export function toUser(firebaseUser) {
  if (!firebaseUser?.uid) return null;
  const email = firebaseUser.email || '';
  const via = (firebaseUser.providerData || []).map((p) => PROVIDERS[p?.providerId]).find(Boolean) || 'google';
  return {
    uid: firebaseUser.uid,
    name: firebaseUser.displayName || email.split('@')[0] || 'You',
    email,
    photo: /^https:\/\//.test(firebaseUser.photoURL || '') ? firebaseUser.photoURL : null,
    via,
    verified: via === 'google' || !!firebaseUser.emailVerified,
  };
}

export const MIN_PASSWORD = 8;

// What's wrong with what someone typed to create an account, or null if it's fine.
export function checkNewAccount({ name, email, password }) {
  if (!String(name || '').trim()) return 'Type your first name. Friends see it, and you can change it later.';
  if (String(name).trim().length > 30) return 'Keep your name to 30 letters or fewer.';
  return checkEmail(email) || checkPassword(password);
}

export function checkEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()) ? null : 'That doesn\'t look like an email address.';
}

export function checkPassword(password) {
  const p = String(password || '');
  if (p.length < MIN_PASSWORD) return `Choose a password of at least ${MIN_PASSWORD} characters.`;
  if (p.trim() !== p) return 'Your password can\'t start or end with a space.';
  return null;
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
    // Signing in with an email and password. Firebase doesn't say whether the email or the
    // password was wrong, so nobody can find out who has an account.
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don\'t match. Check them, or tap Forgot password.';
    case 'auth/email-already-in-use':
      return 'There\'s already an account with this email. Sign in instead (with Google, if that\'s how you made it), or tap Forgot password.';
    case 'auth/invalid-email':
      return 'That doesn\'t look like an email address.';
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return `Choose a longer password, of at least ${MIN_PASSWORD} characters.`;
    case 'auth/missing-password':
      return 'Type your password.';
    case 'auth/operation-not-allowed':
      return 'Signing in with email isn\'t switched on yet. Use Google for now.';
    default:
      return message === 'load'
        ? "Couldn't load the sign-in. Check you're online and try again."
        : 'Something went wrong while signing in. Please try again.';
  }
}
