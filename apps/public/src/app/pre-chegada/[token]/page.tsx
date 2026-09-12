import { PrearrivalJourney } from "./prearrival-journey";

export default async function PrearrivalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <PrearrivalJourney token={(await params).token} />;
}
