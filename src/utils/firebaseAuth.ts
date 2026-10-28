import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Workspace Gmail send scope
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
provider.addScope(GMAIL_SEND_SCOPE);

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google sign in');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * Creates RFC 2822 base64url-encoded raw email message.
 */
function makeBase64UrlEmail(to: string, subject: string, bodyHtml: string): string {
  // RFC 2047 encoded subject for UTF-8 support
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    bodyHtml,
  ];
  const message = messageParts.join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends a real email via Gmail API using the authorized OAuth access token.
 */
export async function sendRealGmailMessage(
  to: string,
  subject: string,
  bodyHtml: string
): Promise<{ id: string; threadId: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('User is not authenticated with Gmail. Please sign in with Google first.');
  }

  const raw = makeBase64UrlEmail(to, subject, bodyHtml);

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to send email via Gmail API (HTTP ${response.status})`
    );
  }

  return response.json();
}

export function getGmailWebComposeUrl(to: string, subject: string, bodyHtml: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = bodyHtml;
  const plainText = tempDiv.innerText || tempDiv.textContent || bodyHtml;

  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    to
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainText)}`;
}

export function getMailtoUrl(to: string, subject: string, bodyHtml: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = bodyHtml;
  const plainText = tempDiv.innerText || tempDiv.textContent || bodyHtml;

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainText)}`;
}

export function downloadEmlFile(to: string, subject: string, bodyHtml: string) {
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    bodyHtml,
  ];
  const emlContent = messageParts.join('\r\n');
  const blob = new Blob([emlContent], { type: 'message/rfc822' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Task-Evaluation-${to.replace(/[^a-zA-Z0-9]/g, '_')}.eml`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Direct web composer fallback for Gmail.
 */
export function openGmailWebComposer(to: string, subject: string, bodyHtml: string) {
  const url = getGmailWebComposeUrl(to, subject, bodyHtml);
  window.open(url, '_blank', 'noopener,noreferrer');
}

