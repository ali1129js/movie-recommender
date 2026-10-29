import { buildCore } from './build-core';

const args = process.argv.slice(2);
const stage = args.find((a) => !a.startsWith('--')) ?? 'all';
const maxUsers = Number(args.find((a) => a.startsWith('--max-users='))?.split('=')[1]) || undefined;

async function main(): Promise<void> {
  if (stage === 'core' || stage === 'all') await buildCore(maxUsers ? { maxUsers } : {});
  if (stage === 'content' || stage === 'all') {
    const { buildContent } = await import('./build-content');
    await buildContent();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
