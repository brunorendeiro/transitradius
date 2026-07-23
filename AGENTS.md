# AGENTS.md

## Objetivo

Este projeto contém exclusivamente a app TransitRadius, um localizador de
partidas de transportes públicos planeados na Suíça.

## Regras

- Manter a app 100% client-side: sem backend, sem base de dados própria,
  sem chaves de API secretas.
- Os dados vêm da API pública `transport.opendata.ch`. Nunca mostrar o
  campo de prognóstico/tempo real dessa API como se fosse a hora oficial —
  a app promete explicitamente horários planeados, não tempo real.
- `src/lib/transportApi.ts` é a única camada que fala com a API externa;
  `src/lib/departures.ts` faz a orquestração (raio, janela de tempo, tipo).
  Manter essa separação ao adicionar funcionalidades novas.
- A distância à paragem é sempre calculada localmente via Haversine
  (`src/lib/geo.ts`), não confiar apenas no campo `distance` da API.
- Não colocar aqui código do portfólio ou de outras aplicações.

## Validação

```bash
npm run check
npm run build
```
