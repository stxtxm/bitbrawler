import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '../serviceAccountKey.json');

type ServiceAccount = Record<string, unknown>;

const parseServiceAccount = (raw: string): ServiceAccount => {
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    return JSON.parse(decoded) as ServiceAccount;
  } catch {
    return JSON.parse(raw) as ServiceAccount;
  }
};

export const loadServiceAccount = (): ServiceAccount | null => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  if (fs.existsSync(DEFAULT_SERVICE_ACCOUNT_PATH)) {
    return JSON.parse(fs.readFileSync(DEFAULT_SERVICE_ACCOUNT_PATH, 'utf8')) as ServiceAccount;
  }

  return null;
};

export const initFirebaseAdmin = (serviceAccount: ServiceAccount) => {
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }

  return getFirestore();
};
