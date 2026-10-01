import { shieldCan, shieldCapabilities } from './member-capabilities';

// Pinned so any change to the manuscript-derived matrix is deliberate and
// reviewed (docs/backend/ACCESS_LIFECYCLE_AUDIT_2026-09-29.md §A.4).
describe('Shield capability set', () => {
  it('allows only subscriber intelligence, scoped export, keys, and billing', () => {
    expect(shieldCapabilities().sort()).toEqual(
      [
        'exportData',
        'manageApiKeys',
        'readIntelligence',
        'viewBilling',
        'viewWorkspace',
      ].sort(),
    );
  });

  it.each(['readReports', 'manageMembers', 'manageWorkspace'] as const)(
    'denies the retired portal capability %s',
    (capability) => expect(shieldCan(capability)).toBe(false),
  );
});
