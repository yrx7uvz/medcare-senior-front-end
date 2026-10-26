# APK de release

Como gerar o APK instalável do MedCare Sênior, apontando para o servidor HTTPS, e como guardar a assinatura.

## O perfil `apk-final`

Definido no `eas.json`:

| Item | Valor |
|---|---|
| Distribuição | `internal` (link de download do EAS; instalação direta no aparelho) |
| Formato | `apk` (o perfil `production` continua gerando `app-bundle`, para a loja no futuro) |
| Ambiente do EAS | `production`: `EXPO_PUBLIC_API_URL` e o arquivo `GOOGLE_SERVICES_JSON` vêm de lá, nunca do código |
| Modo demonstração | desligado (`EXPO_PUBLIC_DEMO=false`) |
| Texto claro (http://) | proibido: sem `ANDROID_ALLOW_CLEARTEXT`, o app sai com `usesCleartextTraffic=false` |
| Minificação (R8) | `enableMinifyInReleaseBuilds` e `enableShrinkResourcesInReleaseBuilds` ligados no `expo-build-properties` |

Garantias automáticas:
- `npm run check:core` confere o perfil (ambiente `production`, sem texto claro, sem a URL no arquivo);
- `tests/configuracaoRelease.test.ts` confere que um build de release com `http://` não usa o endereço e mostra a
  tela "App com configuração inválida".

> No `expo-build-properties` 57, as opções antigas `enableProguardInReleaseBuilds` e
> `enableShrinkResourcesInReleaseBuilds` passaram a se chamar `enableMinifyInReleaseBuilds` e
> `enableShrinkResourcesInReleaseBuilds`. As bibliotecas nativas do app já trazem as próprias regras de ProGuard
> (react-native-svg, expo-notifications, expo-modules-core e os AARs do React Native e do Firebase), então não há
> regras extras.

## Identidade do app

| Item | Onde | Valor |
|---|---|---|
| Nome | `app.json` | MedCare Sênior |
| Pacote Android | `app.json` / `app.config.ts` | `br.ucb.medcaresenior` (não pode mudar depois de publicado) |
| Versão para pessoas | `app.json` → `version` | `1.0.0` |
| Versão para o Android | `app.json` → `android.versionCode` | `1` |
| Esquema (links) | `app.json` → `scheme` | `medcaresenior` |
| Orientação / tema | `app.json` | retrato / segue o sistema (`automatic`) |
| Ícone, ícone adaptativo e monocromático, splash | `assets/`, gerados por `npm run gerar:icones` | cápsula com "+", nas cores do tema |
| Permissões | `app.config.ts` | lista mínima, conferida por `npm run check:permissions` |

**Como subir a versão** (`appVersionSource: local`: o EAS usa os números do `app.json`): a cada APK distribuído,
**some 1 ao `android.versionCode`** (o Android só instala por cima um APK com `versionCode` maior) e ajuste a
`version` (ex.: `1.0.1` para correções, `1.1.0` para novidades). O `package.json` acompanha a `version`.

O ícone e a splash saem de `scripts/gerar-icones.ts`, que desenha em SVG com as cores de `src/theme/colors.ts` e
confere duas coisas: que o desenho do ícone adaptativo fica dentro do círculo seguro (66 dp de 108 dp) e que o
contraste do símbolo com o fundo é de pelo menos 3:1. A splash usa o ícone arredondado sobre o fundo do tema claro
(`#F0F4F8`) ou do escuro (`#121417`), conforme o sistema.

## Passo a passo (primeira vez)

Pré-requisitos: conta no Expo (a mesma do `owner` no `app.json`), `npm i -g eas-cli` e `eas login`. O servidor
HTTPS precisa estar no ar ([implantação no repositório do backend](../../medcare-senior-backend/docs/implantacao.md)).

1. **Variáveis do ambiente `production` no EAS**, sem colocar valores reais em arquivo do repositório:
   ```powershell
   # Endereço da API (obrigatoriamente https://)
   eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://SEU-SUBDOMINIO.duckdns.org --visibility plaintext
   # google-services.json do Firebase, enviado como ARQUIVO secreto (o caminho é do seu PC, fora do repositório)
   eas env:create --environment production --name GOOGLE_SERVICES_JSON --type file --value C:\Users\arthu\segredos\google-services.json --visibility secret
   eas env:list --environment production   # confira (o arquivo aparece só como secreto)
   ```
2. **Gerar o APK:**
   ```powershell
   npm run build:apk           # = eas build --profile apk-final --platform android
   ```
   Na primeira vez, o EAS pergunta *"Generate a new Android Keystore?"*: responda **Yes**. Ele cria a chave de
   assinatura e a guarda nos servidores do Expo (ver a seção da keystore abaixo).
3. **Baixar:** o terminal mostra o link da build. Na página da build no site do Expo (*Projects → medcare-senior →
   Builds*), o botão **Install** abre um QR code para o celular, e **Download** baixa o `.apk` para o PC. O tamanho
   aparece na mesma página.

## Keystore (assinatura): guarde uma cópia segura

O EAS gera a keystore na primeira build de release e a reutiliza em todas as seguintes. **Não crie nem versione
keystore no repositório** (o `.gitignore` bloqueia `*.jks` e `*.keystore`).

Guardar uma cópia, assim que a primeira build terminar:

1. `eas credentials --platform android` → escolha o perfil `apk-final` → **Keystore: Manage everything needed to
   build your project** → **Download existing keystore**.
2. O EAS salva o arquivo `.jks` e mostra a senha da keystore, o alias e a senha da chave. Guarde **os quatro** juntos
   num lugar protegido **fora do repositório e do PC de trabalho**: um gerenciador de senhas com anexo, ou um pendrive
   criptografado e um segundo lugar (cópia dupla).
3. Nunca mande esses arquivos por chat, e-mail ou issue.

**Se a keystore se perder:** o Android só aceita atualizar um app assinado pela mesma chave. Sem ela, uma nova
versão não instala por cima. Cada pessoa teria que **desinstalar o app**, perdendo o pareamento e o PIN, e instalar
o novo. Na Play Store, com o *Play App Signing*, dá para pedir a troca da chave de envio, mas para APK distribuído
direto não há recuperação. Enquanto ela estiver no EAS, a cópia é a garantia contra perda de acesso à conta.

## Validar o APK

**No aparelho real** (Android 8 ou mais novo):
1. Abra o link da build no celular (ou o QR code) e instale; autorize "instalar apps desta fonte" quando pedir.
2. Confira o ícone na tela inicial (e o ícone monocromático com "Ícones temáticos" ligado no Android 13+) e a splash
   ao abrir.
3. Cuidador: cadastro, login, cadastro de paciente e remédio, geração do código.
4. No mesmo ou em outro aparelho, perfil paciente: pareamento pelo código, PIN, dose do dia e confirmação.
5. **Push:** espere uma dose passar da tolerância sem confirmar; o aviso precisa chegar ao celular do cuidador, mesmo
   com o app fechado.
6. **PDF:** Histórico → Exportar PDF → compartilhar pelo menu do Android.
7. Feche e abra de novo: a sessão continua; o paciente pede o PIN.

**No emulador do Android Studio** (sem push real: o emulador precisa de imagem com Google Play):
```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r C:\caminho\para\medcare-senior.apk
```

**Se algo falhar só no release (R8):** veja o erro com
`adb logcat -s ReactNativeJS AndroidRuntime` (procure `ClassNotFoundException` ou `NoSuchMethodError`). O arquivo
`mapping.txt` da build (artefatos da página da build no EAS) traduz os nomes ofuscados. Uma regra
`-keep class pacote.da.biblioteca.** { *; }` em `extraProguardRules` do `expo-build-properties` resolve o caso da
biblioteca afetada.

**Tamanho:** a página da build no EAS mostra o tamanho do artefato. No PC: `(Get-Item .\medcare-senior.apk).Length / 1MB`.
