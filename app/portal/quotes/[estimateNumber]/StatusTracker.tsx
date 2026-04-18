import type { StageState } from "@/lib/portal/workflow";

interface Props {
  stages: StageState[];
}

const SYMBOL: Record<StageState["status"], string> = {
  done: "●",
  current: "◉",
  pending: "○",
  declined: "✕",
  expired: "⏱",
};

const STATUS_TEXT: Record<StageState["status"], string> = {
  done: "completed",
  current: "in progress",
  pending: "pending",
  declined: "Declined",
  expired: "Expired",
};

const STATUS_COLOR: Record<StageState["status"], string> = {
  done: "text-bronze",
  current: "text-bronze",
  pending: "text-gray-500",
  declined: "text-red-500",
  expired: "text-gray-400",
};

export function StatusTracker({ stages }: Props): React.ReactElement {
  const currentIdx = stages.findIndex((s) => s.status === "current");
  const ariaNow =
    currentIdx >= 0
      ? currentIdx + 1
      : stages.filter((s) => s.status === "done").length;

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={stages.length}
      aria-valuenow={Math.max(1, ariaNow)}
      className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-0"
    >
      {stages.map((stage, idx) => (
        <div
          key={stage.id}
          className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center"
        >
          <div className="flex items-center sm:flex-col">
            <div
              aria-label={`${stage.label}, ${STATUS_TEXT[stage.status]}${stage.date ? `, ${stage.date}` : ""}`}
              className={`flex h-8 w-8 items-center justify-center text-xl ${STATUS_COLOR[stage.status]}`}
            >
              {SYMBOL[stage.status]}
            </div>
            {idx < stages.length - 1 && (
              <div
                className={`hidden h-px flex-1 sm:block ${
                  stage.status === "done" ? "bg-bronze" : "bg-white/10"
                }`}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="sm:mt-2">
            <p
              className={`text-xs font-medium uppercase tracking-wider ${STATUS_COLOR[stage.status]}`}
            >
              {stage.label}
            </p>
            {stage.date && (
              <p className="text-[11px] text-gray-500">{stage.date}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
