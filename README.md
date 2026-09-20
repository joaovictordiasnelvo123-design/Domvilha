# Cardápio Dom Vilha — painel administrativo na Vercel

Cardápio digital com pedidos pelo WhatsApp e um painel para o dono do restaurante editar produtos, preços, fotos, categorias e textos do site, **sem mexer em código**. As alterações ficam salvas num banco de dados e aparecem para todos os clientes em poucos segundos.

## Como funciona

```
Cliente abre o site ──► public/index.html ──► GET /api/menu ──► Upstash Redis (cardápio)
                                                     ▲
Dono entra com a senha ──► POST /api/login (token)   │
Dono salva alterações  ──► PUT  /api/menu ───────────┘  (só com token válido)
Dono envia foto        ──► POST /api/upload ──► Vercel Blob (imagens)
```

| Pasta / arquivo | Função |
|---|---|
| `public/index.html` | O site inteiro (visual e painel). O cardápio dentro dele é só o **cardápio inicial**. |
| `api/menu.js` | Lê (público) e grava (só administrador) o cardápio. Valida tudo no servidor. |
| `api/login.js` | Confere a senha e devolve uma sessão de 7 dias. Bloqueia após 8 tentativas erradas em 15 min. |
| `api/upload.js` | Recebe a foto do produto e guarda no Vercel Blob. |
| `lib/` | Código compartilhado (autenticação, validação, conexão com o banco). |

## Publicar na Vercel (passo a passo)

**1. Subir o código.** Crie um repositório no GitHub com o conteúdo desta pasta e, na Vercel, use *Add New… → Project* e importe o repositório. Não precisa mudar nenhuma configuração (o `vercel.json` já indica a pasta `public`). Se preferir, rode `npx vercel` dentro desta pasta.

**2. Criar o banco do cardápio.** No projeto, abra **Storage → Create Database → Upstash (Redis)** e conecte ao projeto, marcando todos os ambientes (Production, Preview, Development). A Vercel cria as variáveis de acesso sozinha.

**3. Criar o armazenamento das fotos.** Em **Storage → Create Database → Blob**, escolha o acesso **Public** e conecte ao projeto. O modo de acesso não pode ser alterado depois de criado. A variável `BLOB_READ_WRITE_TOKEN` é criada automaticamente.

**4. Definir a senha do painel.** Em **Settings → Environment Variables**, crie:

| Nome | Valor |
|---|---|
| `ADMIN_PASSWORD` | A senha que o dono vai digitar. Use uma senha forte e exclusiva. |
| `ADMIN_SECRET` | Um texto aleatório com 40+ caracteres. Para gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

**5. Fazer um novo deploy.** Variáveis novas só valem em deploys novos: *Deployments → ⋯ → Redeploy*.

**6. Testar.**
1. Abra o site e clique em **Área do administrador** (rodapé), ou acesse `seusite.com/#admin`.
2. Entre com a senha, mude um preço ou desative um produto.
3. Abra o site numa **aba anônima**: a alteração deve aparecer.

## Como o cliente usa

- **Entrar:** rodapé do site → *Área do administrador* → senha. A sessão dura 7 dias em cada aparelho; use **Sair** no painel em computadores compartilhados.
- **Cardápio:** ativar/desativar produtos ("ativo"), reordenar (▲▼), editar (✏️) e excluir (🗑️).
- **Produtos:** nome, descrição, preço, categoria, selo, peso/nível, adicionais e foto (enviada do celular ou computador; é reduzida automaticamente).
- **Categorias:** criar, renomear, ícone, cor e ordem.
- **Conteúdo do site:** todos os textos (banner, faixa, diferenciais, rodapé). Use `*palavra*` para destacar em dourado.
- **Configurações:** número do WhatsApp e faixa de aviso/promoção no topo.

Cada botão de salvar mostra "Salvo com sucesso" ou o motivo do erro. Se a sessão expirar no meio da edição, o painel pede a senha de novo e salva a alteração pendente.

## Segurança: o que já está protegido

- A senha é conferida **no servidor**; ela nunca aparece no código do site.
- Só quem tem sessão válida consegue gravar o cardápio ou enviar fotos (o site público só consegue *ler*).
- Sessões são assinadas com `ADMIN_SECRET`. Trocar a senha ou o segredo encerra todas as sessões abertas.
- O servidor valida cada campo (tipos, tamanhos, preços, links de foto) e descarta o que não conhece.
- Fotos são verificadas (tipo e conteúdo real da imagem) e limitadas a 2,5 MB. Fotos removidas do cardápio são apagadas do Blob.
- Pedidos continuam indo direto para o WhatsApp: **nenhum dado de cliente é guardado**.

## Backup

A cada gravação, a versão anterior do cardápio é guardada na chave `dom-vilha:cardapio:anterior`. Para desfazer um erro grave, abra o banco no painel do Upstash (Data Browser) e copie o valor dessa chave para `dom-vilha:cardapio`. Só uma versão anterior é mantida.

## Problemas comuns

| O que aparece | Causa provável | O que fazer |
|---|---|---|
| "Banco de dados não conectado…" | Upstash não conectado ao projeto, ou falta redeploy | Passo 2 e depois passo 5 |
| "Variável ADMIN_PASSWORD não configurada…" | Falta `ADMIN_PASSWORD` ou `ADMIN_SECRET` | Passos 4 e 5 |
| Erro ao enviar foto | Blob não conectado | Passo 3 e depois passo 5 |
| "Muitas tentativas…" | 8 senhas erradas seguidas | Aguardar 15 minutos |
| "Sessão expirada" toda hora | Senha ou segredo foram trocados | Entrar novamente |
| Site mostra o cardápio antigo do arquivo | Banco vazio ou fora do ar | Salve uma alteração no painel; confira o passo 2 |

## Observações importantes

- **Plano da Vercel:** segundo as regras da Vercel, o plano gratuito (Hobby) é restrito a uso pessoal e não comercial. O site de um restaurante divulga a venda de produtos, então confirme com a Vercel se o projeto precisa do plano Pro antes de publicar para clientes reais.
- **Cardápio inicial × banco:** depois do primeiro salvamento no painel, quem manda é o banco. Alterar o cardápio dentro do `index.html` não muda mais o site. Para voltar ao inicial, apague a chave `dom-vilha:cardapio` no Upstash.
- **Domínio próprio:** *Settings → Domains* no projeto da Vercel.
- **Estilos:** o site usa o Tailwind via CDN (como no arquivo original), o que funciona bem para este porte. Se um dia o tráfego crescer muito, vale compilar o CSS.
- **Rodapé:** se não quiser o link "Área do administrador" visível, remova o botão no rodapé do `index.html`; o acesso por `/#admin` continua funcionando.
