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
npm test                # Jest: regras, validações, datas, máscaras, mapeadores, PIN e env
npm run check:core      # verificações do núcleo sem rede (adapters HTTP com fetch falso)
npm run check:permissions  # permissões finais do Android (prebuild numa pasta temporária; não deixa android/)
npm run smoke:api       # ponta a ponta contra a API (EXPO_PUBLIC_API_URL, padrão http://localhost:8080)
```

No APK gerado pelo EAS, as permissões do manifesto mesclado podem ser conferidas com
`aapt dump permissions app.apk` (Android SDK build-tools).

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

- **Janela da dose** (vem do servidor; o app só exibe): abre 60 min antes do horário; no aviso (horário + tolerância
  do cuidador) a dose passa a "Atrasada" e ainda pode ser confirmada até `limiteConfirmacao` (aviso + 30 min), quando
  vira "Não confirmada" (`NAO_TOMADA`). A dose confirmada até o aviso é "Confirmada no horário"
  (`CONFIRMADA_NO_HORARIO`); depois, "Confirmada com atraso". O cuidador também confirma, na tela da dose, e o app
  mostra quem confirmou.
- **Aviso de dose (push)**: o toque abre a tela da dose (app fechado, em segundo plano ou aberto) com o Painel por
  baixo. Inerte no Expo Go, no modo demo e fora do Android.
- **Relatório em PDF**: baixado da API (até 12 meses) e enviado pelo menu de compartilhar do Android; o arquivo fica
  no cache privado do app só durante o envio. Usa `expo-sharing` (módulo nativo: precisa de nova build de
  desenvolvimento no EAS).
- **Tema**: claro/escuro guardado no aparelho (sem escolha, segue o sistema); idoso com tema claro, escuro e alto
  contraste. Todas as cores ficam em `src/theme/colors.ts` e o `npm run check:contrast` confere os cinco temas.
- **Modo demo fora do release**: os mocks só entram no bundle com `EXPO_PUBLIC_DEMO=true` (`npm run check:mocks`
  falha se algo fora do caminho do demo importar os mocks).
- **Adesão** = doses confirmadas (no prazo ou com atraso) ÷ doses encerradas. Doses ainda em aberto não entram.
  Com os mocks, de 07/05 a 05/06: Metformina 92%, Losartana 88%, Atorvastatina 65%.
- **Sem senha no código**: a conta de demonstração entra por um botão. Contas criadas no app guardam um hash
  ilustrativo só em memória (o backend usa BCrypt). No mock, José e Helena passam a pertencer à conta que entrar,
  para o roteiro funcionar com uma conta nova.
- **Armazenamento local**: apenas a sessão e o PIN do idoso, no SecureStore (Keystore do Android). Nenhum dado de
  saúde vai para AsyncStorage; os dados mock somem ao fechar o app.
- **PIN do idoso**: guardado só como hash PBKDF2-HMAC-SHA256 (2.000 iterações, sal aleatório de 16 bytes do
  `expo-crypto`, comparação em tempo constante). A cada 5 erros seguidos o teclado bloqueia por 30 s, 2 min e
  10 min; o bloqueio conta pelo relógio monotônico (adiantar o relógio não adianta) e continua se o app for fechado.
  PIN antigo em texto é convertido no primeiro uso. O `expo-crypto` é nativo: exige um development build novo.
- **HTTPS no release**: fora do desenvolvimento, `EXPO_PUBLIC_API_URL` precisa ser `https://` (senão o app abre uma
  tela de configuração inválida e não chama a API) e os perfis `preview`/`production` desligam o tráfego em texto
  claro (`usesCleartextTraffic=false`); o perfil `development` continua aceitando `http://` da rede local.
- **Permissões do Android**: só INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, VIBRATE, WAKE_LOCK e o
  recebimento do FCM; armazenamento, câmera, microfone, localização, sobreposição de tela e afins ficam bloqueados
  em `app.config.ts`.
- **Tamanho real**: a régua da `PillSizeLegend` usa 1 mm ≈ 6,3 dp (densidade de referência do Android). É uma
  aproximação; a medida exata depende da tela.
- **Acessibilidade (RNF01)**: textos do idoso ≥ 20 sp, botões principais ≥ 88 dp, teclado numérico com teclas de 72 dp,
  status sempre com ícone + texto, rótulos para leitor de tela e respeito ao tamanho de fonte do sistema.
  O botão verde usa `#1E7B45` (contraste 5,6:1 com branco), porque `#27AE60` com texto branco não atinge 4,5:1.
- **Push, PDF e som** são simulados: modal de alerta, arquivo fictício e vibração com anúncio do leitor de tela.

## Auditoria de dependências

`npm audit` acusa advisories que **não chegam ao app**: estão só nas ferramentas de build que o pacote `expo` traz como
dependência (por isso aparecem também em `npm audit --omit=dev`). Nenhum desses pacotes está no bundle do app
(conferido no sourcemap de `npx expo export --platform android`), e nenhum tem versão corrigida compatível: o único
"fix" do npm é rebaixar para o `expo@44`. **Não use `npm audit fix --force`.**

| Advisory | Pacote | Gravidade | Entra por | Onde roda |
|---|---|---|---|---|
| GHSA-vfj7-8cjw-p6xm | braces 3.0.3 (via micromatch) | alta | `expo` → `@expo/metro` → `metro-file-map`; também `jest` | empacotador e testes (PC/CI) |
| GHSA-86w9-cpqp-85rv | node-forge 1.4.0 | alta | `expo` → `@expo/cli` | CLI do Expo (PC/CI) |
| GHSA-w5hq-g745-h8pq | uuid 7.0.3 | moderada | `expo` → `@expo/config-plugins` → `xcode` | prebuild (PC/CI) |
| GHSA-hp3w-g68c-fv3c | sprintf-js 1.0.3 | moderada | `jest` → `@istanbuljs/load-nyc-config` → `js-yaml` | testes (PC/CI) |

`npx expo install --check` confirma as versões alinhadas ao SDK. Reavaliar a cada atualização do SDK do Expo.

## Ainda não coberto

Testes automatizados de componentes, a avaliação heurística e a medição com o Accessibility Scanner em aparelho
real (seção 4.3 do roteiro), e a integração real com a API, FCM e geração de PDF.
