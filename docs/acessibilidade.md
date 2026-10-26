# Acessibilidade

O app é pensado para pessoas idosas: letra grande, alto contraste, alvos de toque grandes e tudo anunciado pelo
leitor de tela. Parte disso é conferida por código a cada mudança; o resto só se confere no aparelho, com a checklist
abaixo.

## O que é verificado por código

| Verificação | Como | Resultado atual |
|---|---|---|
| Contraste WCAG dos cinco temas (claro, escuro, paciente claro, paciente escuro e alto contraste do paciente): 4,5:1 para texto, 3:1 para texto grande, bordas e ícones, 7:1 nos textos principais do alto contraste | `npm run check:contrast` e `tests/acessibilidade.test.ts` | passa |
| Rótulo e papel acessíveis em todo elemento interativo nativo (`Pressable`, `Touchable*`, `Switch`: papel **e** rótulo; `TextInput`: rótulo) | `npm run check:a11y` (lê os `.tsx` com o compilador do TypeScript) | passa: 30 elementos. Dois links de texto estavam sem rótulo explícito (login e ajustes) e foram corrigidos |
| Tamanho mínimo de fonte (cuidador: corpo ≥ 16 sp e rótulos ≥ 14 sp; paciente ≥ 20 sp) e respeito à fonte do sistema | `tests/acessibilidade.test.ts` | passa |
| Alvos de toque ≥ 48 dp nos componentes-base (botões, ícones, caixas, chips) | `tests/acessibilidade.test.ts` (área mínima e `hitSlop` que completa até 48 dp) | passa |
| Ícone do app com contraste ≥ 3:1 e dentro da área segura | `npm run gerar:icones` | passa (5,27:1 e 4,65:1) |
| Animações desligadas quando o sistema pede menos movimento (`reduceMotion`) | código: `LoadingSkeleton` e `DoseConfirmedScreen` consultam `AccessibilityInfo.isReduceMotionEnabled` | — |
| Permissões mínimas (nada de câmera, microfone, localização, contatos) | `npm run check:permissions` e `-- --apk` no APK final | passa |

Limite de ampliação da fonte: os textos crescem com a fonte do sistema até 1,8× (`maxFontSizeMultiplier` do
`AppText`). A barra de abas, os botões grandes e o teclado do PIN têm limites menores, para não cortar.

## Checklist no aparelho

Faça num celular Android real, com o APK de release ([apk-de-release.md](apk-de-release.md)). Marque cada item e
anote o que falhou (tela e passo).

### Preparação

- [ ] *Configurações → Acessibilidade → TalkBack*: aprenda o gesto de ligar e desligar (botões de volume juntos).
- [ ] *Configurações → Tela → Tamanho da fonte*: deixe no **máximo**. *Tamanho da exibição*: no **máximo**.
- [ ] *Configurações → Acessibilidade → Remover animações*: **ligado** (nos itens de movimento).

### Fonte e exibição no máximo (sem TalkBack)

- [ ] Nenhum texto cortado nem sobreposto: login, cadastro, painel do cuidador, cadastro de remédio (horários e dias
      da semana), histórico, mensagens, ajustes.
- [ ] Do lado do paciente: tela inicial, confirmar dose, dose confirmada, PIN e mensagens.
- [ ] A barra de abas continua legível e tocável.
- [ ] Com "Remover animações": a confirmação de dose aparece sem a animação de escala e o carregamento não pisca.

### TalkBack ligado

- [ ] **Rótulos:** cada botão, campo e opção é anunciado com nome e função ("Cadastrar remédio, botão"; "E-mail,
      campo de texto"; "Segunda-feira, caixa de seleção, marcada").
- [ ] **Ordem de foco:** deslizar para a direita percorre a tela de cima para baixo, na ordem visual, sem pular nada
      importante e sem parar em elementos decorativos.
- [ ] **Cartão da dose:** é anunciado inteiro (remédio, dosagem, horário, paciente e situação), num toque só.
- [ ] **Erros:** um login errado anuncia a mensagem de erro; um campo inválido no cadastro anuncia o motivo.
- [ ] **Confirmação de dose (paciente):** depois de confirmar, anuncia "Remédio confirmado" (ou "com atraso").
- [ ] **PIN:** cada tecla é anunciada pelo número; "Apagar último número" no botão de apagar.
- [ ] **Alternâncias:** "Alto contraste" e as notificações anunciam o estado ("ligado"/"desligado") e a mudança.
- [ ] **Mensagens:** o campo anuncia "Mensagem para ..."; uma mensagem nova é lida ao chegar ao fim da lista.

### Alto contraste e tema escuro

- [ ] Lado do paciente → botão de alto contraste: textos e bordas ficam mais fortes, e nada some.
- [ ] *Configurações do Android → Tema escuro*: o app acompanha, sem texto escuro sobre fundo escuro.

### Alvos de toque

- [ ] Todos os botões, caixas e ícones são fáceis de tocar com um dedo, sem acertar o vizinho, inclusive os dias da
      semana, as cores e formatos do remédio e o "olho" da senha.

Resultado: anote em [plano-de-testes.md](plano-de-testes.md), na seção de testes manuais.
