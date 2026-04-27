"use client";

import Link from "next/link";

type DashboardEntityActionButtonsProps = {
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isViewing: boolean;
  isEditing: boolean;
  viewHref: string;
  editHref: string;
  deleteId: string;
  deleteAction: (payload: FormData) => void | Promise<void>;
  editDisabled?: boolean;
  editDisabledTitle?: string;
  deleteDisabled?: boolean;
  deleteDisabledTitle?: string;
};

const baseButtonClassName = "rounded-lg px-[0.65rem] py-[0.45rem]";

export function DashboardEntityActionButtons({
  canRead,
  canUpdate,
  canDelete,
  isViewing,
  isEditing,
  viewHref,
  editHref,
  deleteId,
  deleteAction,
  editDisabled = false,
  editDisabledTitle,
  deleteDisabled = false,
  deleteDisabledTitle
}: DashboardEntityActionButtonsProps) {
  return (
    <>
      {canRead ? (
        <Link
          href={viewHref}
          scroll={false}
          className={`${baseButtonClassName} border border-[#2d6cdf] no-underline ${
            isViewing ? "bg-[#e9f0ff] text-[#1b4db3]" : "bg-white text-[#1b4db3]"
          }`}
        >
          Visualizar dados
        </Link>
      ) : null}

      {canUpdate && !editDisabled ? (
        <Link
          href={editHref}
          scroll={false}
          className={`${baseButtonClassName} border border-[#0f766e] no-underline ${
            isEditing ? "bg-[#ddf5f2] text-[#0a5f58]" : "bg-white text-[#0a5f58]"
          }`}
        >
          Editar dados
        </Link>
      ) : null}

      {canUpdate && editDisabled ? (
        <button
          type="button"
          disabled
          title={editDisabledTitle}
          className={`${baseButtonClassName} cursor-not-allowed border border-[#b8dccc] bg-[#effaf5] text-[#4f8b75]`}
        >
          Editar dados
        </button>
      ) : null}

      {canDelete && !deleteDisabled ? (
        <form action={deleteAction}>
          <input type="hidden" name="id" value={deleteId} />
          <button type="submit" className={`${baseButtonClassName} border border-[#c83a3a] bg-white text-[#b00020]`}>
            Apagar dados
          </button>
        </form>
      ) : null}

      {canDelete && deleteDisabled ? (
        <button
          type="button"
          disabled
          title={deleteDisabledTitle}
          className={`${baseButtonClassName} cursor-not-allowed border border-[#f1a1a1] bg-[#fff6f6] text-[#b45353]`}
        >
          Apagar dados
        </button>
      ) : null}
    </>
  );
}
