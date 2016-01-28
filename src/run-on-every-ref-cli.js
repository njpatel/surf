#!/usr/bin/env node

import './babel-maybefill';

import request from 'request-promise';
import {getNwoFromRepoUrl} from './github-api';
import BuildMonitor from './build-monitor';

const d = require('debug')('surf:run-on-every-ref');

const yargs = require('yargs')
  .usage(`Usage: surf-client -s http://some.server -r https://github.com/some/repo -- command arg1 arg2 arg3...
Monitors a GitHub repo and runs a command for each changed branch / PR.`)
  .help('h')
  .alias('s', 'server')
  .describe('s', 'The Surf server to connect to')
  .alias('r', 'repository')
  .describe('r', 'The URL of the repository to monitor')
  .alias('j', 'jobs')
  .describe('j', 'The number of concurrent jobs to run. Defaults to 2')
  .alias('h', 'help')
  .epilog(`
Some useful environment variables:

GITHUB_ENTERPRISE_URL - the GitHub Enterprise URL to use.
GITHUB_TOKEN - the GitHub API token to use. Must be provided.`);

const argv = yargs.argv;

async function main() {
  const cmdWithArgs = argv._;

  if (cmdWithArgs.length < 1) {
    yargs.showHelp();
    process.exit(-1);
  }

  if (!argv.s || !argv.r) {
    yargs.showHelp();
    process.exit(-1);
  }

  let jobs = parseInt(argv.j || '2');
  if (argv.j && (jobs < 1 || jobs > 64)) {
    console.error("--jobs must be an integer");
    yargs.showHelp();
    process.exit(-1);
  }

  // Do an initial fetch to get our initial state
  let refInfo = null;
  let nwo = getNwoFromRepoUrl(argv.r);
  let surfUrl = `${argv.s}/info/${nwo}`;

  const fetchRefs = async () => {
    try {
      return await request({
        uri: surfUrl,
        json: true
      });
    } catch (e) {
      console.log(`Failed to fetch from ${surfUrl}: ${e.message}`);
      d(e.stack);
      process.exit(-1);
    }
  };

  refInfo = await fetchRefs();

  // TODO: figure out a way to trap Ctrl-C and dispose stop
  console.log(`Watching ${argv.r}, will run '${cmdWithArgs.join(' ')}'\n`);
  let buildMonitor = new BuildMonitor(cmdWithArgs, argv.r, jobs, fetchRefs, refInfo);
  buildMonitor.start();
  
  return new Promise(() => {});
}

main()
  .catch((e) => {
    console.error(e.message);
    d(e.stack);
    process.exit(-1);
  });
