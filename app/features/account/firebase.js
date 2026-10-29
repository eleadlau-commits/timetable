// Connects to Firebase, the first time it's needed. Firebase's code is loaded from the web
// (jsDelivr), so the app doesn't carry it until someone signs in.

import { ui } from 'folio';
import { FIREBASE_CONFIG } from './firebase-config.js';

const VERSION = '12.19.0';
const LIB = (name) => `https://cdn.jsdelivr.net/npm/firebase@${VERSION}/firebase-${name}-compat.js`;

let auth = null;
let db = null;

// For automatic tests only: a test sets this before the app starts, to use Google's emulators
// instead of the real project, e.g. { auth: 'http://127.0.0.1:9099', firestore: ['127.0.0.1', 8080] }.
const emulator = () => window.FOLIO_FIREBASE_EMULATOR;

async function load(...names) {
  try {
    for (const name of names) await ui.loadScript(LIB(name));
  } catch {
    throw new Error('load');
  }
}

// Firebase's sign-in service. Fails with Error('load') if its code couldn't be downloaded.
export async function connect() {
  if (auth) return auth;
  await load('app', 'auth');
  const firebase = window.firebase;
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
  auth = app.auth();
  if (emulator()) auth.useEmulator(emulator().auth);
  return auth;
}

// The database (Firestore), for the signed-in person. Call connect() first.
export async function database() {
  if (db) return db;
  await load('firestore');
  db = window.firebase.app().firestore();
  if (emulator()) db.useEmulator(...emulator().firestore);
  return db;
}

export function googleProvider() {
  const provider = new window.firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function appleProvider() {
  const provider = new window.firebase.auth.OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return provider;
}

// Turns the sign-in from Google's own phone sign-in into one Firebase accepts.
export function googleCredential(idToken) {
  if (!idToken) throw new Error('no-token');
  return window.firebase.auth.GoogleAuthProvider.credential(idToken);
}

// The same for Apple's sign-in on the iPhone. The nonce is the one-off code the plugin made
// for this sign-in, which Firebase checks against the one Apple signed.
export function appleCredential(idToken, rawNonce) {
  if (!idToken) throw new Error('no-token');
  return new window.firebase.auth.OAuthProvider('apple.com').credential({ idToken, rawNonce });
}
