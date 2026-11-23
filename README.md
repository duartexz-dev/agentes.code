# agentes.code

[![Sincronização de agentes](https://github.com/duartexz-dev/agentes.code/actions/workflows/sync-agents.yml/badge.svg)](https://github.com/duartexz-dev/agentes.code/actions/workflows/sync-agents.yml)

Catálogo que cria, classifica e sincroniza agentes do GitHub Copilot entre projetos.

## Categorias

| Pasta | Uso |
| --- | --- |
| `agents/Automations/` | Agentes para tarefas de automação. |
| `agents/Universals/` | Agentes reutilizáveis em dois ou mais projetos. |
| `agents/Projects/<projeto>/` | Agentes feitos para um projeto específico. |

Um agente com o mesmo nome em mais de um projeto é classificado como **Universal**. Definições idênticas são armazenadas uma vez; versões diferentes são preservadas.

## Adicionar um agente

Crie um arquivo `.agent.md` no repositório de origem, dentro de `.github/agents/`:

```text
.github/agents/meu-agente.agent.md
```

Adicione os metadados e as instruções:

```yaml
---
name: Meu Agente
description: Descreve a função do agente.
---

Instruções do agente.
```

Para escolher uma categoria manualmente, use uma destas pastas diretamente dentro de `.github/agents/`:

- `.github/agents/Automations/` → **Automações**.
- `.github/agents/Universals/` → **Universais**.
- `.github/agents/` sem uma dessas pastas → classificação automática.

A classificação automática considera o nome declarado no frontmatter: se o mesmo agente aparecer em dois ou mais repositórios, ele será **Universal**; caso contrário, ficará em **Específicos por projeto**. A pasta de categoria é reconhecida somente no primeiro nível de `.github/agents/`; subpastas comuns não alteram a classificação.

Envie o arquivo para a branch padrão do repositório. A sincronização cria a cópia categorizada neste catálogo sem alterar o arquivo original.

## Sincronização

- Executa a cada cinco minutos ou manualmente em **Actions → Synchronize Copilot agents → Run workflow**.
- Analisa repositórios não arquivados de `duartexz-dev` e suas branches padrão.
- Atualiza os arquivos categorizados e este README.
- Só substitui o catálogo depois de uma leitura completa. Em caso de erro, preserva a última versão válida.

### Secrets necessários

Configure em **Settings → Secrets and variables → Actions**:

| Secret | Permissão mínima |
| --- | --- |
| `SOURCE_READ_TOKEN` | Metadata e Contents: leitura nos repositórios de origem. |
| `CATALOG_WRITE_TOKEN` | Metadata: leitura; Contents: leitura e escrita neste repositório. |

Use tokens Fine-grained separados. Nunca os grave nos arquivos do projeto.

## Catálogo de agentes

Esta lista é atualizada automaticamente.

<!-- BEGIN AUTO-GENERATED AGENT CATALOG -->
### Automações

*Nenhum agente de automação cadastrado.*

### Universais

| Agente | Função | Projeto(s) | Arquivo |
| --- | --- | --- | --- |
| Design QA/Repair | Investiga e corrige bugs confirmados de funcionamento, responsividade, acessibilidade e integração sem redesenhar o produto. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto](agents/Universals/design-qa-repair/avocrypto-a03ed2fb.agent.md)<br>[BuildJava.ln, ChatBot](agents/Universals/design-qa-repair/shared-5dbe623d.agent.md) |
| Design Security Auditor | Audita riscos de segurança e privacidade com análise independente somente leitura, evidências, severidade e limitações explícitas. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto, BuildJava.ln, ChatBot](agents/Universals/design-security-auditor.agent.md) |
| Designer Orchestrator | Conduz a descoberta do produto, aprova a identidade visual e coordena especialistas, QA e auditoria de segurança. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto](agents/Universals/design-orchestrator/avocrypto-6bc80450.agent.md)<br>[BuildJava.ln, ChatBot](agents/Universals/design-orchestrator/shared-297681ae.agent.md) |
| Editorial Designer | Estrutura experiências orientadas a conteúdo com direção tipográfica, grid, ritmo de leitura e hierarquia editorial. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto](agents/Universals/editorial-designer/avocrypto-349b841b.agent.md)<br>[BuildJava.ln, ChatBot](agents/Universals/editorial-designer/shared-1101574f.agent.md) |
| Glassmorphism Designer | Cria interfaces em camadas com transparência e desfoque, preservando contraste, legibilidade e alternativas acessíveis. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto](agents/Universals/glassmorphism-designer/avocrypto-667c4ef4.agent.md)<br>[BuildJava.ln, ChatBot](agents/Universals/glassmorphism-designer/shared-fbe1507f.agent.md) |
| Maximalism Designer | Cria interfaces expressivas com composição, cor e tipografia de personalidade, sem sacrificar legibilidade ou usabilidade. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto](agents/Universals/maximalism-designer/avocrypto-fa5a4a02.agent.md)<br>[BuildJava.ln, ChatBot](agents/Universals/maximalism-designer/shared-e7ea145b.agent.md) |
| Minimalism Designer | Implementa interfaces minimalistas com hierarquia clara, tipografia consistente, espaços intencionais e navegação simples. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto](agents/Universals/minimalism-designer/avocrypto-f86c1f47.agent.md)<br>[BuildJava.ln, ChatBot](agents/Universals/minimalism-designer/shared-f47aa2ef.agent.md) |
| Motion Designer | Implementa microinterações, feedback, estados e transições de interface funcionais, responsivos e acessíveis. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto](agents/Universals/motion-designer/avocrypto-7cb2fb64.agent.md)<br>[BuildJava.ln, ChatBot](agents/Universals/motion-designer/shared-39799991.agent.md) |
| Motion Graphics Designer | Cria movimento gráfico e narrativas animadas com tipografia, ilustração e transições de cena, distintos das microinterações de interface. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto](agents/Universals/motion-graphics-designer/avocrypto-3f93b718.agent.md)<br>[BuildJava.ln, ChatBot](agents/Universals/motion-graphics-designer/shared-a8e1d248.agent.md) |
| Neobrutalism Designer | Cria interfaces neo-brutalistas com geometria, bordas, contraste e personalidade sem comprometer acessibilidade ou usabilidade. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto](agents/Universals/neobrutalism-designer/avocrypto-2b3493e3.agent.md)<br>[BuildJava.ln, ChatBot](agents/Universals/neobrutalism-designer/shared-0c652a20.agent.md) |
| Neumorphism Designer | Projeta superfícies e controles táteis com profundidade suave, limites reconhecíveis, contraste e acessibilidade. | [Avocrypto](https://github.com/duartexz-dev/Avocrypto), [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln), [ChatBot](https://github.com/duartexz-dev/ChatBot) | [Avocrypto](agents/Universals/neumorphism-designer/avocrypto-4d436e44.agent.md)<br>[BuildJava.ln, ChatBot](agents/Universals/neumorphism-designer/shared-26280f14.agent.md) |

### Específicos por projeto

| Agente | Função | Projeto(s) | Arquivo |
| --- | --- | --- | --- |
| JavaSage | Maintain BuildJava.ln by registering Java projects and reviewing source, catalogue, Markdown, and educational-comment consistency. | [BuildJava.ln](https://github.com/duartexz-dev/BuildJava.ln) | [BuildJava.ln](agents/Projects/BuildJava.ln/JavaSage.agent.md) |
<!-- END AUTO-GENERATED AGENT CATALOG -->
