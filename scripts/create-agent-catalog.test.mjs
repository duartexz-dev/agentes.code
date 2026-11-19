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
