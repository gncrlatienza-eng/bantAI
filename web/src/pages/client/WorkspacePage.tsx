/*
 * Workspace Management Page — Self-service workspace management for client tenants.
 * Features: Members list, invitations, member removal, ownership transfer,
 * license status, and billing history.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  ErrorState,
  Input,
  LoadingState,
  StatusBadge,
} from '../../components/primitives';
import {
  getMyWorkspace,
  inviteWorkspaceMember,
  revokeWorkspaceInvitation,
  removeWorkspaceMember,
  transferWorkspaceOwnership,
  getWorkspaceBilling,
  type WorkspaceDetailsResponse,
  type WorkspaceMember,
  type BillingDetailsResponse,
} from '../../services/workspaceService';
import { logout } from '../../services/authService';
import { CLIENT_SIDEBAR_GROUPS } from './clientNav';
import { CommerceDisclosuresCard } from '../../components/common/CommerceDisclosuresCard';

export function WorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [data, setData] = useState<WorkspaceDetailsResponse | null>(null);
  const [billing, setBilling] = useState<BillingDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'TIER_1' | 'TIER_2'>('TIER_2');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Transfer ownership modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const workspaceData = await getMyWorkspace();
      setData(workspaceData);

      if (
        workspaceData.organization.myRole === 'TIER_1' ||
        workspaceData.organization.isOwner
      ) {
        try {
          const billingData = await getWorkspaceBilling();
          setBilling(billingData);
        } catch {
          // Non-blocking billing failure
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load workspace data.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showInviteModal) setShowInviteModal(false);
        if (showTransferModal) setShowTransferModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInviteModal, showTransferModal]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    setInviteError(null);
    try {
      const res = await inviteWorkspaceMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setActionSuccess(res.message);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('TIER_2');
      void loadData();
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : 'Failed to send invitation.',
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemove = async (member: WorkspaceMember) => {
    const confirmName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email;
    if (!window.confirm(`Are you sure you want to remove ${confirmName} from the workspace?`)) {
      return;
    }

    try {
      const res = await removeWorkspaceMember(member.userId);
      setActionSuccess(res.message);
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member.');
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetId) return;

    setTransferLoading(true);
    setTransferError(null);
    try {
      const res = await transferWorkspaceOwnership(transferTargetId);
      setActionSuccess(res.message);
      setShowTransferModal(false);
      setTransferTargetId('');
      void loadData();
    } catch (err) {
      setTransferError(
        err instanceof Error ? err.message : 'Failed to transfer ownership.',
      );
    } finally {
      setTransferLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell
        role="client"
        groups={CLIENT_SIDEBAR_GROUPS}
        brandInitial="B"
        brandLabel="BantAI"
        currentPath={location.pathname}
        onNavigate={(p) => void navigate(p)}
      >
        <LoadingState label="Loading workspace and membership information…" />
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell
        role="client"
        groups={CLIENT_SIDEBAR_GROUPS}
        brandInitial="B"
        brandLabel="BantAI"
        currentPath={location.pathname}
        onNavigate={(p) => void navigate(p)}
      >
        <ErrorState
          title="Workspace Unavailable"
          description={error || 'Unable to retrieve workspace data.'}
          action={
            <Button variant="secondary" onClick={() => void loadData()}>
              Retry
            </Button>
          }
        />
      </AppShell>
    );
  }

  const { organization, members, pendingInvitations } = data;
  const canManage = organization.myRole === 'TIER_1' || organization.isOwner;

  return (
    <AppShell
      role="client"
      groups={CLIENT_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI"
      currentPath={location.pathname}
      onNavigate={(p) => void navigate(p)}
      topbarContext={<span>Operations &middot; Workspace</span>}
      topbarUtility={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            logout();
            void navigate('/login');
          }}
        >
          Sign out
        </Button>
      }
      footer={
        <span style={{ fontSize: '0.85rem' }}>
          Workspace &middot; {organization.name}
        </span>
      }
    >
      <PageHeader
        title="Workspace Management"
        description="Manage workspace members, invitations, license status, and billing history."
      />

      {actionSuccess && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--status-success, #16a34a)',
            color: 'var(--text-primary)',
            borderRadius: 8,
            marginBottom: 20,
            fontSize: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✓ {actionSuccess}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActionSuccess(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* License & Quota Overview Card */}
      <section
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          padding: '20px 24px',
          marginBottom: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 20,
        }}
      >
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 4 }}>
            WORKSPACE NAME
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {organization.name}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            Your Role: <StatusBadge kind="verified" label={organization.myRole} />
            {organization.isOwner && (
              <span style={{ marginLeft: 6 }}>
                <StatusBadge kind="suspicious" label="Owner" />
              </span>
            )}
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 4 }}>
            LICENSE TIER
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {organization.license.tier}
            </span>
            <StatusBadge kind="verified" label={organization.license.status} />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            Period: {organization.license.billingPeriod}
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 4 }}>
            SEAT UTILIZATION
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {organization.seatsUsed} / {organization.seatLimit} Seats
          </div>
          <div
            style={{
              width: '100%',
              height: 6,
              background: 'var(--border-default)',
              borderRadius: 3,
              marginTop: 6,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, (organization.seatsUsed / organization.seatLimit) * 100)}%`,
                height: '100%',
                background:
                  organization.seatsUsed >= organization.seatLimit
                    ? 'var(--status-critical, #dc2626)'
                    : 'var(--accent-primary, #0284c7)',
              }}
            />
          </div>
        </div>
      </section>

      {/* Members Section */}
      <section style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Workspace Members ({members.length})
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Colleagues enrolled in this workspace tenant.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {organization.isOwner && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowTransferModal(true)}
              >
                Transfer Ownership
              </Button>
            )}
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowInviteModal(true)}
              >
                + Invite Member
              </Button>
            )}
          </div>
        </div>

        <DataTable<WorkspaceMember>
          ariaLabel="Workspace members"
          rowKey={(m) => m.id}
          rows={members}
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (m: WorkspaceMember) =>
                `${m.firstName || ''} ${m.lastName || ''}`.trim() || '—',
            },
            {
              key: 'email',
              header: 'Email',
              render: (m: WorkspaceMember) => m.email || '—',
            },
            {
              key: 'role',
              header: 'Workspace Role',
              render: (m: WorkspaceMember) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StatusBadge kind="unknown" label={m.role} />
                  {m.isOwner && <StatusBadge kind="suspicious" label="Owner" />}
                </div>
              ),
            },
            {
              key: 'joined',
              header: 'Joined Date',
              render: (m: WorkspaceMember) =>
                new Date(m.joinedAt).toLocaleDateString(),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (m: WorkspaceMember) => {
                if (m.isOwner) {
                  return (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Workspace Owner
                    </span>
                  );
                }
                if (!canManage) {
                  return <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>—</span>;
                }
                return (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRemove(m)}
                    style={{ color: 'var(--status-critical, #dc2626)' }}
                  >
                    Remove
                  </Button>
                );
              },
            },
          ]}
        />
      </section>

      {/* Pending Invitations Section */}
      {pendingInvitations.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
            Pending Invitations ({pendingInvitations.length})
          </h2>
          <DataTable
            ariaLabel="Pending workspace invitations"
            rowKey={(inv) => inv.id}
            rows={pendingInvitations}
            columns={[
              { key: 'email', header: 'Invited Email', render: (inv) => inv.email },
              {
                key: 'role',
                header: 'Assigned Role',
                render: (inv) => <StatusBadge kind="unknown" label={inv.role} />,
              },
              {
                key: 'status',
                header: 'Status',
                render: (inv) => <StatusBadge kind="verified" label={inv.status} />,
              },
              {
                key: 'expires',
                header: 'Expires',
                render: (inv) => new Date(inv.expiresAt).toLocaleDateString(),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (inv) =>
                  canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (window.confirm(`Revoke invitation for ${inv.email}?`)) {
                          try {
                            const res = await revokeWorkspaceInvitation(inv.id);
                            setActionSuccess(res.message);
                            void loadData();
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to revoke invitation.');
                          }
                        }
                      }}
                      style={{ color: 'var(--status-critical, #dc2626)' }}
                    >
                      Revoke
                    </Button>
                  ) : null,
              },
            ]}
          />
        </section>
      )}

      {/* Billing History Section (Visible to TIER_1 and Owner) */}
      {canManage && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
            Billing & Invoices
          </h2>
          {billing ? (
            <div
              style={{
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-default)',
                borderRadius: 8,
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {billing.currentPlan}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Status: {billing.status} &middot; Billing: {billing.billingPeriod}
                  </div>
                </div>
                {billing.nextBillingDate && (
                  <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Next Renewal: </span>
                    <strong>{new Date(billing.nextBillingDate).toLocaleDateString()}</strong>
                  </div>
                )}
              </div>

              {billing.invoices.length > 0 ? (
                <DataTable
                  ariaLabel="Workspace invoice history"
                  rowKey={(inv) => inv.id}
                  rows={billing.invoices}
                  columns={[
                    { key: 'id', header: 'Invoice ID', render: (inv) => inv.id },
                    {
                      key: 'date',
                      header: 'Date',
                      render: (inv) => new Date(inv.date).toLocaleDateString(),
                    },
                    {
                      key: 'amount',
                      header: 'Amount',
                      render: (inv) =>
                        `₱${(inv.amount / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (inv) => <StatusBadge kind="verified" label={inv.status} />,
                    },
                  ]}
                />
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  No past invoices recorded for this billing cycle.
                </div>
              )}

              <CommerceDisclosuresCard
                tier={organization.license.tier}
                billingPeriod={organization.license.billingPeriod === 'MONTHLY' ? 'MONTHLY' : 'ANNUAL'}
                compact={true}
              />
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Billing information is not configured for this workspace.
            </div>
          )}
        </section>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface-overlay, #18181b)',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 440,
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h3 id="invite-modal-title" style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              Invite Colleague to Workspace
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Assign an organization tier. Platform and staff privileges cannot be assigned here.
            </p>

            {inviteError && (
              <div style={{ color: 'var(--status-critical, #dc2626)', fontSize: '0.85rem', marginBottom: 12 }}>
                {inviteError}
              </div>
            )}

            <form onSubmit={(e) => void handleInvite(e)}>
              <div style={{ marginBottom: 16 }}>
                <Input
                  label="Colleague's Email Address"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@yourcompany.com"
                  required
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Workspace Membership Tier
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'TIER_1' | 'TIER_2')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="TIER_2">TIER_2 (Standard Member &middot; View Only)</option>
                  <option value="TIER_1">TIER_1 (Workspace Lead &middot; Invite & Manage)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowInviteModal(false)}
                  disabled={inviteLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={inviteLoading}>
                  {inviteLoading ? 'Sending…' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface-overlay, #18181b)',
              border: '1px solid var(--border-default)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 440,
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h3 id="transfer-modal-title" style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              Transfer Workspace Ownership
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Select an active member to become the new Workspace Owner. You will remain a TIER_1 member.
            </p>

            {transferError && (
              <div style={{ color: 'var(--status-critical, #dc2626)', fontSize: '0.85rem', marginBottom: 12 }}>
                {transferError}
              </div>
            )}

            <form onSubmit={(e) => void handleTransferOwnership(e)}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Select New Owner
                </label>
                <select
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--surface-raised)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="">— Select a member —</option>
                  {members
                    .filter((m) => !m.isOwner)
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {`${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email} ({m.email})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowTransferModal(false)}
                  disabled={transferLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={transferLoading || !transferTargetId}
                >
                  {transferLoading ? 'Transferring…' : 'Confirm Transfer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default WorkspacePage;
