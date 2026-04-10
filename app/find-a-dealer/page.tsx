import { FindADealerClient } from "./FindADealerClient";

export const metadata = {
  title: "Find a Dealer | LOUISLUSO",
  description: "Find an optical store near you that carries LOUISLUSO frames.",
};

export default function FindADealerPage(): React.ReactElement {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  return <FindADealerClient mapboxToken={mapboxToken} />;
}
