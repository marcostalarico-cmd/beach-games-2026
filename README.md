# 🏖️ Beach Games 2026 — Guia Completo de Deploy

## Estrutura do Projeto

```
beach-games-v2/
├── client/           ← Jogo (HTML, CSS, JS)
│   ├── index.html
│   ├── style.css
│   └── game.js
└── server/           ← Servidor multiplayer
    ├── server.js
    └── package.json
```

---

## 🧪 Testar Localmente (sem internet)

### Opção A — Só o jogo (sem servidor)
Abra `client/index.html` diretamente no navegador.
O jogo roda 100% offline com bots. Perfeito para testar a jogabilidade.

### Opção B — Servidor completo (multiplayer real)

**Requisitos:** Node.js 18+ instalado → https://nodejs.org

```bash
# 1. Entrar na pasta do servidor
cd server

# 2. Instalar dependências
npm install

# 3. Iniciar o servidor
npm start
```

Acesse: **http://localhost:3000**

O servidor serve o jogo automaticamente e o multiplayer já funciona!

**Testar com 2 abas:**
- Abra http://localhost:3000 em duas abas
- Na aba 1: Criar Sala → copie o código
- Na aba 2: Entrar com Código → cole o código
- Na aba 1: clique "Começar Partida"
- As duas abas jogam em tempo real!

**Testar no celular (mesma rede Wi-Fi):**
- Descubra o IP do seu computador:
  - Mac/Linux: `ifconfig | grep inet`
  - Windows: `ipconfig`
- Acesse no celular: **http://SEU_IP:3000**

---

## 🚀 Deploy Gratuito no Railway

Railway é a opção mais simples. Plano gratuito inclui 500h/mês.

### Passo 1 — Criar conta
Acesse **https://railway.app** e faça login com GitHub.

### Passo 2 — Preparar o repositório

Crie um repositório no GitHub com esta estrutura:
```
meu-repositorio/
├── client/
│   ├── index.html
│   ├── style.css
│   └── game.js
├── server.js        ← copie de server/server.js
└── package.json     ← copie de server/package.json
```

> ⚠️ O Railway precisa do `server.js` na raiz do projeto.

Adapte o `server.js` para servir os arquivos do `client/` corretamente:
```js
app.use(express.static(path.join(__dirname, 'client')));
```
(já está configurado assim no código)

### Passo 3 — Deploy no Railway

1. Acesse https://railway.app/new
2. Clique em **"Deploy from GitHub repo"**
3. Selecione seu repositório
4. Railway detecta automaticamente que é Node.js
5. Clique **Deploy**
6. Aguarde ~2 minutos

### Passo 4 — Configurar domínio

1. Na dashboard do Railway, clique no seu projeto
2. Vá em **Settings → Networking**
3. Clique em **Generate Domain**
4. Você receberá um link tipo: `beach-games-xxx.up.railway.app`

**Pronto!** Compartilhe esse link com os jogadores.

---

## 🌐 Alternativa: Deploy no Render (também gratuito)

### Passo 1
Acesse **https://render.com** → crie conta com GitHub.

### Passo 2
- Clique em **New → Web Service**
- Conecte seu repositório GitHub
- Configure:
  - **Build Command:** `npm install`
  - **Start Command:** `node server.js`
  - **Environment:** Node

### Passo 3
Clique em **Create Web Service**.
Aguarde o deploy (~3 min).
Você recebe um link: `beach-games.onrender.com`

> ⚠️ No plano gratuito do Render, o servidor "dorme" após 15 min sem uso.
> O Railway é mais indicado para produção.

---

## 📱 Instalar como App (PWA)

Para os jogadores instalarem no celular como app nativo:

Adicione este arquivo `manifest.json` na pasta `client/`:
```json
{
  "name": "Beach Games 2026",
  "short_name": "BeachGames",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0EA5E9",
  "theme_color": "#F97316",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Adicione no `<head>` do `index.html`:
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#F97316">
```

No celular, ao abrir o site, aparecerá: **"Adicionar à tela inicial"**.

---

## ⚡ Variáveis de Ambiente

Para produção, configure no Railway/Render:

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `PORT` | (automático) | Railway define automaticamente |
| `NODE_ENV` | `production` | Ativa otimizações |

---

## 🗺️ Próximos Passos (Roadmap)

### Fase 2 — Novas Modalidades
Cada modalidade é um arquivo JS separado:
- `surf.js` — ondas, manobras aéreas
- `skate.js` — pista urbana, grinds, half-pipe
- `bmx.js` — rampas maiores, loops
- `beach-run.js` — corrida na areia com vento
- `frisbee.js` — arremesso com timing

### Fase 3 — Perfil e Ranking
- Login com Google (Firebase Auth)
- Ranking por escola / turma
- Histórico de partidas
- Avatares desbloqueáveis

### Fase 4 — Campeonato
- Torneios entre turmas
- Ranking nacional
- Desafios semanais
- Modo professor (cria desafio para a turma)

---

## 🆘 Problemas Comuns

**"Multiplayer não funciona"**
→ Verifique se o servidor está rodando (`npm start`)
→ Verifique o console do navegador (F12)

**"Jogo lento no celular"**
→ Feche outros apps
→ O jogo funciona melhor no Chrome/Safari atualizado

**"Railway não encontra o servidor"**
→ Verifique se `server.js` está na raiz do projeto
→ Verifique se `package.json` tem o script `"start": "node server.js"`

---

## 📞 Resumo Rápido

```
Jogar offline agora:    abrir client/index.html
Rodar servidor local:   cd server && npm install && npm start
Deploy gratuito:        Railway.app ou Render.com
Celular + Wi-Fi local:  http://SEU_IP:3000
```
