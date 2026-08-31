import type { AdminSeason } from "@hotel/shared";

type SeasonOption = Pick<
  AdminSeason,
  "id" | "name" | "start_date" | "end_date" | "is_active"
>;

type SeasonRoomSelectProps = {
  id: string;
  name: string;
  seasons: SeasonOption[];
  defaultValue?: string;
  required?: boolean;
  className?: string;
};

export function SeasonRoomSelect({
  id,
  name,
  seasons,
  defaultValue,
  required = false,
  className = "pms-field-input",
}: SeasonRoomSelectProps) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue || ""}
      required={required}
      className={className}
    >
      <option value="">Selecione uma temporada</option>
      {seasons.map((season) => (
        <option key={season.id} value={season.id}>
          {season.name}
        </option>
      ))}
    </select>
  );
}
