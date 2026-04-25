"use client";

import Link from "next/link";
import type { AdminSeason } from "@hotel/shared";
import { deleteSeasonAction, updateSeasonAction } from "../actions";

type SeasonListItemProps = {
  season: AdminSeason;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
};

function SeasonDataPreview({ season }: { season: AdminSeason }) {
  const createdAt = season.created_at ? new Date(season.created_at).toLocaleString("pt-BR") : "-";
  const updatedAt = season.updated_at ? new Date(season.updated_at).toLocaleString("pt-BR") : "-";

  return (
    <div className="mt-[0.85rem] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[0.75rem]">
      <div>
        <strong>Nome:</strong>
        <p className="m-0 mt-[0.2rem]">{season.name}</p>
      </div>
      <div>
        <strong>Inicio:</strong>
        <p className="m-0 mt-[0.2rem]">{season.start_date}</p>
      </div>
      <div>
        <strong>Fim:</strong>
        <p className="m-0 mt-[0.2rem]">{season.end_date}</p>
      </div>
      <div>
        <strong>Status:</strong>
        <p className="m-0 mt-[0.2rem]">{season.is_active ? "ativa" : "inativa"}</p>
      </div>
      <div>
        <strong>Criado em:</strong>
        <p className="m-0 mt-[0.2rem]">{createdAt}</p>
      </div>
      <div>
        <strong>Atualizado em:</strong>
        <p className="m-0 mt-[0.2rem]">{updatedAt}</p>
      </div>
    </div>
  );
}

function SeasonEditForm({ season }: { season: AdminSeason }) {
  return (
    <form action={updateSeasonAction} className="mt-[0.85rem] grid gap-[0.65rem]">
      <input type="hidden" name="id" value={season.id} />

      <div className="pms-field">
        <label htmlFor={`season-name-${season.id}`}>Nome</label>
        <input id={`season-name-${season.id}`} name="name" defaultValue={season.name} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`season-start-${season.id}`}>Inicio</label>
        <input id={`season-start-${season.id}`} name="start_date" type="date" defaultValue={season.start_date} required className="pms-field-input" />
      </div>

      <div className="pms-field">
        <label htmlFor={`season-end-${season.id}`}>Fim</label>
        <input id={`season-end-${season.id}`} name="end_date" type="date" defaultValue={season.end_date} required className="pms-field-input" />
      </div>

      <label className="flex items-center gap-2">
        <input name="is_active" type="checkbox" defaultChecked={season.is_active} />
        <span>Temporada ativa</span>
      </label>

      <button type="submit" className="justify-self-start rounded-lg border-0 bg-[#1c6d4e] px-[0.75rem] py-[0.55rem] text-white">
        Salvar alteracoes
      </button>
    </form>
  );
}

export function SeasonListItem({ season, canRead, canUpdate, canDelete, isViewing, isEditing }: SeasonListItemProps) {
  const viewHref = `/dashboard/seasons/view?seasonId=${season.id}&mode=view`;
  const editHref = `/dashboard/seasons/view?seasonId=${season.id}&mode=edit`;

  return (
    <article className="rounded-xl border border-[#e2e2e2] bg-white p-[0.95rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="mb-[0.2rem] mt-0">{season.name}</h3>
          <p className="m-0 text-[#555]">{season.start_date} ate {season.end_date} | {season.is_active ? "ativa" : "inativa"}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canRead ? (
            <Link
              href={viewHref}
              scroll={false}
              className={`rounded-lg border border-[#2d6cdf] px-[0.65rem] py-[0.45rem] no-underline ${
                isViewing ? "bg-[#e9f0ff] text-[#1b4db3]" : "bg-white text-[#1b4db3]"
              }`}
            >
              Visualizar dados
            </Link>
          ) : null}

          {canUpdate ? (
            <Link
              href={editHref}
              scroll={false}
              className={`rounded-lg border border-[#0f766e] px-[0.65rem] py-[0.45rem] no-underline ${
                isEditing ? "bg-[#ddf5f2] text-[#0a5f58]" : "bg-white text-[#0a5f58]"
              }`}
            >
              Editar dados
            </Link>
          ) : null}

          {canDelete ? (
            <form action={deleteSeasonAction}>
              <input type="hidden" name="id" value={season.id} />
              <button type="submit" className="rounded-lg border border-[#c83a3a] bg-white px-[0.65rem] py-[0.45rem] text-[#b00020]">
                Apagar dados
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {isViewing ? <SeasonDataPreview season={season} /> : null}
      {isEditing ? <SeasonEditForm season={season} /> : null}
    </article>
  );
}