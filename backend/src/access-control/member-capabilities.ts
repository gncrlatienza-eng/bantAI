/** One capability set for every active Shield subscriber. */
export type MemberCapability =
  | 'viewWorkspace'
  | 'readIntelligence'
  | 'readReports'
  | 'exportData'
  | 'manageMembers'
  | 'manageApiKeys'
  | 'viewBilling'
  | 'manageWorkspace';

const SHIELD_CAPABILITIES = new Set<MemberCapability>([
  'viewWorkspace',
  'readIntelligence',
  'exportData',
  'manageApiKeys',
  'viewBilling',
]);

export function shieldCan(capability: MemberCapability): boolean {
  return SHIELD_CAPABILITIES.has(capability);
}

export function shieldCapabilities(): MemberCapability[] {
  return [...SHIELD_CAPABILITIES];
}
