# 🚚 ROUTEXO — Sistema de Roteirização Inteligente

## 💡 Por que este projeto foi criado?

O **ROUTEXO** é um sistema web moderno e responsivo, projetado para otimização de frotas e roteirização urbana automática.

Utilizando Inteligência Artificial avançada, o sistema extrai dados de entregas a partir de imagens de romaneios ou relatórios, normaliza os endereços para os padrões aceitos pelas APIs de mapas, divide-os eficientemente de forma geográfica entre os veículos da frota e gera itinerários sequenciados prontos para uso no Google Maps.

Criamos este projeto para resolver dores específicas:
1. **Automação do Planejamento:** Em vez de digitar, o usuário tira uma foto ou faz upload da lista de entregas. A Inteligência Artificial faz a leitura, extrai os endereços, limpa informações desnecessárias (como "apto", "loja", "referência") e padroniza tudo perfeitamente para o Google Maps.
2. **Divisão Geográfica Inteligente:** Se você tem 100 entregas e 3 veículos, como dividir isso de forma justa e otimizada? O sistema entende as regiões e agrupa as entregas, alocando blocos lógicos para cada veículo.
3. **Eficiência e Economia:** Rotas bem planejadas reduzem o tempo da frota na rua, cortam custos com gasolina e evitam o desgaste dos motoristas.

Tudo isso foi envelopado em uma interface nostálgica focada em produtividade (estilo ERP clássico), oferecendo uma ferramenta poderosa, rápida e sem distrações visuais para quem trabalha na operação do dia a dia.

---

## Como rodar o projeto na sua máquina

Aqui está o passo a passo simples e objetivo para você preparar esse projeto no seu próprio computador!

## Pré-requisitos
Certifique-se de ter os seguintes itens:
1. **Node.js** (versão 20 ou superior): [Baixe aqui](https://nodejs.org/).
2. **Gerenciador de pacotes**: Recomendamos usar o `pnpm` (mas o `npm` também serve).
3. **Git**: Para baixar o código para a sua máquina.
4. Contas gratuitas nos serviços abaixo (para gerar suas chaves secretas):
   - [Supabase](https://supabase.com/) (para o Banco de Dados)
   - [Google AI Studio](https://aistudio.google.com/) (para a IA do Gemini)
   - [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) (para a proteção CAPTCHA)

### 🥣    Executando

**Passo 1: Clonando o repositório
Abra o seu terminal e digite os comandos abaixo para baixar o projeto e entrar na pasta:
```bash
git clone <URL_DO_SEU_REPOSITORIO>
cd Roteirizacao-main
```

**Passo 2: Instalando dependências
Agora, vamos instalar todos os pacotes necessários. No terminal, execute:
```bash
pnpm install
# ou use "npm install" caso prefira
```

**Passo 3: Variáveis de Ambiente
Crie um arquivo chamado `.env.local` na raiz do projeto (na mesma pasta do `package.json`). Copie o conteúdo abaixo e cole no arquivo, substituindo os valores pelas suas chaves reais:

```env
# 1. Conexão com o banco de dados Supabase (PostgreSQL)
SUPABASE_URL=<SUA_SUPABASE_URL>
SUPABASE_SERVICE_KEY=<SUA_SUPABASE_SERVICE_ROLE_KEY>

# 2. Conexão com o cache Redis (opcional)
REDIS_URL=<SUA_REDIS_URL>

# 3. Chave da IA do Google (Gemini)
GEMINI_API_KEY=<SUA_GEMINI_API_KEY>

# 4. Chave do Cloudflare Turnstile (Segurança/CAPTCHA)
NEXT_PUBLIC_TURNSTILE_SITEKEY=<SUA_TURNSTILE_SITEKEY>

# 5. Token secreto de acesso ao Painel Admin (Crie uma senha forte aqui)
ADMIN_SECRET_TOKEN=<SEU_TOKEN_SECRETO_PARA_ADMIN>

# 6. Usuário e senha para o administrador principal do sistema
LOGIN_USUARIO=<NOME_DE_USUARIO_ADMIN>
LOGIN_SENHA=<SENHA_ADMIN>
```
> ⚠️ **Atenção:** Nunca publique esse arquivo na internet. Ele contém os segredos do seu aplicativo!

**Passo 4: Rodando o servidor
Tudo pronto! Para ligar o sistema no modo de desenvolvimento, digite:
```bash
pnpm dev
# ou "npm run dev"
```
Acesse **[http://localhost:3000](http://localhost:3000)** no seu navegador. Pronto! O painel do ROUTEXO já deve aparecer na sua tela. 🚀

Para gerar a versão final para colocar no ar (modo produção), use:
```bash
pnpm build
pnpm start
```


## 🛠️ Pilha de Tecnologia (Tech Stack)

* **Framework**: Next.js v16.2.6 (App Router)
* **Linguagem**: TypeScript
* **Estilização**: Tailwind CSS v4 + Vanilla CSS customizado (tema ERP)
* **Banco de Dados**: Supabase (PostgreSQL) e Redis
* **Inteligência Artificial**: Google Gemini 2.5 Flash
* **Segurança**: Cloudflare Turnstile e bcryptjs

Desenvolvido por Guilherme Olsen ®
