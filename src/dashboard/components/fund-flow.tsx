"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/dashboard/api-client/client";
import { API } from "@/dashboard/api-client/endpoints";
import type { LiveDecisionItem } from "@/dashboard/hooks/useLiveDecisions";
import { explorerName, explorerTxUrl, networkLabel } from "@/shared/explorer";
import {
  ArrowRight,
  Bot,
  ExternalLink,
  RefreshCw,
  Store,
  TriangleAlert,
  Wallet,
} from "lucide-react";

/**
 * OWNER: UI · Where the money actually went.
 *
 * Two live chain balances with the settled transfers between them, each stamped with the time it
 * settled and linked to the explorer. Balances come from algod; transfers come from the guard's own
 * records. If those two ever disagree, the disagreement is visible here rather than hidden.
 */

interface WalletBalance {
  role: "agent" | "merchant";
  label: string;
  address: string;
  usdc: string | null;
  algo: string | null;
  optedIn: boolean;
  fundedForFees: boolean;
  explorerUrl: string | null;
  error?: string;
}

interface BalancesResponse {
  network: string;
  asset: string;
  wallets: WalletBalance[];
  fetchedAt: string;
  error?: string;
}

const shortAddress = (address: string) =>
  address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address;

/** Cents as integers, so a list of settled payments never sums to $0.30000000000000004. */
function sumUsd(rows: LiveDecisionItem[]): string {
  const cents = rows.reduce((acc, row) => acc + Math.round(Number(row.amountUsd) * 100), 0);
  return (cents / 100).toFixed(2);
}

function stamp(iso?: string): { clock: string; day: string; ago: string } {
  if (!iso) return { clock: "—", day: "", ago: "" };
  const at = new Date(iso);
  const seconds = Math.max(0, Math.round((Date.now() - at.getTime()) / 1000));
  const ago =
    seconds < 60 ? `${seconds}s ago`
    : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago`
    : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago`
    : `${Math.floor(seconds / 86400)}d ago`;
  return {
    clock: at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    day: at.toLocaleDateString([], { day: "2-digit", month: "short" }),
    ago,
  };
}

function WalletPanel({ wallet, icon }: { wallet: WalletBalance; icon: React.ReactNode }) {
  const unreadable = wallet.usdc === null;

  return (
    <div className="flex-1 min-w-[240px] rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {wallet.label}
          </div>
          {wallet.explorerUrl ? (
            <a
              href={wallet.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              {shortAddress(wallet.address)}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="font-mono text-[11px] text-slate-500">{shortAddress(wallet.address)}</span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <span className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
          {unreadable ? "—" : wallet.usdc}
        </span>
        <span className="pb-1 text-xs font-mono font-semibold text-slate-400">USDC</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <span className="text-slate-500">{unreadable ? "ALGO —" : `${wallet.algo} ALGO`}</span>
        {!unreadable && (
          <span
            className={`px-1.5 py-0.5 rounded border ${
              wallet.optedIn
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {wallet.optedIn ? "opted in" : "not opted in"}
          </span>
        )}
        {!unreadable && !wallet.fundedForFees && (
          <span className="px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
            low ALGO
          </span>
        )}
      </div>

      {wallet.error && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-700">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>Balance unreadable: {wallet.error}</span>
        </p>
      )}
    </div>
  );
}

export function FundFlow({
  transactions,
  loading,
  onRefresh,
}: {
  transactions: LiveDecisionItem[];
  loading?: boolean;
  /** Reloads the rows this panel draws its arrows from. Balances alone are not the whole story. */
  onRefresh?: () => Promise<void> | void;
}) {
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadBalances = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const next = await apiGet<BalancesResponse>(API.walletBalances);
      setBalances(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read wallet balances.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleManualRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const [next] = await Promise.all([apiGet<BalancesResponse>(API.walletBalances), onRefresh?.()]);
      setBalances(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read wallet balances.");
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    // Initial mount fetches only wallet balances without triggering parent re-fetch cascade
    void Promise.resolve().then(loadBalances);
  }, [loadBalances]);

  // Only a payment that reached the chain moved money. A row with no transaction id was approved
  // and then never settled, and drawing an arrow for it would claim funds that never left.
  const transfers = transactions
    .filter((tx) => Boolean(tx.txHash))
    .sort(
      (a, b) =>
        new Date(b.settledAt ?? b.createdAt).getTime() - new Date(a.settledAt ?? a.createdAt).getTime(),
    );

  const agent = balances?.wallets.find((w) => w.role === "agent");
  const merchant = balances?.wallets.find((w) => w.role === "merchant");
  const movedUsd = sumUsd(transfers);
  const network = balances?.network;

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div>
          <h3 className="text-sm font-bold tracking-wide text-slate-900 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-slate-500" />
            Fund flow
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Live balances on {networkLabel(network)}, and every settled transfer between them.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {balances?.fetchedAt && (
            <span className="hidden sm:inline font-mono text-xs text-slate-400">
              read {stamp(balances.fetchedAt).clock}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
            aria-controls="fund-flow-content"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            {isExpanded ? "Hide details" : "Show details"}
          </button>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {(error || balances?.error) && (
        <p className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error ?? balances?.error}
        </p>
      )}

      <div className="px-5 pb-4 pt-1">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">${movedUsd}</span> settled across {transfers.length}{" "}
          {transfers.length === 1 ? "transfer" : "transfers"}.
        </p>
      </div>

      {isExpanded && (
        <div id="fund-flow-content">
          {/* Balances, with the flow between them */}
          <div className="flex flex-wrap items-stretch gap-4 px-5 pb-5">
            {agent ? (
              <WalletPanel wallet={agent} icon={<Bot className="h-4 w-4" />} />
            ) : (
              <div className="flex-1 min-w-[240px] h-40 rounded-2xl bg-slate-100 animate-pulse" />
            )}

            <div className="flex w-full flex-col items-center justify-center gap-1 sm:w-auto sm:min-w-[150px]">
              <span className="font-mono text-lg font-extrabold text-emerald-600">${movedUsd}</span>
              <div className="relative h-px w-full min-w-[110px] bg-gradient-to-r from-slate-200 via-emerald-400 to-slate-200 flex items-center">
                <ArrowRight className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              </div>
              <span className="font-mono text-xs text-slate-400">
                {transfers.length} settled {transfers.length === 1 ? "transfer" : "transfers"}
              </span>
            </div>

            {merchant ? (
              <WalletPanel wallet={merchant} icon={<Store className="h-4 w-4" />} />
            ) : (
              <div className="flex-1 min-w-[240px] h-40 rounded-2xl bg-slate-100 animate-pulse" />
            )}
          </div>

          {/* Transfer ledger */}
          <div className="border-t border-slate-100">
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-xs font-semibold tracking-wide text-slate-600">
                Transfers
              </span>
              <span className="font-mono text-xs text-slate-400">newest first</span>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {loading ? (
                [...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-50 animate-pulse" />)
              ) : transfers.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">
                  No settled transfers yet. Blocked and held payments never reach the chain, so they do
                  not appear here.
                </p>
              ) : (
                <div className="mx-auto max-w-4xl">
                  {transfers.map((tx) => {
                    const time = stamp(tx.settledAt ?? tx.createdAt);
                    const url = explorerTxUrl(tx.network, tx.txHash);
                    return (
                      <div
                        key={tx.intentId || tx.id}
                        className="grid grid-cols-1 gap-2 px-5 py-3 hover:bg-slate-50/70 sm:grid-cols-[88px_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3"
                      >
                        <div className="font-mono text-xs leading-tight text-slate-500">
                          <div className="font-semibold text-slate-700">{time.clock}</div>
                          <div>{time.day}</div>
                        </div>

                        <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-slate-500">
                          <span className="truncate text-slate-700">{tx.agentName ?? tx.agentId}</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="truncate" title={tx.recipient}>
                            {tx.recipient ? shortAddress(tx.recipient) : tx.merchant}
                          </span>
                        </div>

                        <span className="font-mono text-sm font-bold text-slate-900">${tx.amountUsd}</span>

                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open transfer ${tx.intentId || tx.id} on ${explorerName(tx.network)}`}
                            className="inline-flex items-center justify-end text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <span className="font-mono text-xs text-slate-300">no link</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
