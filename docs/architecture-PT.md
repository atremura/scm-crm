# Construction Management Platform — Arquitetura Modular

**Versão:** 1.1
**Última atualização:** Maio 2026
**Idioma:** Português (versão em inglês: `architecture-EN.md`)

---

## 1. Visão Geral

Este documento consolida a arquitetura modular de uma plataforma multi-tenant de gestão de construção, cobrindo todo o ciclo de vida de um projeto — desde a captura do lead até o pós-entrega/garantia. O sistema combina automação por IA, app mobile para campo, integrações externas (DocuSign, Cowork, QuickBooks) e uma camada robusta de notificações e dashboards.

### Princípios da Arquitetura

- **Multi-tenant:** isolamento total de dados; cada empresa de construção é um tenant com seu Master Data, branding e configurações.
- **Mobile-first em campo:** funções de execução (avanço, fotos, ponto, pendências, COs) priorizadas para iPad e smartphone.
- **IA integrada:** captura de leads, análise de contratos, geração de contratos com subcontratos e suporte ao estimating via Cowork.
- **Permissões granulares:** View / Edit / Approve / Signatory aplicadas por módulo e por tipo de cadastro.
- **Auditoria e versões:** histórico completo em todos os módulos sensíveis (contratos, WBS, financeiro, master data).
- **Templates da indústria:** padrões como AIA G702/G703 são templates do sistema, customizáveis por tenant.

### Camadas do Sistema

A plataforma se organiza em três camadas interdependentes:

- **Fluxo principal de projeto (Módulos 1–8 + 11–12):** do lead à garantia.
- **Camadas transversais:** Master Data, Estoque, Dashboards, Notificações Centralizadas (Mod. 10).
- **Plataforma:** Admin Master (Mod. 9) gerencia tenants, billing, templates e operações globais.

---

## 2. Fluxo Principal — Sequência dos Módulos

| #   | Módulo                        | Disparador (entrada)            | Saída (próximo)                       |
| --- | ----------------------------- | ------------------------------- | ------------------------------------- |
| 01  | Lead Intake & Qualification   | Email novo / cadastro manual    | Lead aprovado → Mod. 2                |
| 02  | Takeoff, Estimate & Proposal  | Lead aprovado                   | Proposta Won → Mod. 3                 |
| 03  | Contract Analysis & Signature | Proposta com status Won         | Contrato assinado → Mod. 4            |
| 04  | Pre-Execution                 | Contrato assinado               | Setup completo → Mod. 5               |
| 05  | Execution / CECS              | Pre-Execution finalizado        | Obra entregue → Mod. 12               |
| 06  | Purchasing & Rentals          | Pedidos de Mod. 4 e Mod. 5      | Material entregue / Invoice → Mod. 11 |
| 07  | Workforce Tracking            | Funcionário bate ponto (mobile) | Custo automático → Mod. 5 / Mod. 11   |
| 08  | Client Portal                 | Contrato assinado libera acesso | Aprovações → Mod. 5                   |
| 11  | Financial                     | Eventos de Mod. 5/6/7 + manuais | AP / AR / Cash flow / QuickBooks      |
| 12  | Warranty / Post-Delivery      | Obra entregue                   | Reparo / Nova proposta → Mod. 2       |

### Camadas e Plataforma

| #   | Camada / Plataforma         | Função                                                                                        |
| --- | --------------------------- | --------------------------------------------------------------------------------------------- |
| 09  | Admin Master (Multi-Tenant) | Gestão de tenants, planos, billing (Stripe), templates globais, feature flags, suporte        |
| 10  | Centralized Notifications   | Engine de regras (evento + papel + canal), múltiplos canais, escalonamento automático         |
| ★   | Master Data + Estoque       | Cadastros base que alimentam todos os módulos; sub-módulo de Estoque transferível entre obras |
| ★   | Dashboards                  | Visões: Geral (executivo) / Por Módulo / Por Obra                                             |

---

## 3. Módulo 1 — Lead Intake & Qualification

Captura inicial de oportunidades de projeto, com triagem automatizada por IA e validação humana.

### 3.1 Entradas

- **Email scraper:** monitora caixa cadastrada da empresa, identifica novos projetos, cadastra cliente e projeto automaticamente.
- **Cadastro manual:** usuário pode lançar lead direto no sistema sem depender do email.

### 3.2 Pré-análise por IA

- Critérios configuráveis: distância, tipo de trabalho, projeto union, projeto state, entre outros.
- IA rejeita automaticamente leads que não atendem aos critérios.
- Leads rejeitados ficam arquivados — podem ser reabertos manualmente.

### 3.3 Revisão Humana

- Usuário com permissão (View / Edit / Approve) realiza segunda análise.
- Pode aceitar ou rejeitar; pode reabrir leads previamente rejeitados pela IA.

### 3.4 Saída

- Lead aprovado é encaminhado ao Módulo 2 (Estimate & Proposal) e atribuído a um Estimator.

---

## 4. Módulo 2 — Takeoff, Estimate & Proposal

Núcleo de orçamentação: o lead aprovado vira projeto. O sistema oferece **DOIS CAMINHOS** dependendo do porte e complexidade da obra — um com análise por IA via Cowork, outro 100% manual usando o Master Data.

### 4.1 CAMINHO A — Análise por IA (obras médias e grandes)

Indicado para obras médias e grandes onde o esforço de análise por IA agrega valor.

**Setup do Projeto:**

- Estimator atribuído ao lead aprovado.
- Estrutura de pastas com upload de plantas, specs, manuais e addendums.

**Análise no Cowork (Desktop):**

- Skills configurados por tipo de serviço (siding, sheet metal, finish carpentry) ou skill geral.
- Cowork analisa: escopo, serviços, materiais, man-hours, produtividade, cronograma, histograma, riscos.
- Output em arquivo padrão estruturado (ver `docs/cowork-import-schema.md`).
- Base de valores extraídos alimenta planilhas de preços e produtividade.

### 4.2 CAMINHO B — Estimate Manual (obras pequenas)

Para obras pequenas que não justificam o esforço da análise por IA — reparos pontuais, serviços simples, propostas rápidas onde o escopo já é bem conhecido.

**Cadastro direto da obra:**

- Estimator cadastra a obra e cria o estimate sem passar pela IA.
- Adiciona classificações já existentes no banco de dados (Master Data: serviços, materiais, produtividade, mão de obra).
- Pode criar uma classificação nova na hora caso não exista no banco.
- Quantidades, preços unitários e totais lançados manualmente.

**Vantagem operacional:**

- Ganho de agilidade: ideal para propostas rápidas onde o escopo é direto.
- Reduz custo de IA tokens em obras pequenas.
- Mantém o estimator no controle quando a experiência humana já basta.

### 4.3 Estimate & Proposal (em ambos os caminhos)

- Estimator revisa, edita e aprova o estimate.
- Proposta gerada com template fixo + campos dinâmicos.
- Envio para empresa cliente e contato cadastrado.

### 4.4 Status e Tracking

- In Analysis → In Preparation → Sent → Finalist → Won / Lost (transições manuais).

---

## 5. Módulo 3 — Contract Analysis & Signature

Análise de risco contratual com IA, fluxo dual (Exhibit + Contrato ou Contrato direto) e assinatura digital via DocuSign.

### 5.1 Fluxo Padrão (com Exhibit)

- Cliente envia Exhibit primeiro.
- IA analisa: pontuação de risco, comparação com Proposta (itens embutidos, fora de escopo), discrepâncias, termos sensíveis.
- Saída: resumo em texto com bullets dos riscos.
- Revisão humana: aprova ou pede ajuste.
- Assinatura via DocuSign e devolução ao cliente.
- Cliente envia contrato principal → IA reanálise (coerência com Exhibit).
- Aprovação + assinatura DocuSign.

### 5.2 Fluxo Alternativo (Contrato Direto)

- Estimator ou usuário com permissão pula a fase do Exhibit.
- IA compara contrato diretamente com a Proposta original.

### 5.3 Recursos do Módulo

- Múltiplos signatários autorizados (papel Signatory separado de Approve).
- Histórico completo de versões + relatório de IA por versão.

---

## 6. Módulo 4 — Pre-Execution (Project Setup)

Setup completo do projeto após contrato assinado. Cria as estruturas que serão consumidas na execução.

### 6.1 WBS Dual (Cliente e Subcontrato)

- **WBS-Client:** valores fechados com cliente; etapas customizáveis pelo PM da obra (cada projeto pode ter etapas diferentes).
- **WBS-Subcontract:** gerada automaticamente ao atribuir subcontrato; valores próprios negociados.
- **Vínculo:** avanço físico igual nos dois (espelho); avanço financeiro pode ser ajustado pelo PM na WBS-Client (pra cash flow), sem refletir na do sub.

### 6.2 BOM e Submittals

- BOM consolidada a partir do estimate.
- Múltiplos submittals possíveis com PDF gerado em template padrão.
- Status: Pending / Submitted / Approved / Rejected / Revise & Resubmit.

### 6.3 Compras Escalonadas

- Sistema gera lista de compras do momento (não compra tudo de uma vez).
- PM solicita compra → vai pro Módulo 6.

### 6.4 Subcontratos

- Atribuídos por serviço (gera WBS-Subcontract automaticamente).
- Contrato com subcontrato gerado por IA (templates + cláusulas do contrato com cliente + escopo da WBS-Sub).
- Repositório de documentos do subcontrato (puxa do Master Data + customizações por projeto).

### 6.5 Documentação Exigida

- Lista padrão no Master Data + customizações por projeto.
- Exigências variáveis (ex: Umbrella $5M, $2M ou nenhuma).
- Tracking de validade com alertas.

### 6.6 Equipamentos e Locações

- Planejamento com datas previstas de entrada/saída.
- PO automático conforme data programada → Módulo 6.
- Tracking previsto vs realizado (datas, custos, fornecedor).

### 6.7 Cronograma e Histograma

- Criados aqui (base do Cowork) e visíveis/atualizados no Módulo 5 com avanço real.

---

## 7. Módulo 5 — Execution / CECS

Cérebro de acompanhamento da obra. Combina visão completa do PM, app mobile para campo, sub-módulos especializados e medições.

### 7.1 Visão e Sincronização das WBSs

- PM enxerga WBS-Client completa; pode dar avanço em qualquer item (inclusive subs leigos).
- Subcontrato vê apenas a sua WBS-Subcontract (sem valores do cliente).
- Avanço sub → reflete na WBS-Client após aprovação do PM.
- Avanço PM → reflete na WBS-Subcontract automaticamente.
- Avanço financeiro extra na WBS-Client (cash flow) não reflete no sub.

### 7.2 Change Orders

- **Sub → Empresa:** subcontrato cria CO; PM aprova; vira adicional do contrato sub.
- **Empresa → Cliente:** PM cria CO; Diretor aprova interno; cliente aprova; vira adicional do contrato cliente.
- Materiais adicionados em CO geram pedido de compra automático para Módulo 6.
- Anexos: fotos, datas, horas, valores, materiais.

### 7.3 Sub-módulos

- **Plan Viewer:** visualizador de plantas com medição (calibração por escala), markup, pins geolocalizados, comparação de versões.
- **RFI Log:** numeração automática, SLA, vinculação a WBS/pendência/CO, export PDF/Excel.
- **Safety:** Toolbox Talks com assinatura digital, treinamentos com validade, incidentes/near miss, inspeções.
- **Punch List:** ativada perto da entrega; pin no Plan Viewer; verificação final; export PDF padrão.
- **Daily Reports:** clima, equipe presente, atividades, ocorrências, fotos.
- **Pendências:** por item da WBS; email automático para responsáveis.
- **Pedidos de Material não-CO:** faltantes ou adicionais sem repasse ao cliente; vai pro Módulo 6.
- **Galeria + Timeline de fotos:** por item, geolocalizadas e com timestamp.

### 7.4 Custos: Previsto vs Realizado

- Painel comparativo alimentado por POs, COs aprovadas, materiais, equipamentos, mão de obra.
- Por serviço, categoria e total da obra.

### 7.5 Medições

- **Cliente:** AIA padrão indústria (G702/G703), mensal (01–30), inclui adicionais aprovados.
- **Subcontrato:** quinzenal ou mensal conforme acordo; PM define data e sistema busca o executado.

### 7.6 Mobile App

- iPad e celular, offline-first com sync automático.
- Avanço (% ou quantidade), fotos com GPS+timestamp, pendências, COs, daily reports.
- Lista semanal de funcionários (subcontrato atualiza).
- Visualização da WBS, submittals e documentos com cache offline.
- Login por papel (PM completo / sub restrito / foreman intermediário).

---

## 8. Módulo 6 — Purchasing & Rentals

Centraliza compras e locações da empresa, com fluxo de cotação obrigatório e integração com receiving e financeiro.

### 8.1 Entradas

- Lista de compras inicial vinda do Módulo 4 (submittals aprovados).
- Pedidos de material do Módulo 5 (PM ou subcontrato).
- Locações programadas do Módulo 4 (datas).
- Materiais de Change Orders aprovadas.

### 8.2 RFQ — Request for Quote

- Mínimo de 3 cotações antes de emitir PO.
- RFQ enviado para múltiplos fornecedores; comparação lado a lado (preço, prazo, condições).
- Histórico das cotações como base para futuras compras.

### 8.3 PO — Purchase Order

- Aprovação configurável por valor (limite por tenant).
- PO numerada com fornecedor, valores, condições, PDF padrão e envio por email.

### 8.4 Q&A entre Compras e PM

- Compras pode levantar dúvidas no sistema; PM responde sem sair.
- Histórico vinculado ao pedido com notificações.

### 8.5 Receiving (Mobile)

- PM ou foreman confirma recebimento na obra com foto e dados.
- Discrepâncias (faltou, errado, danificado) geram pendências.

### 8.6 Saída para Financeiro

- Invoice do fornecedor → Módulo 11 para aprovação e pagamento.
- PO finalizado alimenta o Previsto vs Realizado do Módulo 5.

---

## 9. Módulo 7 — Workforce Tracking

Rastreamento operacional e cálculo de custo de mão de obra própria por obra. Não substitui RH/folha — é tracking e custo.

### 9.1 Time Clock (Mobile + GPS)

- Funcionário bate ponto pelo app.
- GPS valida localização (raio configurável da obra).
- Foto opcional para confirmação de identidade.

### 9.2 Apontamento de Obra

- Funcionário aponta em qual obra está trabalhando.
- Pode apontar etapa específica da WBS (opcional).
- Múltiplas obras no mesmo dia: registra deslocamentos.

### 9.3 Custo Automático

- Salário/hora vem do Master Data; multiplica pelas horas registradas.
- Gera custo direto na obra (Previsto vs Realizado).
- Vinculado à etapa se o apontamento foi por etapa.

### 9.4 Visão por Funcionário

- Total de horas e custo consolidado em todas as obras.
- Distribuição entre obras; período configurável.

### 9.5 Validação pelo PM

- PM valida pontos do dia/semana.
- Pode ajustar (corrigir hora, transferir entre obras, marcar ausência).
- Histórico de ajustes (auditoria).

### 9.6 Relatórios

- Histórico de localização; tempo de deslocamento; horas extras; faltas.

---

## 10. Módulo 8 — Client Portal

Portal externo dedicado ao cliente: avanço, aprovações, comunicação e histórico financeiro.

### 10.1 Acesso

- Login dedicado, separado dos usuários internos.
- Multi-projeto: clientes com várias obras veem todas.
- Multi-contato: várias pessoas do cliente com permissões individuais (View / Approve).

### 10.2 Visão da Obra

- % de avanço físico, cronograma, próximos marcos, status geral.

### 10.3 Documentos

- Contrato assinado, submittals (aprovados/pendentes), COIs, lista semanal de funcionários.

### 10.4 Aprovações

- Submittals: aprova / rejeita / pede revisão direto no portal.
- Change Orders: revê fotos e justificativas, aprova ou rejeita.
- AIA mensal: revisa e aprova.
- Toda aprovação assinada digitalmente via DocuSign.

### 10.5 Comunicação

- Chat com o PM da obra; notificações automáticas para o cliente.

### 10.6 Histórico Financeiro

- AIAs aprovadas, pagamentos pendentes/recebidos, COs aprovadas, totais (contratado / executado / faturado / pago).

---

## 11. Módulo 9 — Admin Master (Multi-Tenant)

Camada de plataforma usada pela equipe da Construction Management Platform — não pelos tenants.

### 11.1 Gestão de Tenants

- Criar / suspender / desativar tenants.
- Cadastro completo da empresa (CNPJ/EIN, owner, endereço, contatos).

### 11.2 Planos e Billing

- Planos com limites: usuários, obras ativas, storage, módulos, IA tokens.
- Cobrança recorrente via Stripe.
- Faturas emitidas para tenants; controle de inadimplência.

### 11.3 Configurações Globais

- Templates padrão (G702/G703, RFI, PO, RFQ).
- Prompts e modelos de IA.
- Catálogo de integrações (DocuSign, Cowork, QuickBooks, etc.).

### 11.4 Operação

- Logs de atividade por tenant; métricas (DAU, MAU, módulos mais usados).
- Tickets de suporte; audit trail.
- Onboarding com setup wizard e import inicial de Master Data.
- Feature flags / rollout gradual.

---

## 12. Módulo 10 — Centralized Notifications

Camada transversal que padroniza notificações em todos os módulos.

### 12.1 Engine de Regras

- Regras: evento + papel + canal + urgência (Normal / Alta / Crítica).
- Templates editáveis com variáveis dinâmicas.

### 12.2 Canais Suportados

- Email com branding do tenant.
- Push notification (mobile).
- In-app (sino).
- SMS (eventos críticos).
- WhatsApp (futuro).

### 12.3 Preferências por Usuário

- Opt-in/out por evento e canal.
- Modo Não Perturbe (horários, finais de semana).
- Resumo diário/semanal opcional.

### 12.4 Escalonamento

- Sem ação em X tempo → escala para superior (configurável por tipo de evento).

### 12.5 Histórico

- Quem recebeu, quando, leu e clicou.
- Útil para auditoria e melhoria do sistema.

---

## 13. Módulo 11 — Financial

Foco em entradas e saídas das obras com lançamentos automáticos vindos de outros módulos + lançamentos manuais avulsos.

### 13.1 Receitas Automáticas

- AIA aprovada pelo cliente → conta a receber.
- Pagamento do cliente recebido → registra recebimento.
- Change Order aprovada pelo cliente → adiciona ao saldo a receber.

### 13.2 Despesas Automáticas

- PO de material aprovada e recebida → conta a pagar.
- PO de locação aprovada → conta a pagar.
- Invoice de fornecedor → conta a pagar com vencimento.
- Medição de subcontrato aprovada → conta a pagar.
- Folha de funcionários (semanal, do Mod. 7) → despesa automática.

### 13.3 Lançamentos Manuais

- Despesas avulsas: gasolina, café, EPI extra, ferramentas, manutenção.
- Cadastro com data, valor, categoria, obra (opcional), fornecedor, recibo (foto/PDF).
- Categorias configuráveis no Master Data.

### 13.4 Aprovação e Pagamento

- Contas a pagar passam por aprovação antes de pagar.
- Status: Pending Approval / Approved / Paid / Rejected.
- Programação de pagamentos; conciliação manual (futura integração bancária).

### 13.5 Visões

- Por obra: receitas, despesas, saldo, margem real (alimenta Previsto vs Realizado do Mod. 5).
- Empresa: cash flow, AP/AR consolidados, DRE simplificada.

### 13.6 Integração Futura

- Hooks para QuickBooks (export de lançamentos).

---

## 14. Módulo 12 — Warranty / Post-Delivery

Pós-entrega: gestão de chamados de garantia, triagem, execução de reparos e análise histórica.

### 14.1 Configuração de Garantias

- Garantias por serviço/área (ex: estrutura 5 anos, acabamento 1 ano, equipamentos conforme fabricante).
- Documentos anexados (manuais, certificados).

### 14.2 Service Calls

- Cliente abre chamado pelo Portal (descrição, foto, pin no Plan Viewer).
- Numeração automática.
- Status: Open / Under Review / Approved / Rejected / Scheduled / In Progress / Resolved / Closed.

### 14.3 Triagem

- Análise de cobertura: cobre (gratuito) / não cobre (orçamento) / disputa.
- Não cobre → vira proposta nova (volta ao Mod. 2).

### 14.4 Execução do Reparo

- Atribuição a funcionário ou subcontrato.
- Mini-WBS de reparo.
- Custo registrado (saldo de garantia da obra).
- Fotos antes/depois; aprovação do cliente que o reparo foi concluído.

### 14.5 Análise Histórica

- Padrões de defeito por serviço.
- Performance de subcontratos (quem deixa mais defeitos).
- Custo total de garantia por obra (impacta margem real).

---

## 15. Master Data (Camada Transversal)

Fonte única de verdade para os cadastros base que alimentam todos os módulos.

### 15.1 Cadastros

- Clientes (empresas) e seus contatos.
- Funcionários (com salário/hora, certificações, base Boston).
- Subcontratados (separado de funcionários).
- Suppliers (fornecedores; histórico de preços e performance).
- Materiais (catálogo, unidades, specs, fornecedores).
- Serviços e especificações detalhadas (referência para a IA do Cowork e para o Estimate Manual).
- Produtividade (man-hours, crew compositions, waste factors).
- Salários / Labor Rates (acesso restrito).
- Equipamentos / Ferramentas.
- Unidades de Medida.
- Regiões / Localidades (MA, FL com multiplicadores regionais).
- Tipos de Projeto (union, state, private, federal).
- Templates de Documentos (proposal, contract, RFI, PO, etc.).

### 15.2 Recursos

- Permissões granulares — cadastros sensíveis com acesso restrito (Salários, dados de funcionários).
- Histórico de alterações (especialmente Materiais, Salários, Preços).
- Importação em massa via CSV/Excel para setup inicial e atualizações em lote.

### 15.3 Sub-módulo: Estoque

- Material que sobra de uma obra entra no estoque.
- Pode ser transferido para outra obra.
- Transferência gera custo na obra de destino e crédito na obra de origem.
- Controle de localização, quantidade e condição.

---

## 16. Pontos-Chave de Integração entre Módulos

| Conexão                               | Descrição                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Cowork ↔ Mod. 2 (Caminho IA)          | Estimator envia plantas/specs; Cowork devolve análise estruturada; alimenta planilhas de preços e produtividade.            |
| Master Data → Mod. 2 (Caminho Manual) | Estimator usa classificações já existentes (serviços, materiais, produtividade, mão de obra) ou cria novas na hora.         |
| Mod. 2 → Mod. 3                       | Proposta com status Won dispara fluxo de contrato. IA usa a Proposta como base de comparação.                               |
| Mod. 3 → Mod. 4                       | Contrato assinado libera Pre-Execution. Cláusulas do contrato cliente alimentam IA na geração do contrato com subcontratos. |
| Mod. 4 → Mod. 5                       | WBSs, BOM, cronograma e histograma viajam para execução. Submittals e equipamentos disparam Mod. 6.                         |
| Mod. 5 ↔ Mod. 6                       | Pedidos de material, COs e equipamentos geram POs/RFQs. Receiving fecha o ciclo de compras.                                 |
| Mod. 5 ↔ Mod. 7                       | Ponto via mobile dispara custo automático na obra (Previsto vs Realizado).                                                  |
| Mods. 5 / 6 / 7 → Mod. 11             | AIA, POs, invoices, folha — todos geram lançamentos automáticos no Financeiro.                                              |
| Mod. 5 ↔ Mod. 8                       | Cliente vê avanço, aprova Submittals/CO/AIA pelo portal — sincroniza com a execução.                                        |
| Mod. 5 → Mod. 12                      | Após entrega, obra entra em garantia. Service Calls podem virar Proposal nova (volta ao Mod. 2).                            |
| Mod. 10 → Todos                       | Notificações configuráveis por evento, papel e canal. Escalonamento automático em SLAs.                                     |
| Master Data → Todos                   | Fonte única de verdade para clientes, funcionários, materiais, serviços, regiões e templates.                               |
| Mod. 9 → Plataforma                   | Multi-tenant, billing, templates globais, feature flags, suporte. Isolamento total entre tenants.                           |

---

## 17. Próximos Passos Sugeridos

A partir desta visão, sugere-se a seguinte abordagem incremental para desenvolvimento:

- **Fase 1 — Fundação:** Master Data + Admin Master (multi-tenant base) + Permissões + Lead Intake.
- **Fase 2 — Core de Vendas:** Estimate & Proposal (com import do Cowork e fluxo manual) + Contracts + DocuSign.
- **Fase 3 — Núcleo de Operação:** Pre-Execution (WBS dual) + Execution (web) + Mobile App básico.
- **Fase 4 — Cadeia de Suprimentos:** Purchasing (RFQ/PO/Receiving) + Workforce Tracking.
- **Fase 5 — Externos e Financeiro:** Client Portal + Financial (lançamentos automáticos).
- **Fase 6 — Pós-Entrega e Refinamento:** Warranty + Notifications avançadas + Dashboards completos.
- **Fase 7 — Integrações:** QuickBooks, banco, WhatsApp, e amadurecimento da IA.

### Decisões Pendentes

- Definir o schema do arquivo de import do Cowork (campos obrigatórios) — em andamento, ver `cowork-import-schema.md`.
- Definir templates exatos: AIA G702/G703, RFI, PO, Submittal, contratos.
- Definir limites de aprovação por valor de PO (default por tenant).
- Definir SLAs padrão para escalonamento de notificações.
- Definir estrutura de planos de billing (Starter / Professional / Enterprise).

### Observações Finais

A arquitetura aqui descrita é modular por design — cada módulo pode evoluir de forma independente, mas todos consomem o mesmo Master Data e respondem ao mesmo motor de notificações. Isso garante que o sistema cresça de forma consistente sem perder coesão.

O foco mobile-first nas funções de campo (Mod. 5 e Mod. 7) é diferencial competitivo importante: a maioria dos sistemas concorrentes ainda força o uso de desktop, o que reduz adoção em obra.

O caráter multi-tenant abre caminho para comercialização da plataforma como SaaS para outras empresas do setor de construção, multiplicando o valor do investimento de desenvolvimento.

A inclusão do caminho de Estimate Manual (sem IA) no Módulo 2 garante que obras pequenas e propostas rápidas não fiquem sobrecarregadas pelo fluxo de IA, mantendo agilidade e reduzindo custo operacional.

---

_Fim do Documento._
