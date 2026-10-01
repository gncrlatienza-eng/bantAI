import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  GoneException,
  ServiceUnavailableException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import {
  AccessRequestStatus,
  AuditEventType,
  EmailOtpPurpose,
  OrganizationMemberRole,
  Prisma,
  type UserRole,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';

import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OtpSmsService } from './otp-sms.service';
import { normalizePhilippineMobile } from './phone';
import { LoginDto } from './dto/login.dto';
import { PortalRegisterDto } from './dto/portal-register.dto';
import {
  RequestClaimEmailOtpDto,
  RequestEmailOtpDto,
  RequestPortalEmailOtpDto,
  VerifyClaimEmailOtpDto,
  VerifyEmailOtpDto,
  VerifySignUpDto,
} from './dto/email-otp.dto';
import { PortalOtpEmailService } from './portal-otp-email.service';
import { AuthAudience, JWT_ISSUER, jwtSecretFor } from './constants';
import { resolveStaffPermissions } from './constants/staff-permissions';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;
const OTP_MAX_ATTEMPTS = 5;
const EMAIL_OTP_TTL_MS = 5 * 60 * 1000;
const EMAIL_OTP_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_OTP_MAX_REQUESTS_PER_WINDOW = 5;
const EMAIL_OTP_MAX_ATTEMPTS = 5;
const EMAIL_OTP_GENERIC_MESSAGE =
  'If the account is eligible, a verification code has been sent.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private otpSmsService: OtpSmsService,
    private portalOtpEmailService: PortalOtpEmailService,
    private audit: AuditService,
  ) {}

  register(dto: RegisterDto) {
    this.requirePhone(dto.phone);
    // Profile fields are deliberately not stored until the phone owner has
    // completed OTP verification and updates their own profile via /users/me.
    return Promise.resolve({
      message: 'Verify this phone number before creating a profile.',
    });
  }

  async registerPortal(dto: PortalRegisterDto) {
    this.requireLegacyPasswordAuth();
    const checkoutSessionId = dto.checkoutSessionId.trim();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.withSerializationRetry(async () => {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const accessRequest = await tx.accessRequest.findUnique({
              where: { stripeCheckoutSessionId: checkoutSessionId },
            });
            if (
              !accessRequest ||
              accessRequest.status !== AccessRequestStatus.ACTIVE ||
              !accessRequest.activatedAt
            ) {
              throw new BadRequestException(
                'This checkout has not been activated for account creation.',
              );
            }
            if (accessRequest.portalUserId) {
              throw new ConflictException(
                'An account has already been created for this license.',
              );
            }

            const email = accessRequest.email.trim().toLowerCase();
            if (await tx.user.findUnique({ where: { email } })) {
              throw new ConflictException(
                'An account already exists for this email.',
              );
            }

            const created = await tx.user.create({
              data: {
                email,
                passwordHash,
                company: accessRequest.organization.trim(),
                role: 'USER',
                webRole: 'SHIELD',
              },
            });
            const claimed = await tx.accessRequest.updateMany({
              where: {
                id: accessRequest.id,
                status: AccessRequestStatus.ACTIVE,
                portalUserId: null,
              },
              data: { portalUserId: created.id },
            });
            if (claimed.count !== 1) {
              throw new ConflictException(
                'An account has already been created for this license.',
              );
            }
            return created;
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') {
          throw new ConflictException(
            'An account has already been created for this license.',
          );
        }
        throw error;
      }
    });
    return this.issueToken(user.id, user.role, AuthAudience.CLIENT);
  }

  async login(dto: LoginDto) {
    this.requireLegacyPasswordAuth();
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (
      !user.webRole ||
      (user.webRole === 'SHIELD' && user.portalAccessStatus !== 'ACTIVE')
    ) {
      throw new UnauthorizedException(
        'This account does not have web portal access.',
      );
    }
    return this.issueToken(
      user.id,
      user.role,
      user.webRole === 'ADMIN' ? AuthAudience.ADMIN : AuthAudience.CLIENT,
    );
  }

  /*
   * Account-first registration, step 1. Sign-up is intentionally explicit
   * when an account already owns the address so the form can direct the user
   * to sign in. Other OTP purposes retain their generic anti-enumeration
   * response.
   */
  async requestSignUpOtp(dto: RequestEmailOtpDto) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: 'insensitive' } },
          { mobileAuthEmail: { equals: email, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An account already uses this email. Sign in instead.',
      );
    }
    return this.requestEmailOtp(email, EmailOtpPurpose.CLIENT_SIGN_UP);
  }

  /*
   * Account-first registration, step 2. The consumed code proves control of
   * the email, so the account starts verified. Its web lifecycle begins at
   * mandatory setup; no license, workspace, or application is created here.
   */
  async verifySignUp(dto: VerifySignUpDto) {
    const email = this.normalizeEmail(dto.email);
    await this.consumePortalEmailOtp(
      email,
      EmailOtpPurpose.CLIENT_SIGN_UP,
      dto.otp,
    );
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const now = new Date();
    let user: { id: string; role: UserRole };
    try {
      user = await this.withSerializationRetry(async () =>
        this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.user.findFirst({
              where: {
                OR: [
                  { email: { equals: email, mode: 'insensitive' } },
                  {
                    mobileAuthEmail: {
                      equals: email,
                      mode: 'insensitive',
                    },
                  },
                ],
              },
              select: { id: true },
            });
            // Only someone who just proved control of this email reaches
            // this message, so it does not leak account existence.
            if (existing) {
              throw new ConflictException(
                'An account already uses this email. Sign in instead.',
              );
            }
            const created = await tx.user.create({
              data: {
                email,
                passwordHash,
                role: 'USER',
                webRole: 'SHIELD',
                emailVerifiedAt: now,
              },
              select: { id: true, role: true },
            });
            const linkedRequests = await this.linkLegacyRequests(
              tx,
              created.id,
              email,
            );
            await this.audit.record(
              {
                type: AuditEventType.ACCOUNT_CREATED,
                actorUserId: created.id,
                targetUserId: created.id,
                metadata: { linkedLegacyRequests: linkedRequests },
              },
              tx,
            );
            return created;
          },
          { isolationLevel: 'Serializable' },
        ),
      );
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'An account already uses this email. Sign in instead.',
        );
      }
      throw error;
    }
    return this.issueToken(user.id, user.role, AuthAudience.CLIENT);
  }

  /*
   * Requests filed through the retired anonymous form carry only an email.
   * They join this account only after it proved control of that same email.
   * A paid-but-unclaimed legacy workspace is handed to its owner here, which
   * is the same proof the old post-payment claim step relied on.
   */
  private async linkLegacyRequests(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
  ): Promise<number> {
    const orphans = await tx.accessRequest.findMany({
      where: {
        portalUserId: null,
        email: { equals: email, mode: 'insensitive' },
      },
      select: { id: true, status: true, portalOrganizationId: true },
    });
    for (const orphan of orphans) {
      await tx.accessRequest.updateMany({
        where: { id: orphan.id, portalUserId: null },
        data: { portalUserId: userId },
      });
      if (
        orphan.status !== AccessRequestStatus.ACTIVE ||
        !orphan.portalOrganizationId
      ) {
        continue;
      }
      const owner = await tx.organizationMembership.findFirst({
        where: {
          organizationId: orphan.portalOrganizationId,
          role: OrganizationMemberRole.SHIELD,
        },
        select: { userId: true },
      });
      if (owner) continue;
      await tx.organizationMembership.create({
        data: {
          organizationId: orphan.portalOrganizationId,
          userId,
          role: OrganizationMemberRole.SHIELD,
        },
      });
    }
    return orphans.length;
  }

  requestClientEmailOtp(dto: RequestEmailOtpDto) {
    return this.requestEmailOtp(dto.email, EmailOtpPurpose.CLIENT_SIGN_IN);
  }

  requestAdminEmailOtp(dto: RequestEmailOtpDto) {
    return this.requestEmailOtp(dto.email, EmailOtpPurpose.ADMIN_SIGN_IN);
  }

  /*
   * Unified web sign-in — email + password + Gmail OTP (3-factor).
   *
   * Step 1 validates the email/password pair against the DB. On a bad pair
   * we return 401 immediately so the UI can show "invalid email or
   * password"; there is no point pretending to send an OTP that will never
   * verify. Enumeration risk is accepted here because the portal is not a
   * public-signup product — accounts are provisioned by admins, and the
   * per-IP throttle plus bcrypt cost keep brute-force expensive.
   *
   * When the pair matches AND the account is ADMIN or a licensed client,
   * we mint and email a 6-digit code and return 202 with a clear message.
   * The OTP challenge is single-use and expires in 5 minutes.
   *
   * Step 2 (`verifyPortalEmailOtp`) is unchanged in shape — it only takes
   * the email + 6-digit code. The password is not re-collected because the
   * OTP challenge was issued only after a successful password check.
   */
  async requestPortalEmailOtp(dto: RequestPortalEmailOtpDto) {
    const email = this.normalizeEmail(dto.email);
    const account = await this.prisma.user.findUnique({ where: { email } });

    // Always run bcrypt.compare, even for unknown accounts, so response
    // latency does not distinguish "no such email" from "wrong password"
    // when the caller times requests. Correctness of the boolean is what
    // gates the outcome; timing just prevents a cheap oracle.
    const hashToTest = account?.passwordHash ?? AuthService.dummyPasswordHash;
    const passwordOk = await bcrypt.compare(dto.password, hashToTest);
    if (!account || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Password was correct — now check the account may sign in on the web at
    // all. A license is NOT required: authentication proves identity, and
    // PortalRoutePolicy decides what the session may reach (pending, declined,
    // and expired users still need their account and application pages).
    // Account-level enforcement (SUSPENDED/REVOKED) does block sign-in.
    let purpose: EmailOtpPurpose;
    if (account.webRole === 'ADMIN') {
      purpose = EmailOtpPurpose.ADMIN_SIGN_IN;
    } else {
      const identity = await this.findPortalIdentity(email);
      if (!identity || identity.id !== account.id) {
        throw new UnauthorizedException(
          'This account does not have web portal access.',
        );
      }
      purpose = EmailOtpPurpose.CLIENT_SIGN_IN;
    }

    return this.requestEmailOtp(dto.email, purpose);
  }

  async verifyPortalEmailOtp(dto: VerifyEmailOtpDto) {
    const email = this.normalizeEmail(dto.email);
    const account = await this.prisma.user.findUnique({ where: { email } });
    if (account?.webRole === 'ADMIN') {
      return this.verifyAdminEmailOtp(dto);
    }
    return this.verifyClientEmailOtp(dto);
  }

  /*
   * A precomputed bcrypt hash of a value the caller cannot know. Used only
   * to normalize timing when no account exists — the compare will always
   * fail, but it takes roughly the same time as a real check.
   */
  private static readonly dummyPasswordHash =
    '$2b$12$C6UzMDM.H6dfI/f/IKcEeu5vGH6Cw4tp5o3lZOl8bH3W1JmT2LcJq';

  requestClientClaimEmailOtp(dto: RequestClaimEmailOtpDto) {
    return this.requestEmailOtp(
      dto.email,
      EmailOtpPurpose.CLIENT_CLAIM,
      dto.checkoutSessionId.trim(),
    );
  }

  requestMobileEmailOtp(dto: RequestEmailOtpDto) {
    this.requireMobileEmailOtpEnabled();
    return this.requestEmailOtp(dto.email, EmailOtpPurpose.MOBILE_SIGN_IN);
  }

  async verifyMobileEmailOtp(dto: VerifyEmailOtpDto) {
    this.requireMobileEmailOtpEnabled();
    const email = this.normalizeEmail(dto.email);
    const purpose = EmailOtpPurpose.MOBILE_SIGN_IN;
    const challengeKey = this.emailOtpChallengeKey(email, purpose);
    const codeHash = this.hashEmailOtp(email, purpose, dto.otp);
    const now = new Date();

    const user = await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const challenge = await tx.emailOtpChallenge.findUnique({
            where: { challengeKey },
          });
          const matches =
            challenge &&
            !challenge.consumedAt &&
            challenge.expiresAt > now &&
            challenge.attempts < EMAIL_OTP_MAX_ATTEMPTS &&
            this.hashesMatch(challenge.codeHash, codeHash);
          if (!matches) {
            if (
              challenge &&
              !challenge.consumedAt &&
              challenge.attempts < EMAIL_OTP_MAX_ATTEMPTS
            ) {
              await tx.emailOtpChallenge.update({
                where: { challengeKey },
                data: { attempts: { increment: 1 } },
              });
            }
            return null;
          }

          const mobileIdentity = await tx.user.findUnique({
            where: { mobileAuthEmail: email },
            select: {
              id: true,
              role: true,
              email: true,
              mobileAuthEmail: true,
              passwordHash: true,
              accessRequests: { select: { id: true }, take: 1 },
              organizationMemberships: { select: { id: true }, take: 1 },
            },
          });
          const safeExistingMobileUser =
            mobileIdentity?.role === 'USER' &&
            !mobileIdentity.passwordHash &&
            mobileIdentity.accessRequests.length === 0 &&
            mobileIdentity.organizationMemberships.length === 0;
          if (mobileIdentity && !safeExistingMobileUser) {
            await tx.emailOtpChallenge.updateMany({
              where: { challengeKey, codeHash, consumedAt: null },
              data: { consumedAt: now },
            });
            return null;
          }
          const profileIdentity = mobileIdentity
            ? null
            : await tx.user.findUnique({
                where: { email },
                select: {
                  role: true,
                  webRole: true,
                  passwordHash: true,
                  accessRequests: { select: { id: true }, take: 1 },
                  organizationMemberships: { select: { id: true }, take: 1 },
                },
              });
          if (this.isAuthoritativePortalIdentity(profileIdentity)) {
            await tx.emailOtpChallenge.updateMany({
              where: { challengeKey, codeHash, consumedAt: null },
              data: { consumedAt: now },
            });
            return null;
          }

          const consumed = await tx.emailOtpChallenge.updateMany({
            where: {
              challengeKey,
              codeHash,
              consumedAt: null,
              expiresAt: { gt: now },
              attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS },
            },
            data: { consumedAt: now },
          });
          if (consumed.count !== 1) return null;

          if (mobileIdentity) return mobileIdentity;
          return tx.user.create({
            data: { mobileAuthEmail: email, role: 'USER' },
            select: { id: true, role: true },
          });
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    if (!user) throw new BadRequestException('Invalid or expired OTP.');
    return this.issueToken(user.id, user.role, AuthAudience.MOBILE);
  }

  async verifyClientEmailOtp(dto: VerifyEmailOtpDto) {
    const email = this.normalizeEmail(dto.email);
    await this.consumePortalEmailOtp(
      email,
      EmailOtpPurpose.CLIENT_SIGN_IN,
      dto.otp,
    );
    const user =
      (await this.findPortalIdentity(email)) ??
      (await this.acceptPendingWorkspaceInvitations(email));
    if (!user) throw new BadRequestException('Invalid or expired OTP.');
    return this.issueToken(user.id, user.role, AuthAudience.CLIENT);
  }

  async verifyAdminEmailOtp(dto: VerifyEmailOtpDto) {
    const email = this.normalizeEmail(dto.email);
    await this.consumePortalEmailOtp(
      email,
      EmailOtpPurpose.ADMIN_SIGN_IN,
      dto.otp,
    );
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.webRole !== 'ADMIN') {
      throw new BadRequestException('Invalid or expired OTP.');
    }
    return this.issueToken(user.id, user.role, AuthAudience.ADMIN);
  }

  async verifyClientClaimEmailOtp(dto: VerifyClaimEmailOtpDto) {
    const email = this.normalizeEmail(dto.email);
    const checkoutSessionId = dto.checkoutSessionId.trim();
    const purpose = EmailOtpPurpose.CLIENT_CLAIM;
    const challengeKey = this.emailOtpChallengeKey(
      email,
      purpose,
      checkoutSessionId,
    );
    const codeHash = this.hashEmailOtp(
      email,
      purpose,
      dto.otp,
      checkoutSessionId,
    );
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const now = new Date();

    const user = await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const accessRequest = await tx.accessRequest.findUnique({
            where: { stripeCheckoutSessionId: checkoutSessionId },
            include: { license: true, portalUser: true },
          });
          if (
            !accessRequest ||
            this.normalizeEmail(accessRequest.email) !== email ||
            accessRequest.status !== AccessRequestStatus.ACTIVE ||
            !accessRequest.activatedAt ||
            !accessRequest.license ||
            accessRequest.license.status !== 'ACTIVE' ||
            !accessRequest.license.shieldApprovedAt ||
            accessRequest.license.shieldReviewDecision !== 'APPROVED' ||
            accessRequest.license.validFrom > now ||
            (accessRequest.license.validUntil &&
              accessRequest.license.validUntil <= now)
          ) {
            throw new BadRequestException(
              'This checkout is not eligible for account activation.',
            );
          }

          const challenge = await tx.emailOtpChallenge.findUnique({
            where: { challengeKey },
          });
          const validChallenge =
            challenge &&
            challenge.accessRequestId === accessRequest.id &&
            !challenge.consumedAt &&
            challenge.expiresAt > now &&
            challenge.attempts < EMAIL_OTP_MAX_ATTEMPTS &&
            this.hashesMatch(challenge.codeHash, codeHash);
          if (!validChallenge) {
            if (
              challenge &&
              !challenge.consumedAt &&
              challenge.attempts < EMAIL_OTP_MAX_ATTEMPTS
            ) {
              await tx.emailOtpChallenge.update({
                where: { challengeKey },
                data: { attempts: { increment: 1 } },
              });
            }
            return null;
          }

          const consumed = await tx.emailOtpChallenge.updateMany({
            where: {
              challengeKey,
              accessRequestId: accessRequest.id,
              codeHash,
              consumedAt: null,
              expiresAt: { gt: now },
              attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS },
            },
            data: { consumedAt: now },
          });
          if (consumed.count !== 1) return null;

          let user =
            accessRequest.portalUser ??
            (await tx.user.findUnique({ where: { email } }));
          if (user && this.normalizeEmail(user.email ?? '') !== email) {
            throw new ConflictException(
              'This paid access belongs to a different account.',
            );
          }
          if (user?.webRole === 'ADMIN') {
            throw new ConflictException(
              'This email belongs to a staff account and cannot claim a client license.',
            );
          }
          if (user && user.portalAccessStatus !== 'ACTIVE') {
            throw new BadRequestException(
              'This account is not eligible for portal activation.',
            );
          }
          if (user?.passwordHash) {
            throw new ConflictException(
              'This account is already set up. Sign in instead.',
            );
          }

          if (user) {
            const passwordSet = await tx.user.updateMany({
              where: {
                id: user.id,
                role: 'USER',
                portalAccessStatus: 'ACTIVE',
                passwordHash: null,
              },
              data: { passwordHash, webRole: 'SHIELD' },
            });
            if (passwordSet.count !== 1) {
              throw new ConflictException(
                'This account is already set up. Sign in instead.',
              );
            }
            user = { ...user, passwordHash };
          } else {
            user = await tx.user.create({
              data: {
                email,
                passwordHash,
                company: accessRequest.organization.trim(),
                role: 'USER',
                webRole: 'SHIELD',
                portalAccessStatus: 'ACTIVE',
              },
            });
          }

          const claimed = await tx.accessRequest.updateMany({
            where: {
              id: accessRequest.id,
              status: AccessRequestStatus.ACTIVE,
              activatedAt: { not: null },
              OR: [{ portalUserId: null }, { portalUserId: user.id }],
            },
            data: { portalUserId: user.id },
          });
          if (claimed.count !== 1) {
            throw new ConflictException(
              'An account has already been created for this license.',
            );
          }

          await tx.organizationMembership.upsert({
            where: {
              organizationId_userId: {
                organizationId: accessRequest.license.organizationId,
                userId: user.id,
              },
            },
            create: {
              organizationId: accessRequest.license.organizationId,
              userId: user.id,
              role: 'SHIELD',
            },
            update: { role: 'SHIELD' },
          });
          await tx.portalOrganization.update({
            where: { id: accessRequest.license.organizationId },
            data: { ownerId: user.id },
          });

          return user;
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    if (!user) throw new BadRequestException('Invalid or expired OTP.');
    return this.issueToken(user.id, user.role, AuthAudience.CLIENT);
  }

  private async requestEmailOtp(
    rawEmail: string,
    purpose: EmailOtpPurpose,
    binding?: string,
  ) {
    const email = this.normalizeEmail(rawEmail);
    const eligible = await this.isEmailOtpEligible(email, purpose, binding);
    // Anti-enumeration: unknown or ineligible accounts receive the same
    // response without storing or sending a challenge.
    if (!eligible) return { message: EMAIL_OTP_GENERIC_MESSAGE };

    const code = randomInt(100_000, 1_000_000).toString();
    const now = new Date();
    const challengeKey = this.emailOtpChallengeKey(email, purpose, binding);
    const codeHash = this.hashEmailOtp(email, purpose, code, binding);
    const shouldSend = await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.emailOtpChallenge.findUnique({
            where: { challengeKey },
          });
          const inWindow =
            existing &&
            now.getTime() - existing.requestWindowStart.getTime() <
              EMAIL_OTP_WINDOW_MS;
          const requestCount = inWindow ? existing.requestCount + 1 : 1;
          if (requestCount > EMAIL_OTP_MAX_REQUESTS_PER_WINDOW) {
            // Keep the outward response identical for eligible and ineligible
            // addresses so this limit cannot reveal whether an account exists.
            return false;
          }
          await tx.emailOtpChallenge.upsert({
            where: { challengeKey },
            create: {
              challengeKey,
              email,
              purpose,
              accessRequestId: eligible.accessRequestId,
              codeHash,
              expiresAt: new Date(now.getTime() + EMAIL_OTP_TTL_MS),
              requestCount,
              requestWindowStart: now,
            },
            update: {
              codeHash,
              expiresAt: new Date(now.getTime() + EMAIL_OTP_TTL_MS),
              consumedAt: null,
              attempts: 0,
              requestCount,
              requestWindowStart: inWindow ? existing.requestWindowStart : now,
              accessRequestId: eligible.accessRequestId,
            },
          });
          return true;
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    if (!shouldSend) return { message: EMAIL_OTP_GENERIC_MESSAGE };

    try {
      await this.portalOtpEmailService.send(email, code, purpose);
    } catch (error) {
      await this.prisma.emailOtpChallenge.updateMany({
        where: { challengeKey, codeHash, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      throw error;
    }
    return { message: EMAIL_OTP_GENERIC_MESSAGE };
  }

  private async consumePortalEmailOtp(
    email: string,
    purpose: EmailOtpPurpose,
    otp: string,
    binding?: string,
  ) {
    const challengeKey = this.emailOtpChallengeKey(email, purpose, binding);
    const codeHash = this.hashEmailOtp(email, purpose, otp, binding);
    const now = new Date();
    const valid = await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const challenge = await tx.emailOtpChallenge.findUnique({
            where: { challengeKey },
          });
          const matches =
            challenge &&
            !challenge.consumedAt &&
            challenge.expiresAt > now &&
            challenge.attempts < EMAIL_OTP_MAX_ATTEMPTS &&
            this.hashesMatch(challenge.codeHash, codeHash);
          if (!matches) {
            if (
              challenge &&
              !challenge.consumedAt &&
              challenge.attempts < EMAIL_OTP_MAX_ATTEMPTS
            ) {
              await tx.emailOtpChallenge.update({
                where: { challengeKey },
                data: { attempts: { increment: 1 } },
              });
            }
            return false;
          }
          const consumed = await tx.emailOtpChallenge.updateMany({
            where: {
              challengeKey,
              codeHash,
              consumedAt: null,
              expiresAt: { gt: now },
              attempts: { lt: EMAIL_OTP_MAX_ATTEMPTS },
            },
            data: { consumedAt: now },
          });
          return consumed.count === 1;
        },
        { isolationLevel: 'Serializable' },
      ),
    );
    if (!valid) throw new BadRequestException('Invalid or expired OTP.');
  }

  private async isEmailOtpEligible(
    email: string,
    purpose: EmailOtpPurpose,
    binding?: string,
  ): Promise<{ accessRequestId: string | null } | null> {
    if (purpose === EmailOtpPurpose.MOBILE_SIGN_IN) {
      const mobileIdentity = await this.prisma.user.findUnique({
        where: { mobileAuthEmail: email },
        select: {
          role: true,
          mobileAuthEmail: true,
          passwordHash: true,
          accessRequests: { select: { id: true }, take: 1 },
          organizationMemberships: { select: { id: true }, take: 1 },
        },
      });
      if (mobileIdentity) {
        return mobileIdentity.role === 'USER' &&
          !mobileIdentity.passwordHash &&
          mobileIdentity.accessRequests.length === 0 &&
          mobileIdentity.organizationMemberships.length === 0
          ? { accessRequestId: null }
          : null;
      }
      const profileIdentity = await this.prisma.user.findUnique({
        where: { email },
        select: {
          role: true,
          webRole: true,
          passwordHash: true,
          accessRequests: { select: { id: true }, take: 1 },
          organizationMemberships: { select: { id: true }, take: 1 },
        },
      });
      return this.isAuthoritativePortalIdentity(profileIdentity)
        ? null
        : { accessRequestId: null };
    }
    if (purpose === EmailOtpPurpose.ADMIN_SIGN_IN) {
      const user = await this.prisma.user.findUnique({ where: { email } });
      return user?.webRole === 'ADMIN' ? { accessRequestId: null } : null;
    }
    if (purpose === EmailOtpPurpose.CLIENT_SIGN_UP) {
      const taken = await this.prisma.user.findFirst({
        where: { OR: [{ email }, { mobileAuthEmail: email }] },
        select: { id: true },
      });
      return taken ? null : { accessRequestId: null };
    }
    if (purpose === EmailOtpPurpose.CLIENT_SIGN_IN) {
      const user = await this.findPortalIdentity(email);
      if (user) return { accessRequestId: null };
      const invitation = await this.prisma.organizationInvitation.findFirst({
        where: {
          email,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
          organization: {
            isActive: true,
            licenses: {
              some: {
                status: 'ACTIVE',
                OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
              },
            },
          },
        },
        select: { id: true },
      });
      return invitation ? { accessRequestId: null } : null;
    }
    if (!binding) return null;
    const request = await this.prisma.accessRequest.findUnique({
      where: { stripeCheckoutSessionId: binding },
      include: { license: true, portalUser: true },
    });
    if (
      !request ||
      this.normalizeEmail(request.email) !== email ||
      request.status !== AccessRequestStatus.ACTIVE ||
      !request.activatedAt ||
      !request.license ||
      request.license.status !== 'ACTIVE' ||
      !request.license.shieldApprovedAt ||
      request.license.shieldReviewDecision !== 'APPROVED' ||
      request.license.validFrom > new Date() ||
      (request.license.validUntil && request.license.validUntil <= new Date())
    ) {
      return null;
    }

    const user =
      request.portalUser ??
      (await this.prisma.user.findUnique({ where: { email } }));
    return !user ||
      (user.role === 'USER' &&
        user.portalAccessStatus === 'ACTIVE' &&
        !user.passwordHash)
      ? { accessRequestId: request.id }
      : null;
  }

  /**
   * A web portal identity: a USER with a portal password whose account is not
   * suspended or revoked. Deliberately independent of any license — licensed
   * data is enforced per request by PortalRoutePolicy, not at sign-in.
   */
  private async findPortalIdentity(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        webRole: 'SHIELD',
        portalAccessStatus: 'ACTIVE',
        passwordHash: { not: null },
      },
    });
  }

  private async acceptPendingWorkspaceInvitations(email: string) {
    return this.withSerializationRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const invitations = await tx.organizationInvitation.findMany({
            where: {
              email,
              status: 'PENDING',
              expiresAt: { gt: new Date() },
              organization: {
                isActive: true,
                licenses: {
                  some: {
                    status: 'ACTIVE',
                    OR: [
                      { validUntil: null },
                      { validUntil: { gt: new Date() } },
                    ],
                  },
                },
              },
            },
          });
          if (invitations.length === 0) return null;

          let user = await tx.user.findUnique({ where: { email } });
          if (user?.role === 'ADMIN') return null;
          user ??= await tx.user.create({
            data: {
              email,
              role: 'USER',
              webRole: 'SHIELD',
              portalAccessStatus: 'ACTIVE',
              emailVerifiedAt: new Date(),
            },
          });

          for (const invitation of invitations) {
            await tx.organizationMembership.upsert({
              where: {
                organizationId_userId: {
                  organizationId: invitation.organizationId,
                  userId: user.id,
                },
              },
              create: {
                organizationId: invitation.organizationId,
                userId: user.id,
                role: invitation.role,
              },
              update: { role: invitation.role },
            });
            await tx.organizationInvitation.updateMany({
              where: {
                id: invitation.id,
                status: 'PENDING',
                expiresAt: { gt: new Date() },
              },
              data: { status: 'ACCEPTED' },
            });
          }
          return user;
        },
        { isolationLevel: 'Serializable' },
      ),
    );
  }

  private issueToken(
    id: string,
    role: UserRole,
    audience: AuthAudience.CLIENT | AuthAudience.ADMIN,
  ): Promise<{
    message: string;
    audience: AuthAudience.CLIENT | AuthAudience.ADMIN;
    access_token: string;
  }>;
  private issueToken(
    id: string,
    role: UserRole,
    audience: AuthAudience.MOBILE,
  ): Promise<{ message: string; access_token: string }>;
  private async issueToken(id: string, role: UserRole, audience: AuthAudience) {
    const payload = { sub: id, role };
    if (audience === AuthAudience.MOBILE) {
      // Keep the existing Semaphore/mobile token contract unchanged. Mobile
      // tokens contain no web audience and continue using JWT_SECRET.
      return {
        message: 'Authentication successful.',
        access_token: await this.jwtService.signAsync(payload),
      };
    }
    return {
      message: 'Authentication successful.',
      audience,
      access_token: await this.jwtService.signAsync(payload, {
        secret: jwtSecretFor(audience),
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience,
      }),
    };
  }

  async requestOtp(dto: RequestOtpDto) {
    const phone = this.requirePhone(dto.phone);
    // crypto.randomInt is cryptographically secure; Math.random() is not
    const otp = randomInt(100_000, 1_000_000).toString();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const codeHash = this.hashOtp(phone, otp);

    // A serializable transaction and one row per phone make replacement of the
    // active challenge atomic under concurrent requests.
    await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.otpCode.findUnique({ where: { phone } });
          const inWindow =
            existing &&
            now.getTime() - existing.requestWindowStart.getTime() <
              OTP_WINDOW_MS;
          const requestCount = inWindow ? existing.requestCount + 1 : 1;
          if (requestCount > OTP_MAX_REQUESTS_PER_WINDOW) {
            throw new HttpException(
              'Too many OTP requests. Try again later.',
              HttpStatus.TOO_MANY_REQUESTS,
            );
          }
          await tx.otpCode.upsert({
            where: { phone },
            create: {
              phone,
              codeHash,
              expiresAt,
              requestCount: 1,
              requestWindowStart: now,
            },
            update: {
              codeHash,
              expiresAt,
              verified: false,
              attempts: 0,
              requestCount,
              requestWindowStart: inWindow ? existing.requestWindowStart : now,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    try {
      await this.otpSmsService.send(phone, otp);
    } catch {
      // An undelivered code must never remain usable.
      await this.prisma.otpCode.updateMany({
        where: { phone, codeHash, verified: false },
        data: { verified: true },
      });
      this.logger.warn(`OTP delivery failed for ${this.redactPhone(phone)}`);
      throw new ServiceUnavailableException(
        'OTP delivery is temporarily unavailable.',
      );
    }

    return {
      message: 'OTP generated successfully.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = this.requirePhone(dto.phone);
    const codeHash = this.hashOtp(phone, dto.otp);
    const now = new Date();
    const result = await this.withSerializationRetry(async () =>
      this.prisma.$transaction(
        async (tx) => {
          const challenge = await tx.otpCode.findUnique({ where: { phone } });
          const valid =
            challenge &&
            !challenge.verified &&
            challenge.expiresAt > now &&
            challenge.attempts < OTP_MAX_ATTEMPTS &&
            this.hashesMatch(challenge.codeHash, codeHash);

          if (!valid) {
            if (
              challenge &&
              !challenge.verified &&
              challenge.attempts < OTP_MAX_ATTEMPTS
            ) {
              await tx.otpCode.update({
                where: { phone },
                data: { attempts: { increment: 1 } },
              });
            }
            // Do not throw inside this transaction: that would roll back the
            // durable attempt increment and make brute-force limits ineffective.
            return null;
          }

          const consumed = await tx.otpCode.updateMany({
            where: {
              phone,
              codeHash,
              verified: false,
              expiresAt: { gt: now },
              attempts: { lt: OTP_MAX_ATTEMPTS },
            },
            data: { verified: true },
          });
          if (consumed.count !== 1) {
            throw new BadRequestException('Invalid or expired OTP.');
          }
          /*
           * OTP-verified sign-in creates or updates the phone-owned user with
           * the USER role. Admin promotion is no longer derived from the
           * phone number - admin role is set on the User record directly
           * (seed, migration, or a dedicated admin
           * management endpoint). Do NOT overwrite an existing ADMIN role on
           * successful OTP verify.
           */
          return tx.user.upsert({
            where: { phone },
            create: { phone, role: 'USER' },
            update: {}, // preserve existing role
          });
        },
        { isolationLevel: 'Serializable' },
      ),
    );

    if (!result) throw new BadRequestException('Invalid or expired OTP.');

    // Minimal payload — no PII in the token; phone is fetched from DB when needed
    return this.issueToken(result.id, result.role, AuthAudience.MOBILE);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        mobileAuthEmail: true,
        company: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
        role: true,
        staffRole: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      ...user,
      permissions: resolveStaffPermissions(user.role, user.staffRole),
    };
  }

  private requirePhone(phone: string): string {
    const normalized = normalizePhilippineMobile(phone);
    if (!normalized)
      throw new BadRequestException('Enter a valid Philippine mobile number.');
    return normalized;
  }

  private hashOtp(phone: string, otp: string): string {
    const secret = process.env.OTP_HASH_SECRET;
    if (!secret)
      throw new Error('OTP_HASH_SECRET environment variable is not set.');
    return createHmac('sha256', secret).update(`${phone}:${otp}`).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private requireMobileEmailOtpEnabled() {
    if (process.env.MOBILE_OTP_DELIVERY?.trim().toLowerCase() !== 'email') {
      throw new ServiceUnavailableException(
        'Mobile email OTP authentication is not enabled.',
      );
    }
  }

  private isAuthoritativePortalIdentity(
    identity: {
      role: UserRole;
      webRole?: string | null;
      passwordHash: string | null;
      accessRequests: { id: string }[];
      organizationMemberships: { id: string }[];
    } | null,
  ) {
    return Boolean(
      identity &&
      (identity.webRole != null ||
        identity.passwordHash ||
        identity.accessRequests.length > 0 ||
        identity.organizationMemberships.length > 0),
    );
  }

  private emailOtpChallengeKey(
    email: string,
    purpose: EmailOtpPurpose,
    binding?: string,
  ): string {
    const secret = this.emailOtpSecret();
    return createHmac('sha256', secret)
      .update(`${email}:${purpose}:${binding ?? ''}`)
      .digest('hex');
  }

  private hashEmailOtp(
    email: string,
    purpose: EmailOtpPurpose,
    otp: string,
    binding?: string,
  ): string {
    const secret = this.emailOtpSecret();
    return createHmac('sha256', secret)
      .update(`${email}:${purpose}:${binding ?? ''}:${otp}`)
      .digest('hex');
  }

  private emailOtpSecret(): string {
    const secret = process.env.EMAIL_OTP_HASH_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        'Email OTP authentication is not configured.',
      );
    }
    return secret;
  }

  private requireLegacyPasswordAuth() {
    const enabled =
      process.env.NODE_ENV !== 'production' &&
      process.env.ENABLE_LEGACY_PORTAL_PASSWORD_AUTH === 'true';
    if (!enabled) {
      throw new GoneException(
        'Password authentication has been replaced by email verification codes.',
      );
    }
  }

  private hashesMatch(left: string, right: string): boolean {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async withSerializationRetry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await work();
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2034' || attempt === 2)
          throw error;
      }
    }
    throw new Error('Unreachable serialization retry state.');
  }

  private redactPhone(phone: string): string {
    return `${phone.slice(0, 3)}****${phone.slice(-2)}`;
  }

  /*
   * isAdministratorPhone removed: admin role is stored on the User record,
   * not derived from env vars. If you need to promote a user, update
   * User.role in the database.
   */
}
