# MedCare Sênior: aplicativo

Aplicativo Android do MedCare Sênior, de lembrete e registro de remédios, pensado para pessoas idosas e usado por
qualquer paciente acompanhado por um cuidador. React Native com Expo SDK 57, TypeScript, React Navigation, Zustand,
React Hook Form e Zod. A API (Spring Boot) fica no repositório `medcare-senior-backend`.

Um mesmo app tem dois perfis, escolhidos na primeira tela:

- **Cuidador:** interface completa, para quem acompanha os remédios de alguém.
- **Paciente:** interface simplificada, com letra grande e poucos botões, no celular de quem toma os remédios.

## Telas e fluxos

**Cuidador** (abas Painel, Remédios, Histórico, Mensagens e Ajustes):
1. Cria a conta (senha forte e aceite do termo LGPD) e entra.
2. Cadastra o paciente e gera o **código de vínculo** de 6 números, válido por 24 horas.
3. Cadastra os remédios (formato, cor, dosagem) e o tratamento (horários, dias da semana, início e fim).
4. No **Painel**, vê as doses de hoje: pendentes, atrasadas, confirmadas e não confirmadas. Toca numa dose para ver os
   detalhes e, dentro da janela, **confirmar por ele**.
5. Recebe o **aviso push** quando uma dose não é confirmada a tempo; o toque abre a dose.
6. Consulta o **relatório do dia**, o **histórico** com filtros, e **exporta o PDF** de adesão (até 12 meses),
   compartilhado pelo menu do Android.
7. Troca **mensagens** com cada paciente, ajusta a **tolerância** do aviso (5 a 120 minutos), o tema e as notificações,
   e pode **excluir a conta**.

**Paciente:**
1. Entra com o código que o cuidador gerou e cria um **PIN** de 4 números (pedido ao abrir o app).
2. Vê o próximo remédio em destaque e confirma em dois toques ("Tomar remédio agora" → "Tomei o remédio").
3. Lê e responde as mensagens do cuidador; pode ligar o **alto contraste**.

A janela de cada dose vem do servidor: abre 60 minutos antes do horário; no fim da tolerância do cuidador vira
"atrasada" e o cuidador é avisado; 30 minutos depois, encerra como "não confirmada". Até o aviso, a confirmação é "no
horário"; depois, "com atraso". Uma dose registrada não muda mais.

## Como rodar

Requisitos: Node 24 (`.nvmrc`) e um aparelho ou emulador com Android 8 ou mais novo.

```powershell
npm install
copy .env.example .env      # e ajuste EXPO_PUBLIC_API_URL
```

**Com o backend** (o app de desenvolvimento é um *development build*, por causa dos módulos nativos de push, PIN e
PDF; o Expo Go não serve):
1. Suba o backend (README do repositório do backend).
2. No `.env`: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080` no emulador, ou `http://IP-DO-PC:8080` no celular da
   mesma rede.
3. `npm run start:dev` e, com o app de desenvolvimento instalado (`npm run build:dev` gera o APK no EAS), aperte `a`.

**Modo demonstração** (sem backend, dados fictícios em memória):

```powershell
npm run start:demo          # ou npm run web:demo para ver no navegador
```

No demo há um menu de protótipo (chave inglesa) para trocar de perfil, simular o relógio e falhas, e ver os códigos de
vínculo de teste (`482913` e `305718` válidos; `111111` expirado; `222222` já usado). **O que o demo não mostra:**
o push real (o aviso aparece como um alerta dentro do app), o PDF gerado pelo servidor (sai um PDF fictício marcado
como demonstração) e a persistência (tudo some ao fechar o app). Os dados de demonstração **não entram** no bundle
de produção, e o `npm run check:mocks` confere isso.

## Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `EXPO_PUBLIC_API_URL` | Endereço da API. Em desenvolvimento aceita `http://` da rede local; **no release, só `https://`** (senão o app mostra "App com configuração inválida" e não chama a API). No EAS, vem do ambiente `production`. |
| `EXPO_PUBLIC_DEMO` | `true` liga o modo demonstração. Ao trocar, reinicie com `npx expo start -c`. |
| `GOOGLE_SERVICES_JSON` | Só no build: caminho do `google-services.json` do Firebase, sempre fora do repositório (segredo de arquivo no EAS). Sem ele, o app compila sem push. |
| `ANDROID_ALLOW_CLEARTEXT` | Só no perfil `development` do EAS: permite `http://` para falar com o backend na rede local. |

As variáveis `EXPO_PUBLIC_*` vão embutidas no app: nunca coloque segredo nelas.

## Scripts

| Script | O que faz |
|---|---|
| `npm test` / `npm run test:coverage` | Jest (regras, mapeadores, PIN, datas, configuração de release); com cobertura, falha abaixo do limite mínimo |
| `npm run typecheck` / `npm run lint` | TypeScript sem emitir e ESLint |
| `npm run check:core` | Verificações do núcleo sem rede (adaptadores HTTP com `fetch` falso, configuração do app e do EAS) |
| `npm run check:a11y` | Todo botão, campo e alternância com rótulo e papel acessíveis |
| `npm run check:contrast` | Contraste WCAG dos cinco temas |
| `npm run check:permissions` | Permissões do Android (prebuild numa pasta temporária); `-- --apk arquivo.apk` confere o APK real |
| `npm run check:mocks` | Mocks do demo fora do bundle de produção |
| `npm run smoke` | Fluxo de ponta a ponta contra a API (`EXPO_PUBLIC_API_URL`); cria e exclui uma conta de teste |
| `npm run plano:testes` | Gera `docs/plano-de-testes.md` conferindo que cada teste citado existe nos dois repositórios |
| `npm run gerar:icones` | Gera ícone, ícone adaptativo e splash a partir de SVG, com as cores do tema |
| `npm run build:dev` / `build:preview` / `build:apk` | Builds no EAS: desenvolvimento, prévia e o **APK final** |

## APK de release

`npm run build:apk` gera o APK no EAS (perfil `apk-final`: release, ambiente `production`, só HTTPS, R8 ligado).
O passo a passo completo está em [docs/apk-de-release.md](docs/apk-de-release.md): variáveis do EAS, keystore e
cópia de segurança, versão e `versionCode`, e validação no aparelho.

## Estrutura de pastas

```
src/
  app/            App.tsx (fontes, tema, sessão, push) e a navegação: pilha + abas, telas conforme perfil, sessão e PIN
  features/       telas por assunto: auth, profile, dashboard, patients, medications, history, reports, messages,
                  settings, legal e patient (as telas do paciente)
  components/ui   componentes-base acessíveis (Button, TextField, PinPad, ChatThread, PillVisual, DoseStatusBadge...)
  components/layout  cabeçalhos, seletor de paciente, alertas, banners, tela de configuração inválida
  services/       contratos dos serviços, erros e o ponto único que escolhe entre API e demo
  adapters/http   cliente HTTP (JWT, 401, relógio do servidor) e os adaptadores de cada serviço da API
  adapters/mock   os mesmos serviços para o modo demonstração (só carregados com EXPO_PUBLIC_DEMO=true)
  lib/            regras de dose e janela, datas no fuso de São Paulo, esquemas Zod, PIN, push, sessão, SecureStore
  store/          estado da interface (Zustand)
  theme/          cores (claro, escuro, paciente, alto contraste), tipografia e espaçamentos; única fonte de cores
tests/            Jest
scripts/          verificações (check:*), smoke, geração de ícones e do plano de testes
assets/           ícones e splash gerados
docs/             APK de release, qualidade, desempenho, acessibilidade e plano de testes
```

## Decisões de segurança

- **HTTPS obrigatório no release:** fora do desenvolvimento, o app recusa endereço `http://` e mostra a tela de
  configuração inválida, e o Android sai com `usesCleartextTraffic=false`. Teste: `tests/configuracaoRelease.test.ts`.
- **PIN do paciente:** só o hash fica no aparelho, com PBKDF2-HMAC-SHA256, sal aleatório de 16 bytes e comparação em
  tempo constante. A cada 5 erros seguidos o teclado bloqueia por 30 s, 2 min e 10 min, contados pelo relógio
  monotônico (adiantar o relógio não destrava); o bloqueio continua se o app for fechado.
- **Armazenamento local:** só a sessão, o PIN e as preferências, no SecureStore (Keystore do Android). Nenhum dado de
  saúde fica gravado no aparelho.
- **Permissões mínimas:** internet, estado da rede, notificações, vibração, wake lock e o recebimento do FCM. Câmera,
  microfone, localização, contatos, armazenamento, contador no ícone e o identificador de publicidade ficam
  bloqueados em `app.config.ts`. O `check:permissions -- --apk` confere o APK de verdade.
- **Push sem dado de saúde:** a notificação traz o nome do paciente e o horário, nunca o nome do remédio.
- **Sem segredo no repositório:** `google-services.json`, keystores e `.env` estão no `.gitignore`; os valores do
  build ficam no EAS.

## Mais documentação

- [docs/apk-de-release.md](docs/apk-de-release.md): gerar, assinar e validar o APK.
- [docs/qualidade.md](docs/qualidade.md): SonarQube, `npm audit` e cobertura mínima.
- [docs/desempenho.md](docs/desempenho.md): tamanho do bundle, listas e dispositivo fraco.
- [docs/acessibilidade.md](docs/acessibilidade.md): o que é verificado por código e a checklist no aparelho.
- [docs/plano-de-testes.md](docs/plano-de-testes.md): matriz de rastreabilidade e roteiro dos testes manuais.
