"use client";

import { useState } from "react";
import { apiPost, ApiClientError } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { Bot, Check, Copy, KeyRound, Loader2, ShieldCheck, X } from "lucide-react";

/**
 * OWNER: UI · Register a new agent.
 *
 * Registering an agent does not create a wallet or a key pair. It creates an identity, an API key
 * and a starting policy — the signer stays behind the Guard, which is the reason an agent cannot
 * route around it. The form says so, because "where is its wallet?" is the first question anyone
 * asks and the answer is the architecture.
 *
 * The plaintext API key comes back exactly once. The success step therefore does not auto-close.
 */

interface CreatedAgent {
  agent: { agentId: string; name: string };
  policy?: { version: number };
  apiKey: string;
}

export function CreateAgentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allowanceCapUsd, setAllowanceCapUsd] = useState("25.00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedAgent | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError("Give the agent a name.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<CreatedAgent>(API.agents, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        allowanceCapUsd,
        createdByEmail: "operator@aspg.dev",
      });
      setCreated(result);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Could not create the agent.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyKey = async () => {
    if (!created?.apiKey) return;
    try {
      await navigator.clipboard.writeText(created.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is permission-gated; the key is on screen and selectable either way.
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <Bot className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            {created ? "Agent registered" : "Register a new agent"}
          </h2>
          <button onClick={onClose} className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {created ? (
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">{created.agent.name}</span> is active on policy v
              {created.policy?.version ?? 1}.
            </p>

            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800">
                <KeyRound className="h-4 w-4" /> Guard API key — shown once
              </h3>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800">
                  {created.apiKey}
                </code>
                <button
                  onClick={copyKey}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-2 text-xs text-amber-800">
                Stored as a hash. It cannot be retrieved again — only rotated.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PricingBot"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Monitors competitor pricing APIs"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wallet allowance cap (USD)</span>
              <input
                value={allowanceCapUsd}
                onChange={(e) => setAllowanceCapUsd(e.target.value)}
                inputMode="decimal"
                className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-800"
              />
            </label>

            <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <p>
                Starts on the <span className="font-semibold">conservative</span> policy — an agent is
                never registered without one. It signs with the Guard&apos;s wallet and never holds a
                private key, so it cannot pay around the policy you set.
              </p>
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create agent
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
