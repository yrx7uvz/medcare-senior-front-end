# Desempenho do aplicativo

Medições do build de **release** (`npx expo export --platform android` e APK com R8 gerado localmente), antes e depois
das otimizações deste ciclo.

## Tamanho

| | Antes | Depois | Diferença |
|---|---:|---:|---:|
| Bundle JavaScript (bytecode Hermes) | 3,95 MB | **2,48 MB** | −37% |
| Código-fonte que entra no bundle (antes de minificar) | 6,20 MB | 4,58 MB | −26% |
| `lucide-react-native` dentro do bundle | 1.721 KB | só os ~75 ícones usados | — |
| Assets | 47 arquivos, 4,1 MB | **22 arquivos, 0,7 MB** | −83% |
| Fontes (`.ttf`) | 30 arquivos, 4.015 KB | 5 arquivos, 668 KB | −83% |
| APK local (4 arquiteturas de CPU, R8 ligado) | 80,0 MB | **77,1 MB** | −3,6% |

O APK distribuído pelo EAS é do mesmo tipo (universal); a maior parte do tamanho são as bibliotecas nativas das 4
arquiteturas, não o JavaScript.

O que mudou:
- **Ícones um a um:** `import X from 'lucide-react-native/icons/nome'` em vez de `import { X } from
  'lucide-react-native'`. O Metro não remove os ícones não usados do índice do pacote, que trazia a biblioteca inteira
  (mais de 1.500 ícones).
- **Só as fontes usadas:** o `App.tsx` carrega pelo arquivo os 5 pesos que o tema usa (Nunito 700 e 800; Nunito Sans
  400, 600 e 700). O índice do `@expo-google-fonts` referencia todos os pesos dos dois pacotes, e por isso os 30
  arquivos iam para o app.

Como medir de novo:

```powershell
npx expo export --platform android --output-dir dist-check --dump-sourcemap
# tamanho do .hbc em dist-check\_expo\static\js\android e dos arquivos em dist-check\assets
```

## Tempo até a primeira tela

Emulador Android 17 (API 37, x86_64) na máquina de desenvolvimento, APK de release, mediana de 5 aberturas a frio
(app encerrado antes de cada uma):

| Marco | Tempo |
|---|---:|
| Primeiro quadro (splash), `am start -W` → `TotalTime` | ~1,0 s |
| Primeira tela do app (`Running "main"` no log) | ~1,6 s |

Não há medição anterior comparável: a única do APK anterior foi a primeira abertura logo depois de instalar (3,4 s),
que inclui a otimização do código pelo Android. O ganho esperado está no carregamento do bundle (37% menor) e no
registro de 5 fontes em vez de 30. Para repetir no aparelho:
`adb shell am start -W -n br.ucb.medcaresenior/.MainActivity` (depois de `adb shell am force-stop br.ucb.medcaresenior`).

## Re-renderizações e listas

| Tela | Situação | Ajuste |
|---|---|---|
| Painel | Re-renderiza a cada 15 s (relógio, para a dose passar a "atrasada" na hora) e a cada atualização. Todos os cartões eram redesenhados, porque cada um recebia uma função `onPress` nova. | `DoseCard` com `React.memo` e `onPress(dose)` estável (`useCallback`) no Painel, no Histórico e no Relatório diário. O `liveAt` já devolve o mesmo objeto quando a dose não muda, e agora só os cartões que mudaram são redesenhados. |
| Conversa | Atualiza a cada 10 s, e cada consulta traz objetos novos, então todos os balões eram redesenhados. | `ChatBubble` memorizado pelo conteúdo (id, texto, horário, lida). |
| Histórico | Lista longa, paginada. | Já era `SectionList` virtualizada, com `keyExtractor` pelo id. |
| Remédios e lista de conversas | Uma linha por remédio ou paciente. | Já eram `FlatList` com `keyExtractor`. |

`getItemLayout` não foi usado: a altura das linhas varia com a fonte do sistema (até 1,8×) e com a quebra de
linha, e um valor fixo erraria a rolagem. O Painel continua em `ScrollView`, porque mostra as doses de um dia (poucas
dezenas no máximo); a conversa também, porque carrega 20 mensagens por página e precisa rolar até a última.

## Dispositivo fraco: fonte no máximo e animações reduzidas

Conferido no emulador com o APK de release, fonte do sistema em **2,0×** e animações desligadas (que é o que o
`AccessibilityInfo.isReduceMotionEnabled` lê): escolha de perfil, login, cadastro e pareamento do paciente.

- Os textos quebram linha, e nada se sobrepõe.
- **Um corte encontrado e corrigido:** o subtítulo do cabeçalho do cadastro terminava em "Para quem cuida dos
  remédi…". O `StackHeader` passou a aceitar duas linhas no título e no subtítulo.
- No pareamento, a última fileira do teclado numérico fica abaixo da dobra com fonte 2,0×, mas a tela rola e tudo
  fica alcançável. O botão de tema flutua no canto superior, e o texto passa por baixo dele ao rolar.
- As telas que dependem de dados (Painel, Histórico, Mensagens, telas do paciente com doses) ficam na checklist do
  aparelho real ([acessibilidade.md](acessibilidade.md)).
- Com animações desligadas, o esqueleto de carregamento não pisca e a confirmação de dose aparece sem a animação de
  escala.
