// Connects to Firebase, the first time it's needed. Firebase's code is loaded from the web
// (jsDelivr), so the app doesn't carry it until someone signs in.

import { ui } from 'folio';
import { FIREBASE_CONFIG } from './firebase-config.js';

const VERSION = '12.19.0';
const LIB = (name) => `https://cdn.jsdelivr.net/npm/firebase@${VERSION}/firebase-${name}-compat.js`;

let auth = null;

// Firebase's sign-in service. Fails with Error('load') if its code couldn't be downloaded.
export async function connect() {
  if (auth) return auth;
  try {
    await ui.loadScript(LIB('app'));
    await ui.loadScript(LIB('auth'));
  } catch {
    throw new Error('load');
  }
  const firebase = window.firebase;
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
  auth = app.auth();
  return auth;
}

export function googleProvider() {
  const provider = new window.firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
