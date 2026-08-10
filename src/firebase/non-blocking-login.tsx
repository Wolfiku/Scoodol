
'use client';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously as firebaseSignInAnonymously,
  Auth,
} from 'firebase/auth';

/**
 * Meldet einen Benutzer mit E-Mail und Passwort an.
 */
export async function initiateEmailSignIn(auth: Auth, email: string, pass: string) {
  return signInWithEmailAndPassword(auth, email, pass);
}

/**
 * Erstellt einen neuen Benutzer-Account.
 */
export async function initiateEmailSignUp(auth: Auth, email: string, pass: string) {
  return createUserWithEmailAndPassword(auth, email, pass);
}

/**
 * Startet eine anonyme Gast-Sitzung.
 */
export async function signInAnonymously(auth: Auth) {
  return firebaseSignInAnonymously(auth);
}
