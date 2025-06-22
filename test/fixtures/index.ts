import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesDir = fileURLToPath(new URL('.', import.meta.url));

interface Scenario {
  input: string;
  output: string;
  sources: Record<string, string>;
}

/**
 * Load a fixture file's content
 */
export function loadFixture(relativePath: string): string {
  return readFileSync(join(fixturesDir, relativePath), 'utf-8');
}

/**
 * Get all scenario names by reading directory names
 */
export function getScenarios(): string[] {
  return readdirSync(fixturesDir).filter((item) => {
    const itemPath = join(fixturesDir, item);
    return statSync(itemPath).isDirectory();
  });
}

/**
 * Load a scenario with its input, output, and source files
 */
export function loadScenario(scenarioName: string): Scenario {
  const scenarioPath = join(fixturesDir, scenarioName);

  if (!statSync(scenarioPath).isDirectory()) {
    throw new Error(`Scenario '${scenarioName}' not found`);
  }

  const sources: Record<string, string> = {};
  let input = '';
  let output = '';

  function loadFilesRecursively(dirPath: string, relativePath: string = '') {
    const files = readdirSync(dirPath);

    for (const file of files) {
      const filePath = join(dirPath, file);
      const stat = statSync(filePath);

      if (stat.isDirectory()) {
        const newRelativePath = relativePath ? `${relativePath}/${file}` : file;
        loadFilesRecursively(filePath, newRelativePath);
      } else {
        const content = readFileSync(filePath, 'utf-8');
        const fileKey = relativePath ? `${relativePath}/${file}` : file;

        if (file === 'input.md' && !relativePath) {
          input = content;
        } else if (file === 'output.md' && !relativePath) {
          output = content;
        } else {
          sources[fileKey] = content;
        }
      }
    }
  }

  loadFilesRecursively(scenarioPath);
  return { input, output, sources };
}

/**
 * Get all scenarios as a map
 */
export function loadAllScenarios(): Record<string, Scenario> {
  const scenarios: Record<string, Scenario> = {};
  const scenarioNames = getScenarios();

  for (const name of scenarioNames) {
    scenarios[name] = loadScenario(name);
  }

  return scenarios;
}
