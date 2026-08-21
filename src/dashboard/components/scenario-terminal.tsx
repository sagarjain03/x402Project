"use client";

import { useState } from "react";
import { Terminal, Copy, Check, ExternalLink, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { explorerTxUrl } from "@/shared/explorer";

export interface ScenarioTerminalProps {
  scenarioId: string;
  scenarioName: string;
  passed?: boolean;
  transcript: string[];
  isRunning?: boolean;
}

export function ScenarioTerminal({
  scenarioId,
  scenarioName,
  passed,
  transcript,
  isRunning,
}: ScenarioTerminalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (transcript.length === 0) return;
    try {
      await navigator.clipboard.writeText(transcript.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy transcript", err);
    }
  };

  const renderLogLine = (line: string, index: number) => {
    // Regex to match tx hashes (0x followed by 64 hex chars)
    const txHashMatch = line.match(/(0x[a-fA-F0-9]{64}|\b[A-Z2-7]{52}\b)/);

    let textColor = "text-zinc-300";
    if (line.includes("PASS") || line.includes("ALLOW") || line.includes("Settled on")) {
      textColor = "text-emerald-400 font-medium";
    } else if (
      line.includes("BLOCK") ||
      line.includes("BLOCKED") ||
      line.includes("PER_TRANSACTION_LIMIT_EXCEEDED") ||
      line.includes("MERCHANT_BLOCKED") ||
      line.includes("VELOCITY_EXCEEDED") ||
      line.includes("ABSOLUTE_BLOCK_THRESHOLD") ||
      line.includes("FAIL")
    ) {
      textColor = "text-rose-400 font-medium";
    } else if (line.includes("HOLD") || line.includes("APPROVAL_REQUIRED") || line.includes("review band")) {
      textColor = "text-amber-400 font-medium";
    }

    if (txHashMatch) {
      const hash = txHashMatch[1];
      const parts = line.split(hash);
      return (
        <div key={index} className={`font-mono text-xs leading-relaxed py-0.5 flex items-start gap-2 ${textColor}`}>
          <span className="text-zinc-600 select-none text-[10px] w-5 shrink-0 text-right">{index + 1}</span>
          <div>
            <span>{parts[0]}</span>
            <a
              href={explorerTxUrl(hash.startsWith("0x") ? "eip155:84532" : "algorand:testnet", hash)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300 underline font-mono inline-flex items-center gap-0.5 bg-sky-950/40 px-1 rounded border border-sky-800/60"
            >
              {hash.slice(0, 10)}...{hash.slice(-8)}
              <ExternalLink className="h-2.5 w-2.5 inline ml-0.5" />
            </a>
            <span>{parts[1]}</span>
          </div>
        </div>
      );
    }

    return (
      <div key={index} className={`font-mono text-xs leading-relaxed py-0.5 flex items-start gap-2 ${textColor}`}>
        <span className="text-zinc-600 select-none text-[10px] w-5 shrink-0 text-right">{index + 1}</span>
        <span>{line}</span>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 shadow-md overflow-hidden animate-in fade-in">
      {/* Terminal Top Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-900/90 border-b border-zinc-800/80 text-xs">
        <div className="flex items-center gap-2">
          {/* Terminal Dots */}
          <div className="flex items-center gap-1.5 mr-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-[11px]">
            <Terminal className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-semibold text-zinc-200">{scenarioId}</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-400 truncate max-w-[200px] sm:max-w-xs">{scenarioName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          {isRunning ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-950 text-blue-400 border border-blue-800 animate-pulse">
              RUNNING
            </span>
          ) : passed !== undefined ? (
            passed ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                PASS
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-950 text-rose-400 border border-rose-800">
                <XCircle className="h-3 w-3 text-rose-400" />
                RESULT
              </span>
            )
          ) : null}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            disabled={transcript.length === 0}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono transition-colors disabled:opacity-40 cursor-pointer"
            title="Copy Transcript"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-3.5 max-h-56 overflow-y-auto font-mono text-xs space-y-0.5 selection:bg-emerald-900 selection:text-emerald-100">
        {transcript.length === 0 ? (
          <div className="text-zinc-500 italic py-2">No output recorded yet.</div>
        ) : (
          transcript.map((line, idx) => renderLogLine(line, idx))
        )}
      </div>
    </div>
  );
}
