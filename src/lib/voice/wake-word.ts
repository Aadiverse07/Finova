'use client';

import { useEffect, useState } from 'react';
import { isExplicitCommand } from '@/lib/assistant/voice-intents';
import { hasHindiAlias, isWakeAlias, wakeCommandPattern, wakeCommandPatternHi } from './aliases';

type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

type Listener = (enabled: boolean, listening: boolean) => void;
let state = { enabled: false, listening: false };
let recognition: Recognition | null = null;
let restartTimer: number | null = null;
let failures = 0;
let wakeCooldownUntil = 0;
let wakeSuspended = false;
let wakeTimer: number | null = null;
let latestWakeText = '';
let lastHeard = '';
const heardSubs = new Set<(text: string) => void>();
export function subscribeHeard(fn: (text: string) => void) { heardSubs.add(fn); fn(lastHeard); return () => { heardSubs.delete(fn); }; }
const subscribers = new Set<Listener>();
const emit = () => subscribers.forEach((s) => s(state.enabled, state.listening));
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^a-z\u0900-\u097f0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim();
function distance(a: string, b: string) { const prev = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { const cur = [i]; for (let j = 1; j <= b.length; j++) cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)); for (let j = 0; j <= b.length; j++) prev[j] = cur[j]!; } return prev[b.length]!; }
export function matchesWakePhrase(input: string) {
  const text = normalize(input);
  const phrases = ['hi finova', 'hey finova', 'hai finova', 'हाय फिनोवा', 'हे फिनोवा'];
  if (phrases.some((p) => text.includes(normalize(p)))) return true;
  const words = text.split(' ');
  return words.some((w) => isWakeAlias(w) || (w.length >= 5 && distance(w, 'finova') <= 1)) || hasHindiAlias(text);
}
export function commandFromWake(input: string) {
  const n = normalize(input);
  const take = (re: RegExp) => { const all = [...n.matchAll(re)]; const last = all[all.length - 1]; return last ? (last[1] ?? '').trim() : null; };
  return take(wakeCommandPattern()) ?? take(wakeCommandPatternHi()) ?? '';
}
function createRecognition() {
  const w = window as RecWindow; const Speech = w.SpeechRecognition || w.webkitSpeechRecognition; if (!Speech) return null;
  const r = new Speech(); r.continuous = true; r.interimResults = true; const preferred = localStorage.getItem('finova-ai-language'); r.lang = preferred === 'hi' ? 'hi-IN' : 'en-IN';
  r.onresult = (e) => { const text = Array.from(e.results).map((x) => x[0]?.transcript ?? '').join(' ').trim(); lastHeard = text.slice(-120); heardSubs.forEach((f) => f(lastHeard)); if (Date.now() < wakeCooldownUntil) return; if (!matchesWakePhrase(text)) { /* No wake word: still act on a finished, unmistakable command such as "open expenses". */ const last = e.results[e.results.length - 1]; const finalText = last?.isFinal ? (last[0]?.transcript ?? '').trim() : ''; if (finalText && isExplicitCommand(finalText)) { wakeCooldownUntil = Date.now() + 3000; wakeSuspended = true; window.dispatchEvent(new CustomEvent('finova:wake', { detail: { command: finalText } })); try { r.stop(); } catch {} } return; } latestWakeText = text; if (wakeTimer !== null) clearTimeout(wakeTimer); /* wait for a short pause so "Hi Finova, open dashboard" is captured whole */ wakeTimer = window.setTimeout(() => { wakeTimer = null; wakeCooldownUntil = Date.now() + 5000; wakeSuspended = true; window.dispatchEvent(new CustomEvent('finova:wake', { detail: { command: commandFromWake(latestWakeText) } })); try { r.stop(); } catch {} }, 1300); };
  r.onerror = (e) => { if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') { state.enabled = false; state.listening = false; emit(); return; } state.listening = false; emit(); failures = Math.min(failures + 1, 6); scheduleRestart(); };
  r.onend = () => { state.listening = false; emit(); if (state.enabled && !document.hidden && !wakeSuspended) scheduleRestart(); };
  return r;
}
function scheduleRestart() { if (!state.enabled || document.hidden || restartTimer !== null) return; const delay = Math.min(30_000, 500 * (2 ** failures)); restartTimer = window.setTimeout(() => { restartTimer = null; if (!state.enabled || document.hidden) return; startRecognition(); }, delay); }
function startRecognition() { recognition?.abort(); recognition = createRecognition(); if (!recognition) return; try { recognition.start(); state.listening = true; failures = 0; emit(); } catch { state.listening = false; emit(); scheduleRestart(); } }
export function suspendWakeListening() { if (wakeTimer !== null) { clearTimeout(wakeTimer); wakeTimer = null; } if (!state.enabled) return; wakeSuspended = true; if (restartTimer !== null) { clearTimeout(restartTimer); restartTimer = null; } try { recognition?.abort(); } catch {} state.listening = false; emit(); }
export function resumeWakeListening() { if (!state.enabled) return; wakeSuspended = false; if (document.hidden) return; startRecognition(); }
export function setWakeEnabled(next: boolean) { if (typeof window !== 'undefined') localStorage.setItem('finova-hands-free', String(next)); state.enabled = next; wakeSuspended = false; emit(); if (next) { if (!(window as RecWindow).SpeechRecognition && !(window as RecWindow).webkitSpeechRecognition) { window.dispatchEvent(new CustomEvent('finova:wake-error', { detail: 'Continuous hands-free voice is not supported in this browser. Use Push to talk instead.' })); return; } if (!window.isSecureContext && location.hostname !== 'localhost') { window.dispatchEvent(new CustomEvent('finova:wake-error', { detail: 'Voice hands-free mode requires HTTPS or localhost.' })); return; } startRecognition(); } else { if (restartTimer !== null) { clearTimeout(restartTimer); restartTimer = null; } try { recognition?.abort(); } catch {} recognition = null; wakeSuspended = false; state.listening = false; emit(); } }
export function subscribeWake(listener: Listener) { subscribers.add(listener); listener(state.enabled, state.listening); return () => subscribers.delete(listener); }
export function useWakeWordStatus() { const [value, setValue] = useState(state); useEffect(() => subscribeWake((enabled, listening) => setValue({ enabled, listening })), []); return value; }
export function installWakeWordRuntime() {
  const onVisibility = () => { if (!state.enabled) return; if (document.hidden) { try { recognition?.abort(); } catch {} state.listening = false; emit(); } else startRecognition(); };
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}
export function selectedVoice(language: 'en' | 'hi' | 'hinglish') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices(); const wanted = language === 'hi' ? ['hi-IN', 'hi'] : ['en-IN', 'en-US', 'en-GB', 'en'];
  return voices.find((v) => wanted.some((code) => v.lang.toLowerCase() === code.toLowerCase() || v.lang.toLowerCase().startsWith(`${code.toLowerCase()}-`))) ?? null;
}
export function speakVoice(text: string, language: 'en' | 'hi' | 'hinglish', onState?: (speaking: boolean) => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/[•✅⚠️…]/g, '').replace(/\n+/g, '. ')); u.lang = language === 'hi' ? 'hi-IN' : 'en-IN'; const v = selectedVoice(language); if (v) u.voice = v; u.rate = 1.02; u.onstart = () => onState?.(true); u.onend = () => onState?.(false); u.onerror = () => onState?.(false); window.speechSynthesis.speak(u);
}
