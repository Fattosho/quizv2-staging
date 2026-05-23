# CRM DUDA FARAGE

Este projeto agora tem duas telas:

- Quiz: `http://127.0.0.1:5188/`
- CRM: `http://127.0.0.1:5188/crm`
- API local: `http://localhost:8080`

Em producao no Railway, o frontend e a API rodam no mesmo servico. Exemplo:

- App publica: `https://crm-duda-farage.up.railway.app`
- Webhook Meta: `https://crm-duda-farage.up.railway.app/webhooks/whatsapp`

## Rodar local

Em dois terminais:

```bash
npm run server
npm run dev:crm
```

Sem `META_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`, a API roda em modo simulado. Isso permite testar inbox, criacao de lead, diagnostico, mensagens e templates sem enviar WhatsApp real.

Para usar WAHA, rode tambem o container do WAHA e configure o webhook dele apontando para esta API.

## Variaveis

Copie `.env.example` para `.env`:

```bash
PORT=8080
WHATSAPP_PROVIDER=waha
WAHA_BASE_URL=http://localhost:3000
WAHA_SESSION=default
WAHA_API_KEY=
LEAD_AGENT_ENABLED=false
LEAD_AGENT_REPLY_ASSIGNED=false
LEAD_AGENT_HANDOFF_KEYWORDS=preco,valor,matricula,atendente,humano
LEAD_GROUP_FORWARD_ENABLED=false
LEAD_GROUP_CHAT_ID=
LEAD_AGENT_SEND_SEEN=true
LEAD_AGENT_SHOW_PRESENCE=true
LEAD_AGENT_RESPONSE_DELAY_MS=1400
LEAD_AGENT_BETWEEN_MESSAGES_DELAY_MS=850
LEAD_AGENT_DELAY_PER_CHAR_MS=12
LEAD_AGENT_RESPONSE_JITTER_MS=900
LEAD_AGENT_MAX_RESPONSE_DELAY_MS=6500
LEAD_AGENT_MAX_AUTO_MESSAGES_PER_HOUR=8
LEAD_AGENT_USE_AUDIO_REPLIES=false
LEAD_AGENT_AUDIO_REPLY_URL=
ENABLE_AUDIO_REPLIES=false
AUDIO_REPLY_MODE=smart
TTS_PROVIDER=elevenlabs
TTS_VOICE_ID=
TTS_MODEL=eleven_multilingual_v2
MAX_AUDIO_DURATION_SECONDS=35
SEND_AUDIO_TRANSCRIPT=true
AUDIO_ONLY_WHEN_USER_SENDS_AUDIO=true
WAHA_SEND_VOICE_ENDPOINT=/api/sendVoice
AUDIO_STORAGE_ENABLED=false
AUDIO_TRANSCRIPTION_PROVIDER=elevenlabs
AUDIO_TRANSCRIPTION_MAX_BYTES=26214400
ELEVENLABS_API_KEY=
ELEVENLABS_ENABLE_LOGGING=true
ELEVENLABS_STT_MODEL=scribe_v2
ELEVENLABS_STT_LANGUAGE=pt
ELEVENLABS_STT_TAG_AUDIO_EVENTS=false
ELEVENLABS_TTS_ENABLED=false
ELEVENLABS_TTS_VOICE_ID=
ELEVENLABS_TTS_MODEL=eleven_multilingual_v2
ELEVENLABS_TTS_LANGUAGE=pt
ELEVENLABS_TTS_OUTPUT_FORMAT=mp3_44100_128
ELEVENLABS_TTS_REPLY_MODE=first
ELEVENLABS_TTS_SEND_TEXT_COPY=false
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
AZURE_SPEECH_VOICE=pt-BR-FranciscaNeural
OPENAI_API_KEY=
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=coral
PIPER_SERVER_URL=
PIPER_TTS_PATH=/tts
WHATSAPP_FIRST_CONTACT_TEXT=Ola, {{1}}. Seu diagnostico de estudos ficou pronto. Posso te enviar por aqui?
META_GRAPH_VERSION=v23.0
META_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_VERIFY_TOKEN=crm_uno_dev_token
WHATSAPP_FIRST_CONTACT_TEMPLATE=hello_world
WHATSAPP_FIRST_CONTACT_LANGUAGE=en_US
AUTO_SEND_FIRST_CONTACT=false
VITE_API_BASE_URL=http://localhost:8080
VITE_WHATSAPP_BUSINESS_NUMBER=
```

Use `WHATSAPP_PROVIDER=waha` para WAHA, `WHATSAPP_PROVIDER=meta` para Meta Cloud API ou deixe sem credenciais para o modo simulado.

## WAHA

O CRM agora suporta WAHA como provedor de WhatsApp. O envio usa `POST /api/sendText` e o recebimento usa o webhook de eventos `message`.

### Rodar WAHA local

Pelo guia oficial do WAHA, primeiro gere as credenciais:

```bash
docker run --rm -v "$(pwd)":/app/env devlikeapro/waha init-waha /app/env
```

Depois suba o WAHA:

```bash
docker run -it --env-file "$(pwd)/.env" -v "$(pwd)/sessions:/app/.sessions" --rm -p 3000:3000 --name waha devlikeapro/waha
```

Abra `http://localhost:3000/dashboard` e escaneie o QR Code da sessao `default`.

### Configurar webhook no WAHA

No Dashboard do WAHA, configure a sessao `default` com:

```text
Eventos: message, message.ack
URL local Windows/Docker: http://host.docker.internal:8080/webhooks/whatsapp
URL local sem Docker para o WAHA: http://localhost:8080/webhooks/whatsapp
URL producao: https://SEU_DOMINIO/webhooks/whatsapp
```

No `.env` deste CRM:

```bash
WHATSAPP_PROVIDER=waha
WAHA_BASE_URL=http://localhost:3000
WAHA_SESSION=default
WAHA_API_KEY=cole_a_api_key_do_waha_se_voce_ativou_uma
LEAD_AGENT_ENABLED=true
```

Com `LEAD_AGENT_ENABLED=true`, mensagens recebidas pelo WAHA entram no inbox e recebem resposta automatica do agente. Quando a lead perguntar por `preco`, `valor`, `matricula`, `atendente` ou `humano`, a conversa fica como `pending` para atendimento manual.

### Enviar lead para grupo interno

O envio para grupo fica desligado por padrao. Para ativar em staging:

```bash
LEAD_GROUP_FORWARD_ENABLED=true
LEAD_GROUP_CHAT_ID=120363xxxxxxxxxxxx@g.us
```

O grupo precisa ser um chat ID do WAHA terminado em `@g.us`. Quando o quiz for enviado, a API cria o lead no CRM e envia um resumo para o grupo com nome, WhatsApp, objetivo, fase, area que trava, interesse, resposta aberta e proxima acao sugerida.

Se o envio para grupo falhar, o quiz nao quebra. O erro volta no campo `groupForwardError` da resposta da API.

Para preservar o numero:

```bash
AUTO_SEND_FIRST_CONTACT=false
LEAD_AGENT_ENABLED=true
LEAD_GROUP_FORWARD_ENABLED=true
ENABLE_AUDIO_REPLIES=false
```

Assim o sistema avisa o grupo interno, mas nao abre conversa ativa automaticamente com a lead.

### Humanizacao do agente

O agente agora usa:

- `sendSeen` para marcar a mensagem como vista.
- Presenca WAHA `typing`, `recording` e `paused`.
- Delay com variacao por tamanho da mensagem.
- Envio de multiplas bolhas por resposta.
- Memoria por conversa em `server/data/crm-store.json`, campo `agentSessions`.
- Base expansivel em `server/data/agent-knowledge.json`.
- Limite de automacoes por hora para evitar loops ou excesso de mensagens.
- Politica de voz adaptada ao funil da Duda: audio curto para acolhimento e continuidade; texto para valores, matricula, links, datas, horarios e handoff comercial.

Variaveis principais:

```bash
ENABLE_AUDIO_REPLIES=true
AUDIO_REPLY_MODE=smart
LEAD_AGENT_SEND_SEEN=true
LEAD_AGENT_SHOW_PRESENCE=true
LEAD_AGENT_RESPONSE_DELAY_MS=1400
LEAD_AGENT_BETWEEN_MESSAGES_DELAY_MS=850
LEAD_AGENT_RESPONSE_JITTER_MS=900
LEAD_AGENT_MAX_AUTO_MESSAGES_PER_HOUR=8
MAX_AUDIO_DURATION_SECONDS=35
SEND_AUDIO_TRANSCRIPT=true
AUDIO_ONLY_WHEN_USER_SENDS_AUDIO=true
```

Modos de audio:

- `off`: nunca envia audio.
- `always`: envia audio sempre que nao bater em uma regra de bloqueio.
- `smart`: envia audio quando fizer sentido, especialmente se a lead mandou audio.
- `user_preference`: usa audio quando a lead pediu ou demonstrou preferencia.

Use `AUDIO_REPLY_MODE=smart` no funil de vendas.

### ElevenLabs para audio

Para transcrever audio recebido no WhatsApp:

```bash
AUDIO_TRANSCRIPTION_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=sua_chave
ELEVENLABS_STT_MODEL=scribe_v2
ELEVENLABS_STT_LANGUAGE=pt
```

Quando uma lead mandar audio, o CRM baixa a midia do WAHA, envia para o endpoint `POST /v1/speech-to-text` da ElevenLabs, salva a transcricao na mensagem do CRM e usa o texto transcrito para o agente responder.

Para o agente responder em audio gerado por ElevenLabs:

```bash
ENABLE_AUDIO_REPLIES=true
AUDIO_REPLY_MODE=smart
TTS_PROVIDER=elevenlabs
TTS_VOICE_ID=seu_voice_id
TTS_MODEL=eleven_multilingual_v2
SEND_AUDIO_TRANSCRIPT=true
```

Com `SEND_AUDIO_TRANSCRIPT=true`, o sistema envia uma frase curta em texto antes do audio. O texto original que virou audio fica salvo no `raw.audio.storage.text` da mensagem no CRM.

Importante: para o download de audio funcionar, o webhook do WAHA precisa vir com `media.url`. Se chegar `hasMedia: true` sem `media.url`, ajuste a configuracao de media do WAHA.

## Primeiro contato

Na API oficial da Meta, a primeira mensagem ativa precisa ser um template aprovado. Para o numero de teste da Meta, use o template padrao:

```bash
WHATSAPP_FIRST_CONTACT_TEMPLATE=hello_world
WHATSAPP_FIRST_CONTACT_LANGUAGE=en_US
AUTO_SEND_FIRST_CONTACT=false
```

Com `AUTO_SEND_FIRST_CONTACT=false`, o CRM mostra o lead e voce clica em `Enviar primeiro contato`. Para disparar automaticamente assim que o quiz for enviado:

```bash
AUTO_SEND_FIRST_CONTACT=true
```

Para producao, crie um template em portugues no WhatsApp Manager, por exemplo:

```text
Nome: diagnostico_pronto
Categoria: Marketing ou Utility
Idioma: pt_BR
Texto: Ola, {{1}}. Seu diagnostico de estudos ficou pronto. Posso te enviar por aqui?
```

Depois configure:

```bash
WHATSAPP_FIRST_CONTACT_TEMPLATE=diagnostico_pronto
WHATSAPP_FIRST_CONTACT_LANGUAGE=pt_BR
```

## Configurar numero de teste

1. Acesse `https://developers.facebook.com/apps/`.
2. Crie um app do tipo Business.
3. Adicione o produto WhatsApp.
4. Em `WhatsApp > API Setup`, use o numero de teste.
5. Copie:
   - `Temporary access token` para `META_ACCESS_TOKEN`
   - `Phone number ID` para `WHATSAPP_PHONE_NUMBER_ID`
   - `WhatsApp Business Account ID` para `WHATSAPP_BUSINESS_ACCOUNT_ID`
6. Adicione seu telefone como destinatario de teste na tela da Meta.

## Webhook

Para desenvolvimento local, exponha a API com ngrok ou Railway:

```bash
ngrok http 8080
```

Na Meta, configure:

```text
Callback URL: https://SEU_DOMINIO/webhooks/whatsapp
Verify token: crm_uno_dev_token
```

Assine pelo menos estes campos:

```text
messages
message_template_status_update
```

## Deploy Railway

Este repositorio ja esta pronto para subir como servico unico do **CRM DUDA FARAGE**:

- `railway.toml` com `buildCommand` e `startCommand`
- `npm start` para o backend Express
- frontend Vite consumindo a mesma origem em producao

### Passo a passo

1. Suba este repositorio no GitHub.
2. No Railway, clique em `New Project`.
3. Escolha `Deploy from GitHub repo`.
4. Selecione este repositorio.
5. O Railway vai detectar `railway.toml` e usar:
   - build: `npm run build`
   - start: `npm start`
6. Quando o deploy terminar, copie a URL publica, por exemplo:

```text
https://crm-duda-farage.up.railway.app
```

7. Na Meta, configure:

```text
Callback URL: https://crm-duda-farage.up.railway.app/webhooks/whatsapp
Verify token: crm_uno_dev_token
```

8. Assine o campo:

```text
messages
```

9. Teste enviando uma mensagem para o numero de teste `+1 555 650 2507`.

### Variaveis no Railway

No Railway, configure:

```text
PORT=8080
WHATSAPP_PROVIDER=waha
WAHA_BASE_URL=https://SEU_WAHA_PUBLICO
WAHA_SESSION=default
WAHA_API_KEY=...
LEAD_AGENT_ENABLED=true
META_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_VERIFY_TOKEN=crm_uno_dev_token
WHATSAPP_FIRST_CONTACT_TEMPLATE=hello_world
WHATSAPP_FIRST_CONTACT_LANGUAGE=en_US
AUTO_SEND_FIRST_CONTACT=false
VITE_WHATSAPP_BUSINESS_NUMBER=55...
```

`VITE_API_BASE_URL` nao e obrigatorio no Railway. Em producao, o frontend ja usa a mesma origem do backend automaticamente.

Para producao real, substitua o armazenamento JSON local por Postgres/Supabase antes de escalar o atendimento.
