'use client';
import { useEffect, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { FinancialAssistant } from '@/components/financial-assistant';
import { WakeWordRuntime } from '@/components/wake-word-runtime';
import { useAssistantChat } from '@/lib/assistant/chat-store';
import { setWakeEnabled, subscribeHeard, useWakeWordStatus } from '@/lib/voice/wake-word';

/** Mounted once in the root layout so "Finova ..." works on every page and survives navigation. */
export function GlobalVoiceAssistant() {
  return <><FinancialAssistant /><WakeWordRuntime /><VoiceChip /></>;
}

/** Tiny status pill: shows whether Finova is listening and what the browser last heard (helps when a word is misrecognised). */
function VoiceChip() {
  const { enabled, listening } = useWakeWordStatus();
  const open = useAssistantChat((s) => s.open);
  const [heard, setHeard] = useState('');
  useEffect(() => subscribeHeard(setHeard), []);
  useEffect(() => { if (!heard) return; const id = window.setTimeout(() => setHeard(''), 6000); return () => window.clearTimeout(id); }, [heard]);
  if (open) return null;
  if (!enabled) return <button type="button" className="voice-chip off" onClick={() => setWakeEnabled(true)}><MicOff size={14} /> Voice is off. Click to enable &ldquo;Finova&rdquo;</button>;
  return <div className="voice-chip" role="status"><span className={`voice-dot ${listening ? 'on' : ''}`} /><Mic size={14} />{heard ? <span className="voice-heard">&ldquo;{heard}&rdquo;</span> : <span>{listening ? 'Listening: say “Finova, open expenses”' : 'Voice paused'}</span>}</div>;
}
