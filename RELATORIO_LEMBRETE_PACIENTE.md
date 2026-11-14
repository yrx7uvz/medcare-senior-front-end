# Relatório — Lembrete de dose no aparelho do paciente

Data: 13/11/2026. Somente commits locais: nada foi enviado ao GitHub (sem push, PR ou merge).

## Resumo

| Item | Situação | Em uma linha |
|---|---|---|
| Camada A: lembrete agendado no aparelho | **feito** | Alarme no horário e 10 min depois, 72 h, até 60, canal "Lembrete de remédio", funciona sem internet |
| Camada B: reforço do servidor | **feito** | Job a cada minuto, 2 min depois do horário até o aviso ao cuidador, um evento por dose e tipo |
| Migração V18 | **feito** | Token do aparelho do paciente e `tipo` do evento, unicidade por dose e tipo, sem perder dados |
| Endpoints do token do paciente | **feito** | `PUT`/`DELETE /api/pacientes/me/fcm-token`, só PACIENTE, paciente do JWT; 44 operações no OpenAPI |
| Alarme exato e bateria | **feito** | `SCHEDULE_EXACT_ALARM`, módulo nativo local, aviso grande e orientação de bateria nos Ajustes |
| Testes e verificações | **feito** | Backend 710 testes; app 281 testes; todas as verificações verdes; smoke 43/43 (local e público) |
| Documentação | **feito** | LGPD, API, READMEs, acessibilidade, APK e `docs/lembrete-do-paciente.md` |
| Pilha de apresentação | **feito** | Imagem recompilada (commit `a2c6d47`), V18 aplicada sem apagar dados, demonstração com dose a 4 min |
| APK final | **feito** | EAS `apk-final`; permissões do APK real conferidas com `aapt` |

## Branches e ordem de merge

Os dois repositórios continuam empilhados sobre a entrega anterior (que ainda não está na `main`).

**Backend** (`medcare-senior-backend`), do primeiro ao último:
1. `feature/validacao-de-horario-do-tratamento` (já no GitHub)
2. `feature/apresentacao-local-via-tunel`
3. `feature/desconexao-do-paciente-com-autorizacao`
4. `feature/desvincular-paciente` (já no GitHub)
5. **`feature/lembrete-dose-paciente`** (esta)

**App** (`medcare-senior-mobile`):
1. `feature/seletor-de-horario-e-aviso-de-notificacoes` (já no GitHub)
2. `feature/desconexao-do-paciente-com-autorizacao`
3. `feature/correcoes-do-paciente-e-desvinculo` (só local)
4. **`feature/lembrete-dose-paciente`** (esta)

Antes de começar: os dois repositórios estavam limpos e a `main` local igual à `origin/main`. Há branches locais ainda
não enviadas (as dos itens 2 e 3 acima); as branches novas partiram da última que contém a entrega anterior
(`feature/desvincular-paciente` no backend e `feature/correcoes-do-paciente-e-desvinculo` no app).

**Faça o merge do backend antes do app:** o app novo chama `PUT/DELETE /api/pacientes/me/fcm-token`.

## Commits

**Backend** (`feature/lembrete-dose-paciente`):
- `0e0d1ee` Lembra o paciente da dose pelo push do servidor quando o aparelho não tocar
- `a2c6d47` Documenta o lembrete do paciente e põe a dose ao vivo da demonstração a 4 minutos
- `ae64cbf` Atualiza a contagem de testes no README

**App** (`feature/lembrete-dose-paciente`):
- `6c69940` Lembra o paciente na hora do remédio com alarme no próprio aparelho, mesmo sem internet
- `391af55` Versiona o código Android do módulo nativo local de alarmes
- `59bf521` Documenta o lembrete do paciente: duas camadas, limites do Android e teste no aparelho
- (último) este relatório

## 1. App: camada A (lembrete agendado no aparelho)

Arquivos principais:

| Arquivo | O que faz |
|---|---|
| `src/lib/reminderPlan.ts` | Puro: o que agendar (2 por dose, 72 h, até 60, ordem por proximidade, relógio do servidor), identificadores `dose-{id}-1/-2` e a diferença com o que já está agendado (idempotente) |
| `src/lib/reminderCore.ts` | Embrulha o `expo-notifications`: canal, agendar, cancelar a dose, cancelar tudo, permissão, toque |
| `src/lib/reminders.ts` | `sincronizarLembretesDoPaciente()` (única, idempotente, sem chamadas paralelas), `cancelarLembretesDaDose()`, `cancelarTodosOsLembretes()`, decisão do banner em primeiro plano |
| `src/lib/reminderTask.ts` | Tarefa em segundo plano (`expo-background-task`, 15 min), definida no `index.ts` |
| `src/lib/reminderHealth.ts` e `src/lib/useReminderHealth.ts` | Avisos (notificações desligadas, alarme inexato), bateria e o "Toque aqui para ativar" (reaproveita `enableNotifications` do `notificationsOff.ts`) |
| `modules/medcare-alarmes/` | Módulo nativo local (Kotlin): `canScheduleExactAlarms()`, `isIgnoringBatteryOptimizations()` e as telas certas das configurações |

- **Canal `lembrete-dose` ("Lembrete de remédio"):** importância MAX, som padrão no volume de **alarme**
  (`enforceAudibility`), vibração forte, luz, `lockscreenVisibility` público, `bypassDnd` falso. O canal
  `alertas-dose` do cuidador não mudou.
- **Texto:** "Hora do remédio" / "Tomar Losartana às 08:00"; insistência "Você ainda não confirmou o remédio" /
  "Tomar Losartana às 08:00. Toque para confirmar."
- **Quando sincroniza:** abertura e volta ao primeiro plano (`useRefreshOnAppActive`), a cada 15 min com o app aberto,
  mudança de sessão (pareou, saiu, desconectou, trocou de perfil: fora do paciente, cancela tudo), chegada do reforço
  do servidor, segundo plano. Sem rede, não cancela nada.
- **Confirmar** cancela os dois lembretes e tira da tela (`ConfirmDoseScreen`).
- **Toque:** abre `PatientConfirmDose` com o dia da dose, com o início por baixo; com o PIN pedido, espera o
  desbloqueio (`decidePatientDoseOpen`). O mesmo caminho para o lembrete local e o do servidor.
- **Aviso grande** (`NotificationsOffBanner`, variante do paciente: 22 sp, botão de 88 dp) no início e nos Ajustes:
  "O lembrete do remédio está desligado. Toque aqui para ativar" ou "O lembrete pode atrasar. Toque aqui para ativar".
  Quando o alarme exato é liberado, tudo é reagendado (os já agendados continuariam inexatos).
- **Bateria:** cartão "Economia de bateria" nos Ajustes do paciente, com o botão que abre a página do app nas
  configurações ("Bateria" → "Sem restrições"); some quando o app já está sem restrição. Não bloqueia nada.
- **Demo:** agenda a partir dos dados de demonstração, com o alarme levado do relógio simulado para o do aparelho
  (`check:mocks` confere). Os mocks seguem fora do bundle de produção.
- **Cuidador:** nunca agenda (teste `o aparelho do cuidador nunca agenda lembrete de dose`).

## 2. Backend: camada B (reforço do servidor)

- **`V18__lembrete_do_paciente.sql`:** `paciente.token_fcm` e `token_atualizado_em` (com CHECK de que andam juntos e
  índice parcial); `evento_notificacao.tipo` (`AVISO_CUIDADOR`, `LEMBRETE_PACIENTE`) com o valor padrão só para as
  linhas existentes e depois retirado; o UNIQUE de `dose_id` virou `(dose_id, tipo)` na mesma transação.
- **Endpoints:** `PUT /api/pacientes/me/fcm-token` (204; 400 `VALIDACAO`) e `DELETE` (204, idempotente), com
  `@PerfilExigido(PACIENTE)`, regras no `SecurityConfig` antes de `/api/pacientes/**`, tag "Push/Token". O paciente
  vem do JWT; um `pacienteId` no corpo é ignorado. O mesmo token sai de outro paciente (o do cuidador não é tocado).
- **Token apagado:** `DELETE` do app; desconexão do aparelho (`DesconexaoDoAparelhoService`, cobre a saída autorizada
  e a desconexão pelo cuidador); desvinculação e exclusão de conta (some com a linha); FCM `TOKEN_INVALIDO`.
- **Job `LembreteDoPacienteJob`:** `@Scheduled` (segundo 15 de cada minuto) + ShedLock `lembrete-paciente` +
  `LembrarPacienteDaDoseUseCase` + `Clock`. Dose PENDENTE, horário + 2 min ≤ agora < aviso ao cuidador
  (`PoliticaDeJanela.dentroDoLembreteAoPaciente`, que usa o mesmo `avisoEm`), paciente com token. Evento
  `LEMBRETE_PACIENTE` com `ON CONFLICT DO NOTHING`, reivindicação atômica e envio pelo `EnvioDeAvisoService`.
- **Retentativa:** o `ReenviarAvisosPendentesUseCase` trata os dois tipos; o lembrete desiste com `FORA_DA_JANELA`
  (motivo novo) quando a dose chega ao aviso ao cuidador, e com `DOSE_JA_REGISTRADA` quando foi confirmada.
- **Push:** `NotificacaoPushPort` ganhou `OpcoesDeEntrega` (canal, tag, prioridade máxima, validade). Lembrete:
  "Hora do remédio" / "Tomar {remédio} às HH:mm", dados `tipo=LEMBRETE_DOSE`, `doseId`, `pacienteId`, `data`; canal
  `lembrete-dose`, tag `dose-{id}-1`, TTL até o aviso ao cuidador. Sem credencial, vale o adaptador de log. Token e
  texto nunca em log.

## 3. Testes e verificações

| Verificação | Resultado |
|---|---|
| Backend `.\mvnw.cmd verify` (JDK 17, Postgres descartável na porta 55432 com as credenciais do `.env`) | **710 testes**, 0 falhas (eram 649); JaCoCo ok: linhas **96,0%**, ramos **93,8%** |
| OpenAPI | `docs/api/openapi.json` regerado; **44 operações** (eram 42), conferidas no `OpenApiContratoTest`; segurança × documentação verde |
| App `npm run typecheck`, `npm run lint` | verdes |
| App `npm test` | **281 testes** em 26 arquivos (eram 240); cobertura: linhas 87,9%, ramos 85,6% (piso 84/83) |
| `npm run check:core` | 74 verificações OK |
| `npm run check:contrast` / `check:a11y` | todos os pares WCAG / 31 elementos com rótulo e papel |
| `npm run check:mocks` | OK, com a seção nova: 30 lembretes agendados a partir do demo |
| `npm run check:android-permissions` (novo nome; `check:permissions` continua) | 8 permissões, 36 bloqueadas, sem texto claro |
| `npm run smoke` contra o backend da branch na porta 8090 | **43/43** (eram 40) |
| `npm run smoke` pela URL pública da apresentação | **43/43** |
| `npm run plano:testes` | 135 testes citados e conferidos; `docs/plano-de-testes.md` com UC-006 |

Testes novos, por exigência:

| Exigência | Testes |
|---|---|
| Migração do zero e sobre dados; unicidade por dose e tipo | `MigracoesDoZeroPostgresTest.aV18PreservaOsAvisosExistentes...` (avisos da V17 viram `AVISO_CUIDADOR`, aceita um lembrete, recusa o segundo de cada tipo, CHECKs) |
| Job: não envia se confirmada, nem antes de 2 min; uma vez mesmo rodando duas vezes; retentativa; token inválido | `LembreteDoPacientePostgresTest` (7, com execuções simultâneas e relógio ajustável) e `LembrarPacienteDaDoseUseCaseTest` (10) |
| Retentativa dos dois tipos | `ReenviarAvisosPendentesUseCaseTest` (+3), `EnvioDeAvisoServiceTest` (+3) |
| Janela única | `PoliticaDeJanelaTest` (+5: fronteiras do lembrete com tolerâncias 5, 30 e 120) |
| Push | `PushNotificadorDeLembreteDoPacienteAdapterTest` (9), `FCMServiceTest` (+2) |
| Endpoints: 401, 403, paciente do JWT, token de outro paciente; limpeza na desconexão, desvinculação, exclusão e saída autorizada | `TokenDoPacienteApiTest` (11), `TokenDoPacienteUseCasesTest` (8) |
| App: plano, IDs, cancelamento, idempotência, relógio do servidor | `tests/lembrete.test.ts` (33) e `tests/lembreteSessao.test.ts` (8) |

Os testes que gravavam eventos com SQL direto passaram a informar o `tipo` (a V18 tira o valor padrão de propósito).

Observação: o Jest imprime um aviso "Cannot log after tests are done" que vem do `fetch` instalado pelo `jest-expo`;
aparece também sem estas mudanças e não afeta os resultados.

## 4. Decisões tomadas

- **`SCHEDULE_EXACT_ALARM`, não `USE_EXACT_ALARM`:** conferi no código do `expo-notifications` 57
  (`ExpoSchedulingDelegate`): ele usa `setExactAndAllowWhileIdle` só se `canScheduleExactAlarms()`; senão, agenda
  inexato. `USE_EXACT_ALARM` é concedida sem o usuário ver, mas a política do Google Play a reserva a despertadores e
  agendas, e fica bloqueada. Com `SCHEDULE_EXACT_ALARM`, o Android 14+ vem negado em instalação nova: por isso o
  módulo nativo confere e o aviso leva à tela "Alarmes e lembretes".
- **`RECEIVE_BOOT_COMPLETED`** (antes bloqueada): o Android apaga os alarmes ao reiniciar e o `expo-notifications` os
  recria ao ligar. `FOREGROUND_SERVICE` continua bloqueada (a tarefa do WorkManager é curta).
- **Segundo lembrete aos 10 min:** perto o bastante para quem não ouviu o primeiro; só se a dose ainda puder ser
  confirmada naquela hora.
- **Reforço do servidor aos 2 min, até o aviso ao cuidador:** dá a vez ao alarme local e a quem confirma logo; termina
  exatamente quando o aviso começa (sem duas notificações no mesmo instante).
- **72 h / 60 notificações:** cobre um fim de semana sem abrir o app, com folga do limite de alarmes por app.
- **Volume de alarme:** idosos deixam o volume de notificação baixo; o Não Perturbe continua respeitado.
- **Nome do remédio no push do paciente:** pedido no requisito; documentado na LGPD (só o nome, sem dosagem; o aviso
  ao cuidador continua sem o nome).
- **Dose ao vivo da demonstração a 4 min:** a API exige 5 min de antecedência; o script cria pela API a 6 min e
  aproxima o horário por SQL, só no banco da apresentação.
- **Aviso, não pedido automático de permissão:** o paciente vê o aviso grande com um toque para ativar, em vez de um
  diálogo do sistema surgindo sozinho depois do pareamento.

## 5. Limites conhecidos

- Fabricantes que param o app à força (alguns Xiaomi, Huawei, Oppo, Vivo) podem apagar os alarmes até a próxima
  abertura. A orientação de bateria reduz; o reforço do servidor cobre quando há internet. **Sem internet e com o
  fabricante apagando os alarmes, o lembrete pode não tocar.**
- O módulo nativo e o canal só são exercitados no aparelho: os testes cobrem o plano, o agendamento com um
  `expo-notifications` falso e a sessão, não o AlarmManager de verdade (roteiro manual abaixo).
- A tarefa em segundo plano roda quando o Android decide (mínimo de 15 min). É a renovação da janela, não o lembrete.
- Remédio cadastrado pelo cuidador com o celular do paciente sem internet só entra na próxima sincronização com rede.
- Dose confirmada pelo **cuidador** com o celular do paciente sem internet: o segundo lembrete local ainda pode tocar.
- Troca de perfil do paciente para o cuidador sem internet: o token pode ficar no servidor até a próxima vez que o
  perfil do paciente for usado; o reforço ainda pode chegar nesse intervalo.
- Os aparelhos já pareados precisam abrir o app novo uma vez para registrar o token e agendar.

## 6. Pilha de apresentação e APK

- Cópia do banco da apresentação antes da V18 (`pg_dump`) guardada fora dos repositórios; não foi preciso usar.
- `iniciar-apresentacao.ps1`: imagem do commit `a2c6d47`; V18 aplicada (`flyway_schema_history` versão 18, sucesso).
  Dados mantidos: 4 cuidadores, 4 pacientes, 8 remédios, 421 doses e 28 eventos (todos `AVISO_CUIDADOR`).
- `status-apresentacao.ps1`: tudo OK (contêineres, saúde local e pública, push com credencial, relógio, disco).
- `preparar-demonstracao.ps1`: dose ao vivo da Dona Maria **4 minutos depois** da execução (no teste, às 14:17 para
  uma execução às 14:13). **Rode de novo** minutos antes do teste no aparelho: ele renova a dose e os códigos.
- Smoke pela URL pública: 43/43. A pilha ficou **rodando**.
- Endereço do APK: `https://passion-unease-attempt.ngrok-free.dev` (`EXPO_PUBLIC_API_URL` do ambiente `production` do
  EAS, conferido com `eas env:list`).

**APK:** gerado no EAS, perfil `apk-final`, ambiente `production` (commit `391af55`; o módulo nativo compilou).

| Item | Valor |
|---|---|
| Arquivo | `C:\Users\arthu\Projetos\entrega\MedCare-Senior.apk` (substitui o anterior) |
| Tamanho | 81.096.209 bytes (cerca de 77 MB) |
| SHA-256 | `7f8e78c66824b3bd5d2ba46c3f6ec84e3909013836343a6d21e78b1632a3b5e4` |
| Build | https://expo.dev/accounts/arthuribeir0/projects/medcare-senior/builds/62921f77-eb0e-4d6d-81d6-87a4a98f27a8 |
| Download direto | https://expo.dev/artifacts/eas/TIJrDS04n_M_pzfGe5gDF_22NDrklRy4MdQss6vAwK4.apk |
| Endereço da API no APK | https://passion-unease-attempt.ngrok-free.dev |

Permissões do APK real (`npm run check:android-permissions -- --apk`): `ACCESS_NETWORK_STATE`, `INTERNET`,
`POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `SCHEDULE_EXACT_ALARM`, `VIBRATE`, `WAKE_LOCK`, o recebimento do FCM e
a permissão interna do AndroidX; nada fora da lista mínima (`FOREGROUND_SERVICE` e `USE_EXACT_ALARM` ausentes). O
módulo nativo `MedcareAlarmes` está no `classes.dex`.


## O que só o Arthur precisa fazer

1. **Push e PR/merge, backend primeiro** (validação de horário → apresentação local → desconexão → desvincular
   paciente → lembrete do paciente) e depois o app (seletor de horário → desconexão → correções do paciente →
   lembrete do paciente).
2. **Instalar o APK novo nos dois celulares**, por cima do anterior.
3. **No celular do paciente:** permitir notificações (o aviso amarelo leva lá), **Alarmes e lembretes** (aviso "O
   lembrete pode atrasar") e **Bateria → Sem restrições** (Ajustes do paciente → Economia de bateria). Abrir o app do
   paciente uma vez depois de instalar.
4. Antes de testar: `deploy\apresentacao\preparar-demonstracao.ps1` (dose a 4 minutos) e abrir o app do paciente.

## Roteiro de teste manual

1. Paciente pareado, PIN criado, notificações permitidas (sem aviso amarelo no início nem nos Ajustes).
2. Dose daqui a poucos minutos (`preparar-demonstracao.ps1`, ou um remédio cadastrado no cuidador para daqui a 6 min);
   abra o app do paciente uma vez.
3. Bloqueie a tela e aguarde: deve **tocar, vibrar e aparecer na tela bloqueada** "Hora do remédio — Tomar ... às HH:MM".
4. Toque na notificação: abre a dose (pedindo o PIN se passaram mais de 10 minutos do último uso).
5. Confirme: o segundo lembrete ("Você ainda não confirmou o remédio") **não** pode aparecer 10 minutos depois.
6. Repita com o app **fechado à força** e com o **modo avião** ligado: o lembrete local toca do mesmo jeito.
7. Não confirme (com internet): 2 minutos depois chega o reforço do servidor, sem empilhar; no fim da tolerância
   (10 min na demonstração) o **cuidador** continua recebendo o aviso dele.
