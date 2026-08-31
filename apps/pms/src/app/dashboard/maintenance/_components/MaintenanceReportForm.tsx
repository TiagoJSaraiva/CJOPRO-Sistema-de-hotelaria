"use client";

import type {
  AdminItemResponse,
  AdminMaintenanceOccurrenceDetail,
  AdminMaintenanceReferenceData,
} from "@hotel/shared";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = { referenceData: AdminMaintenanceReferenceData };

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & {
    message?: string;
  };
  if (!response.ok)
    throw new Error(payload.message || "Não foi possível concluir a operação.");
  return payload;
}

export function MaintenanceReportForm({ referenceData }: Props) {
  const router = useRouter();
  const [target, setTarget] = useState<"room" | "location">("room");
  const [roomId, setRoomId] = useState(referenceData.rooms[0]?.id || "");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const stays = useMemo(
    () => referenceData.stays.filter((stay) => stay.room_id === roomId),
    [referenceData.stays, roomId],
  );

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    try {
      const payload = {
        category_id: String(formData.get("category_id")),
        room_id: target === "room" ? roomId : null,
        location_id:
          target === "location" ? String(formData.get("location_id")) : null,
        stay_id:
          target === "room" && formData.get("stay_id")
            ? String(formData.get("stay_id"))
            : null,
        kind: String(formData.get("kind")),
        priority: String(formData.get("priority")),
        description: String(formData.get("description")),
        blocking_recommended: formData.get("blocking_recommended") === "on",
      };
      const created = await readJson<
        AdminItemResponse<AdminMaintenanceOccurrenceDetail>
      >(
        await fetch("/api/maintenance/occurrences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      if (files.length) {
        const intents = await readJson<{
          items: Array<{ storage_path: string; signed_url: string }>;
        }>(
          await fetch(
            `/api/maintenance/occurrences/${created.item.id}/attachments/upload-intents`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                files: files.map((file) => ({
                  filename: file.name,
                  content_type: file.type,
                  size_bytes: file.size,
                })),
              }),
            },
          ),
        );
        const uploaded = await Promise.all(
          files.map(async (file, index) => {
            const intent = intents.items[index]!;
            const response = await fetch(intent.signed_url, {
              method: "PUT",
              headers: { "Content-Type": file.type, "x-upsert": "false" },
              body: file,
            });
            if (!response.ok)
              throw new Error(
                `A ocorrência foi salva, mas a foto ${file.name} não foi enviada. Tente novamente no detalhe.`,
              );
            return {
              storage_path: intent.storage_path,
              filename: file.name,
              content_type: file.type,
              size_bytes: file.size,
            };
          }),
        );
        await readJson(
          await fetch(
            `/api/maintenance/occurrences/${created.item.id}/attachments/finalize`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ files: uploaded }),
            },
          ),
        );
      }
      router.push(`/dashboard/maintenance/occurrences/${created.item.id}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Falha ao registrar ocorrência.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      action={submit}
      className="grid gap-4 rounded-xl border border-[#d7dce2] bg-white p-4 sm:p-6"
    >
      <fieldset className="grid gap-2">
        <legend className="font-semibold">Alvo</legend>
        <div className="flex gap-4">
          <label>
            <input
              type="radio"
              checked={target === "room"}
              onChange={() => setTarget("room")}
            />{" "}
            Quarto
          </label>
          <label>
            <input
              type="radio"
              checked={target === "location"}
              onChange={() => setTarget("location")}
            />{" "}
            Área ou equipamento
          </label>
        </div>
      </fieldset>
      {target === "room" ? (
        <>
          <label className="grid gap-1">
            Quarto
            <select
              required
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className="pms-field-input"
            >
              {referenceData.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.room_number} · {room.room_type}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Estadia relacionada (opcional)
            <select name="stay_id" className="pms-field-input">
              <option value="">Nenhuma</option>
              {stays.map((stay) => (
                <option key={stay.id} value={stay.id}>
                  {stay.reservation_code || stay.id} ·{" "}
                  {stay.customer_name || "Sem hóspede"}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label className="grid gap-1">
          Área ou equipamento
          <select name="location_id" required className="pms-field-input">
            {referenceData.locations
              .filter((item) => item.is_active)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.kind === "area" ? "Área" : "Equipamento"} · {item.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1">
          Tipo
          <select name="kind" className="pms-field-input">
            <option value="damage">Dano</option>
            <option value="defect">Defeito</option>
            <option value="wear">Desgaste</option>
            <option value="safety_risk">Risco de segurança</option>
            <option value="special_cleaning">Limpeza especial</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label className="grid gap-1">
          Categoria
          <select name="category_id" required className="pms-field-input">
            {referenceData.categories
              .filter((item) => item.is_active)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1">
          Prioridade
          <select name="priority" className="pms-field-input">
            <option value="normal">Normal</option>
            <option value="low">Baixa</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1">
        Descrição
        <textarea
          name="description"
          required
          minLength={5}
          maxLength={4000}
          rows={5}
          className="pms-field-input"
        />
      </label>
      <label>
        <input name="blocking_recommended" type="checkbox" /> Recomendar
        bloqueio do quarto
      </label>
      <label className="grid gap-1">
        Fotos opcionais (até 5, JPEG, PNG ou WebP, 10 MB cada)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) =>
            setFiles(Array.from(event.target.files || []).slice(0, 5))
          }
        />
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-[#fff1f0] p-3 text-[#9f1239]">
          {error}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="rounded-lg bg-[#102a43] px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Registrando…" : "Registrar ocorrência"}
      </button>
    </form>
  );
}
