import { PORTAL_ROUTE_KEY } from '../access-control/portal-route.decorator';
import { PortalOrganizationsCustomerController as Controller } from './portal-organizations-customer.controller';

describe('Customer workspace endpoint capabilities', () => {
  it.each([
    ['inviteMember', 'manageMembers'],
    ['revokeInvitation', 'manageMembers'],
    ['removeMember', 'manageMembers'],
    ['transferOwnership', 'manageWorkspace'],
    ['getMyBilling', 'viewBilling'],
  ])('declares the required capability for %s', (method, capability) => {
    const rule = Reflect.getMetadata(
      PORTAL_ROUTE_KEY,
      Controller.prototype[method],
    );
    expect(rule).toMatchObject({ kind: 'licensed', capability });
  });
});
