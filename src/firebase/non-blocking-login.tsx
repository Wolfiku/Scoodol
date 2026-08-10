
'use client';

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
