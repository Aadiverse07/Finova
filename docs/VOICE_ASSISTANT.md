# Finova Voice Assistant

## Behaviour
Finova exposes an opt-in hands-free mode that listens for `Hi Finova`, `Hey Finova`, `Hai Finova`, and Hindi wake phrases. Wake matching runs in the browser with fuzzy matching for common Finova misrecognitions. The background listener pauses while a command is actively being captured, then resumes.

Read-only queries execute immediately against the current Finova workspace. Write actions are represented as typed assistant actions and require visible confirmation before the Zustand mutation. The model is never given permission to execute SQL, JavaScript, or arbitrary tools.

## Privacy disclosure
The wake check is performed in the browser, but the Web Speech Recognition implementation exposed by the browser may use a browser/platform speech service. Finova does not record raw microphone audio itself. Users must explicitly enable hands-free mode, the microphone indicator remains visible, and the mode can be turned off at any time. Browser speech services can have their own processing policies; production deployments should use a tested on-device wake engine and a documented Indian-language STT/TTS provider when those requirements are strict.

## Browser fallback
Browsers without SpeechRecognition receive a clear notice and can use the assistant's push-to-talk or typed input. Voice requires HTTPS or localhost.

## Environment flags
`FINOVA_WAKE_ENGINE=browser` is the current implementation seam. A future on-device Porcupine/openWakeWord adapter can implement the same service interface. `FINOVA_VOICE_TELEMETRY=false` keeps privacy-safe voice telemetry disabled by default.
