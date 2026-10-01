import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppShell, PageHeader } from '../../components/appshell/AppShell';
import {
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Metric,
  MetricRow,
  StatusBadge,
  type Column,
} from '../../components/primitives';
import {
  createSafetyTip,
  deleteSafetyTip,
  getAdminTips,
  updateSafetyTip,
  type SafetyTip,
  type SafetyTipInput,
} from '../../services/tipsService';
import { ADMIN_SIDEBAR_GROUPS } from './adminNav';

const EMPTY_DRAFT: SafetyTipInput = {
  title: '',
  body: '',
  region: '',
  campaign: '',
  isPublished: false,
};
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'The backend request failed.';
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
}

export function TipsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tips, setTips] = useState<SafetyTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<SafetyTipInput>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<SafetyTip | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<SafetyTip | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTips(await getAdminTips());
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const publishedCount = useMemo(
    () => tips.filter((tip) => tip.isPublished).length,
    [tips],
  );
  function closeEditor() {
    if (!busy) {
      setEditorOpen(false);
      setEditing(null);
      setDraft(EMPTY_DRAFT);
      setActionError(null);
    }
  }
  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setActionError(null);
    setEditorOpen(true);
  }
  function openEdit(tip: SafetyTip) {
    setEditing(tip);
    setDraft({
      title: tip.title,
      body: tip.body,
      region: tip.region ?? '',
      campaign: tip.campaign ?? '',
      isPublished: tip.isPublished,
    });
    setActionError(null);
    setEditorOpen(true);
  }
  async function save() {
    if (!draft.title.trim() || !draft.body.trim()) {
      setActionError('A title and guidance text are required.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const input: SafetyTipInput = {
        ...draft,
        region: draft.region?.trim() || null,
        campaign: draft.campaign?.trim() || null,
      };
      const saved = editing
        ? await updateSafetyTip(editing.id, input)
        : await createSafetyTip(input);
      setTips((current) =>
        editing
          ? current.map((tip) => (tip.id === saved.id ? saved : tip))
          : [saved, ...current],
      );
      setEditorOpen(false);
      setEditing(null);
      setDraft(EMPTY_DRAFT);
      setActionError(null);
    } catch (caught) {
      setActionError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteSafetyTip(deleting.id);
      setTips((current) => current.filter((tip) => tip.id !== deleting.id));
      setDeleting(null);
    } catch (caught) {
      setActionError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<SafetyTip>[] = [
    {
      key: 'title',
      header: 'Guidance',
      render: (tip) => (
        <span>
          <strong>{tip.title}</strong>
          <span
            style={{
              display: 'block',
              marginTop: 3,
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
            }}
          >
            {tip.body}
          </span>
        </span>
      ),
      truncate: true,
    },
    {
      key: 'audience',
      header: 'Targeting',
      render: (tip) =>
        [tip.region, tip.campaign].filter(Boolean).join(' · ') || 'All clients',
      width: '20%',
      truncate: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (tip) => (
        <StatusBadge
          kind={tip.isPublished ? 'verified' : 'unknown'}
          label={tip.isPublished ? 'Published' : 'Draft'}
        />
      ),
      width: '14%',
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (tip) => formatDate(tip.updatedAt),
      width: '13%',
      align: 'right',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (tip) => (
        <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <Button size="sm" variant="ghost" onClick={() => openEdit(tip)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleting(tip)}>
            Delete
          </Button>
        </span>
      ),
      width: '15%',
      align: 'right',
    },
  ];

  return (
    <AppShell
      role="admin"
      groups={ADMIN_SIDEBAR_GROUPS}
      brandInitial="B"
      brandLabel="BantAI Admin"
      currentPath={location.pathname}
      onNavigate={(path) => void navigate(path)}
      topbarContext={<span>Administration &middot; Tips</span>}
      footer={<span style={{ fontSize: '0.85rem' }}>Authenticated admin</span>}
    >
      <PageHeader
        title="Safety tips"
        description="Publish practical smishing-safety guidance to mobile clients. These records never include message bodies, model details, or training data."
        actions={<Button onClick={openCreate}>Create tip</Button>}
      />
      {error && !loading ? (
        <ErrorState
          title="Tips unavailable"
          description={error}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : loading ? (
        <LoadingState label="Loading safety tips" />
      ) : (
        <>
          <MetricRow columns={2}>
            <Metric label="Total tips" value={tips.length.toLocaleString()} />
            <Metric label="Published" value={publishedCount.toLocaleString()} />
          </MetricRow>
          <div style={{ marginTop: 20 }}>
            <DataTable
              ariaLabel="Safety tips"
              rowKey={(tip) => tip.id}
              rows={tips}
              columns={columns}
              emptyState={
                <EmptyState
                  title="No safety tips yet"
                  description="Create a draft, then publish it when the guidance is ready for mobile clients."
                  action={<Button onClick={openCreate}>Create tip</Button>}
                />
              }
            />
          </div>
        </>
      )}
      <Dialog
        open={editorOpen}
        title={editing ? 'Edit safety tip' : 'Create safety tip'}
        onClose={closeEditor}
        actions={
          <>
            <Button variant="secondary" disabled={busy} onClick={closeEditor}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save tip'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <Input
            label="Title"
            value={draft.title}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            maxLength={120}
            required
          />
          <label className="bantai-p-field">
            <span className="bantai-p-field__label">Guidance</span>
            <textarea
              className="bantai-p-input"
              value={draft.body}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  body: event.target.value,
                }))
              }
              rows={5}
              maxLength={2000}
              required
            />
          </label>
          <Input
            label="Region (optional)"
            value={draft.region ?? ''}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                region: event.target.value,
              }))
            }
          />
          <Input
            label="Campaign (optional)"
            value={draft.campaign ?? ''}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                campaign: event.target.value,
              }))
            }
          />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={draft.isPublished}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  isPublished: event.target.checked,
                }))
              }
            />
            Publish this guidance to mobile clients
          </label>
          {actionError && (
            <p
              role="alert"
              style={{ color: 'var(--status-threat)', margin: 0 }}
            >
              {actionError}
            </p>
          )}
        </div>
      </Dialog>
      <Dialog
        open={deleting !== null}
        title="Delete safety tip?"
        description={
          deleting
            ? `“${deleting.title}” will be permanently removed from the guidance list.`
            : undefined
        }
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive-confirm"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? 'Deleting…' : 'Delete tip'}
            </Button>
          </>
        }
      />
    </AppShell>
  );
}

export default TipsPage;
