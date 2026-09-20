import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { App } from 'firebase-admin/app';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';

const FIREBASE_APP_NAME = 'bantai-mobile-auth';

@Injectable()
export class FirebaseTokenVerifierService {
  private auth: Auth | undefined;

  async verifyPhoneIdToken(idToken: string): Promise<DecodedIdToken> {
    try {
      const auth = await this.getFirebaseAuth();
      const decoded = await auth.verifyIdToken(idToken);
      if (
        !decoded.phone_number ||
        decoded.firebase?.sign_in_provider !== 'phone'
      ) {
        throw new UnauthorizedException(
          'A Firebase phone-authentication token is required.',
        );
      }
      return decoded;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired Firebase token.');
    }
  }

  private async getFirebaseAuth(): Promise<Auth> {
    if (this.auth) return this.auth;
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    if (!projectId) {
      throw new ServiceUnavailableException(
        'Firebase authentication is not configured.',
      );
    }

    const app = await this.getOrCreateApp(projectId);
    const { getAuth } = await import('firebase-admin/auth');
    this.auth = getAuth(app);
    return this.auth;
  }

  private async getOrCreateApp(projectId: string): Promise<App> {
    const { getApps, initializeApp } = await import('firebase-admin/app');
    const existing = getApps().find((app) => app.name === FIREBASE_APP_NAME);
    return existing ?? initializeApp({ projectId }, FIREBASE_APP_NAME);
  }
}
