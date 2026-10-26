# Plano de testes

Gerado por `npm run plano:testes` (repositório do app, com o do backend ao lado). O script **confere que cada teste
citado existe** (método no backend, título no app) e falha se algum sumir ou mudar de nome: a matriz não fica
desatualizada. São 93 referências a testes automatizados, todas conferidas.

Como rodar todos os testes automatizados:
- **backend:** `.\mvnw.cmd verify` (com as variáveis `POSTGRES_*`);
- **app:** `npm test`, `npm run check:core`, `npm run check:a11y` e `npm run check:contrast`;
- **de ponta a ponta:** `npm run smoke` contra um backend no ar (cria e exclui uma conta de teste).

## Regras de negócio → testes

| Regra | O que garante | Testes automatizados |
|---|---|---|
| RN-01 | E-mail do cuidador único no sistema | backend: `CadastrarCuidadorUseCaseTest` › deveRejeitarEmailJaCadastrado<br>backend: `CadastrarCuidadorUseCaseTest` › deveNormalizarEmailAntesDeChecarDuplicidade |
| RN-02 | Senha forte: 8+ caracteres, maiúscula, minúscula e número | backend: `CadastrarCuidadorUseCaseTest` › deveRejeitarSenhaFraca<br>app: `tests/validacoes.test.ts` › senha segue a RN02 (8+, maiúscula, minúscula e número) e o medidor de força |
| RN-03 | Sem paciente duplicado (mesmo nome e nascimento) para o mesmo cuidador | backend: `CadastrarPacienteUseCaseTest` › deveRejeitarPacienteDuplicadoParaOMesmoCuidador<br>backend: `CadastrarPacienteUseCaseTest` › deveRejeitarPacienteDuplicadoComVariacaoDeMaiusculasNoNome<br>backend: `CadastrarPacienteUseCaseTest` › devePermitirMesmoNomeEDataParaOutroCuidador |
| RN-04 | Paciente vinculado a um só cuidador: só ele acessa os dados (404 igual a inexistente) | backend: `SegurancaApiTest` › cuidadorANaoVePacienteMedicamentoNemDosesDoCuidadorB<br>backend: `MensagemApiTest` › cuidadorNaoAcessaPacienteDeOutroCuidadorEmNenhumaRota<br>backend: `GerarCodigoVinculoUseCaseTest` › deveRejeitarPacienteDeOutroCuidadorOuInexistente |
| RN-05 | Remédio exige nome, dosagem e tipo | backend: `CadastrarMedicamentoUseCaseTest` › deveRejeitarNomeAusente<br>backend: `CadastrarMedicamentoUseCaseTest` › deveRejeitarDosagemAusente<br>backend: `CadastrarMedicamentoUseCaseTest` › deveRejeitarTipoAusente<br>app: `tests/validacoes.test.ts` › limites da API, estoque inteiro, link da bula, dias, horários repetidos e período |
| RN-06 | Remédio com tratamento ativo só é removido com confirmação | backend: `RemoverMedicamentoUseCaseTest` › deveBloquearRemocaoComTratamentoContinuoSemConfirmacao<br>backend: `RemoverMedicamentoUseCaseTest` › deveRemoverComTratamentoAtivoQuandoForcado |
| RN-07 | Tratamento válido: ao menos um horário, sem repetição, dias da semana e período coerente | backend: `SalvarTratamentoUseCaseTest` › deveRejeitarHorariosDuplicados<br>backend: `SalvarTratamentoUseCaseTest` › deveRejeitarDataFimAnteriorADataInicio<br>app: `tests/horarios.test.ts` › horário repetido não entra e explica o motivo; o formulário também recusa repetidos<br>app: `tests/horarios.test.ts` › remove o único horário e permite escolher outro; ao salvar, pede ao menos um |
| RN-08 | Dose registrada nunca muda, nem em confirmações simultâneas | backend: `ConfirmarDoseUseCaseTest` › doseJaRegistradaNaoMuda<br>backend: `ConfirmarDoseUseCaseTest` › perderACorridaNoUpdateEhJaRegistrada<br>backend: `ConfirmacaoConcorrentePostgresTest` › duasConfirmacoesConcorrentesSoUmaVence<br>app: `tests/doseRules.test.ts` › dose registrada mostra o status gravado em qualquer momento |
| RN-09 | Tolerância do cuidador (5 a 120 min) define o aviso e a janela de confirmação | backend: `PoliticaDeJanelaTest` › outraToleranciaMoveOAvisoOEncerramentoEOStatusDaConfirmacao<br>backend: `ConfirmarDoseUseCaseTest` › usaAToleranciaDoCuidadorParaDecidirSeFoiComAtraso<br>backend: `ToleranciaUseCasesTest` › comConfiguracaoPropriaValeADoCuidador<br>app: `tests/doseRules.test.ts` › janela abre 60 min antes, avisa após a tolerância e encerra 30 min depois do aviso<br>app: `tests/doseRules.test.ts` › tolerância aceita só inteiro de 5 a 120 |
| RN-10 | Aviso que falhou é reenviado com intervalo crescente, até 5 tentativas | backend: `ReenviarAvisosPendentesUseCaseTest` › falhaTemporariaAntesDaUltimaTentativaDeixaOEventoPendente<br>backend: `ReenviarAvisosPendentesUseCaseTest` › falhaTemporariaNaQuintaTentativaEsgotaOAviso<br>backend: `EnvioDeAvisoServiceTest` › falhaTemporariaDeixaOEventoPendenteParaARetentativa |
| RN-11 | Período de consulta e exportação: início não posterior ao fim; sem fim, vale hoje | backend: `FiltroHistoricoTest` › inicioDepoisDoFimEhRecusado<br>backend: `FiltroHistoricoTest` › semFimValeHojeEPaginacaoPadrao<br>backend: `GerarRelatorioPdfUseCaseTest` › inicioAusenteOuDepoisDoFimEhRecusadoAntesDeConsultar<br>app: `tests/datas.test.ts` › 7 e 30 dias contando hoje, personalizado e recusas |
| RN-12 | PDF com paciente, período, remédios, cada dose e taxa de adesão; até 12 meses | backend: `GerarRelatorioPdfUseCaseTest` › montaTotaisDoPeriodoEPorMedicamentoEmOrdemDeNomeEPassaAsDosesEmLotes<br>backend: `GerarRelatorioPdfUseCaseTest` › periodoDeExatamente12MesesEhAceito<br>backend: `OpenPdfGeradorAdapterTest` › trazNomePeriodoGeracaoTaxaTotaisPorMedicamentoEAsLinhasComAcentos<br>app: `tests/relatorioPdf.test.ts` › aceita exatamente 12 meses e recusa 12 meses + 1 dia |
| RN-13 | Exclusão de conta apaga os dados pessoais; o histórico fica anônimo | backend: `ExcluirContaUseCaseTest` › deveApagarDadosNaOrdemDasChavesEstrangeiras<br>backend: `PersistenciaPostgresTest` › exclusaoDeContaApagaTudoDoCuidadorEAnonimizaSomenteAsDosesRegistradas<br>backend: `SegurancaApiTest` › tokenDeCuidadorDeContaExcluidaResponde401SessaoInvalidaEmTodasAsRotas |
| RN-14 | O aviso não muda a dose; ela só vira não confirmada no encerramento da janela | backend: `VerificarDosesVencidasUseCaseTest` › doseQuePassouDaToleranciaGeraEventoEAvisoEContinuaPendente<br>backend: `VerificarDosesVencidasUseCaseTest` › encerraEAvisaComAToleranciaPadraoEAMargemDepoisDoAviso<br>app: `tests/doseRules.test.ts` › avança PENDENTE -> ATRASADA -> NAO_TOMADA e a confirmabilidade nos limites exatos |

## Casos de uso → testes

| Caso de uso | O que cobre | Testes automatizados |
|---|---|---|
| Cadastro e login | Cuidador se cadastra (com o termo LGPD) e entra | backend: `CadastrarCuidadorUseCaseTest` › deveCadastrarCuidadorComSenhaHasheada<br>backend: `SegurancaApiTest` › cadastroDeCuidadorContinuaPublico<br>backend: `SegurancaApiTest` › erroResponseTemCodigoEFormatoPadrao<br>app: `tests/validacoes.test.ts` › cadastro confere senhas, telefone e consentimento LGPD |
| Paciente e pareamento | Cuidador cadastra o paciente e gera o código; o aparelho do paciente entra com ele | backend: `GerarCodigoVinculoUseCaseTest` › deveGerarCodigoDeSeisDigitosValidoPor24Horas<br>backend: `ValidarCodigoVinculoUseCaseTest` › codigoValidoDeveGerarTokenComRolePacienteEDevolverIdENomeDoPaciente<br>backend: `ValidarCodigoVinculoUseCaseTest` › codigoJaUsadoDeveSerRejeitado<br>backend: `RateLimiterTest` › deveBloquearASextaTentativaAposCincoFalhas<br>app: `tests/pareamento.test.ts` › aceita exatamente 6 números, ignorando espaços e hífens |
| PIN do paciente | PIN local de 4 números, com hash e bloqueio progressivo | app: `tests/pin.test.ts` › PBKDF2-SHA256 com o custo atual, sal de 16 bytes aleatório: o mesmo PIN gera hashes diferentes<br>app: `tests/pin.test.ts` › a cada 5 erros seguidos, bloqueio de 30 s, 2 min, 10 min e 10 min daí em diante<br>app: `tests/pin.test.ts` › nunca guarda o PIN em texto |
| UC-04 Remédios | Cadastro, edição e remoção de remédios | backend: `CadastrarMedicamentoUseCaseTest` › deveCadastrarMedicamento<br>backend: `EditarMedicamentoUseCaseTest` › deveRejeitarTransferenciaParaPacienteDeOutroCuidador<br>app: `tests/mapeadores.test.ts` › pedido leva só os campos da API, formato só de comprimido e estoque opcional |
| Tratamentos e doses | Horários e dias da semana; as doses são geradas numa janela rolante | backend: `SalvarTratamentoUseCaseTest` › deveSalvarTratamentoValido<br>backend: `GeradorDeDosesServiceTest` › deveGerarSomenteNosDiasDaSemanaDoTratamento<br>backend: `GeradorDeDosesServiceTest` › naoDeveDuplicarDosesJaExistentes<br>backend: `PersistenciaPostgresTest` › indiceUnicoDeixaUmaSoDoseNoMesmoHorarioDoMesmoTratamento<br>app: `tests/mapeadores.test.ts` › tratamento: horários únicos e ordenados, dias em inglês; resposta vira HH:mm e índice |
| Confirmação de dose | Paciente confirma as próprias doses; cuidador, as dos pacientes dele | backend: `ConfirmarDoseUseCaseTest` › noPrazoGravaConfirmadaNoHorarioComAHoraDoServidor<br>backend: `SegurancaApiTest` › confirmarDoseNoPrazoDevolveConfirmadaNoHorarioEDuasVezesResponde409<br>backend: `SegurancaApiTest` › cuidadorConfirmaDoseDoProprioPacienteENaoADoPacienteDeOutroCuidador<br>app: `tests/confirmacaoCuidador.test.ts` › pendente dentro da janela: pode confirmar até o limite que veio do servidor |
| UC-07 Aviso por push | Cuidador recebe o aviso de dose não confirmada, sem o nome do remédio | backend: `PushNotificadorDeDoseNaoTomadaAdapterTest` › enviaMensagemEmPortuguesComPacienteEHorarioSemOMedicamento<br>backend: `PushNotificadorDeDoseNaoTomadaAdapterTest` › tokenInvalidoEhDescartadoDoCuidador<br>app: `tests/notificacao.test.ts` › payload válido com cuidador logado abre a dose (app aberto, em segundo plano ou fechado: mesma decisão) |
| UC-08 Relatório diário | Doses do dia de um paciente, com totais | backend: `GerarRelatorioDiarioUseCaseTest` › semDataUsaHojeNoFusoDaAplicacaoEMontaTotaisEDoses<br>backend: `GerarRelatorioDiarioUseCaseTest` › segundaChamadaDoMesmoDiaVemDoCacheMasODonoEhConferidoSempre<br>app: `tests/mapeadores.test.ts` › RelatorioDiarioResponse vira DailyReport com totais e doses |
| UC-10 Mensagens | Conversa entre o cuidador e cada paciente | backend: `MensagemApiTest` › cuidadorEnviaParaUmPacienteSeuEPacienteEnviaParaOCuidador<br>backend: `MensagemApiTest` › conteudoVazioSoEspacosAusenteOuMaiorQue500Eh400NoCampoConteudo<br>backend: `AcessoAConversaServiceTest` › pacienteInformandoOutroPacienteEhAcessoNegado<br>app: `tests/mensagens.test.ts` › vazio ou só espaços não envia; até 500 caracteres envia; 501 não |
| UC-11 Histórico | Histórico de doses filtrável e paginado | backend: `ConsultarHistoricoUseCaseTest` › semFiltrosBuscaTodosOsPacientesDoCuidadorAteHojeEAvaliaAsDoses<br>backend: `ConsultarHistoricoUseCaseTest` › pacienteDeOutroCuidadorEhNaoEncontrado<br>app: `tests/mapeadores.test.ts` › HistoricoResponse vira HistoryPage; caminho com filtros e junção das páginas |
| UC-12 PDF de adesão | Exportação do histórico em PDF; período sem doses não gera arquivo | backend: `GerarRelatorioPdfUseCaseTest` › periodoSemDosesNaoGeraArquivo<br>backend: `RelatorioPdfApiTest` › periodoSemDosesEh422ComCodigo<br>app: `tests/relatorioPdf.test.ts` › nome sem dado pessoal, igual ao do servidor |
| Segurança e contrato | Perfil exigido em cada rota, HTTPS obrigatório no app de release, contrato da API | backend: `OpenApiContratoTest` › perfilAnotadoBateComOSecurityConfigEmTodasAsRotas<br>backend: `SwaggerDesligadoEmProducaoTest` › semAVariavelADocumentacaoResponde404<br>app: `tests/configuracaoRelease.test.ts` › recusa http:// no release: há problema de configuração e o cliente HTTP não recebe o endereço<br>app: `tests/configuracaoRelease.test.ts` › a tela de configuração mostra o motivo, como alerta acessível |
| Acessibilidade | Contraste, tamanho de fonte e alvos de toque | app: `tests/acessibilidade.test.ts` › cuidador: corpo ≥ 16 sp e rótulos ≥ 14 sp; paciente ≥ 20 sp<br>app: `tests/acessibilidade.test.ts` › cada componente-base usa a área mínima<br>app: `tests/tema.test.ts` › lê o alto contraste gravado com o nome antigo (elderHighContrast) por versões anteriores |

## O que só se testa à mão

Estes itens dependem de aparelho real, de serviço externo ou de percepção humana. Preencha a coluna **Resultado**
(ok / falhou, com data e aparelho) e, se falhar, descreva o passo.

### Push real

1. APK de release instalado no celular do cuidador, com o FCM ligado no servidor.
2. Entre como cuidador e aceite a permissão de notificações.
3. Cadastre um remédio com horário daqui a 2 minutos e não confirme a dose.
4. Feche o app (deslize para tirar da lista de recentes).
5. No fim da tolerância, a notificação chega ("... não confirmou a dose das HH:MM"), sem o nome do remédio.
6. Toque na notificação: o app abre direto na dose.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### TalkBack

1. Siga a checklist de docs/acessibilidade.md, seções "TalkBack ligado" e "Fonte e exibição no máximo".
2. Anote cada tela em que algum botão foi anunciado sem nome, ou em que o foco pulou ou se perdeu.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### Instalação do APK

1. Abra o link da build do EAS no celular e instale; autorize "instalar apps desta fonte".
2. Confira o ícone (e o ícone temático no Android 13+) e a splash ao abrir.
3. Faça os fluxos de docs/apk-de-release.md, seção "Validar o APK".
4. Instale uma versão nova (versionCode maior) por cima: a sessão e o PIN continuam.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### PDF compartilhado

1. Histórico → Exportar PDF → escolha o período e gere.
2. Compartilhe pelo menu do Android (ex.: e-mail ou Drive) e abra o arquivo: paciente, período, doses e taxa de adesão.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |
