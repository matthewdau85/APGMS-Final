import path from 'path';
import { runPayrollFeaturePipeline } from '../pipelines/payrollFeaturePipeline.js';

interface CliOptions {
  input: string;
  output: string;
  version?: string;
}

function printHelp(): void {
  console.log(`Usage: pnpm --filter @apgms/model-service pipeline:payroll -- [options]\n\n` +
    `Options:\n` +
    `  --input <path>     Path to the payroll dataset JSON file.\n` +
    `  --output <path>    Directory where pipeline outputs will be written.\n` +
    `  --version <value>  Optional version tag recorded in metadata (default: 0.1.0).\n` +
    `  --help             Show this help message.\n`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    input: '',
    output: path.resolve('packages/model-service/artifacts/pipeline-output'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--input': {
        options.input = path.resolve(argv[index + 1] ?? '');
        index += 1;
        break;
      }
      case '--output': {
        options.output = path.resolve(argv[index + 1] ?? '');
        index += 1;
        break;
      }
      case '--version': {
        options.version = argv[index + 1];
        index += 1;
        break;
      }
      case '--help':
      case '-h': {
        printHelp();
        process.exit(0);
      }
      default:
        break;
    }
  }

  if (!options.input) {
    throw new Error('Missing required option --input <path>');
  }

  return options;
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    await runPayrollFeaturePipeline({
      inputPath: args.input,
      outputDir: args.output,
      version: args.version,
    });
  } catch (error) {
    console.error('[model-service] Failed to run payroll pipeline:', error);
    process.exit(1);
  }
}

main();
