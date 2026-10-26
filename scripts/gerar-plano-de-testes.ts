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
  { id: 'Confirmação de dose', descricao: 'Paciente confirma as próprias doses; cuidador, as dos pacientes dele', testes: [
    ['backend', 'ConfirmarDoseUseCaseTest', 'noPrazoGravaConfirmadaNoHorarioComAHoraDoServidor'],
    ['backend', 'SegurancaApiTest', 'confirmarDoseNoPrazoDevolveConfirmadaNoHorarioEDuasVezesResponde409'],
    ['backend', 'SegurancaApiTest', 'cuidadorConfirmaDoseDoProprioPacienteENaoADoPacienteDeOutroCuidador'],
    ['app', 'tests/confirmacaoCuidador.test.ts', 'pendente dentro da janela: pode confirmar até o limite que veio do servidor'],
  ] },
  { id: 'UC-07 Aviso por push', descricao: 'Cuidador recebe o aviso de dose não confirmada, sem o nome do remédio', testes: [
    ['backend', 'PushNotificadorDeDoseNaoTomadaAdapterTest', 'enviaMensagemEmPortuguesComPacienteEHorarioSemOMedicamento'],
    ['backend', 'PushNotificadorDeDoseNaoTomadaAdapterTest', 'tokenInvalidoEhDescartadoDoCuidador'],
    ['app', 'tests/notificacao.test.ts', 'payload válido com cuidador logado abre a dose (app aberto, em segundo plano ou fechado: mesma decisão)'],
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
    ['app', 'tests/tema.test.ts', 'lê o alto contraste gravado com o nome antigo (elderHighContrast) por versões anteriores'],
  ] },
];

const MANUAIS = [
  { caso: 'Push real', roteiro: [
    'APK de release instalado no celular do cuidador, com o FCM ligado no servidor.',
    'Entre como cuidador e aceite a permissão de notificações.',
    'Cadastre um remédio com horário daqui a 2 minutos e não confirme a dose.',
    'Feche o app (deslize para tirar da lista de recentes).',
    'No fim da tolerância, a notificação chega ("... não confirmou a dose das HH:MM"), sem o nome do remédio.',
    'Toque na notificação: o app abre direto na dose.',
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
