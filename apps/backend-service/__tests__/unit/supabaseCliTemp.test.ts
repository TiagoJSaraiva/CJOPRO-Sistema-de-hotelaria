import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanSupabaseCliTemp,
  supabaseCliEnvironment,
} from "../../../../scripts/database.mjs";

const roots: string[] = [];
function folder(): string {
  const root = mkdtempSync(join(tmpdir(), "supabase-cli-tmp-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

// A CLI do Supabase é compilada com Bun e extrai um módulo nativo para a pasta temporária a cada
// execução, sem apagá-lo. Rodada após rodada, isso chegou a 4,8 GB no Temp do Windows (QA-096).
describe("pasta temporária da CLI do Supabase", () => {
  it("aponta TEMP, TMP e TMPDIR para a pasta própria sem mudar o restante", () => {
    const base = { PATH: "caminho", TEMP: "C:\\Temp", KEEP: "sim" };
    const environment = supabaseCliEnvironment(base, "C:\\projeto\\cli-tmp");

    expect(environment).toMatchObject({
      PATH: "caminho",
      KEEP: "sim",
      TEMP: "C:\\projeto\\cli-tmp",
      TMP: "C:\\projeto\\cli-tmp",
      TMPDIR: "C:\\projeto\\cli-tmp",
    });
    expect(base.TEMP, "o ambiente original não muda").toBe("C:\\Temp");
  });

  it("apaga só os módulos extraídos e preserva o resto", () => {
    const directory = folder();
    writeFileSync(join(directory, ".5cf5efdf5f3dfd6d-00000000.node"), "x");
    writeFileSync(join(directory, ".5cf5efd79fadefe5-00000000.node"), "x");
    writeFileSync(join(directory, "modulo.node"), "x");
    writeFileSync(join(directory, "anotacao.txt"), "x");

    expect(cleanSupabaseCliTemp(directory)).toBe(2);
    expect(readdirSync(directory).sort()).toEqual([
      "anotacao.txt",
      "modulo.node",
    ]);
  });

  it("não falha quando a pasta ainda não existe", () => {
    const directory = join(folder(), "ausente");
    expect(cleanSupabaseCliTemp(directory)).toBe(0);
    expect(existsSync(directory)).toBe(false);
  });
});
