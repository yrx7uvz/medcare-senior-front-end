/**
 * Gera docs/plano-de-testes.md: a matriz de rastreabilidade (regras de negócio e casos de uso → testes automatizados
 * dos DOIS repositórios) e o roteiro do que só se testa à mão. Antes de gravar, confere que cada teste citado existe
 * (método no backend, título no app); se algum sumir ou mudar de nome, falha. Assim a matriz não fica desatualizada.
 *
 * Uso: npm run plano:testes   (com o repositório do backend ao lado: ../medcare-senior-backend)
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const APP = join(__dirname, '..');
const BACKEND = join(APP, '..', 'medcare-senior-backend');

/** [repositório, arquivo ou classe, teste]: no backend, classe de teste e método; no app, arquivo e título do teste. */
type Teste = ['backend' | 'app', string, string];
interface Item {
  id: string;
  descricao: string;
  testes: Teste[];
}

const REGRAS: Item[] = [
  { id: 'RN-01', descricao: 'E-mail do cuidador único no sistema', testes: [
    ['backend', 'CadastrarCuidadorUseCaseTest', 'deveRejeitarEmailJaCadastrado'],
    ['backend', 'CadastrarCuidadorUseCaseTest', 'deveNormalizarEmailAntesDeChecarDuplicidade'],
  ] },
  { id: 'RN-02', descricao: 'Senha forte: 8+ caracteres, maiúscula, minúscula e número', testes: [
    ['backend', 'CadastrarCuidadorUseCaseTest', 'deveRejeitarSenhaFraca'],
    ['app', 'tests/validacoes.test.ts', 'senha segue a RN02 (8+, maiúscula, minúscula e número) e o medidor de força'],
  ] },
  { id: 'RN-03', descricao: 'Sem paciente duplicado (mesmo nome e nascimento) para o mesmo cuidador', testes: [
    ['backend', 'CadastrarPacienteUseCaseTest', 'deveRejeitarPacienteDuplicadoParaOMesmoCuidador'],
    ['backend', 'CadastrarPacienteUseCaseTest', 'deveRejeitarPacienteDuplicadoComVariacaoDeMaiusculasNoNome'],
    ['backend', 'CadastrarPacienteUseCaseTest', 'devePermitirMesmoNomeEDataParaOutroCuidador'],
  ] },
  { id: 'RN-04', descricao: 'Paciente vinculado a um só cuidador: só ele acessa os dados (404 igual a inexistente)', testes: [
    ['backend', 'SegurancaApiTest', 'cuidadorANaoVePacienteMedicamentoNemDosesDoCuidadorB'],
    ['backend', 'MensagemApiTest', 'cuidadorNaoAcessaPacienteDeOutroCuidadorEmNenhumaRota'],
    ['backend', 'GerarCodigoVinculoUseCaseTest', 'deveRejeitarPacienteDeOutroCuidadorOuInexistente'],
  ] },
  { id: 'RN-05', descricao: 'Remédio exige nome, dosagem e tipo', testes: [
    ['backend', 'CadastrarMedicamentoUseCaseTest', 'deveRejeitarNomeAusente'],
    ['backend', 'CadastrarMedicamentoUseCaseTest', 'deveRejeitarDosagemAusente'],
    ['backend', 'CadastrarMedicamentoUseCaseTest', 'deveRejeitarTipoAusente'],
    ['app', 'tests/validacoes.test.ts', 'limites da API, estoque inteiro, link da bula, dias, horários repetidos e período'],
  ] },
  { id: 'RN-06', descricao: 'Remédio com tratamento ativo só é removido com confirmação', testes: [
    ['backend', 'RemoverMedicamentoUseCaseTest', 'deveBloquearRemocaoComTratamentoContinuoSemConfirmacao'],
    ['backend', 'RemoverMedicamentoUseCaseTest', 'deveRemoverComTratamentoAtivoQuandoForcado'],
  ] },
  { id: 'RN-07', descricao: 'Tratamento válido: ao menos um horário, sem repetição, dias da semana e período coerente', testes: [
    ['backend', 'SalvarTratamentoUseCaseTest', 'deveRejeitarHorariosDuplicados'],
    ['backend', 'SalvarTratamentoUseCaseTest', 'deveRejeitarDataFimAnteriorADataInicio'],
    ['app', 'tests/horarios.test.ts', 'horário repetido não entra e explica o motivo; o formulário também recusa repetidos'],
    ['app', 'tests/horarios.test.ts', 'remove o único horário e permite escolher outro; ao salvar, pede ao menos um'],
  ] },
  { id: 'RN-08', descricao: 'Dose registrada nunca muda, nem em confirmações simultâneas', testes: [
    ['backend', 'ConfirmarDoseUseCaseTest', 'doseJaRegistradaNaoMuda'],
    ['backend', 'ConfirmarDoseUseCaseTest', 'perderACorridaNoUpdateEhJaRegistrada'],
    ['backend', 'ConfirmacaoConcorrentePostgresTest', 'duasConfirmacoesConcorrentesSoUmaVence'],
    ['app', 'tests/doseRules.test.ts', 'dose registrada mostra o status gravado em qualquer momento'],
  ] },
  { id: 'RN-09', descricao: 'Tolerância do cuidador (5 a 120 min) define o aviso e a janela de confirmação', testes: [
    ['backend', 'PoliticaDeJanelaTest', 'outraToleranciaMoveOAvisoOEncerramentoEOStatusDaConfirmacao'],
    ['backend', 'ConfirmarDoseUseCaseTest', 'usaAToleranciaDoCuidadorParaDecidirSeFoiComAtraso'],
    ['backend', 'ToleranciaUseCasesTest', 'comConfiguracaoPropriaValeADoCuidador'],
    ['app', 'tests/doseRules.test.ts', 'janela abre 60 min antes, avisa após a tolerância e encerra 30 min depois do aviso'],
    ['app', 'tests/doseRules.test.ts', 'tolerância aceita só inteiro de 5 a 120'],
  ] },
  { id: 'RN-10', descricao: 'Aviso que falhou é reenviado com intervalo crescente, até 5 tentativas', testes: [
    ['backend', 'ReenviarAvisosPendentesUseCaseTest', 'falhaTemporariaAntesDaUltimaTentativaDeixaOEventoPendente'],
    ['backend', 'ReenviarAvisosPendentesUseCaseTest', 'falhaTemporariaNaQuintaTentativaEsgotaOAviso'],
    ['backend', 'EnvioDeAvisoServiceTest', 'falhaTemporariaDeixaOEventoPendenteParaARetentativa'],
  ] },
  { id: 'RN-11', descricao: 'Período de consulta e exportação: início não posterior ao fim; sem fim, vale hoje', testes: [
    ['backend', 'FiltroHistoricoTest', 'inicioDepoisDoFimEhRecusado'],
    ['backend', 'FiltroHistoricoTest', 'semFimValeHojeEPaginacaoPadrao'],
    ['backend', 'GerarRelatorioPdfUseCaseTest', 'inicioAusenteOuDepoisDoFimEhRecusadoAntesDeConsultar'],
    ['app', 'tests/datas.test.ts', '7 e 30 dias contando hoje, personalizado e recusas'],
  ] },
  { id: 'RN-12', descricao: 'PDF com paciente, período, remédios, cada dose e taxa de adesão; até 12 meses', testes: [
    ['backend', 'GerarRelatorioPdfUseCaseTest', 'montaTotaisDoPeriodoEPorMedicamentoEmOrdemDeNomeEPassaAsDosesEmLotes'],
    ['backend', 'GerarRelatorioPdfUseCaseTest', 'periodoDeExatamente12MesesEhAceito'],
    ['backend', 'OpenPdfGeradorAdapterTest', 'trazNomePeriodoGeracaoTaxaTotaisPorMedicamentoEAsLinhasComAcentos'],
    ['app', 'tests/relatorioPdf.test.ts', 'aceita exatamente 12 meses e recusa 12 meses + 1 dia'],
  ] },
  { id: 'RN-13', descricao: 'Exclusão de conta apaga os dados pessoais; o histórico fica anônimo', testes: [
    ['backend', 'ExcluirContaUseCaseTest', 'deveApagarDadosNaOrdemDasChavesEstrangeiras'],
    ['backend', 'PersistenciaPostgresTest', 'exclusaoDeContaApagaTudoDoCuidadorEAnonimizaSomenteAsDosesRegistradas'],
    ['backend', 'SegurancaApiTest', 'tokenDeCuidadorDeContaExcluidaResponde401SessaoInvalidaEmTodasAsRotas'],
  ] },
  { id: 'RN-14', descricao: 'O aviso não muda a dose; ela só vira não confirmada no encerramento da janela', testes: [
    ['backend', 'VerificarDosesVencidasUseCaseTest', 'doseQuePassouDaToleranciaGeraEventoEAvisoEContinuaPendente'],
    ['backend', 'VerificarDosesVencidasUseCaseTest', 'encerraEAvisaComAToleranciaPadraoEAMargemDepoisDoAviso'],
    ['app', 'tests/doseRules.test.ts', 'avança PENDENTE -> ATRASADA -> NAO_TOMADA e a confirmabilidade nos limites exatos'],
  ] },
];

const CASOS: Item[] = [
  { id: 'Cadastro e login', descricao: 'Cuidador se cadastra (com o termo LGPD) e entra', testes: [
    ['backend', 'CadastrarCuidadorUseCaseTest', 'deveCadastrarCuidadorComSenhaHasheada'],
    ['backend', 'SegurancaApiTest', 'cadastroDeCuidadorContinuaPublico'],
    ['backend', 'SegurancaApiTest', 'erroResponseTemCodigoEFormatoPadrao'],
    ['app', 'tests/validacoes.test.ts', 'cadastro confere senhas, telefone e consentimento LGPD'],
  ] },
  { id: 'Paciente e pareamento', descricao: 'Cuidador cadastra o paciente e gera o código; o aparelho do paciente entra com ele', testes: [
    ['backend', 'GerarCodigoVinculoUseCaseTest', 'deveGerarCodigoDeSeisDigitosValidoPor24Horas'],
    ['backend', 'ValidarCodigoVinculoUseCaseTest', 'codigoValidoDeveGerarTokenComRolePacienteEDevolverIdENomeDoPaciente'],
    ['backend', 'ValidarCodigoVinculoUseCaseTest', 'codigoJaUsadoDeveSerRejeitado'],
    ['backend', 'RateLimiterTest', 'deveBloquearASextaTentativaAposCincoFalhas'],
    ['app', 'tests/pareamento.test.ts', 'aceita exatamente 6 números, ignorando espaços e hífens'],
  ] },
  { id: 'PIN do paciente', descricao: 'PIN local de 4 números, com hash e bloqueio progressivo', testes: [
    ['app', 'tests/pin.test.ts', 'PBKDF2-SHA256 com o custo atual, sal de 16 bytes aleatório: o mesmo PIN gera hashes diferentes'],
    ['app', 'tests/pin.test.ts', 'a cada 5 erros seguidos, bloqueio de 30 s, 2 min, 10 min e 10 min daí em diante'],
    ['app', 'tests/pin.test.ts', 'nunca guarda o PIN em texto'],
    ['app', 'tests/pinTolerancia.test.ts', 'fronteiras: 9:59 e 10:00 entram direto; 10:01 pede o PIN'],
    ['app', 'tests/pinTolerancia.test.ts', 'relógio que voltou (último uso no futuro): pede o PIN'],
    ['app', 'tests/pinTolerancia.test.ts', 'Sempre pede; Nunca não pede; o padrão segue a tolerância'],
  ] },
  { id: 'Desvincular paciente', descricao: 'Cuidador remove um paciente da conta: dados apagados, doses registradas anonimizadas, aparelho do paciente sai', testes: [
    ['backend', 'DesvincularPacienteUseCaseTest', 'deveApagarDadosDoPacienteNaOrdemDasChavesEstrangeiras'],
    ['backend', 'DesvinculacaoApiTest', 'desvincularApagaOPacienteEOsDadosDeleEAnonimizaAsDosesRegistradas'],
    ['backend', 'DesvinculacaoApiTest', 'depoisDeDesvincularOPacienteSome404EOAparelhoPerdeASessao'],
    ['backend', 'DesvinculacaoAtomicaTest', 'falhaNoMeioNaoDeixaEstadoParcial'],
    ['app', 'tests/desvinculo.test.ts', 'nome diferente, só o primeiro nome ou vazio não libera'],
    ['app', 'tests/desvinculo.test.ts', 'DELETE /api/pacientes/{id}, 204 sem corpo'],
  ] },
  { id: 'Tema do paciente', descricao: 'Escuro do paciente igual ao do cuidador; o paciente escolhe Automático, Claro ou Escuro', testes: [
    ['app', 'tests/tema.test.ts', 'só o texto secundário (documentado) difere entre paciente escuro e cuidador escuro'],
    ['app', 'tests/tema.test.ts', 'escolher Escuro muda as cores do paciente mesmo com o celular no claro; Automático volta a seguir o celular'],
  ] },
  { id: 'Abrir a dose do paciente', descricao: 'A tela da dose abre com a dose da lista, sem skeleton nem salto, e o status não muda só por abrir', testes: [
    ['app', 'tests/aberturaDaDose.test.ts', 'com a dose da lista: pronta no primeiro quadro, sem carregamento'],
    ['app', 'tests/aberturaDaDose.test.ts', 'a dose da lista, recalculada na tela da dose no mesmo instante, não muda (sem "Atrasado" piscando)'],
  ] },
  { id: 'UC-04 Remédios', descricao: 'Cadastro, edição e remoção de remédios', testes: [
    ['backend', 'CadastrarMedicamentoUseCaseTest', 'deveCadastrarMedicamento'],
    ['backend', 'EditarMedicamentoUseCaseTest', 'deveRejeitarTransferenciaParaPacienteDeOutroCuidador'],
    ['app', 'tests/mapeadores.test.ts', 'pedido leva só os campos da API, formato só de comprimido e estoque opcional'],
  ] },
  { id: 'Tratamentos e doses', descricao: 'Horários e dias da semana; as doses são geradas numa janela rolante', testes: [
    ['backend', 'SalvarTratamentoUseCaseTest', 'deveSalvarTratamentoValido'],
    ['backend', 'GeradorDeDosesServiceTest', 'deveGerarSomenteNosDiasDaSemanaDoTratamento'],
    ['backend', 'GeradorDeDosesServiceTest', 'naoDeveDuplicarDosesJaExistentes'],
    ['backend', 'PersistenciaPostgresTest', 'indiceUnicoDeixaUmaSoDoseNoMesmoHorarioDoMesmoTratamento'],
    ['app', 'tests/mapeadores.test.ts', 'tratamento: horários únicos e ordenados, dias em inglês; resposta vira HH:mm e índice'],
  ] },
  { id: 'Horário do tratamento', descricao: 'Horário de hoje com pelo menos 5 minutos de antecedência (na edição, só os novos); o que já passou fica para o próximo dia', testes: [
    ['backend', 'AntecedenciaDoHorarioTest', 'menosDeCincoMinutosAFrenteEhRecusado'],
    ['backend', 'EditarTratamentoUseCaseTest', 'edicaoSemMudarOsHorariosNaoEhBloqueadaPorHorarioQueJaExistia'],
    ['backend', 'TratamentoApiTest', 'horarioAgoraOuAMenosDeCincoMinutosResponde400ComAMensagemNoTopoENoCampo'],
    ['app', 'tests/horarioDoTratamento.test.ts', 'a menos de 5 minutos é recusado; com 5 minutos ou mais, aceito'],
    ['app', 'tests/horarioDoTratamento.test.ts', 'horário de hoje passou: amanhã, com o texto do aviso'],
  ] },
  { id: 'Confirmação de dose', descricao: 'Paciente confirma as próprias doses; cuidador, as dos pacientes dele', testes: [
    ['backend', 'ConfirmarDoseUseCaseTest', 'noPrazoGravaConfirmadaNoHorarioComAHoraDoServidor'],
    ['backend', 'SegurancaApiTest', 'confirmarDoseNoPrazoDevolveConfirmadaNoHorarioEDuasVezesResponde409'],
    ['backend', 'SegurancaApiTest', 'cuidadorConfirmaDoseDoProprioPacienteENaoADoPacienteDeOutroCuidador'],
    ['app', 'tests/confirmacaoCuidador.test.ts', 'pendente dentro da janela: pode confirmar até o limite que veio do servidor'],
  ] },
  { id: 'UC-06 Lembrete no aparelho do paciente', descricao: 'Lembrete local no horário e 10 minutos depois, mesmo offline (72 h, até 60, relógio do servidor), cancelado ao confirmar e ao sair', testes: [
    ['app', 'tests/lembrete.test.ts', 'duas notificações por dose pendente: no horário e 10 minutos depois, com o texto do paciente'],
    ['app', 'tests/lembrete.test.ts', 'janela de 72 horas: o que passa dela fica para a próxima sincronização'],
    ['app', 'tests/lembrete.test.ts', 'nunca mais de 60 notificações, das mais próximas para as mais distantes'],
    ['app', 'tests/lembrete.test.ts', 'relógio do servidor: com o aparelho 5 minutos adiantado, o alarme é agendado 5 minutos mais tarde no relógio dele'],
    ['app', 'tests/lembrete.test.ts', 'rodar duas vezes não duplica nem reagenda; cada alarme vai para o canal do lembrete na hora certa'],
    ['app', 'tests/lembrete.test.ts', 'confirmar a dose cancela os dois lembretes dela e tira da tela o que já apareceu; as outras doses continuam'],
    ['app', 'tests/lembrete.test.ts', 'desbloqueado abre a dose; com o PIN pedido, espera o desbloqueio (o lembrete não contorna o PIN)'],
    ['app', 'tests/lembreteSessao.test.ts', 'sem internet: os lembretes já agendados continuam (o paciente é lembrado mesmo offline)'],
    ['app', 'tests/lembreteSessao.test.ts', 'sair da conta, desconexão ou troca de perfil: cancela tudo'],
    ['app', 'tests/lembreteSessao.test.ts', 'o aparelho do cuidador nunca agenda lembrete de dose (nem consulta as doses para isso)'],
  ] },
  { id: 'UC-06 Reforço do lembrete pelo servidor', descricao: 'Push ao paciente 2 min depois do horário, só com a dose PENDENTE e antes do aviso ao cuidador, uma vez por dose', testes: [
    ['backend', 'LembrarPacienteDaDoseUseCaseTest', 'naoEnviaAntesDoAtrasoMinimoDeDoisMinutos'],
    ['backend', 'LembreteDoPacientePostgresTest', 'jobRodandoAoMesmoTempoEDepoisEnviaUmLembreteSoComOTextoECanalDoPaciente'],
    ['backend', 'LembreteDoPacientePostgresTest', 'naoEnviaAntesDeDoisMinutosNemParaDoseConfirmadaNemParaPacienteSemAparelho'],
    ['backend', 'LembreteDoPacientePostgresTest', 'paraNoAvisoAoCuidadorConformeAToleranciaDeCadaCuidador'],
    ['backend', 'LembreteDoPacientePostgresTest', 'tokenInvalidoApagaOTokenDoPacienteEEncerraOLembrete'],
    ['backend', 'LembreteDoPacientePostgresTest', 'falhaTemporariaEhReenviadaPelaRetentativaDentroDaJanela'],
    ['backend', 'LembreteDoPacientePostgresTest', 'avisoAoCuidadorELembreteAoPacienteDaMesmaDoseConvivemUmDeCadaTipo'],
    ['backend', 'MigracoesDoZeroPostgresTest', 'aV18PreservaOsAvisosExistentesComoAvisoAoCuidadorEAUnicidadePassaASerPorDoseETipo'],
    ['backend', 'TokenDoPacienteApiTest', 'oPacienteVemDoJwtEOCorpoNaoEscolheOutroPaciente'],
    ['backend', 'TokenDoPacienteApiTest', 'semTokenResponde401ComPerfilErradoResponde403ETokenInvalidoResponde400'],
    ['backend', 'TokenDoPacienteApiTest', 'desconectarOAparelhoApagaOTokenEOAparelhoNaoConsegueRegistrarDeNovo'],
    ['app', 'tests/lembrete.test.ts', 'o lembrete local e o do servidor têm o mesmo payload e abrem a mesma dose'],
  ] },
  { id: 'UC-07 Aviso por push', descricao: 'Cuidador recebe o aviso de dose não confirmada, sem o nome do remédio', testes: [
    ['backend', 'PushNotificadorDeDoseNaoTomadaAdapterTest', 'enviaMensagemEmPortuguesComPacienteEHorarioSemOMedicamento'],
    ['backend', 'PushNotificadorDeDoseNaoTomadaAdapterTest', 'tokenInvalidoEhDescartadoDoCuidador'],
    ['app', 'tests/notificacao.test.ts', 'payload válido com cuidador logado abre a dose (app aberto, em segundo plano ou fechado: mesma decisão)'],
    ['app', 'tests/avisoNotificacoes.test.ts', 'aparece com a permissão negada ou ainda não pedida, só onde o push existe'],
  ] },
  { id: 'UC-08 Relatório diário', descricao: 'Doses do dia de um paciente, com totais', testes: [
    ['backend', 'GerarRelatorioDiarioUseCaseTest', 'semDataUsaHojeNoFusoDaAplicacaoEMontaTotaisEDoses'],
    ['backend', 'GerarRelatorioDiarioUseCaseTest', 'segundaChamadaDoMesmoDiaVemDoCacheMasODonoEhConferidoSempre'],
    ['app', 'tests/mapeadores.test.ts', 'RelatorioDiarioResponse vira DailyReport com totais e doses'],
  ] },
  { id: 'UC-10 Mensagens', descricao: 'Conversa entre o cuidador e cada paciente', testes: [
    ['backend', 'MensagemApiTest', 'cuidadorEnviaParaUmPacienteSeuEPacienteEnviaParaOCuidador'],
    ['backend', 'MensagemApiTest', 'conteudoVazioSoEspacosAusenteOuMaiorQue500Eh400NoCampoConteudo'],
    ['backend', 'AcessoAConversaServiceTest', 'pacienteInformandoOutroPacienteEhAcessoNegado'],
    ['app', 'tests/mensagens.test.ts', 'vazio ou só espaços não envia; até 500 caracteres envia; 501 não'],
  ] },
  { id: 'UC-11 Histórico', descricao: 'Histórico de doses filtrável e paginado', testes: [
    ['backend', 'ConsultarHistoricoUseCaseTest', 'semFiltrosBuscaTodosOsPacientesDoCuidadorAteHojeEAvaliaAsDoses'],
    ['backend', 'ConsultarHistoricoUseCaseTest', 'pacienteDeOutroCuidadorEhNaoEncontrado'],
    ['app', 'tests/mapeadores.test.ts', 'HistoricoResponse vira HistoryPage; caminho com filtros e junção das páginas'],
  ] },
  { id: 'UC-12 PDF de adesão', descricao: 'Exportação do histórico em PDF; período sem doses não gera arquivo', testes: [
    ['backend', 'GerarRelatorioPdfUseCaseTest', 'periodoSemDosesNaoGeraArquivo'],
    ['backend', 'RelatorioPdfApiTest', 'periodoSemDosesEh422ComCodigo'],
    ['app', 'tests/relatorioPdf.test.ts', 'nome sem dado pessoal, igual ao do servidor'],
  ] },
  { id: 'Segurança e contrato', descricao: 'Perfil exigido em cada rota, HTTPS obrigatório no app de release, contrato da API', testes: [
    ['backend', 'OpenApiContratoTest', 'perfilAnotadoBateComOSecurityConfigEmTodasAsRotas'],
    ['backend', 'SwaggerDesligadoEmProducaoTest', 'semAVariavelADocumentacaoResponde404'],
    ['app', 'tests/configuracaoRelease.test.ts', 'recusa http:// no release: há problema de configuração e o cliente HTTP não recebe o endereço'],
    ['app', 'tests/configuracaoRelease.test.ts', 'a tela de configuração mostra o motivo, como alerta acessível'],
  ] },
  { id: 'Acessibilidade', descricao: 'Contraste, tamanho de fonte e alvos de toque', testes: [
    ['app', 'tests/acessibilidade.test.ts', 'cuidador: corpo ≥ 16 sp e rótulos ≥ 14 sp; paciente ≥ 20 sp'],
    ['app', 'tests/acessibilidade.test.ts', 'cada componente-base usa a área mínima'],
    ['app', 'tests/seletorDeHorario.test.ts', 'a ação acessível increment aumenta e decrement diminui, com volta'],
    ['app', 'tests/tema.test.ts', 'lê o alto contraste gravado com o nome antigo (elderHighContrast) por versões anteriores'],
  ] },
];

const MANUAIS = [
  { caso: 'Lembrete do paciente', roteiro: [
    'Paciente pareado, PIN criado; em Ajustes do paciente, nenhum aviso amarelo (notificações e alarmes liberados; bateria "Sem restrições").',
    'No cuidador, cadastre uma dose para daqui a 6 minutos.',
    'No paciente, abra o app uma vez e bloqueie a tela.',
    'Na hora: toca, vibra e aparece na tela bloqueada "Hora do remédio — Tomar ... às HH:MM".',
    'Toque na notificação: abre a dose (pede o PIN se passaram mais de 10 minutos de uso).',
    'Confirme: o segundo lembrete ("Você ainda não confirmou o remédio") não aparece 10 minutos depois.',
    'Repita com o app fechado à força e com o modo avião: o lembrete local toca do mesmo jeito.',
    'Não confirme: 2 minutos depois chega o reforço do servidor (com internet), sem empilhar; no fim da tolerância o cuidador recebe o aviso dele.',
  ] },
  { caso: 'Push real', roteiro: [
    'APK de release instalado no celular do cuidador, com o FCM ligado no servidor.',
    'Entre como cuidador e aceite a permissão de notificações.',
    'Cadastre um remédio com horário daqui a 6 minutos (o app recusa horário de hoje a menos de 5) e não confirme a dose.',
    'Feche o app (deslize para tirar da lista de recentes).',
    'No fim da tolerância, a notificação chega ("... não confirmou a dose das HH:MM"), sem o nome do remédio.',
    'Toque na notificação: o app abre direto na dose.',
  ] },
  { caso: 'Seletor de horário', roteiro: [
    'Remédios → Novo remédio → Adicionar horário.',
    'Arraste a coluna das horas e a dos minutos: só a coluna rola, a tela não.',
    'Segure o "+" dos minutos: depois de um instante repete, cada vez mais rápido; ao soltar, para.',
    'Toque nos atalhos (ex.: 08 e :30): o horário muda na hora.',
    'Escolha um horário de hoje daqui a 2 minutos e salve: aparece a mensagem dos 5 minutos no campo dos horários.',
    'Escolha um horário de hoje que já passou: aparece o aviso de que a primeira dose será no próximo dia.',
  ] },
  { caso: 'Notificações desligadas', roteiro: [
    'No Android, desligue as notificações do MedCare (Configurações → Apps → MedCare → Notificações).',
    'Volte ao app: o Painel e os Ajustes mostram que as notificações estão desligadas.',
    'Toque em "Ativar notificações": o Android pede a permissão ou abre as configurações do app; ligue e volte.',
    'O aviso some sem precisar reabrir o app.',
  ] },
  { caso: 'TalkBack', roteiro: [
    'Siga a checklist de docs/acessibilidade.md, seções "TalkBack ligado" e "Fonte e exibição no máximo".',
    'Anote cada tela em que algum botão foi anunciado sem nome, ou em que o foco pulou ou se perdeu.',
  ] },
  { caso: 'Instalação do APK', roteiro: [
    'Abra o link da build do EAS no celular e instale; autorize "instalar apps desta fonte".',
    'Confira o ícone (e o ícone temático no Android 13+) e a splash ao abrir.',
    'Faça os fluxos de docs/apk-de-release.md, seção "Validar o APK".',
    'Instale uma versão nova (versionCode maior) por cima: a sessão e o PIN continuam.',
  ] },
  { caso: 'PIN com tolerância de 10 minutos', roteiro: [
    'No celular do paciente, desbloqueie com o PIN, use o app e feche (tire da lista de recentes).',
    'Abra de novo antes de 10 minutos: entra direto, sem PIN.',
    'Feche e espere mais de 10 minutos: ao abrir, o PIN é pedido.',
    'Ajustes → "Pedir o PIN ao abrir o app" → Sempre: a cada abertura, o PIN é pedido.',
    'Escolha "Nunca neste celular": o app pede o PIN atual e mostra o aviso; depois disso, abre sem PIN.',
  ] },
  { caso: 'Desvincular paciente', roteiro: [
    'Cuidador: Ajustes → Pacientes → o paciente → "Desvincular paciente".',
    'Leia a explicação, toque em Continuar e digite o nome do paciente: o botão só libera com o nome certo.',
    'Confirme: aparece "Paciente desvinculado." e a lista, o Painel, Remédios, Histórico e Mensagens não mostram mais o paciente.',
    'No celular do paciente, abra o app: ele volta ao pareamento com o aviso de conectar de novo.',
  ] },
  { caso: 'Tema e tela da dose do paciente', roteiro: [
    'Paciente: Ajustes → Tema → Escuro; compare com o cuidador no escuro: mesmas cores de fundo, cartões e botões.',
    'No início, toque em "Tomar remédio agora": a tela da dose abre já pronta, sem esqueleto e sem o rodapé surgir depois.',
    'Repita com a fonte do Android no máximo e no alto contraste: o horário e o status não cortam; o status desce de linha.',
  ] },
  { caso: 'PDF compartilhado', roteiro: [
    'Histórico → Exportar PDF → escolha o período e gere.',
    'Compartilhe pelo menu do Android (ex.: e-mail ou Drive) e abra o arquivo: paciente, período, doses e taxa de adesão.',
  ] },
];

// ---------------------------------------------------------------------------------------------------------------

function arquivosJava(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivosJava(p) : p.endsWith('.java') ? [p] : [];
  });
}

const classesDoBackend = new Map<string, string>();
if (existsSync(BACKEND)) {
  for (const f of arquivosJava(join(BACKEND, 'src', 'test', 'java'))) classesDoBackend.set(f.split(/[\\/]/).pop()!.replace('.java', ''), f);
} else {
  console.error(`Repositório do backend não encontrado em ${BACKEND}`);
  process.exit(1);
}

const problemas: string[] = [];
function existe([repo, onde, teste]: Teste): boolean {
  if (repo === 'backend') {
    const arquivo = classesDoBackend.get(onde);
    return !!arquivo && new RegExp(`void ${teste}\\(`).test(readFileSync(arquivo, 'utf8'));
  }
  const arquivo = join(APP, onde);
  return existsSync(arquivo) && readFileSync(arquivo, 'utf8').includes(`'${teste}'`);
}

function linha(item: Item): string {
  for (const t of item.testes) if (!existe(t)) problemas.push(`${item.id}: ${t.join(' › ')}`);
  const testes = item.testes.map(([repo, onde, teste]) => `${repo === 'backend' ? 'backend' : 'app'}: \`${onde}\` › ${teste}`).join('<br>');
  return `| ${item.id} | ${item.descricao} | ${testes} |`;
}

const total = [...REGRAS, ...CASOS].reduce((n, i) => n + i.testes.length, 0);
const conteudo = `# Plano de testes

Gerado por \`npm run plano:testes\` (repositório do app, com o do backend ao lado). O script **confere que cada teste
citado existe** (método no backend, título no app) e falha se algum sumir ou mudar de nome: a matriz não fica
desatualizada. São ${total} referências a testes automatizados, todas conferidas.

Como rodar todos os testes automatizados:
- **backend:** \`.\\mvnw.cmd verify\` (com as variáveis \`POSTGRES_*\`);
- **app:** \`npm test\`, \`npm run check:core\`, \`npm run check:a11y\` e \`npm run check:contrast\`;
- **de ponta a ponta:** \`npm run smoke\` contra um backend no ar (cria e exclui uma conta de teste).

## Regras de negócio → testes

| Regra | O que garante | Testes automatizados |
|---|---|---|
${REGRAS.map(linha).join('\n')}

## Casos de uso → testes

| Caso de uso | O que cobre | Testes automatizados |
|---|---|---|
${CASOS.map(linha).join('\n')}

## O que só se testa à mão

Estes itens dependem de aparelho real, de serviço externo ou de percepção humana. Preencha a coluna **Resultado**
(ok / falhou, com data e aparelho) e, se falhar, descreva o passo.

${MANUAIS.map((m) => `### ${m.caso}

${m.roteiro.map((p, i) => `${i + 1}. ${p}`).join('\n')}

| Aparelho e Android | Data | Resultado | Observação |
|---|---|---|---|
| | | | |
`).join('\n')}`;

if (problemas.length) {
  console.error(`${problemas.length} teste(s) citado(s) não encontrado(s):\n- ${problemas.join('\n- ')}`);
  process.exit(1);
}
const destino = join(APP, 'docs', 'plano-de-testes.md');
writeFileSync(destino, conteudo);
console.log(`OK: ${total} testes conferidos; ${relative(APP, destino)} gravado`);
