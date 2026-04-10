import { Suspense } from "react";
import { FindADealerClient } from "./FindADealerClient";
import { env } from "@/lib/env";

export const metadata = {
  title: "Find a Dealer | LOUISLUSO",
  description: "Find an optical store near you that carries LOUISLUSO frames.",
};

export default function FindADealerPage(): React.ReactElement {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-gray-500">Loading dealers...</p>
      </div>
    }>
      <FindADealerClient mapboxToken={env.NEXT_PUBLIC_MAPBOX_TOKEN} />
    </Suspense>
  );
}
