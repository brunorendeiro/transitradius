# TransitRadius

Descobre todas as partidas de transportes públicos planeadas nas próximas
horas à tua volta, na Suíça — sem tempo real, apenas horários oficiais.

## Ideia

- Pede a localização atual (ou permite pesquisar por cidade), encontra as
  paragens mais próximas e mostra as partidas planeadas dentro da janela de
  tempo escolhida (1h/2h/3h) e do raio escolhido (1/3/5/10 km).
- Filtra por tipo de transporte (tram, autocarro, comboio, barco, outros) e
  permite agrupar os resultados por hora, paragem, tipo ou distância.
- Cada partida mostra hora oficial, contagem decrescente, linha, destino,
  paragem, distância, tempo estimado a pé, operador e cais (quando existe).
- 100% client-side: sem backend, sem base de dados própria, sem chaves de
  API. Usa a API pública oficial [transport.opendata.ch](https://transport.opendata.ch),
  que serve os horários planeados suíços (fonte: HRDF/GTFS oficial).
  Ignoramos deliberadamente o campo de prognóstico/tempo real da API —
  mostramos sempre a hora oficial do horário.
- Distância calculada com a fórmula de Haversine a partir da localização do
  utilizador até cada paragem.

## Limitação conhecida

O endpoint público `/v1/locations` devolve no máximo as 10 paragens mais
próximas, independentemente do raio pedido. Em zonas muito densas com um
raio grande (10 km), pode haver paragens dentro do raio que não aparecem.
Aceitável para o MVP; uma versão futura com GTFS importado localmente (como
descrito no pedido original) resolveria isto por completo.

## Executar

```bash
npm install
npm run dev
```

Abrir <http://127.0.0.1:5182>.

## Validar

```bash
npm run check
npm run build
```

## Ideias para evoluir

- Vista de mapa (Leaflet/MapLibre) com raio desenhado e clique na paragem.
- Paragens favoritas e histórico de pesquisas (localStorage).
- Tradução da interface para PT/EN/DE, como as outras apps do portfólio.
- PWA com modo offline parcial.
- Importar GTFS Static oficial para uma base de dados própria, para cobrir
  mais do que 10 paragens por pesquisa e não depender de um serviço externo.

## Nota técnica — Google Analytics

O Analytics só é carregado depois de o utilizador aceitar os cookies. A função
`gtag` deve enviar o objeto nativo `arguments` para `dataLayer`:

```js
function gtag() {
  dataLayer.push(arguments)
}
```

Não substituir por `dataLayer.push(args)` com um rest parameter (`...args`):
apesar de o script da Google carregar, o comando `config` e o `page_view` podem
não ser processados.
