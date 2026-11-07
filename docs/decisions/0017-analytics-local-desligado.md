# 0017: Analytics do Supabase local desligado

- **Status:** aceita
- **Data:** 2026-11-07
- **Origem:** decisão do usuário
- **Áreas:** ambiente

## Decisão

`[analytics]` fica desligado em `supabase/config.toml`, o que remove os containers de analytics e vector.

## Motivo

O `vector` ficava em ciclo de reinício e o analytics usava 690 MB de RAM, numa máquina no limite. Medição:
os containers caíram de cerca de 1,75 GB para 1,18 GB. O tempo do reset **não** mudou, cerca de 60 s.

## Alternativas recusadas

- Manter ligado: só seria útil para a aba de logs do Studio local, que a documentação não cita.

## Consequências

A aba de logs do Studio local deixa de funcionar. Os logs dos containers continuam acessíveis pelo Docker.

## Prova

- [Configuração local](../../supabase/config.toml); `pnpm test:db` passou com o analytics desligado.
