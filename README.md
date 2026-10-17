# MedCare Sênior — aplicativo móvel (front-end)

Front-end Android do MedCare Sênior em React Native + Expo (SDK 52) e TypeScript, com as duas interfaces:
**Cuidador** (completa) e **Idoso** (ultra-simplificada). Nesta fase não há backend real: todos os dados
vêm de adapters mock isolados, prontos para serem trocados pela API Spring Boot.

## Como rodar

```bash
npm install
npx expo start          # abra no Expo Go (Android) ou pressione "a" com um emulador aberto
npm run typecheck       # tsc --noEmit
npm run check:mocks     # confere se painel, histórico e PDF fecham entre si
```

Requisitos: Node 18+ e um aparelho/emulador Android 8.0 (API 26) ou superior.
`expo-build-properties` fixa o `minSdkVersion` em 26 (RNF04) para builds nativos (`npx expo run:android` / EAS).

Verificado neste estado: `tsc --noEmit` sem erros e `npx expo export --platform android` gerando o bundle Hermes.

## Menu do protótipo (botão de chave inglesa, canto inferior esquerdo)

Existe só no protótipo. Permite:

- **Visualizar como** Cuidador / Idoso, sem refazer login;
- **Relógio simulado**: o app começa em 05/06/2026 às 14:02 e o tempo corre a partir daí. O atalho
  **15:10** faz a Atorvastatina virar "Não tomada" e, se o Omeprazol não foi confirmado, dispara um alerta novo;
- **Simular falhas**: erro de API (500), sem conexão e carregamento lento;
- ver os **códigos de vínculo** de teste e **restaurar os dados de demonstração** (também apaga o PIN do aparelho).

Códigos de vínculo prontos: `482913` (José, válido), `305718` (Helena, válido), `111111` (expirado), `222222` (já usado).

## Roteiro de demonstração (≈ 5 min)

1. **Criar conta**: "Criar conta de cuidador", senha com maiúscula, minúscula e número; o botão só libera com o consentimento LGPD.
   (Atalho: "Usar conta de demonstração (Maria)" na tela de login.)
2. **Cadastrar paciente**: chip "+ Novo" no topo → nome e nascimento → o código de vínculo aparece com contagem regressiva.
3. **Cadastrar remédio**: digite "Omeprazol" ou "Metformina" e toque em "Buscar dados do remédio" — formato, cor, tamanho
   e marcação são preenchidos e a prévia é desenhada. Teste também um nome inexistente para ver o preenchimento manual.
4. **Tratamento**: dias, horários (horário repetido é bloqueado — RN07), início e fim.
5. **Filtro de idosos**: alterne José / Helena / Todos no painel; a escolha vale em todas as abas.
6. **Perfil Idoso**: menu do protótipo → Idoso → código `482913` → criar PIN de 4 dígitos.
7. **Confirmar dose em 2 toques**: "TOMAR REMÉDIO AGORA" → "TOMEI O REMÉDIO". A Atorvastatina está atrasada,
   então aparece primeiro e é registrada como "Confirmada com atraso"; em seguida, o Omeprazol, como "Tomada".
8. **Voltar ao Cuidador**: a dose aparece confirmada no painel.
9. **Dose não confirmada**: menu do protótipo → relógio 15:10 → modal de alerta (push simulado) e faixa vermelha no painel.
10. **Histórico** com filtros de status e período (registros não editáveis — RN08).
11. **Exportar PDF**: barras de adesão por remédio e geração simulada.
12. **Configurações**: tolerância de 5 a 120 min, com a linha do tempo do aviso e do encerramento.
13. **Mensagens** nos dois perfis (mensagem vazia é bloqueada; o idoso tem respostas rápidas).
14. **Excluir conta**: confirmação em duas etapas (digitar EXCLUIR), com o texto da RN13.

## Estrutura

```
src/
  app/            App.tsx e navegação (stack + bottom tabs, telas condicionais por perfil/sessão/PIN)
  components/ui   PillVisual, PillSizeLegend, DoseStatusBadge, BigActionButton, PinPad, ChatThread, AdherenceBars...
  components/layout  ElderSwitcher, AlertBanner, AlertWatcher, CaregiverScreen, ElderScreen, ProfileSwitcher, Toast
  features/       auth, dashboard, elders, medications, history, messages, settings, elder (telas do idoso), legal
  services/       contratos (types.ts), erros e o ponto único de troca (index.ts)
  adapters/mock   implementação mock dos 7 serviços
  adapters/http   cliente HTTP com JWT e mapa de endpoints da API (ainda não ligado)
  mocks/          seed (Maria, José, Helena), histórico determinístico, catálogo do MedicationInfoService
  lib/            datas, regras de dose (RN08/RN09/RN14), esquemas Zod, máscaras, useQuery, SecureStore
  store/          estado leve da interface (Zustand) e chaves do menu do protótipo
  theme/          cores (claro, escuro, idoso, alto contraste), tipografia Nunito/Nunito Sans, espaçamentos
```

## Trocando os mocks pela API

Cada tela usa apenas `services.*` (`src/services/index.ts`). Para integrar, crie em `src/adapters/http` uma
implementação de cada interface de `src/services/types.ts` usando `request()` de `httpClient.ts` e troque o
objeto em `services/index.ts`. Configure a URL em `EXPO_PUBLIC_API_URL` (ver `.env.example`).
Depois de cada escrita, chame `invalidateQueries()` para as telas abertas recarregarem.

Pontos que a API ainda precisa expor para cobrir todas as telas: listagem de idosos do cuidador,
`GET /api/doses/pendentes` com o status resolvido, alertas do dia, contagem de mensagens não lidas e os campos de
aparência do medicamento (formato, cores, tamanho em mm, imprint, sulco) — hoje a tabela `medicamento` tem só
`formato` e `cor`.

## Decisões do protótipo

- **Status "Não confirmada" (ATRASADA)**: é só de exibição. No banco a dose continua `PENDENTE` depois do aviso e pode
  ser confirmada com atraso até 180 min (RN09); depois disso aparece como `NAO_TOMADA`.
- **Adesão** = doses confirmadas (no prazo ou com atraso) ÷ doses encerradas. Doses ainda em aberto não entram.
  Com os mocks, de 07/05 a 05/06: Metformina 92%, Losartana 88%, Atorvastatina 65%.
- **Sem senha no código**: a conta de demonstração entra por um botão. Contas criadas no app guardam um hash
  ilustrativo só em memória (o backend usa BCrypt). No mock, José e Helena passam a pertencer à conta que entrar,
  para o roteiro funcionar com uma conta nova.
- **Armazenamento local**: apenas a sessão e o PIN do idoso, no SecureStore (Keystore do Android). Nenhum dado de
  saúde vai para AsyncStorage; os dados mock somem ao fechar o app.
- **Tamanho real**: a régua da `PillSizeLegend` usa 1 mm ≈ 6,3 dp (densidade de referência do Android). É uma
  aproximação; a medida exata depende da tela.
- **Acessibilidade (RNF01)**: textos do idoso ≥ 20 sp, botões principais ≥ 88 dp, teclado numérico com teclas de 72 dp,
  status sempre com ícone + texto, rótulos para leitor de tela e respeito ao tamanho de fonte do sistema.
  O botão verde usa `#1E7B45` (contraste 5,6:1 com branco), porque `#27AE60` com texto branco não atinge 4,5:1.
- **Push, PDF e som** são simulados: modal de alerta, arquivo fictício e vibração com anúncio do leitor de tela.

## Ainda não coberto

Testes automatizados de componentes, a avaliação heurística e a medição com o Accessibility Scanner em aparelho
real (seção 4.3 do roteiro), e a integração real com a API, FCM e geração de PDF.
