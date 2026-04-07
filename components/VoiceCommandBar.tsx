"use client";

import { useState, useRef, useCallback } from "react";
import VoicePreview from "@/components/voice/VoicePreview";

interface VoiceResult {
  voiceCommandId: string;
  id?: string; // backward compat
  intent: string;
  entities: Record<string, string>;
  response: string;
  action?: string | null;
  confidence: number;
  needsClarification?: boolean;
  clarification_options?: string[];
  clarificationOptions?: string[];
  englishPreview?: string | null;
  requiresConfirmation?: boolean;
  timing?: { totalMs: number; classifyMs: number };
}

interface ExecutionResult {
  success: boolean;
  action: string;
  message: string;
  requiresConfirmation?: boolean;
  data?: Record<string, unknown>;
}

export default function VoiceCommandBar() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition is not supported in your browser. Use Chrome for best results.");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setResult(null);
      setError(null);
      setTranscript("");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }

      setTranscript(final || interim);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-submit if we got a final transcript
      if (transcript.trim()) {
        processCommand(transcript);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setIsListening(false);
      setError(`Speech error: ${event.error}`);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [transcript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  async function processCommand(command: string) {
    if (!command.trim()) return;

    setProcessing(true);
    setError(null);
    setExecutionResult(null);

    try {
      const res = await fetch("/api/voice-command/v2/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: command }),
      });

      if (!res.ok) {
        throw new Error("Voice command processing failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7);
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === "intent") {
                // Show intent immediately for perceived speed
                setResult((prev) => ({
                  voiceCommandId: prev?.voiceCommandId || "",
                  intent: data.intent,
                  entities: prev?.entities || {},
                  response: "Processing...",
                  confidence: data.confidence,
                  needsClarification: data.needsClarification,
                }));
              } else if (currentEvent === "response") {
                setResult((prev) => prev ? {
                  ...prev,
                  response: data.response,
                  action: data.action,
                  clarificationOptions: data.clarificationOptions,
                } : null);
              } else if (currentEvent === "complete") {
                setResult(data);
              } else if (currentEvent === "error") {
                setError(data.message);
              }
            } catch { /* skip malformed events */ }
            currentEvent = "";
          }
        }
      }
    } catch {
      setError("Failed to process voice command. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  async function executeVoiceAction(confirmed: boolean = false) {
    if (!result) return;
    setExecuting(true);
    setError(null);

    try {
      const res = await fetch("/api/voice-command/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceCommandId: result.voiceCommandId || result.id,
          intent: result.intent,
          entities: result.entities,
          confirmed,
        }),
      });

      if (!res.ok) throw new Error("Execution failed");

      const data: ExecutionResult = await res.json();

      if (data.requiresConfirmation) {
        // Show confirmation — user must click again
        setExecutionResult(data);
      } else {
        setExecutionResult(data);
        if (data.success) {
          // Clear voice input after successful execution
          setTimeout(() => {
            setResult(null);
            setExecutionResult(null);
            setTranscript("");
          }, 3000);
        }
      }
    } catch {
      setError("Failed to execute command. Please try again.");
    } finally {
      setExecuting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && transcript.trim()) {
      processCommand(transcript);
    }
  }

  const showPreview =
    !!result &&
    result.requiresConfirmation === true &&
    !!result.englishPreview &&
    !executionResult;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* English Preview Card — shown for mutating intents before execution */}
      {showPreview && result && (
        <div className="max-w-3xl mx-auto px-6 mb-2">
          <VoicePreview
            intent={result.intent}
            preview={result.englishPreview as string}
            executing={executing}
            onAccept={() => executeVoiceAction(true)}
            onEdit={() => {
              // Let the user re-speak or edit. Keep the transcript in the box.
              setResult(null);
              setExecutionResult(null);
            }}
            onCancel={() => {
              setResult(null);
              setExecutionResult(null);
              setTranscript("");
            }}
          />
        </div>
      )}

      {/* Result Card (for non-preview intents or post-execution messages) */}
      {result && !showPreview && (
        <div className="max-w-7xl mx-auto px-6 mb-2">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider">
                    {result.intent}
                  </p>
                  {result.timing && (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {(result.timing.totalMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                <p className="text-white mt-1">{result.response}</p>
                {result.needsClarification && (result.clarification_options || result.clarificationOptions) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(result.clarificationOptions || result.clarification_options || []).map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setResult(null);
                          setTranscript(opt.replace(/^Try:\s*/i, ""));
                          processCommand(opt.replace(/^Try:\s*/i, ""));
                        }}
                        className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-xs text-zinc-300 transition-colors"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                {executionResult ? (
                  <div className={`mt-3 px-4 py-2 rounded-lg text-sm font-semibold ${
                    executionResult.success ? "bg-green-800 text-green-200" :
                    executionResult.requiresConfirmation ? "bg-yellow-800 text-yellow-200" :
                    "bg-red-800 text-red-200"
                  }`}>
                    {executionResult.message}
                    {executionResult.requiresConfirmation && (
                      <button
                        onClick={() => executeVoiceAction(true)}
                        disabled={executing}
                        className="ml-3 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 rounded text-sm text-white disabled:opacity-50"
                      >
                        {executing ? "Executing..." : "Yes, confirm"}
                      </button>
                    )}
                  </div>
                ) : result.action ? (
                  <button
                    onClick={() => executeVoiceAction(false)}
                    disabled={executing}
                    className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {executing ? "Executing..." : `Confirm: ${result.action}`}
                  </button>
                ) : null}
              </div>
              <button
                onClick={() => setResult(null)}
                className="text-zinc-500 hover:text-white"
              >
                &#10005;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 mb-2">
          <div className="bg-red-950/80 border border-red-800 rounded-xl p-3 text-red-300 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Command Bar */}
      <div className="bg-zinc-900 border-t border-zinc-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={processing}
            className={`p-3 rounded-full transition-all ${
              isListening
                ? "bg-red-600 animate-pulse shadow-lg shadow-red-600/30"
                : "bg-blue-600 hover:bg-blue-700"
            } disabled:opacity-50`}
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>

          <div className="flex-1 relative">
            <input
              type="text"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? "Listening..."
                  : 'Say or type a command... "Create addendum for 123 Main St"'
              }
              className="w-full bg-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {processing && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <button
            onClick={() => processCommand(transcript)}
            disabled={!transcript.trim() || processing}
            className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// Add type declarations for Web Speech API
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}
