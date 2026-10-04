import type { Workspace } from '@/lib/assistant/engine';

export type VoiceMutationAudit = { action: string; transcript: string; confirmed: boolean; entityId?: string };

export function auditVoiceMutation(value: VoiceMutationAudit): void {
  if (typeof window === 'undefined') return;
  void fetch('/api/assistant/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
    keepalive: true,
  }).catch(() => undefined);
}

export function cloneWorkspaceForUndo(workspace: Workspace): Workspace {
  return {
    accounts: [...workspace.accounts],
    entries: [...workspace.entries],
    invoices: [...workspace.invoices],
    expenses: [...workspace.expenses],
  };
}
