import { readFile, writeFile } from 'node:fs/promises';
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
    value = value.replace(/\n+$/, '') + '\n';
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

function projectUrl(repository) {
  return 'https://github.com/' + encodeURIComponent(sourceOwner) + '/' + encodeURIComponent(repository);
}

function buildCategorySection(category, entries, emptyMessage) {
  const selected = entries
    .filter((entry) => entry.category === category)
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));

  if (selected.length === 0) {
    return '### ' + (category === 'Projects' ? 'Específicos por projeto' : category === 'Automations' ? 'Automações' : 'Universais') + '\n\n' +
      emptyMessage;
  }

  const rows = selected.map((entry) => {
    const projects = [...new Set(entry.sources.map((source) => source.repository))]
      .sort((left, right) => left.localeCompare(right, 'en'));
    const projectLinks = projects
      .map((repository) => '[' + escapeTableCell(repository) + '](' + projectUrl(repository) + ')')
      .join(', ');
    const fileLinks = entry.files
      .map((file) => {
        const labels = [...new Set(file.sources.map((source) => source.repository))]
          .sort((left, right) => left.localeCompare(right, 'en'));
        return '[' + escapeTableCell(labels.join(', ')) + '](' + encodePath(file.path) + ')';
      })
      .join('<br>');
    return '| ' + escapeTableCell(entry.name) + ' | ' +
      escapeTableCell(entry.description) + ' | ' + projectLinks + ' | ' + fileLinks + ' |';
  });

  return [
    '### ' + (category === 'Projects' ? 'Project-specific' : category),
    '',
    '| Agente | Função | Projeto(s) | Arquivo |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

export function buildCatalog(entries) {
  return [
    buildCategorySection('Automations', entries, '*Nenhum agente de automação cadastrado.*'),
    buildCategorySection('Universals', entries, '*Nenhum agente universal cadastrado.*'),
    buildCategorySection('Projects', entries, '*Nenhum agente específico de projeto cadastrado.*'),
  ].join('\n\n');
}

function replaceGeneratedSection(readme, catalog) {
  const lines = readme.split(/\r?\n/);
  const beginIndexes = [];
  const endIndexes = [];
  lines.forEach((line, index) => {
    if (line.trim() === beginMarker) beginIndexes.push(index);
    if (line.trim() === endMarker) endIndexes.push(index);
  });

  if (beginIndexes.length === 1 && endIndexes.length === 1 && beginIndexes[0] < endIndexes[0]) {
    lines.splice(beginIndexes[0] + 1, endIndexes[0] - beginIndexes[0] - 1, catalog);
    return lines.join(readme.includes('\r\n') ? '\r\n' : '\n');
  }
  if (beginIndexes.length || endIndexes.length) {
    throw new Error('README catalog markers are malformed or duplicated.');
  }

  const headingIndex = lines.findIndex((line) => line.trim() === '## Catálogo de agentes');
  const insertion = [beginMarker, catalog, endMarker];
  if (headingIndex >= 0) lines.splice(headingIndex + 1, 0, '', ...insertion);
  else lines.push('', '## Agent Catalog', '', ...insertion);
  return lines.join(readme.includes('\r\n') ? '\r\n' : '\n');
}

export async function generateAgentCatalog(root = process.cwd()) {
  const readmePath = path.join(root, 'README.md');
  const manifestPath = path.join(root, 'agents', 'catalog.json');
  const [readme, rawManifest] = await Promise.all([
    readFile(readmePath, 'utf8'),
    readFile(manifestPath, 'utf8'),
  ]);
  const manifest = JSON.parse(rawManifest);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries)) {
    throw new Error('agents/catalog.json has an unsupported format.');
  }

  const updatedReadme = replaceGeneratedSection(readme, buildCatalog(manifest.entries));
  if (updatedReadme !== readme) await writeFile(readmePath, updatedReadme, 'utf8');
  return { count: manifest.entries.length, changed: updatedReadme !== readme };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  generateAgentCatalog()
    .then((result) => {
      console.log(
        result.changed
          ? 'Updated README.md with ' + result.count + ' agent catalog entr(y/ies).'
          : 'README.md is up to date (' + result.count + ' agent catalog entr(y/ies)).'
      );
    })
    .catch((error) => {
      console.error('Unable to generate the agent catalog: ' + error.message);
      process.exitCode = 1;
    });
}
