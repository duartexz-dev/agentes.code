# agentes.code

## Sincronização de agentes do GitHub Copilot

O workflow [sync-agents.yml](./.github/workflows/sync-agents.yml) procura, a cada cinco minutos, arquivos `.agent.md` em qualquer nível abaixo de `.github/agents/` nos repositórios pertencentes a `duartexz-dev`. A execução também pode ser iniciada manualmente em **Actions > Synchronize Copilot agents > Run workflow**. O agendamento pode sofrer atrasos do GitHub Actions e não é instantâneo.

Os agentes são copiados para `agents/NOME-DO-REPOSITORIO/`, preservando o caminho relativo dentro de `.github/agents/`. Arquivos novos e alterados são sincronizados; conteúdo idêntico não gera commit. Remoções na origem não apagam arquivos do catálogo. Repositórios arquivados e o próprio catálogo são ignorados.

### Configuração dos secrets

Em **Settings > Secrets and variables > Actions**, crie estes dois repository secrets:

- `SOURCE_READ_TOKEN`: Fine-grained PAT da conta `duartexz-dev`, com acesso aos repositórios de origem necessários. Conceda somente **Metadata: Read-only** e **Contents: Read-only**.
- `CATALOG_WRITE_TOKEN`: Fine-grained PAT com acesso somente a `duartexz-dev/agentes.code`. Conceda **Metadata: Read-only** e **Contents: Read and write**.

Não coloque os tokens no código ou nos arquivos do repositório. O workflow usa cada token apenas para a operação correspondente: leitura das origens e gravação do catálogo.

### Execução e diagnóstico

Para executar manualmente, abra a aba **Actions**, selecione **Synchronize Copilot agents** e clique em **Run workflow**. Abra a execução para consultar o log de cada repositório e o resumo final de repositórios analisados e ignorados, agentes encontrados, novos, atualizados e inalterados, repositórios com erros e situação da execução. Erros de acesso ou leitura são informados por repositório para que os demais possam continuar; falhas ao listar repositórios indicam que é necessário conferir a validade, o acesso e as permissões de `SOURCE_READ_TOKEN`. Quando houver erros, as alterações válidas ainda são publicadas, mas a execução termina com falha e situação parcial para não aparentar sucesso completo.

O commit de sincronização só é criado quando há alterações no diretório `agents/`. O workflow impede execuções simultâneas conflitantes. A configuração inicial dos dois secrets acima é necessária antes da primeira execução.
