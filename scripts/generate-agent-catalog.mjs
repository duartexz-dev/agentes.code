import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const beginMarker = '<!-- BEGIN AUTO-GENERATED AGENT CATALOG -->';
const endMarker = '<!-- END AUTO-GENERATED AGENT CATALOG -->';
const sourceOwner = 'duartexz-dev';

function parseScalar(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1).replace(/\\([\\'"nrt])/g, (_, character) => {
        const escapes = { n: '\n', r: '\r', t: '\t' };
        return escapes[character] ?? character;
      });
    }
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  return trimmed.replace(/\s+#.*$/, '').trim();
}

function parseBlockScalar(lines, start, style) {
  let end = start;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() && !/^[ \t]/.test(line)) break;
    end += 1;
  }

  const block = lines.slice(start, end);
  const indentation = Math.min(
    ...block.filter((line) => line.trim()).map((line) => line.match(/^[ \t]*/)[0].length),
    Number.POSITIVE_INFINITY
  );
  const content = block.map((line) => (line.trim() ? line.slice(indentation) : ''));
  const folded = style.startsWith('>');
  const indicator = style.slice(1);
  let value = '';

  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];
    const next = content[index + 1];
    value += current;
    if (index < content.length - 1) {
      value += folded && current && next ? ' ' : '\n';
    }
  }

  if (indicator.includes('-')) {
    value = value.replace(/\n+$/, '');
  } else if (indicator.includes('+')) {
    if (content.length > 0) value += '\n';
  } else if (value) {
    value = `${value.replace(/\n+$/, '')}\n`;
  }

  return { value, nextIndex: end };
}

export function parseAgentFrontmatter(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0] !== '---') return {};

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && (line === '---' || line === '...')
  );
  if (closingIndex < 0) return {};

  const frontmatter = lines.slice(1, closingIndex);
  const metadata = {};
  for (let index = 0; index < frontmatter.length; index += 1) {
    const match = frontmatter[index].match(/^(name|description)\s*:\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (rawValue.startsWith('|') || rawValue.startsWith('>')) {
      const block = parseBlockScalar(frontmatter, index + 1, rawValue.trim());
      metadata[key] = block.value.trim();
      index = block.nextIndex - 1;
    } else {
      metadata[key] = parseScalar(rawValue);
    }
  }

  return metadata;
}

function compareAlphabetically(left, right) {
  const a = left.toLocaleLowerCase('en');
  const b = right.toLocaleLowerCase('en');
  return a < b ? -1 : a > b ? 1 : left < right ? -1 : left > right ? 1 : 0;
}

async function findAgentFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findAgentFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.agent.md')) {
      files.push(entryPath);
    }
  }
  return files;
}

function filenameFallback(filePath) {
  return path.basename(filePath, '.agent.md').replace(/[-_]+/g, ' ') || 'Unnamed agent';
}

function escapeTableCell(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n?|\n/g, '<br>');
}

function encodePath(relativePath) {
  return relativePath.split('/').map(encodeURIComponent).join('/');
}

function buildCatalog(agents) {
  if (agents.length === 0) return 'No agents have been synchronized yet.';

  const sorted = [...agents].sort(
    (left, right) =>
      compareAlphabetically(left.repository, right.repository) ||
      compareAlphabetically(left.name, right.name) ||
      compareAlphabetically(left.relativePath, right.relativePath)
  );
  const rows = sorted.map((agent) => {
    const filePath = `agents/${agent.repository}/${agent.relativePath}`;
    const fileLink = `./${encodePath(filePath)}`;
    const repositoryLink = `https://github.com/${encodeURIComponent(sourceOwner)}/${encodeURIComponent(agent.repository)}`;
    return `| ${escapeTableCell(agent.name)} | ${escapeTableCell(agent.description)} | [${escapeTableCell(agent.repository)}](${repositoryLink}) | [${escapeTableCell(filePath)}](${fileLink}) |`;
  });

  return [
    '| Agent | Description | Source repository | File |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function replaceGeneratedSection(readme, catalog, newline) {
  const beginCount = readme.split(beginMarker).length - 1;
  const endCount = readme.split(endMarker).length - 1;
  const headings = [...readme.matchAll(/^## Available Agents[ \t]*$/gm)];

  if (beginCount !== endCount || beginCount > 1) {
    throw new Error(
      'README markers are malformed or duplicated; expected exactly one matching marker pair.'
    );
  }
  if (headings.length > 1) {
    throw new Error('README contains multiple "## Available Agents" headings.');
  }

  const block = `${beginMarker}${newline}${catalog}${newline}${endMarker}`;
  if (beginCount === 1) {
    const beginMatches = [...readme.matchAll(new RegExp(`^${beginMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*$`, 'gm'))];
    const endMatches = [...readme.matchAll(new RegExp(`^${endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*$`, 'gm'))];
    if (beginMatches.length !== 1 || endMatches.length !== 1 || beginMatches[0].index > endMatches[0].index) {
      throw new Error(
        'README markers must each appear once on their own line, with BEGIN before END.'
      );
    }

    const beginIndex = beginMatches[0].index;
    const endLineEnd = readme.indexOf(newline, endMatches[0].index);
    const endIndex = endLineEnd < 0 ? readme.length : endLineEnd;
    let updated = `${readme.slice(0, beginIndex)}${block}${readme.slice(endIndex)}`;

    if (headings.length === 0) {
      const markerIndex = updated.indexOf(beginMarker);
      updated = `${updated.slice(0, markerIndex)}## Available Agents${newline}${newline}${updated.slice(markerIndex)}`;
    }
    return updated;
  }

  if (headings.length === 1) {
    const headingEnd = readme.indexOf(newline, headings[0].index);
    if (headingEnd < 0) {
      return `${readme}${newline}${newline}${block}${newline}`;
    }
    return `${readme.slice(0, headingEnd + newline.length)}${block}${newline}${readme.slice(headingEnd + newline.length)}`;
  }

  const separator = readme.endsWith(newline.repeat(2))
    ? ''
    : readme.endsWith(newline)
      ? newline
      : `${newline}${newline}`;
  return `${readme}${separator}## Available Agents${newline}${newline}${block}${newline}`;
}

export async function generateAgentCatalog(root = process.cwd()) {
  const catalogDirectory = path.join(root, 'agents');
  const readmePath = path.join(root, 'README.md');
  const files = await findAgentFiles(catalogDirectory);
  const seenPaths = new Set();
  const agents = [];

  for (const filePath of files) {
    const relativeToCatalog = path.relative(catalogDirectory, filePath);
    const [repository, ...pathSegments] = relativeToCatalog.split(path.sep);
    if (!repository || pathSegments.length === 0) continue;

    const relativePath = pathSegments.join('/');
    const identity = `${repository}/${relativePath}`;
    if (seenPaths.has(identity)) continue;
    seenPaths.add(identity);

    const metadata = parseAgentFrontmatter(await readFile(filePath, 'utf8'));
    agents.push({
      repository,
      relativePath,
      name: metadata.name?.trim() || filenameFallback(filePath),
      description: metadata.description?.trim() || 'Description unavailable.',
    });
  }

  const readme = await readFile(readmePath, 'utf8');
  const newline = readme.includes('\r\n') ? '\r\n' : '\n';
  const updatedReadme = replaceGeneratedSection(readme, buildCatalog(agents), newline);
  if (updatedReadme !== readme) {
    await writeFile(readmePath, updatedReadme, 'utf8');
  }
  return { count: agents.length, changed: updatedReadme !== readme };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await generateAgentCatalog();
    console.log(
      result.changed
        ? `Updated README.md with ${result.count} synchronized agent(s).`
        : `README.md is up to date (${result.count} synchronized agent(s)).`
    );
  } catch (error) {
    console.error(`Unable to generate the agent catalog: ${error.message}`);
    process.exitCode = 1;
  }
}
