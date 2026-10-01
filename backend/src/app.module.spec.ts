import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * JwtAuthGuard fails closed when PortalRoutePolicy is missing, so forgetting
 * to register these modules would turn every signed-in request into a 500.
 * Guard/e2e specs build their own providers and would not notice. AppModule
 * cannot be imported here (the unit-test setup stubs Passport), so the
 * registration is checked in the module source.
 */
describe('AppModule wiring', () => {
  it('registers the central authorization, audit, and account modules', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app.module.ts'),
      'utf8',
    );
    const importsBlock = /imports:\s*\[([\s\S]*?)\n\s*\],/.exec(source)?.[1];
    expect(importsBlock).toBeDefined();
    for (const moduleName of [
      'AuthModule',
      'AccessControlModule',
      'AuditModule',
      'AccountModule',
    ]) {
      expect(importsBlock).toMatch(new RegExp(`^\\s*${moduleName},`, 'm'));
    }
  });
});
