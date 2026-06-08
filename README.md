# 🐟 Orca — Sistema de Orçamentos

Sistema web de gestão de propostas comerciais desenvolvido para a **d'Avila Soluções Sustentáveis** e empresas parceiras.

Substitui planilhas de cálculo isoladas por uma plataforma centralizada, multiusuária e com controle de acesso por proposta.

---

## Empresas atendidas

| Prefixo | Empresa | Regime |
|---|---|---|
| AMB | d'Avila Soluções Sustentáveis LTDA | Lucro Real |
| ECO | Ecobiota Consultoria Ambiental LTDA | Simples Nacional |
| SLX | Sílex Arqueologia e Patrimônio LTDA | Simples Nacional |

---

## Funcionalidades

### Propostas
- Identificação única no formato `AMB-ORC-26001-REV00`
- Numeração sequencial anual por grupo de emitentes
- Revisões rastreáveis com histórico completo
- Status: Em Elaboração → Emitida → Follow-up → Em Revisão → Conquistada / Perdida / Cancelada / Suspensa
- Painel com abas: Ativas, Conquistadas, Encerradas
- Cards de estatística por status

### Composição de Custos (em desenvolvimento)
- Mão de obra com encargos sociais e complementares por função
- Logística, Materiais, Ferramentas, Equipamentos
- Serviços de terceiros com histórico de preços
- Encargos calculados automaticamente por tipo de profissional e regime do emitente

### Formação de Preço
- Fórmula: `Preço = (Custo × (1 + BDI%)) / (1 − Tributos%)`
- BDI configurável por emitente com histórico de versões
- Tributos por emitente (ISS, PIS, COFINS, IR, CSLL, CPP)
- Alerta de desvio em relação aos referenciais TCU (propostas públicas)
- Curva ABC de custos por proposta

### Quadro de Quantidades e Preços (QQP)
- Hierarquia de até 3 níveis
- Máscara de numeração configurável por proposta
- Exportação em PDF e Excel (em desenvolvimento)

### Cadastros
- Clientes e fornecedores (PJ e PF) com múltiplos contatos
- Pool compartilhado entre emitentes do grupo AMB
- Painel lateral com dados e contatos

### Administração
- Gestão de usuários com controle de acesso por emitente
- Siglas de 3 caracteres por usuário (ex: FD, JV, AA)
- Papéis por proposta: Criador, Mediador, Participante
- Log de auditoria imutável por proposta
- Gestão de emitentes com parâmetros versionados

---

## Tecnologia

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + CSS + JavaScript (arquivo único, sem framework) |
| Backend / Banco | [Supabase](https://supabase.com) (PostgreSQL) |
| Autenticação | Supabase Auth |
| Segurança | Row Level Security (RLS) em todas as tabelas |
| Hospedagem | GitHub Pages / Netlify |

---

## Estrutura do repositório

```
orca/
├── docs/
│   └── index.html      # Aplicação completa (frontend)
└── README.md
```

---

## Deploy

### Banco de dados (Supabase)
Os scripts SQL foram aplicados na seguinte ordem no projeto **Orca** (`qxfqavhnojskrgmisqpm`):

1. `Orca_BancoDeDados_v1_0.sql` — tabelas, views, índices e funções
2. `Orca_RLS_v1_0.sql` — Row Level Security e políticas de acesso
3. Criação do primeiro usuário no painel Supabase Auth
4. `Orca_Seed_v1_0.sql` — dados iniciais (emitentes, soluções, funções, referenciais TCU)

### Frontend (GitHub Pages)
1. Faça upload de `index.html` na pasta `docs/`
2. Em **Settings → Pages**, selecione branch `main`, pasta `/docs`
3. A aplicação estará disponível em `https://chircuitos.github.io/orca`

---

## Primeiro acesso

1. Acesse a URL do sistema
2. Faça login com o e-mail e senha cadastrados no Supabase Auth
3. O usuário administrador (`FD`) tem acesso a todas as funcionalidades
4. Para cadastrar novos usuários: **Administração → Usuários → + Novo Usuário**

---

## Status do projeto

| Módulo | Status |
|---|---|
| Login e autenticação | ✅ Concluído |
| Lista de propostas | ✅ Concluído |
| Criação de proposta | ✅ Concluído |
| Cadastro de clientes/fornecedores | ✅ Concluído |
| Gestão de usuários | ✅ Concluído |
| Gestão de emitentes | ✅ Concluído |
| Tela da proposta (cabeçalho + QQP) | 🔄 Em desenvolvimento |
| Composição de custos | 🔄 Em desenvolvimento |
| Exportação PDF / Excel | 🔄 Em desenvolvimento |
| Relatórios gerenciais | 🔄 Em desenvolvimento |

---

## Observações importantes

- Os **percentuais de tributos, encargos sociais e BDI** inseridos no seed são provisórios e devem ser revisados com o contador da d'Avila antes do uso em produção
- A chave `anon` do Supabase é segura para uso no frontend desde que o RLS esteja configurado corretamente — todas as tabelas têm RLS ativo
- O cadastro de novos usuários requer criação prévia da conta no painel Supabase Auth para obtenção do UUID

---

*Desenvolvido em colaboração com Claude (Anthropic) · Junho/2026*
