import { BookingJourney } from "./booking-journey";

export default async function HotelBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <BookingJourney slug={(await params).slug} />;
}
