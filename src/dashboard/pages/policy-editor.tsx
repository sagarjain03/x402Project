"use client";

import { useEffect, useState } from "react";
import { ErrorCard } from "@/dashboard/components/error-card";
import { useParams } from "next/navigation";
import { apiGet, apiPost } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import { PolicyForm } from "@/dashboard/components/policy-form";
import {
  PolicySimulationResults,
  type PolicySimulationData,
} from "@/dashboard/components/policy-simulation-results";
import type { Policy, PolicyRules } from "@/shared/types";
import {
  Lock,
  History,
  Code,
  Sparkles,
  Play,
  RotateCw,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface PolicyVersionsResponse {
  versions: Policy[];
  total: number;
}

export function PolicyEditorPage() {
  const params = useParams();
  const agentId = (params?.agentId as string) || "agent_researchbot";

  const [activePolicy, setActivePolicy] = useState<Policy | null>(null);
  const [draftRules, setDraftRules] = useState<PolicyRules | null>(null);
  const [versions, setVersions] = useState<Policy[]>([]);
  const [activeTab, setActiveTab] = useState<"simulate" | "form" | "json" | "history">("simulate");
  const [loading, setLoading] = useState(true);
  // A failed load used to be swallowed, leaving the form showing its hardcoded defaults as though
  // they were this agent's live policy — which 'Create Immutable Version' would then write.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number>(3);

  // Simulation state
  const [simulating, setSimulating] = useState(false);
  const [simulationLimit, setSimulationLimit] = useState<number>(50);
  const [simulationData, setSimulationData] = useState<PolicySimulationData | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const loadPolicy = async () => {
    try {
      setLoading(true);
      // This endpoint nests the policy under `policy`. Assigning the envelope leaves rules
      // undefined and the form silently shows its own defaults instead of the live policy.
      const [current, vers] = await Promise.all([
        apiGet<{ policy: Policy }>(API.policy(agentId)),
        apiGet<PolicyVersionsResponse>(API.policyVersions(agentId)),
      ]);
      if (current?.policy) {
        setActivePolicy(current.policy);
        if (!draftRules) setDraftRules(current.policy.rules);
      }
      if (vers?.versions) {
        setVersions(vers.versions);
        setSelectedVersion(current?.policy?.version ?? 1);
      }
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load this agent's policy.");
    }
  };

  useEffect(() => {
    void (async () => {
      await loadPolicy();
    })();
  }, [agentId]);

  const handleRunSimulation = async () => {
    const rulesToSimulate = draftRules || activePolicy?.rules;
    if (!rulesToSimulate) return;

    setSimulating(true);
    setSimulationError(null);

    try {
      const response = await apiPost<PolicySimulationData>(API.policySimulate(agentId), {
        rules: rulesToSimulate,
        limit: simulationLimit,
      });
      setSimulationData(response);
    } catch (err) {
      setSimulationError(
        err instanceof Error ? err.message : "Failed to run policy replay simulation."
      );
    } finally {
      setSimulating(false);
    }
  };

  const targetVersionPolicy = versions.find((v) => v.version === selectedVersion) || activePolicy;

  return (
    <div className="space-y-8">
      {loadError && (
        <ErrorCard
          title="Could not load this agent's policy"
          message={`${loadError} The rules below are defaults, not this agent's live policy — do not save them.`}
          onRetry={() => void loadPolicy()}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2.5">
            <Lock className="h-6 w-6 text-zinc-700" />
            Policy Engine Editor
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Configure financial rules, merchant allowlists, velocity limits, and risk review bands for{" "}
            <span className="font-mono font-medium text-zinc-900">{agentId}</span>.
          </p>
        </div>

        {/* View Switcher */}
        <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-1 text-xs font-medium shadow-sm">
          <button
            onClick={() => {
              setActiveTab("simulate");
              if (!simulationData && !simulating) {
                handleRunSimulation();
              }
            }}
            className={`px-3.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab === "simulate"
                ? "bg-blue-600 text-white font-semibold shadow-xs"
                : "text-blue-700 hover:text-blue-900 bg-blue-50/60"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Simulate Impact (What-If)</span>
          </button>
          <button
            onClick={() => setActiveTab("form")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "form" ? "bg-zinc-900 text-white font-semibold" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Visual Form
          </button>
          <button
            onClick={() => setActiveTab("json")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "json" ? "bg-zinc-900 text-white font-semibold" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            JSON Schema
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === "history" ? "bg-zinc-900 text-white font-semibold" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Version Diff ({versions.length})
          </button>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === "form" && (
        <PolicyForm
          key={activePolicy?.policyId ?? "loading"}
          agentId={agentId}
          initialRules={draftRules || activePolicy?.rules}
          onRulesChange={(updated) => setDraftRules(updated)}
          onVersionCreated={loadPolicy}
          onSimulateClick={() => {
            setActiveTab("simulate");
            handleRunSimulation();
          }}
        />
      )}

      {activeTab === "json" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Declarative policy rules object evaluated deterministically by the Core Policy Engine.</span>
            <span className="font-mono text-[11px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-700">Read-Only View</span>
          </div>
          <div className="bg-zinc-900 text-emerald-400 p-6 rounded-xl font-mono text-xs overflow-x-auto shadow-sm border border-zinc-800">
            <pre>{JSON.stringify(draftRules || activePolicy?.rules || {}, null, 2)}</pre>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Version Selector Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Compare Against Active (v{activePolicy?.version ?? 3}):
            </span>
            <div className="flex items-center gap-2">
              {versions.map((v) => (
                <button
                  key={v.version}
                  onClick={() => setSelectedVersion(v.version)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-medium border transition-colors ${
                    selectedVersion === v.version
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-sm font-bold"
                      : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  v{v.version} {v.isActive ? "(ACTIVE)" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Side-by-Side Diff Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Version Selected */}
            <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 font-mono">
                    Version v{targetVersionPolicy?.version}
                  </h4>
                  <div className="text-xs text-zinc-400 font-mono space-y-0.5 mt-0.5">
                    <div>Created: {targetVersionPolicy?.createdAt ? new Date(targetVersionPolicy.createdAt).toLocaleDateString() : "Historical"}</div>
                    {targetVersionPolicy?.createdByEmail && <div>Author: {targetVersionPolicy.createdByEmail}</div>}
                  </div>
                </div>
                {targetVersionPolicy?.isActive && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ACTIVE
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-zinc-50">
                  <span className="text-zinc-500">Max Per Tx:</span>
                  <span className="font-bold text-zinc-900">${targetVersionPolicy?.rules?.financial?.maxPerTransactionUsd}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-50">
                  <span className="text-zinc-500">Hourly Budget:</span>
                  <span className="font-bold text-zinc-900">${targetVersionPolicy?.rules?.financial?.hourlyBudgetUsd}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-50">
                  <span className="text-zinc-500">Daily Budget:</span>
                  <span className="font-bold text-zinc-900">${targetVersionPolicy?.rules?.financial?.dailyBudgetUsd}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-50">
                  <span className="text-zinc-500">Allowed Merchants:</span>
                  <span className="text-zinc-900 truncate max-w-[200px]">
                    {targetVersionPolicy?.rules?.merchant?.allowedMerchants?.join(", ")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-50">
                  <span className="text-zinc-500">Velocity Limit:</span>
                  <span className="font-bold text-zinc-900">{targetVersionPolicy?.rules?.velocity?.maxTxPerMinute} tx/min</span>
                </div>
              </div>
            </div>

            {/* Current Active v3 */}
            <div className="bg-white rounded-xl border border-emerald-300/80 bg-emerald-50/10 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-zinc-900 font-mono">
                    Current Gateway Active (v{activePolicy?.version ?? 3})
                  </h4>
                  <span className="text-xs text-zinc-400 font-mono">Live Rule Set</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  CURRENT
                </span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-emerald-50">
                  <span className="text-zinc-500">Max Per Tx:</span>
                  <span className="font-bold text-emerald-700">${activePolicy?.rules?.financial?.maxPerTransactionUsd}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-50">
                  <span className="text-zinc-500">Hourly Budget:</span>
                  <span className="font-bold text-emerald-700">${activePolicy?.rules?.financial?.hourlyBudgetUsd}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-50">
                  <span className="text-zinc-500">Daily Budget:</span>
                  <span className="font-bold text-emerald-700">${activePolicy?.rules?.financial?.dailyBudgetUsd}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-50">
                  <span className="text-zinc-500">Allowed Merchants:</span>
                  <span className="text-zinc-900 truncate max-w-[200px]">
                    {activePolicy?.rules?.merchant?.allowedMerchants?.join(", ")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-50">
                  <span className="text-zinc-500">Velocity Limit:</span>
                  <span className="font-bold text-emerald-700">{activePolicy?.rules?.velocity?.maxTxPerMinute} tx/min</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkpoint F1: Simulate Impact (What-If) Tab */}
      {activeTab === "simulate" && (
        <div className="space-y-6">
          {/* Header & Controls Card */}
          <div className="bg-white rounded-xl border border-blue-200 bg-linear-to-r from-blue-50/40 to-white p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  Policy Impact Simulation (&ldquo;What-If&rdquo; Historical Replay)
                </h3>
                <p className="text-xs text-zinc-600 max-w-2xl leading-relaxed">
                  Safely evaluate the last <span className="font-semibold font-mono">{simulationLimit}</span> historical payment intents against your draft policy rules. Simulation executes deterministically via pure evaluation with <span className="font-semibold text-emerald-700">zero DB writes or budget locks</span>.
                </p>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 bg-white border border-zinc-200 px-2.5 py-1.5 rounded-lg shadow-xs">
                  <span className="text-zinc-400">Replay:</span>
                  <select
                    value={simulationLimit}
                    onChange={(e) => setSimulationLimit(Number(e.target.value))}
                    className="bg-transparent font-mono font-medium text-zinc-900 focus:outline-none cursor-pointer"
                  >
                    <option value={20}>20 intents</option>
                    <option value={50}>50 intents</option>
                    <option value={100}>100 intents</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={simulating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {simulating ? (
                    <>
                      <RotateCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Replaying Engine...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Run Replay Simulation</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Simulation Error Alert */}
            {simulationError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{simulationError}</span>
              </div>
            )}
          </div>

          {/* Results Component or Empty Prompt */}
          {simulationData ? (
            <PolicySimulationResults data={simulationData} />
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-zinc-300 p-12 text-center space-y-3">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-blue-50 text-blue-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-zinc-800">No Simulation Data Yet</h4>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Click &quot;Run Replay Simulation&quot; above to evaluate your draft rules against historical transactions and preview decision deltas before committing an immutable policy version.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
