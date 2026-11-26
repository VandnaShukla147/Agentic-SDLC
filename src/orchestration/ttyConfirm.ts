import readline from 'node:readline';
import type { ConfirmFn } from './workflow.js';

/** Human confirmation that only works from an interactive terminal and requires typing the target name. */
export function createTtyConfirm(
  input: NodeJS.ReadStream = process.stdin,
  output: NodeJS.WriteStream = process.stdout,
): ConfirmFn {
  return async (request) => {
    if (!input.isTTY || !output.isTTY) return false;
    output.write(`\nHuman confirmation required: ${request.action} gate "${request.gate}"\n`);
    output.write(`Artifacts: ${request.artifacts.join(', ')}\n`);
    const rl = readline.createInterface({ input, output });
    try {
      const answer = await new Promise<string>((resolve) => rl.question(`Type "${request.gate}" to confirm: `, resolve));
      return answer.trim() === request.gate;
    } finally {
      rl.close();
    }
  };
}
