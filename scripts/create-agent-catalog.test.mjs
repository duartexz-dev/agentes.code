import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildCategorizedCatalog,
  classifyAgentSources,
} from './create-agent-catalog.mjs';

function agent(repository, fileName, content, folder = '') {
  const suffix = folder ? folder + '/' : '';
  return {
    repository,
    sourcePath: '.github/agents/' + suffix + fileName,
    content,
  };
}

function definition(name, description = 'An example agent.') {
  return [
    '---',
    'name: ' + JSON.stringify(name),
    'description: ' + JSON.stringify(description),
    '---',
    '',
    'Agent instructions.',
    '',
  ].join('\n');
}

test('agents with the same name in two projects become universal', () => {
  const sources = [
    agent('ProjectA', 'designer.agent.md', definition('Designer')),
    agent('ProjectB', 'designer.agent.md', definition('Designer')),
  ];
  assert.deepEqual(classifyAgentSources(sources).map((item) => item.category), [
    'Universals',
    'Universals',
  ]);
});

test('category folders explicitly classify automation and universal agents', () => {
  const sources = [
    agent('OpsProject', 'release.agent.md', definition('Release Assistant'), 'Automations'),
    agent('OneProject', 'designer.agent.md', definition('Designer'), 'Universals'),
    agent('BuildJava.ln', 'JavaSage.agent.md', definition('JavaSage')),
  ];
  assert.deepEqual(classifyAgentSources(sources).map((item) => item.category), [
    'Automations',
    'Universals',
    'Projects',
  ]);
});

test('a category declaration applies to every version of the same agent', () => {
  const sources = [
    agent('ProjectA', 'designer.agent.md', definition('Designer'), 'Universals'),
    agent('ProjectB', 'designer.agent.md', definition('Designer')),
  ];
  assert.deepEqual(classifyAgentSources(sources).map((item) => item.category), [
    'Universals',
    'Universals',
  ]);
});

test('identical universal definitions are stored once and retain all source references', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentes-code-test-'));
  try {
    const content = definition('Design Orchestrator');
    const result = await buildCategorizedCatalog([
      agent('ProjectA', 'design-orchestrator.agent.md', content),
      agent('ProjectB', 'design-orchestrator.agent.md', content),
    ], root);
    const manifest = JSON.parse(await readFile(path.join(root, 'agents', 'catalog.json'), 'utf8'));
    assert.equal(result.files, 1);
    assert.equal(manifest.entries.length, 1);
    assert.equal(manifest.entries[0].name, 'Designer Orchestrator');
    assert.deepEqual(
      manifest.entries[0].sources.map((source) => source.repository),
      ['ProjectA', 'ProjectB']
    );
    const filePath = path.join(root, manifest.entries[0].files[0].path);
    const copied = await readFile(filePath, 'utf8');
    assert.match(copied, /^---\nname: "Designer Orchestrator"/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('different universal definitions are preserved as separate variants', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentes-code-test-'));
  try {
    const result = await buildCategorizedCatalog([
      agent('ProjectA', 'designer.agent.md', definition('Designer', 'Version A.')),
      agent('ProjectB', 'designer.agent.md', definition('Designer', 'Version B.')),
    ], root);
    const manifest = JSON.parse(await readFile(path.join(root, 'agents', 'catalog.json'), 'utf8'));
    assert.equal(result.files, 2);
    assert.equal(manifest.entries[0].category, 'Universals');
    assert.equal(manifest.entries[0].files.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('nested folders named after categories do not override automatic classification', () => {
  const sources = [
    agent('ProjectA', 'release.agent.md', definition('Release Helper'), 'Documentation/Automations'),
    agent('ProjectB', 'layout.agent.md', definition('Layout Helper'), 'Guides/Universals'),
    agent('ProjectC', 'notes.agent.md', definition('Notes Helper'), 'Archive/Projects'),
  ];

  assert.deepEqual(classifyAgentSources(sources).map((item) => item.category), [
    'Projects',
    'Projects',
    'Projects',
  ]);
});

test('categorized catalog materializes automation, universal, and project files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentes-code-test-'));
  try {
    const sharedDefinition = definition('Shared Designer');
    const result = await buildCategorizedCatalog([
      agent('OpsProject', 'release.agent.md', definition('Release Assistant'), 'Automations'),
      agent('ProjectA', 'designer.agent.md', sharedDefinition),
      agent('ProjectB', 'designer.agent.md', sharedDefinition),
      agent('BuildJava.ln', 'JavaSage.agent.md', definition('JavaSage')),
    ], root);

    const manifest = JSON.parse(await readFile(path.join(root, 'agents', 'catalog.json'), 'utf8'));
    assert.deepEqual(result.counts, {
      Automations: 1,
      Universals: 1,
      Projects: 1,
    });
    assert.ok(manifest.entries.some((entry) =>
      entry.category === 'Automations' &&
      entry.files.some((file) => file.path === 'agents/Automations/release.agent.md')
    ));
    assert.ok(manifest.entries.some((entry) =>
      entry.category === 'Universals' &&
      entry.files.some((file) => file.path === 'agents/Universals/shared-designer.agent.md')
    ));
    assert.ok(manifest.entries.some((entry) =>
      entry.category === 'Projects' &&
      entry.files.some((file) => file.path === 'agents/Projects/BuildJava.ln/JavaSage.agent.md')
    ));

    for (const entry of manifest.entries) {
      for (const file of entry.files) {
        const absolutePath = path.join(root, file.path);
        const written = await readFile(absolutePath, 'utf8');
        assert.ok(written.length > 0, file.path + ' must be materialized');
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('source validation rejects traversal paths and repository names', () => {
  assert.throws(() => classifyAgentSources([
    {
      repository: 'ProjectA',
      sourcePath: '.github/agents/../../outside.agent.md',
      content: definition('Unsafe Agent'),
    },
  ]), /Invalid agent source path/);

  assert.throws(() => classifyAgentSources([
    {
      repository: '..',
      sourcePath: '.github/agents/agent.agent.md',
      content: definition('Unsafe Agent'),
    },
  ]), /Invalid source repository name/);
});
