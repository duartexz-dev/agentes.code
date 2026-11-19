import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAgentFrontmatter } from './generate-agent-catalog.mjs';

const CATEGORY_DIRECTORIES = ['Automations', 'Universals', 'Projects'];
const MAIN_AGENT_NAMES = new Map([
  ['design-orchestrator', 'Designer Orchestrator'],
  ['javasage', 'JavaSage'],
]);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeIdentity(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unnamed-agent';
}

function categoryFromSourcePath(sourcePath) {
  const segments = String(sourcePath).replace(/\\/g, '/').split('/').map(normalizeIdentity);
  if (segments.some((segment) => ['automation', 'automations', 'automacao', 'automacoes'].includes(segment))) {
    return 'Automations';
  }
  if (segments.some((segment) => ['universal', 'universals', 'universais'].includes(segment))) {
    return 'Universals';
  }
  if (segments.some((segment) => ['project', 'projects', 'projeto', 'projetos'].includes(segment))) {
    return 'Projects';
  }
  return null;
}

function filenameFallback(sourcePath) {
  return path.basename(sourcePath, '.agent.md').replace(/[-_]+/g, ' ') || 'Unnamed agent';
}

function validateSource(source) {
  const repository = String(source.repository ?? '').trim();
  const sourcePath = String(source.sourcePath ?? '').replace(/\\/g, '/');
  const segments = sourcePath.split('/');

  if (!repository || !/^[a-zA-Z0-9._-]+$/.test(repository)) {
    throw new Error('Invalid source repository name: ' + repository);
  }
  if (
    !sourcePath ||
    sourcePath.startsWith('/') ||
    !sourcePath.endsWith('.agent.md') ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('Invalid agent source path: ' + sourcePath);
  }
  if (typeof source.content !== 'string') {
    throw new Error('Agent content must be UTF-8 text: ' + repository + '/' + sourcePath);
  }
}

export function classifyAgentSources(sources) {
  const prepared = sources.map((source) => {
    validateSource(source);
    const metadata = parseAgentFrontmatter(source.content);
    const name = metadata.name?.trim() || filenameFallback(source.sourcePath);
    const identity = normalizeIdentity(name);

    return {
      ...source,
      repository: String(source.repository),
      sourcePath: String(source.sourcePath).replace(/\\/g, '/'),
      name,
      displayName: MAIN_AGENT_NAMES.get(identity) ?? name,
      description: metadata.description?.trim() || 'Description unavailable.',
      identity,
      declaredCategory: categoryFromSourcePath(source.sourcePath),
    };
  });

  const repositoriesByIdentity = new Map();
  const declaredCategoriesByIdentity = new Map();
  for (const agent of prepared) {
    if (!repositoriesByIdentity.has(agent.identity)) {
      repositoriesByIdentity.set(agent.identity, new Set());
      declaredCategoriesByIdentity.set(agent.identity, new Set());
    }
    repositoriesByIdentity.get(agent.identity).add(agent.repository);
    if (agent.declaredCategory) {
      declaredCategoriesByIdentity.get(agent.identity).add(agent.declaredCategory);
    }
  }

  return prepared.map((agent) => {
    const declared = declaredCategoriesByIdentity.get(agent.identity);
    const sharedAcrossProjects = repositoriesByIdentity.get(agent.identity).size >= 2;
    const category = declared.has('Automations')
      ? 'Automations'
      : declared.has('Universals') || sharedAcrossProjects
        ? 'Universals'
        : 'Projects';
    return { ...agent, category };
  });
}

function setFrontmatterName(content, name) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0] !== '---') return content;

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && (line === '---' || line === '...')
  );
  if (closingIndex < 0) return content;

  const nameIndex = lines.findIndex(
    (line, index) => index > 0 && index < closingIndex && /^name\s*:/i.test(line)
  );
  if (nameIndex >= 0) {
    lines[nameIndex] = 'name: ' + JSON.stringify(name);
  } else {
    lines.splice(1, 0, 'name: ' + JSON.stringify(name));
  }
  return lines.join('\n');
}

function contentHash(content) {
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

function chooseDescription(agents) {
  const counts = new Map();
  for (const agent of agents) {
    counts.set(agent.description, (counts.get(agent.description) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)[0][0];
}

function projectRelativePath(sourcePath) {
  const prefix = '.github/agents/';
  const relativePath = sourcePath.startsWith(prefix) ? sourcePath.slice(prefix.length) : sourcePath;
  const firstSegment = relativePath.split('/')[0];
  const normalizedFolder = normalizeIdentity(firstSegment);
  return [
    'automation', 'automations', 'automacao', 'automacoes',
    'universal', 'universals', 'universais',
    'project', 'projects', 'projeto', 'projetos',
  ].includes(normalizedFolder)
    ? relativePath.split('/').slice(1).join('/')
    : relativePath;
}

function buildFileGroups(agents) {
  const groups = new Map();
  for (const agent of agents) {
    const content = setFrontmatterName(agent.content, agent.displayName);
    const hash = contentHash(content);
    if (!groups.has(hash)) groups.set(hash, { hash, content, agents: [] });
    groups.get(hash).agents.push(agent);
  }
  return [...groups.values()];
}

export async function buildCategorizedCatalog(sources, root = process.cwd()) {
  const classified = classifyAgentSources(sources);
  const entryGroups = new Map();

  for (const agent of classified) {
    const entryKey = agent.category === 'Projects'
      ? [agent.category, agent.identity, agent.repository, agent.sourcePath].join('\0')
      : [agent.category, agent.identity].join('\0');
    if (!entryGroups.has(entryKey)) entryGroups.set(entryKey, []);
    entryGroups.get(entryKey).push(agent);
  }

  const outputFiles = new Map();
  const entries = [];
  const orderedGroups = [...entryGroups.values()].sort((left, right) => {
    return left[0].category.localeCompare(right[0].category, 'en') ||
      left[0].identity.localeCompare(right[0].identity, 'en') ||
      left[0].repository.localeCompare(right[0].repository, 'en');
  });

  for (const agents of orderedGroups) {
    const representative = agents[0];
    const files = [];

    if (representative.category === 'Projects') {
      for (const agent of agents) {
        const relativePath = projectRelativePath(agent.sourcePath);
        const filePath = path.posix.join(
          'agents',
          'Projects',
          agent.repository,
          relativePath
        );
        const content = setFrontmatterName(agent.content, agent.displayName);
        outputFiles.set(filePath, content);
        files.push({
          path: filePath,
          sources: [{ repository: agent.repository, path: agent.sourcePath }],
        });
      }
    } else {
      const variants = buildFileGroups(agents);
      for (const variant of variants) {
        let filePath;
        if (variants.length === 1) {
          filePath = path.posix.join(
            'agents',
            representative.category,
            representative.identity + '.agent.md'
          );
        } else {
          const repositories = uniqueSorted(variant.agents.map((agent) => agent.repository));
          const label = repositories.length > 1
            ? 'shared'
            : normalizeIdentity(repositories[0]);
          filePath = path.posix.join(
            'agents',
            representative.category,
            representative.identity,
            label + '-' + variant.hash.slice(0, 8) + '.agent.md'
          );
        }
        outputFiles.set(filePath, variant.content);
        files.push({
          path: filePath,
          sources: variant.agents
            .map((agent) => ({ repository: agent.repository, path: agent.sourcePath }))
            .sort((left, right) =>
              left.repository.localeCompare(right.repository, 'en') ||
              left.path.localeCompare(right.path, 'en')
            ),
        });
      }
    }

    const allSources = agents.map((agent) => ({
      repository: agent.repository,
      path: agent.sourcePath,
    }));
    entries.push({
      category: representative.category,
      identity: representative.identity,
      name: representative.displayName,
      description: chooseDescription(agents),
      sources: allSources.sort((left, right) =>
        left.repository.localeCompare(right.repository, 'en') ||
        left.path.localeCompare(right.path, 'en')
      ),
      files,
    });
  }

  const categoryOrder = new Map(CATEGORY_DIRECTORIES.map((category, index) => [category, index]));
  entries.sort((left, right) =>
    categoryOrder.get(left.category) - categoryOrder.get(right.category) ||
    left.name.localeCompare(right.name, 'en')
  );

  const temporaryDirectory = await mkdtemp(path.join(root, '.agent-catalog-build-'));
  const agentsDirectory = path.join(root, 'agents');
  const backupDirectory = path.join(root, '.agent-catalog-backup-' + process.pid);
  let previousCatalogMoved = false;

  try {
    for (const category of CATEGORY_DIRECTORIES) {
      const directory = path.join(temporaryDirectory, category);
      await mkdir(directory, { recursive: true });
      const hasFiles = [...outputFiles.keys()].some((filePath) =>
        filePath.startsWith('agents/' + category + '/')
      );
      if (!hasFiles) await writeFile(path.join(directory, '.gitkeep'), '', 'utf8');
    }

    for (const [filePath, content] of outputFiles) {
      const destination = path.join(temporaryDirectory, ...filePath.split('/').slice(1));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, content, 'utf8');
    }

    const catalog = {
      schemaVersion: 1,
      entries,
    };
    await writeFile(
      path.join(temporaryDirectory, 'catalog.json'),
      JSON.stringify(catalog, null, 2) + '\n',
      'utf8'
    );

    await rm(backupDirectory, { recursive: true, force: true });
    try {
      await rename(agentsDirectory, backupDirectory);
      previousCatalogMoved = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await rename(temporaryDirectory, agentsDirectory);
    if (previousCatalogMoved) {
      await rm(backupDirectory, { recursive: true, force: true });
      previousCatalogMoved = false;
    }
  } catch (error) {
    if (previousCatalogMoved) {
      try {
        await rename(backupDirectory, agentsDirectory);
      } catch {
        // Keep the backup on disk if restoration itself fails.
      }
    }
    throw error;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  return {
    entries: entries.length,
    files: outputFiles.size,
    counts: Object.fromEntries(
      CATEGORY_DIRECTORIES.map((category) => [
        category,
        entries.filter((entry) => entry.category === category).length,
      ])
    ),
  };
}

async function findAgentFiles(directory) {
  let children;
  try {
    children = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const child of children) {
    const childPath = path.join(directory, child.name);
    if (child.isDirectory()) files.push(...(await findAgentFiles(childPath)));
    else if (child.isFile() && child.name.endsWith('.agent.md')) files.push(childPath);
  }
  return files;
}

async function readLocalAgentSources(root) {
  const directory = path.join(root, '.github', 'agents');
  const files = await findAgentFiles(directory);
  return Promise.all(files.map(async (filePath) => ({
    repository: 'agentes.code',
    sourcePath: path.relative(root, filePath).split(path.sep).join('/'),
    content: await readFile(filePath, 'utf8'),
  })));
}

async function main() {
  const root = process.cwd();
  const manifestPath = process.env.SOURCE_MANIFEST;
  if (!manifestPath) throw new Error('SOURCE_MANIFEST is required.');

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.complete !== true) {
    throw new Error('Source scan was incomplete; the previous catalog was preserved.');
  }

  const localSources = await readLocalAgentSources(root);
  const result = await buildCategorizedCatalog(
    [...(manifest.sources ?? []), ...localSources],
    root
  );
  console.log(
    'Created ' + result.files + ' agent file(s) across ' + result.entries + ' catalog entr(y/ies): ' +
    CATEGORY_DIRECTORIES.map((category) => category + '=' + result.counts[category]).join(', ') + '.'
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Unable to create the categorized agent catalog: ' + error.message);
    process.exitCode = 1;
  });
}
