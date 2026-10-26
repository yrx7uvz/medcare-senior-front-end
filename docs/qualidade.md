# Qualidade: SonarQube, dependências e cobertura

## SonarQube

Análise do SonarQube Community 26.10 (perfil e quality gate "Sonar way"), na máquina local, com a cobertura do Jest
(`coverage/lcov.info`):

| Métrica | Antes das correções | Depois |
|---|---:|---:|
| Quality gate | aprovado | **aprovado** |
| Bugs | 15 | **0** |
| Vulnerabilidades | 14 | **0** |
| Security hotspots | 0 | **0** |
| Code smells | 8 | **0** |
| Nota de confiabilidade / segurança / manutenibilidade | D / C / A | **A / A / A** |
| Duplicação | 0,0% | 0,0% |
| Cobertura, no código inteiro, menos as exclusões abaixo | 40,1% | 40,1% |
| Linhas analisadas | 13.084 | 13.201 |

**Sobre a cobertura.** O Jest mede 83% (instruções e ramos) dos módulos de regra, dos mapeadores e dos adaptadores
HTTP listados no `collectCoverageFrom`. O Sonar mostra 40% porque também conta, como não cobertos, os módulos de lógica
que não têm teste de unidade: sessão, push, armazenamento seguro e os serviços do modo demonstração. Eles são
exercitados pelo `check:core`, que não gera lcov, e pelo smoke contra o backend. **Não foram excluídos para subir o
número.** São os próximos candidatos a teste de unidade.

### O que foi corrigido

| Regra | Onde | Correção |
|---|---|---|
| `S2871`, bug: `sort()` sem função de comparação (ordena como texto) | `WeekdayChips`, `HttpMedicationService` (2), `medicationMeta` e scripts | Comparação numérica para dias da semana e `localeCompare` para horários e nomes. |
| `S3923`, bug: condicional com os dois lados iguais | `ChatBubble` | Simplificado (o comportamento não muda). |
| `S8786`, bug: expressão regular com retrocesso caro | `config/env.ts` (barras finais da URL), `lib/jwt.ts` (`=` final), `lib/schemas.ts` (e-mail) | Barras e `=` finais tirados sem regex (`lib/text.ts`). E-mail com classes que não se sobrepõem (agora também recusa ponto duplo no domínio). Responde em 0 ms a uma entrada patológica de 100 mil caracteres. |
| `S9383`, bug: promessa sem tratamento | `LoadingSkeleton`, `DoseConfirmedScreen`, `LinkCodeScreen`, `check-mocks` | Marcadas com `void` (o resultado é tratado dentro do `then` ou não importa). |
| `S7773` e `S7767`, code smell | `contrast.ts`, `PillVisual`, `MockAuthService`, `check-core` | `Number.parseInt` e `Number.NaN`; hash do mock com `Math.imul` e `>>> 0`, com o mesmo resultado. |

### Revisados e mantidos (com `// NOSONAR` e o motivo na própria linha)

| Regra | Onde | Por que é seguro |
|---|---|---|
| `S5332`: endereço `http://` ou `ftp://` | `check-core.ts`, `check-core-env.ts` | São os testes que conferem justamente que o app trata e **recusa** esses endereços no release; o domínio é `.invalid`, nunca acessado. |
| `S2245`: `Math.random` | `MockPatientService`, `simulate.ts`, `smoke-api.ts` | Código de vínculo e esperas **do modo demonstração** (o código real é gerado no backend, com `SecureRandom`) e um e-mail de teste único no smoke. Nada de segurança. |
| `S4036`: `PATH` no `execSync` | `check-android-permissions.ts` | Ferramenta de verificação local, que roda o `npx` do próprio projeto. Não vai para o app. |
| `S8786`: regex `=+$` | `check-core.ts` | Só nos textos curtos que o próprio teste monta. |

### Exclusões (`sonar-project.properties`)

- **Fora da análise:** só o que não é código do app (`node_modules`, `coverage`, `dist`, `android`, `ios`, `assets`).
- **Fora só da cobertura** (bugs, vulnerabilidades e code smells continuam analisados):
  - telas e componentes visuais (`src/features/**/*.tsx`, `src/components/**`, `src/app/**`), verificados pelo plano
    de testes manuais, pelo `check:a11y` e pelo smoke;
  - dados do modo demonstração (`src/mocks/**`) e tokens de tema (`src/theme/**`), sem lógica a cobrir;
  - os próprios scripts de verificação (`scripts/**`).

## Como rodar a análise

Use o mesmo SonarQube do backend (`docker-compose.sonar.yml` no repositório do backend; o passo a passo do token está
no `docs/qualidade.md` de lá):

```powershell
cd ..\medcare-senior-backend; docker compose -f docker-compose.sonar.yml up -d; cd ..\medcare-senior-mobile
npm run test:coverage                       # gera coverage/lcov.info
$env:SONAR_TOKEN = "cole-o-token-aqui"
docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 -e SONAR_TOKEN=$env:SONAR_TOKEN `
  -v "${PWD}:/usr/src" sonarsource/sonar-scanner-cli:11
# resultado em http://localhost:9000, projeto "MedCare Sênior - app"; depois derrube o SonarQube
```

**No CI (opcional):** o job `qualidade` do `frontend-ci.yml` roda só se o repositório tiver a variável
`SONAR_HOST_URL` e o segredo `SONAR_TOKEN` (*Settings → Secrets and variables → Actions*), com o projeto
`medcare-senior-mobile` criado no servidor. Sem eles, é pulado; se a análise falhar, não derruba o CI.

## Cobertura mínima do Jest

`jest.config.js` tem `coverageThreshold` no piso do que existe hoje: 83% de instruções, 83% de ramos, 77% de funções
e 84% de linhas. `npm run test:coverage` falha abaixo disso, e o CI roda os testes com cobertura. O limite só pode
subir.

## `npm audit`

Resultado: 7 avisos (2 moderados e 5 altos). **Nenhum tem correção sem quebrar versão**, e por isso nada foi forçado
(nem `--force`, nem override de versão maior):

| Pacote | Gravidade | Vem de | Entra no app? | Correção disponível | Decisão |
|---|---|---|---|---|---|
| `node-forge` ≤ 1.4.0 (verificação de assinatura RSA) | alta | `@expo/cli` → `@expo/code-signing-certificates` | **não**: ferramenta de desenvolvimento (assinatura de atualizações do CLI) | nenhuma: 1.4.0 é a última versão | aceito; reavaliar quando sair versão nova |
| `zod` < 4.6.6 (memória em coleções enormes) | alta | dependência direta (e do `@expo/cli`) | **sim** | só no zod 4 (versão maior; exige também o `@hookform/resolvers` 5) | aceito com risco baixo: o zod só valida o que a própria pessoa digita nos formulários (textos com tamanho máximo e no máximo 7 dias da semana). A falha exige coleções enormes, que essas telas não aceitam. A migração para o zod 4 fica registrada como pendência técnica. |
| `uuid` < 11.1.1 (limite de buffer em v3/v5/v6) | moderada | `@expo/ngrok` (túnel do `expo start --tunnel`) | **não**: só desenvolvimento | só na 11 (a 3 instalada tem outra API) | aceito |
| `@expo/cli`, `@expo/code-signing-certificates`, `expo`, `@expo/ngrok` | — | herdam os avisos acima | — | o `npm audit fix --force` sugere **rebaixar o Expo para a versão 44**, o que quebraria o app | recusado |
