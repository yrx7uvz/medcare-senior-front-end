# Plano de testes

Gerado por `npm run plano:testes` (repositório do app, com o do backend ao lado). O script **confere que cada teste
citado existe** (método no backend, título no app) e falha se algum sumir ou mudar de nome: a matriz não fica
desatualizada. São 156 referências a testes automatizados, todas conferidas.

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
| PIN do paciente | PIN local de 4 números, com hash e bloqueio progressivo | app: `tests/pin.test.ts` › PBKDF2-SHA256 com o custo atual, sal de 16 bytes aleatório: o mesmo PIN gera hashes diferentes<br>app: `tests/pin.test.ts` › a cada 5 erros seguidos, bloqueio de 30 s, 2 min, 10 min e 10 min daí em diante<br>app: `tests/pin.test.ts` › nunca guarda o PIN em texto<br>app: `tests/pinTolerancia.test.ts` › fronteiras: 9:59 e 10:00 entram direto; 10:01 pede o PIN<br>app: `tests/pinTolerancia.test.ts` › relógio que voltou (último uso no futuro): pede o PIN<br>app: `tests/pinTolerancia.test.ts` › Sempre pede; Nunca não pede; o padrão segue a tolerância |
| Desvincular paciente | Cuidador remove um paciente da conta: dados apagados, doses registradas anonimizadas, aparelho do paciente sai | backend: `DesvincularPacienteUseCaseTest` › deveApagarDadosDoPacienteNaOrdemDasChavesEstrangeiras<br>backend: `DesvinculacaoApiTest` › desvincularApagaOPacienteEOsDadosDeleEAnonimizaAsDosesRegistradas<br>backend: `DesvinculacaoApiTest` › depoisDeDesvincularOPacienteSome404EOAparelhoPerdeASessao<br>backend: `DesvinculacaoAtomicaTest` › falhaNoMeioNaoDeixaEstadoParcial<br>app: `tests/desvinculo.test.ts` › nome diferente, só o primeiro nome ou vazio não libera<br>app: `tests/desvinculo.test.ts` › DELETE /api/pacientes/{id}, 204 sem corpo |
| Tema do paciente | Escuro do paciente igual ao do cuidador; o paciente escolhe Automático, Claro ou Escuro | app: `tests/tema.test.ts` › só o texto secundário (documentado) difere entre paciente escuro e cuidador escuro<br>app: `tests/tema.test.ts` › escolher Escuro muda as cores do paciente mesmo com o celular no claro; Automático volta a seguir o celular |
| Abrir a dose do paciente | A tela da dose abre com a dose da lista, sem skeleton nem salto, e o status não muda só por abrir | app: `tests/aberturaDaDose.test.ts` › com a dose da lista: pronta no primeiro quadro, sem carregamento<br>app: `tests/aberturaDaDose.test.ts` › a dose da lista, recalculada na tela da dose no mesmo instante, não muda (sem "Atrasado" piscando) |
| E-mail do cuidador | Conta nova confirma o e-mail com um código de 6 números antes de cadastrar pacientes; "Esqueci minha senha" troca a senha por código; domínio que não existe é barrado e o app sugere a correção | backend: `VerificacaoDeEmailApiTest` › cadastroEnviaOCodigoEOPacienteSoDepoisDeConfirmar<br>backend: `VerificacaoDeEmailApiTest` › reenviarSoDepoisDeUmMinuto<br>backend: `VerificacaoDeEmailApiTest` › cadastroRecusaEmailForaDoFormatoOuDeDominioInexistente<br>backend: `VerificacaoDeEmailApiTest` › esqueciASenhaTrocaASenhaEConfirmaOEmail<br>backend: `VerificacaoDeEmailApiTest` › esqueciASenhaDeEmailSemContaRespondeIgualENaoEnviaNada<br>backend: `CodigosPorEmailServiceTest` › cincoErrosBloqueiamOCodigoAteOCertoDeixaDeValer<br>backend: `CodigosPorEmailServiceTest` › enviaUmCodigoDeSeisDigitosEGuardaSoOHash<br>app: `tests/email.test.ts` › corrige os erros de digitação mais comuns no domínio<br>app: `tests/email.test.ts` › login com e-mail não confirmado vira emailVerified=false; servidor antigo (sem o campo) conta como confirmado<br>app: `tests/email.test.ts` › confirmar, reenviar, esqueci e redefinir usam as rotas e os nomes da API |
| UC-04 Remédios | Cadastro, edição e remoção de remédios | backend: `CadastrarMedicamentoUseCaseTest` › deveCadastrarMedicamento<br>backend: `EditarMedicamentoUseCaseTest` › deveRejeitarTransferenciaParaPacienteDeOutroCuidador<br>app: `tests/mapeadores.test.ts` › pedido leva só os campos da API, formato só de comprimido e estoque opcional |
| Tratamentos e doses | Horários e dias da semana; as doses são geradas numa janela rolante | backend: `SalvarTratamentoUseCaseTest` › deveSalvarTratamentoValido<br>backend: `GeradorDeDosesServiceTest` › deveGerarSomenteNosDiasDaSemanaDoTratamento<br>backend: `GeradorDeDosesServiceTest` › naoDeveDuplicarDosesJaExistentes<br>backend: `PersistenciaPostgresTest` › indiceUnicoDeixaUmaSoDoseNoMesmoHorarioDoMesmoTratamento<br>app: `tests/mapeadores.test.ts` › tratamento: horários únicos e ordenados, dias em inglês; resposta vira HH:mm e índice |
| Horário do tratamento | Horário de hoje com pelo menos 5 minutos de antecedência (na edição, só os novos); o que já passou fica para o próximo dia | backend: `AntecedenciaDoHorarioTest` › menosDeCincoMinutosAFrenteEhRecusado<br>backend: `EditarTratamentoUseCaseTest` › edicaoSemMudarOsHorariosNaoEhBloqueadaPorHorarioQueJaExistia<br>backend: `TratamentoApiTest` › horarioAgoraOuAMenosDeCincoMinutosResponde400ComAMensagemNoTopoENoCampo<br>app: `tests/horarioDoTratamento.test.ts` › a menos de 5 minutos é recusado; com 5 minutos ou mais, aceito<br>app: `tests/horarioDoTratamento.test.ts` › horário de hoje passou: amanhã, com o texto do aviso |
| Confirmação de dose | Paciente confirma as próprias doses; cuidador, as dos pacientes dele | backend: `ConfirmarDoseUseCaseTest` › noPrazoGravaConfirmadaNoHorarioComAHoraDoServidor<br>backend: `SegurancaApiTest` › confirmarDoseNoPrazoDevolveConfirmadaNoHorarioEDuasVezesResponde409<br>backend: `SegurancaApiTest` › cuidadorConfirmaDoseDoProprioPacienteENaoADoPacienteDeOutroCuidador<br>app: `tests/confirmacaoCuidador.test.ts` › pendente dentro da janela: pode confirmar até o limite que veio do servidor |
| UC-06 Lembrete no aparelho do paciente | Lembrete local no horário e 10 minutos depois, mesmo offline (72 h, até 60, relógio do servidor), cancelado ao confirmar e ao sair | app: `tests/lembrete.test.ts` › duas notificações por dose pendente: no horário e 10 minutos depois, com o texto do paciente<br>app: `tests/lembrete.test.ts` › janela de 72 horas: o que passa dela fica para a próxima sincronização<br>app: `tests/lembrete.test.ts` › nunca mais de 60 notificações, das mais próximas para as mais distantes<br>app: `tests/lembrete.test.ts` › relógio do servidor: com o aparelho 5 minutos adiantado, o alarme é agendado 5 minutos mais tarde no relógio dele<br>app: `tests/lembrete.test.ts` › rodar duas vezes não duplica nem reagenda; cada alarme vai para o canal do lembrete na hora certa<br>app: `tests/lembrete.test.ts` › confirmar a dose cancela os dois lembretes dela e tira da tela o que já apareceu; as outras doses continuam<br>app: `tests/lembrete.test.ts` › desbloqueado abre a dose; com o PIN pedido, espera o desbloqueio (o lembrete não contorna o PIN)<br>app: `tests/lembreteSessao.test.ts` › sem internet: os lembretes já agendados continuam (o paciente é lembrado mesmo offline)<br>app: `tests/lembreteSessao.test.ts` › sair da conta, desconexão ou troca de perfil: cancela tudo<br>app: `tests/lembreteSessao.test.ts` › o aparelho do cuidador nunca agenda lembrete de dose (nem consulta as doses para isso) |
| UC-06 Alarme da dose | No APK com o módulo nativo, a dose vira alarme que toca até a confirmação (ou o fim do prazo), no lugar dos dois lembretes; "Tomar o remédio" abre a dose | app: `tests/alarme.test.ts` › um alarme por dose pendente: toca no horário e vale até o prazo de confirmação<br>app: `tests/alarme.test.ts` › dose cujo horário passou continua enquanto pode ser confirmada (o alarme dela pode estar tocando ou adiado)<br>app: `tests/alarme.test.ts` › sem rede em algum dia: só sai o alarme das doses que vieram (as confirmadas)<br>app: `tests/alarme.test.ts` › fora do Android, sem o módulo ou com um APK antigo (sem as funções do alarme), fica inerte<br>app: `tests/alarmeSessao.test.ts` › com o módulo nativo, a dose vira alarme e os lembretes comuns saem (inclusive os que já estavam agendados)<br>app: `tests/alarmeSessao.test.ts` › dose confirmada para o alarme na hora; na sincronização seguinte, ele não volta<br>app: `tests/alarmeSessao.test.ts` › nativo com falha: os dois lembretes comuns assumem<br>app: `tests/alarmeSessao.test.ts` › o reforço do servidor não repete o aviso de uma dose que tem alarme<br>app: `tests/alarmeSessao.test.ts` › "Tomar o remédio" na tela do alarme abre a dose no app, uma vez só |
| UC-06 Reforço do lembrete pelo servidor | Push ao paciente 2 min depois do horário, só com a dose PENDENTE e antes do aviso ao cuidador, uma vez por dose | backend: `LembrarPacienteDaDoseUseCaseTest` › naoEnviaAntesDoAtrasoMinimoDeDoisMinutos<br>backend: `LembreteDoPacientePostgresTest` › jobRodandoAoMesmoTempoEDepoisEnviaUmLembreteSoComOTextoECanalDoPaciente<br>backend: `LembreteDoPacientePostgresTest` › naoEnviaAntesDeDoisMinutosNemParaDoseConfirmadaNemParaPacienteSemAparelho<br>backend: `LembreteDoPacientePostgresTest` › paraNoAvisoAoCuidadorConformeAToleranciaDeCadaCuidador<br>backend: `LembreteDoPacientePostgresTest` › tokenInvalidoApagaOTokenDoPacienteEEncerraOLembrete<br>backend: `LembreteDoPacientePostgresTest` › falhaTemporariaEhReenviadaPelaRetentativaDentroDaJanela<br>backend: `LembreteDoPacientePostgresTest` › avisoAoCuidadorELembreteAoPacienteDaMesmaDoseConvivemUmDeCadaTipo<br>backend: `MigracoesDoZeroPostgresTest` › aV18PreservaOsAvisosExistentesComoAvisoAoCuidadorEAUnicidadePassaASerPorDoseETipo<br>backend: `TokenDoPacienteApiTest` › oPacienteVemDoJwtEOCorpoNaoEscolheOutroPaciente<br>backend: `TokenDoPacienteApiTest` › semTokenResponde401ComPerfilErradoResponde403ETokenInvalidoResponde400<br>backend: `TokenDoPacienteApiTest` › desconectarOAparelhoApagaOTokenEOAparelhoNaoConsegueRegistrarDeNovo<br>app: `tests/lembrete.test.ts` › o lembrete local e o do servidor têm o mesmo payload e abrem a mesma dose |
| UC-07 Aviso por push | Cuidador recebe o aviso de dose não confirmada, sem o nome do remédio | backend: `PushNotificadorDeDoseNaoTomadaAdapterTest` › enviaMensagemEmPortuguesComPacienteEHorarioSemOMedicamento<br>backend: `PushNotificadorDeDoseNaoTomadaAdapterTest` › tokenInvalidoEhDescartadoDoCuidador<br>app: `tests/notificacao.test.ts` › payload válido com cuidador logado abre a dose (app aberto, em segundo plano ou fechado: mesma decisão)<br>app: `tests/avisoNotificacoes.test.ts` › aparece com a permissão negada ou ainda não pedida, só onde o push existe |
| UC-08 Relatório diário | Doses do dia de um paciente, com totais | backend: `GerarRelatorioDiarioUseCaseTest` › semDataUsaHojeNoFusoDaAplicacaoEMontaTotaisEDoses<br>backend: `GerarRelatorioDiarioUseCaseTest` › segundaChamadaDoMesmoDiaVemDoCacheMasODonoEhConferidoSempre<br>app: `tests/mapeadores.test.ts` › RelatorioDiarioResponse vira DailyReport com totais e doses |
| UC-10 Mensagens | Conversa entre o cuidador e cada paciente | backend: `MensagemApiTest` › cuidadorEnviaParaUmPacienteSeuEPacienteEnviaParaOCuidador<br>backend: `MensagemApiTest` › conteudoVazioSoEspacosAusenteOuMaiorQue500Eh400NoCampoConteudo<br>backend: `AcessoAConversaServiceTest` › pacienteInformandoOutroPacienteEhAcessoNegado<br>app: `tests/mensagens.test.ts` › vazio ou só espaços não envia; até 500 caracteres envia; 501 não |
| UC-11 Histórico | Histórico de doses filtrável e paginado | backend: `ConsultarHistoricoUseCaseTest` › semFiltrosBuscaTodosOsPacientesDoCuidadorAteHojeEAvaliaAsDoses<br>backend: `ConsultarHistoricoUseCaseTest` › pacienteDeOutroCuidadorEhNaoEncontrado<br>app: `tests/mapeadores.test.ts` › HistoricoResponse vira HistoryPage; caminho com filtros e junção das páginas |
| UC-12 PDF de adesão | Exportação do histórico em PDF; período sem doses não gera arquivo | backend: `GerarRelatorioPdfUseCaseTest` › periodoSemDosesNaoGeraArquivo<br>backend: `RelatorioPdfApiTest` › periodoSemDosesEh422ComCodigo<br>app: `tests/relatorioPdf.test.ts` › nome sem dado pessoal, igual ao do servidor |
| Segurança e contrato | Perfil exigido em cada rota, HTTPS obrigatório no app de release, contrato da API | backend: `OpenApiContratoTest` › perfilAnotadoBateComOSecurityConfigEmTodasAsRotas<br>backend: `SwaggerDesligadoEmProducaoTest` › semAVariavelADocumentacaoResponde404<br>app: `tests/configuracaoRelease.test.ts` › recusa http:// no release: há problema de configuração e o cliente HTTP não recebe o endereço<br>app: `tests/configuracaoRelease.test.ts` › a tela de configuração mostra o motivo, como alerta acessível |
| Acessibilidade | Contraste, tamanho de fonte e alvos de toque | app: `tests/acessibilidade.test.ts` › cuidador: corpo ≥ 16 sp e rótulos ≥ 14 sp; paciente ≥ 20 sp<br>app: `tests/acessibilidade.test.ts` › cada componente-base usa a área mínima<br>app: `tests/seletorDeHorario.test.ts` › a ação acessível increment aumenta e decrement diminui, com volta<br>app: `tests/tema.test.ts` › lê o alto contraste gravado com o nome antigo (elderHighContrast) por versões anteriores<br>app: `tests/tema.test.ts` › alterna entre claro e escuro; no alto contraste (fundo preto), vai para o claro<br>app: `tests/teclado.test.ts` › sobe exatamente o que o teclado cobre da área |

## O que só se testa à mão

Estes itens dependem de aparelho real, de serviço externo ou de percepção humana. Preencha a coluna **Resultado**
(ok / falhou, com data e aparelho) e, se falhar, descreva o passo.

### E-mail do cuidador

1. No cadastro, digite "voce@gmial.com": aparece "Você quis dizer voce@gmail.com?"; toque para corrigir.
2. Cadastre com um domínio que não existe (ex.: voce@dominio-inexistente-123.com): a API recusa no campo E-mail.
3. Cadastre com um e-mail seu: abre "Confirme seu e-mail" (sem SMTP na apresentação, o código sai em .\ultimo-codigo-email.ps1).
4. Digite um código errado: "Código incorreto. Você tem mais 4 tentativas." "Reenviar código" só libera depois de 1 minuto.
5. Digite o código certo: entra no painel e consegue cadastrar o paciente.
6. Saia, toque em "Esqueci minha senha", peça o código, troque a senha e entre com a nova (a antiga não entra mais).

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### Lembrete do paciente

1. Paciente pareado, PIN criado; em Ajustes do paciente, nenhum aviso amarelo (notificações e alarmes liberados; bateria "Sem restrições").
2. No cuidador, cadastre uma dose para daqui a 6 minutos.
3. No paciente, abra o app uma vez e bloqueie a tela.
4. Na hora: toca, vibra e aparece na tela bloqueada "Hora do remédio — Tomar ... às HH:MM".
5. Toque na notificação: abre a dose (pede o PIN se passaram mais de 10 minutos de uso).
6. Confirme: o segundo lembrete ("Você ainda não confirmou o remédio") não aparece 10 minutos depois.
7. Repita com o app fechado à força e com o modo avião: o lembrete local toca do mesmo jeito.
8. Não confirme: 2 minutos depois chega o reforço do servidor (com internet), sem empilhar; no fim da tolerância o cuidador recebe o aviso dele.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### Alarme da dose

1. APK com o alarme; paciente pareado, sem aviso amarelo no início (notificações, alarmes e tela cheia liberados).
2. No cuidador, cadastre uma dose para daqui a 2 minutos (modo de teste) e, no paciente, abra o app uma vez e bloqueie a tela.
3. Na hora: a tela acende com "Hora do remédio", o remédio e o horário; o som de alarme não para e o celular vibra.
4. Toque em "Adiar 5 minutos": cala, a notificação some e o alarme volta 5 minutos depois.
5. Abra só a gaveta de notificações (o som cala): 2 minutos depois toca de novo.
6. Toque em "Tomar o remédio": pede o desbloqueio e abre a dose no app (PIN se for a vez dele); a notificação fica, sem som.
7. Não confirme por 3 minutos: o alarme volta a tocar. Confirme: o alarme some e não volta.
8. Reinicie o celular com um alarme marcado para depois: ele toca na hora mesmo assim.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### Push real

1. APK de release instalado no celular do cuidador, com o FCM ligado no servidor.
2. Entre como cuidador e aceite a permissão de notificações.
3. Cadastre um remédio com horário daqui a 6 minutos (o app recusa horário de hoje a menos de 5) e não confirme a dose.
4. Feche o app (deslize para tirar da lista de recentes).
5. No fim da tolerância, a notificação chega ("... não confirmou a dose das HH:MM"), sem o nome do remédio.
6. Toque na notificação: o app abre direto na dose.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### Seletor de horário

1. Remédios → Novo remédio → Adicionar horário.
2. Arraste a coluna das horas e a dos minutos: só a coluna rola, a tela não.
3. Arremesse a coluna dos minutos: passa vários valores, para encaixado numa linha e vibra de leve a cada número.
4. Toque no número logo abaixo do escolhido: a roda vai até ele. Role as horas além do 23: aparece 00 (dá a volta).
5. No tema claro e no escuro, a faixa da linha escolhida vai de ponta a ponta atrás das duas colunas e do ":".
6. Escolha um horário de hoje daqui a 2 minutos e salve: aparece a mensagem dos 5 minutos no campo dos horários.
7. Escolha um horário de hoje que já passou: aparece o aviso de que a primeira dose será no próximo dia.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### Notificações desligadas

1. No Android, desligue as notificações do MedCare (Configurações → Apps → MedCare → Notificações).
2. Volte ao app: o Painel e os Ajustes mostram que as notificações estão desligadas.
3. Toque em "Ativar notificações": o Android pede a permissão ou abre as configurações do app; ligue e volte.
4. O aviso some sem precisar reabrir o app.

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

### PIN com tolerância de 10 minutos

1. No celular do paciente, desbloqueie com o PIN, use o app e feche (tire da lista de recentes).
2. Abra de novo antes de 10 minutos: entra direto, sem PIN.
3. Feche e espere mais de 10 minutos: ao abrir, o PIN é pedido.
4. Ajustes → "Pedir o PIN ao abrir o app" → Sempre: a cada abertura, o PIN é pedido.
5. Escolha "Nunca neste celular": o app pede o PIN atual e mostra o aviso; depois disso, abre sem PIN.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### Desvincular paciente

1. Cuidador: Ajustes → Pacientes → o paciente → "Desvincular paciente".
2. Leia a explicação, toque em Continuar e digite o nome do paciente: o botão só libera com o nome certo.
3. Confirme: aparece "Paciente desvinculado." e a lista, o Painel, Remédios, Histórico e Mensagens não mostram mais o paciente.
4. No celular do paciente, abra o app: ele volta ao pareamento com o aviso de conectar de novo.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### Tema e tela da dose do paciente

1. Paciente: Ajustes → Tema → Escuro; compare com o cuidador no escuro: mesmas cores de fundo, cartões e botões.
2. No início, toque em "Tomar remédio agora": a tela da dose abre já pronta, sem esqueleto e sem o rodapé surgir depois.
3. Repita com a fonte do Android no máximo e no alto contraste: o horário e o status não cortam; o status desce de linha.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |

### PDF compartilhado

1. Histórico → Exportar PDF → escolha o período e gere.
2. Compartilhe pelo menu do Android (ex.: e-mail ou Drive) e abra o arquivo: paciente, período, doses e taxa de adesão.

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |
