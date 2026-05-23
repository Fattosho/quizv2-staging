# CRM Duda Farage

## Audio no WhatsApp

O agente pode transcrever audio recebido e responder com texto, audio ou texto + audio pelo WAHA.

Fluxo:

1. A lead envia mensagem ou audio no WhatsApp.
2. O WAHA envia o webhook para `/webhooks/whatsapp`.
3. Se vier audio com `media.url`, o CRM baixa a midia e transcreve.
4. O agente gera a resposta em texto.
5. A politica de voz decide se a resposta sai como texto ou audio.
6. Se for audio, o TTS gera o arquivo e o WAHA envia por `/api/sendVoice`.
7. O CRM salva o texto original que virou audio no log da mensagem.

## Ativar Audio

No `.env`:

```bash
ENABLE_AUDIO_REPLIES=true
AUDIO_REPLY_MODE=smart
TTS_PROVIDER=elevenlabs
TTS_VOICE_ID=seu_voice_id
TTS_MODEL=eleven_multilingual_v2
ELEVENLABS_API_KEY=sua_chave
MAX_AUDIO_DURATION_SECONDS=35
SEND_AUDIO_TRANSCRIPT=true
AUDIO_ONLY_WHEN_USER_SENDS_AUDIO=true
WAHA_SEND_VOICE_ENDPOINT=/api/sendVoice
```

Use `AUDIO_REPLY_MODE=smart` como padrao.

## Modos

- `off`: nunca envia audio.
- `always`: envia audio sempre que nao bater em uma regra de bloqueio.
- `smart`: envia audio quando fizer sentido para acolhimento curto ou quando a lead mandou audio.
- `user_preference`: usa audio quando a lead pediu ou ja demonstrou preferencia.

## Quando Enviar Audio

- A lead enviou audio primeiro.
- A lead pediu audio.
- A resposta e curta, acolhedora e simples.
- O bot esta confirmando entendimento ou proximo passo.
- A conversa esta em tom humano e sem dados importantes.

## Quando Nao Enviar Audio

- Valor, preco, parcelamento, contrato ou link de pagamento.
- Endereco, data, horario, agenda ou instrucao que a lead precisa consultar depois.
- Handoff para atendimento humano.
- Resposta longa.
- Lead irritada ou pedindo objetividade.
- Promessa de resultado ou informacao comercial sensivel.

## ElevenLabs Free

1. Crie uma conta na ElevenLabs.
2. Copie sua API key.
3. Escolha uma voz neutra da biblioteca e copie o `voice_id`.
4. Configure:

```bash
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=sua_chave
TTS_VOICE_ID=seu_voice_id
```

## Azure Speech Free F0

Crie um recurso Speech no Azure e configure:

```bash
TTS_PROVIDER=azure
AZURE_SPEECH_KEY=sua_chave
AZURE_SPEECH_REGION=brazilsouth
AZURE_SPEECH_VOICE=pt-BR-FranciscaNeural
```

## Piper Local

Suba um servidor local compatível com `POST /tts` retornando audio binario e configure:

```bash
TTS_PROVIDER=piper
PIPER_SERVER_URL=http://localhost:5000
PIPER_TTS_PATH=/tts
```

## Testar WAHA

1. Configure o webhook do WAHA para `message` e `message.ack`.
2. Envie um audio para o numero conectado.
3. Verifique se o webhook tem `media.url`.
4. Acesse o CRM e confira a mensagem com a transcricao em `raw.transcription`.

## Desativar Audio em Producao

```bash
ENABLE_AUDIO_REPLIES=false
AUDIO_REPLY_MODE=off
```

## Limitar Audio

Para enviar audio apenas quando a lead enviou audio primeiro:

```bash
AUDIO_ONLY_WHEN_USER_SENDS_AUDIO=true
```

## Politica de Voz

Use voz neutra, calma, profissional e acolhedora. O agente nao deve simular a Duda, prometer aprovacao ou soar como propaganda. Audio deve ser curto: ideal de 8 a 20 segundos, maximo de 35 segundos.

## Railway Staging

Nao sobrescreva o servico atual de producao se ele ja envia leads para grupo. Crie um servico separado no Railway apontando para este mesmo repo/codigo.

Variaveis recomendadas no staging:

```bash
AUTO_SEND_FIRST_CONTACT=false
LEAD_AGENT_ENABLED=true
LEAD_GROUP_FORWARD_ENABLED=true
LEAD_GROUP_CHAT_ID=120363xxxxxxxxxxxx@g.us
ENABLE_AUDIO_REPLIES=false
WHATSAPP_PROVIDER=waha
WAHA_BASE_URL=https://seu-waha-staging
WAHA_SESSION=default
WAHA_API_KEY=sua_chave_waha
```

Fluxo seguro:

1. O quiz cria o lead.
2. O CRM salva diagnostico e conversa.
3. O sistema envia um resumo para o grupo interno.
4. O agente so responde quando a lead chamar no WhatsApp.
5. Depois de testar com 2 ou 3 leads, avalie ativar audio ou primeiro contato automatico.

Mantenha em producao:

```bash
AUTO_SEND_FIRST_CONTACT=false
ENABLE_AUDIO_REPLIES=false
```

Isso reduz risco de bloqueio do numero por disparo ativo.
