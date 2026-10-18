// Which Firebase project the app signs in with (Project settings → General → Your apps →
// Mobile Durham → Config). None of this is a password: it only names the project, and it's in
// every copy of the app anyway. What keeps people's data safe are the project's security rules.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCY1x1LL7yyfsHFaXrbttRPL9NdJLT8mp8',
  authDomain: 'mobile-durham.firebaseapp.com',
  projectId: 'mobile-durham',
  storageBucket: 'mobile-durham.firebasestorage.app',
  messagingSenderId: '116399300931',
  appId: '1:116399300931:web:c0f2eaccb8a20266044ff6',
};

// App Check, in the web version: the reCAPTCHA v3 *site key* (Firebase console → App Check →
// Apps → Mobile Durham web). It's public, like the config above. The *secret* key that comes
// with it goes only into the Firebase console, never here. Empty means App Check is off.
// It runs in monitor-only mode: Firebase records requests that fail the check but lets them
// through, because the Android app (installed from GitHub, not Google Play) can't pass it yet.
export const APP_CHECK_SITE_KEY = '';
