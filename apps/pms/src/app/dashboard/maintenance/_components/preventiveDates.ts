export function futureDates(start: string, unit: string, interval: number) {
  const dates: string[] = [];
  const anchor = new Date(`${start}T12:00:00`);
  const day = anchor.getDate();
  for (let index = 0; index < 5; index += 1) {
    const current = new Date(anchor);
    if (unit === "daily") current.setDate(anchor.getDate() + index * interval);
    if (unit === "weekly")
      current.setDate(anchor.getDate() + index * interval * 7);
    if (unit === "monthly" && index) {
      current.setDate(1);
      current.setMonth(anchor.getMonth() + index * interval);
      current.setDate(
        Math.min(
          day,
          new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate(),
        ),
      );
    }
    if (unit === "yearly" && index) {
      current.setDate(1);
      current.setFullYear(anchor.getFullYear() + index * interval);
      current.setMonth(anchor.getMonth());
      current.setDate(
        Math.min(
          day,
          new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate(),
        ),
      );
    }
    // toISOString converte para UTC e recua um dia em fusos a partir de UTC+12.
    dates.push(
      [
        String(current.getFullYear()).padStart(4, "0"),
        String(current.getMonth() + 1).padStart(2, "0"),
        String(current.getDate()).padStart(2, "0"),
      ].join("-"),
    );
  }
  return dates;
}
