'use client';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAssistantChat } from '@/lib/assistant/chat-store';
import { useI18n } from '@/lib/i18n';
import { useWakeWordStatus } from '@/lib/voice/wake-word';

export function AssistantLauncher({ home = false }: { home?: boolean }) {
  const { setOpen } = useAssistantChat();
  const { t } = useI18n();
  const { enabled, listening } = useWakeWordStatus();
  const [tooltip, setTooltip] = useState(false);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen(true); } }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [setOpen]);
  return <button type="button" className={`assistant-launcher-top ${home ? 'assistant-launcher-home' : ''} ${listening ? 'is-listening' : ''}`} onClick={() => setOpen(true)} onMouseEnter={() => setTooltip(true)} onMouseLeave={() => setTooltip(false)} title={t('assistant.shortcutHint')} aria-label={`${t('assistant.launcher')} (Ctrl or Command J)`}>
    <span className="assistant-launcher-icon"><Sparkles size={17} /><i aria-hidden="true" /></span>
    <span className="assistant-launcher-label">{t('assistant.launcher')}</span><kbd>⌘ J</kbd>
    {enabled && <span className="sr-only">{listening ? t('voice.listening') : t('voice.handsFreeOff')}</span>}
    {tooltip && <span className="assistant-tooltip" role="tooltip">{t('assistant.shortcutHint')}</span>}
  </button>;
}
