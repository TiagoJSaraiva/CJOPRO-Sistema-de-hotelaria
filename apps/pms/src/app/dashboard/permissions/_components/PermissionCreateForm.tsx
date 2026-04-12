import { createPermissionAction } from "../actions";

type PermissionCreateFormProps = {
  formKey?: string;
};

export function PermissionCreateForm({ formKey }: PermissionCreateFormProps) {
  return (
    <article style={{ background: "#fff", border: "1px solid #e2e2e2", borderRadius: "12px", padding: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Criar permissao</h3>

      <form key={formKey} action={createPermissionAction} style={{ display: "grid", gap: "0.7rem" }}>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <label htmlFor="create-permission-name">Nome</label>
          <input
            id="create-permission-name"
            name="name"
            minLength={3}
            required
            style={{ border: "1px solid #d2d2d2", borderRadius: "8px", padding: "0.55rem" }}
          />
        </div>

        <button
          type="submit"
          style={{ border: 0, background: "#0f6d5f", color: "#fff", borderRadius: "8px", padding: "0.6rem 0.8rem", cursor: "pointer", justifySelf: "start" }}
        >
          Criar permissao
        </button>
      </form>
    </article>
  );
}
