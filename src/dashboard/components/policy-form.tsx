"use client";

import { useState } from "react";
import type { PolicyRules } from "@/shared/types";
import { apiPost, ApiClientError } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import {
  DollarSign,
  Zap,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Bug,
  Shield,
} from "lucide-react";

export function PolicyForm({
  agentId = "agent_researchbot",
  initialRules,
  onVersionCreated,
  onRulesChange,
  onSimulateClick,
}: {
  agentId?: string;
  initialRules?: PolicyRules;
  onVersionCreated?: () => void;
  onRulesChange?: (rules: PolicyRules) => void;
  onSimulateClick?: () => void;
}) {
  const defaultRules: PolicyRules = {
    financial: {
      maxPerTransactionUsd: "0.10",
      hourlyBudgetUsd: "1.00",
      dailyBudgetUsd: "5.00",
      monthlyBudgetUsd: "50.00",
    },
    merchant: {
      allowedMerchants: ["localhost:3000"],
      blockedMerchants: ["rogue.example.com"],
      pinnedRecipients: { "localhost:3000": "0x9a2B4c6D8e0F1a3B5c7D9e1F2a4B6c8D0e2F4a6B" },
      unknownMerchantAction: "BLOCK",
      enforceRecipientPinning: true,
    },
    velocity: {
      maxTxPerMinute: 10,
      maxTxPerHour: 100,
      maxTxPerMerchantPerMinute: 5,
    },
    rail: {
      allowedNetworks: ["algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="],
      allowedAssets: ["USDC"],
    },
    risk: {
      autoApproveBelowUsd: "0.10",
      holdBetweenUsd: ["0.10", "1.00"],
      blockAboveUsd: "1.00",
      riskHoldScore: 30,
      riskBlockScore: 60,
    },
  };

  const [rules, setRulesState] = useState<PolicyRules>(initialRules || defaultRules);

  const updateRules = (newRules: PolicyRules) => {
    setRulesState(newRules);
    if (onRulesChange) onRulesChange(newRules);
  };

  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      await apiPost(API.policies, {
        agentId,
        rules,
      });
      setSuccessMessage("New immutable policy version created and applied to gateway!");
      if (onVersionCreated) onVersionCreated();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError(err instanceof Error ? err.message : "Validation failed on server.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestInvalid = async () => {
    setSaving(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      // Intentionally invalid: max per tx ($5.00) > hourly budget ($1.00)
      await apiPost(API.policies, {
        agentId,
        rules: {
          ...rules,
          financial: {
            ...rules.financial,
            maxPerTransactionUsd: "5.00",
            hourlyBudgetUsd: "1.00",
          },
        },
      });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message);
      } else {
        setServerError(err instanceof Error ? err.message : "Validation rejected.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Server Validation Error Banner (Server's exact message) */}
      {serverError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 shadow-sm flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-xs uppercase tracking-wider text-rose-950 font-mono">
              Server Validation Error
            </h4>
            <p className="text-xs text-rose-800 font-medium">{serverError}</p>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold">{successMessage}</span>
        </div>
      )}

      {/* 1. Financial Rules */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          Financial Limits (USD)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-zinc-500 font-medium">Max Per Tx ($)</label>
            <input
              type="text"
              value={rules.financial.maxPerTransactionUsd}
              onChange={(e) =>
                updateRules({
                  ...rules,
                  financial: { ...rules.financial, maxPerTransactionUsd: e.target.value },
                })
              }
              className="mt-1 w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium">Hourly Ceiling ($)</label>
            <input
              type="text"
              value={rules.financial.hourlyBudgetUsd}
              onChange={(e) =>
                updateRules({
                  ...rules,
                  financial: { ...rules.financial, hourlyBudgetUsd: e.target.value },
                })
              }
              className="mt-1 w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium">Daily Ceiling ($)</label>
            <input
              type="text"
              value={rules.financial.dailyBudgetUsd}
              onChange={(e) =>
                updateRules({
                  ...rules,
                  financial: { ...rules.financial, dailyBudgetUsd: e.target.value },
                })
              }
              className="mt-1 w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium">Monthly Ceiling ($)</label>
            <input
              type="text"
              value={rules.financial.monthlyBudgetUsd}
              onChange={(e) =>
                updateRules({
                  ...rules,
                  financial: { ...rules.financial, monthlyBudgetUsd: e.target.value },
                })
              }
              className="mt-1 w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* 2. Velocity Rules */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-600" />
          Velocity Thresholds
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-zinc-500 font-medium">Max Tx / Minute</label>
            <input
              type="number"
              value={rules.velocity.maxTxPerMinute}
              onChange={(e) =>
                updateRules({
                  ...rules,
                  velocity: { ...rules.velocity, maxTxPerMinute: parseInt(e.target.value) || 0 },
                })
              }
              className="mt-1 w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium">Max Tx / Hour</label>
            <input
              type="number"
              value={rules.velocity.maxTxPerHour}
              onChange={(e) =>
                updateRules({
                  ...rules,
                  velocity: { ...rules.velocity, maxTxPerHour: parseInt(e.target.value) || 0 },
                })
              }
              className="mt-1 w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium">Max Tx / Merchant / Min</label>
            <input
              type="number"
              value={rules.velocity.maxTxPerMerchantPerMinute}
              onChange={(e) =>
                updateRules({
                  ...rules,
                  velocity: {
                    ...rules.velocity,
                    maxTxPerMerchantPerMinute: parseInt(e.target.value) || 0,
                  },
                })
              }
              className="mt-1 w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* 3. Risk Bands */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          Risk Scoring & Review Band
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-zinc-500 font-medium">Auto-Approve Below ($)</label>
            <input
              type="text"
              value={rules.risk.autoApproveBelowUsd}
              onChange={(e) =>
                updateRules({
                  ...rules,
                  risk: { ...rules.risk, autoApproveBelowUsd: e.target.value },
                })
              }
              className="mt-1 w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium">HOLD Review Band ($ - $)</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={rules.risk.holdBetweenUsd[0]}
                onChange={(e) =>
                  updateRules({
                    ...rules,
                    risk: {
                      ...rules.risk,
                      holdBetweenUsd: [e.target.value, rules.risk.holdBetweenUsd[1]],
                    },
                  })
                }
                className="w-1/2 px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg"
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                type="text"
                value={rules.risk.holdBetweenUsd[1]}
                onChange={(e) =>
                  updateRules({
                    ...rules,
                    risk: {
                      ...rules.risk,
                      holdBetweenUsd: [rules.risk.holdBetweenUsd[0], e.target.value],
                    },
                  })
                }
                className="w-1/2 px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 font-medium">Absolute Block Ceiling ($)</label>
            <input
              type="text"
              value={rules.risk.blockAboveUsd}
              onChange={(e) =>
                updateRules({
                  ...rules,
                  risk: { ...rules.risk, blockAboveUsd: e.target.value },
                })
              }
              className="mt-1 w-full px-3 py-2 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTestInvalid}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            <Bug className="h-3.5 w-3.5 text-rose-600" />
            <span>Test Server Validation Rejection</span>
          </button>
          {onSimulateClick && (
            <button
              type="button"
              onClick={onSimulateClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold rounded-lg transition-colors"
            >
              <Shield className="h-3.5 w-3.5 text-blue-600" />
              <span>Simulate Impact (What-If)</span>
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60"
        >
          {saving ? "Creating Version..." : "Create Immutable Version"}
        </button>
      </div>
    </form>
  );
}
