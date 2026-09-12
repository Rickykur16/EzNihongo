import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const workflow = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
// Execute the actual inline deployment script, not a second implementation.
// Fail closed if the workflow stops having exactly one inline SSH script.
const blocks = [...workflow.matchAll(/^          script: \|\r?\n((?:(?: {12}[^\n]*|[ \t]*)\r?\n?)*)/gm)];
assert.equal(blocks.length, 1, 'Update the harness when the SSH script layout changes');
const script = blocks[0][1].replace(/^ {12}/gm, '');
const bash = process.env.DEPLOY_TEST_BASH || 'bash';

test('deployment binds the CI-tested SHA and retains the main-only/CI gate', () => {
  assert.match(workflow, /env:\s*\n\s+DEPLOY_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /envs: DEPLOY_SHA\s*\n/);
  assert.match(workflow, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /needs: ci/);
  assert.match(workflow, /TEST_DATABASE_URL: postgresql:\/\/[^\n]+/);
  assert.match(workflow, /run: node --test learning-state\.test\.js/);
  const syntax = spawnSync(bash, ['--noprofile', '--norc', '-n'], { input: script, encoding: 'utf8' });
  assert.ifError(syntax.error);
  assert.equal(syntax.status, 0, syntax.stderr);
});

// Each test owns two disposable local Git repositories. Only Git and Bash are
// real; all VPS commands are shell functions that log instead of touching the
// machine. Never open SSH, run npm/migrations, or contact a database here.
async function fixture(t) {
  const prefix = path.join(tmpdir(), 'eznihongo-deploy-test-');
  const root = await mkdtemp(prefix);
  t.after(async () => {
    assert.equal(path.dirname(root), path.dirname(prefix));
    assert.ok(path.basename(root).startsWith(path.basename(prefix)));
    await rm(root, { recursive: true, force: true });
  });
  const upstream = path.join(root, 'upstream');
  const checkout = path.join(root, 'checkout');
  const commandLog = path.join(root, 'commands.log');
  const git = (cwd, ...args) => execFileSync('git', [
    '-c', 'user.name=Deployment Test', '-c', 'user.email=deploy@example.invalid',
    '-c', 'commit.gpgsign=false', ...args,
  ], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  await mkdir(upstream);
  git(upstream, 'init', '--initial-branch=main', '--template=');
  await mkdir(path.join(upstream, 'backend'));
  await writeFile(path.join(upstream, '.gitignore'), '.env\nuploads/\n');
  await writeFile(path.join(upstream, 'backend', 'release.txt'), 'initial');
  git(upstream, 'add', '.');
  git(upstream, 'commit', '-m', 'initial');
  const initial = git(upstream, 'rev-parse', 'HEAD');
  git(root, 'clone', '--no-hardlinks', upstream, checkout);
  await writeFile(path.join(checkout, 'backend', '.env'), 'LOCAL_TEST_SENTINEL=preserved\n');
  await mkdir(path.join(checkout, 'uploads'));
  await writeFile(path.join(checkout, 'uploads', 'existing.txt'), 'existing upload');
  const commit = async (label) => {
    await writeFile(path.join(upstream, 'backend', 'release.txt'), label);
    git(upstream, 'add', '.');
    git(upstream, 'commit', '-m', label);
    return git(upstream, 'rev-parse', 'HEAD');
  };
  const tested = await commit('tested');
  const newer = await commit('newer-not-tested-by-this-run');
  const harness = `
    cd() {
      if [ "$1" = /var/www/eznihongo ]; then
        builtin cd "$DEPLOY_TEST_CHECKOUT"
      elif [ "$1" = backend ]; then
        builtin cd backend
      else
        echo 'Unexpected deployment directory' >&2; exit 97
      fi
    }
    record() { printf '%s\\n' "$*" >> "$DEPLOY_TEST_LOG"; }
    git() {
      record "git $*"
      if [ "$1" = reset ] && [ "\${DEPLOY_TEST_RESET_NOOP:-}" = 1 ]; then return 0; fi
      command git "$@"
    }
    install() { record "install $*"; }
    nginx() { record "nginx $*"; }
    systemctl() { record "systemctl $*"; }
    npm() {
      record "npm $*"
      if [ "$*" = 'run migrate' ] && [ "\${DEPLOY_TEST_MIGRATION_FAIL:-}" = 1 ]; then return 1; fi
    }
    curl() { record "curl $*"; [ "\${DEPLOY_TEST_HEALTH_FAIL:-}" != 1 ]; }
    sleep() { record "sleep $*"; }
    journalctl() { record "journalctl $*"; }
  `;
  const run = async (sha = tested, options = {}) => {
    await writeFile(commandLog, '');
    const result = spawnSync(bash, ['--noprofile', '--norc', '-s'], {
      cwd: checkout, input: harness + '\n' + script, encoding: 'utf8', timeout: 20000,
      env: { ...process.env, DEPLOY_SHA: sha, DEPLOY_TEST_CHECKOUT: checkout,
        DEPLOY_TEST_LOG: commandLog, ...options },
    });
    assert.ifError(result.error);
    return { ...result, commands: await readFile(commandLog, 'utf8') };
  };
  const head = () => git(checkout, 'rev-parse', 'HEAD');
  const assertNoRelease = (result, expected = initial) => {
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(head(), expected);
    assert.doesNotMatch(result.commands, /^(?:install|nginx|systemctl|npm|curl) /m);
    assert.doesNotMatch(result.stdout, /Deploy ok:/);
  };
  return { upstream, checkout, initial, tested, newer, git, head, run, assertNoRelease };
}

test('deploy installs the tested commit even after main advances; same-SHA retry is allowed', async (t) => {
  const f = await fixture(t);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await f.run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(f.head(), f.tested);
    assert.equal(f.git(f.checkout, 'rev-parse', 'origin/main'), f.newer);
    assert.equal(await readFile(path.join(f.checkout, 'backend', 'release.txt'), 'utf8'), 'tested');
    assert.match(result.commands, /npm ci --omit=dev\nnpm run migrate\nsystemctl restart eznihongo-api/);
    assert.ok(result.stdout.includes(`Deploy ok: ${f.tested}`));
    assert.equal(await readFile(path.join(f.checkout, 'backend', '.env'), 'utf8'), 'LOCAL_TEST_SENTINEL=preserved\n');
    assert.equal(await readFile(path.join(f.checkout, 'uploads', 'existing.txt'), 'utf8'), 'existing upload');
  }
});

test('missing, abbreviated, symbolic and malformed SHA fail before fetch or checkout', async (t) => {
  const f = await fixture(t);
  for (const sha of ['', f.tested.slice(0, 7), 'origin/main', '--help', `${f.tested}; exit 0`]) {
    const result = await f.run(sha);
    f.assertNoRelease(result);
    assert.equal(result.commands, '');
  }
});

test('unknown commit fails without changing the installed checkout', async (t) => {
  const f = await fixture(t);
  f.assertNoRelease(await f.run('f'.repeat(40)));
});

test('fetch failure stops before reset, install, migration or restart', async (t) => {
  const f = await fixture(t);
  f.git(f.checkout, 'remote', 'set-url', 'origin', path.join(f.upstream, 'missing-repository'));
  const result = await f.run();
  f.assertNoRelease(result);
  assert.doesNotMatch(result.commands, /git reset/);
});

test('a commit removed from main by a force-push is rejected', async (t) => {
  const f = await fixture(t);
  f.git(f.checkout, 'fetch', 'origin'); // The target object exists locally.
  f.git(f.upstream, 'checkout', '-B', 'main', f.initial);
  const result = await f.run();
  f.assertNoRelease(result);
  assert.match(result.stdout, /tidak lagi berada pada main/);
});

test('a stale rerun cannot roll an already newer deployment back', async (t) => {
  const f = await fixture(t);
  f.git(f.checkout, 'fetch', 'origin');
  f.git(f.checkout, 'checkout', '--detach', f.newer);
  const result = await f.run();
  f.assertNoRelease(result, f.newer);
  assert.match(result.stdout, /bukan fast-forward/);
});

test('a divergent server commit requires manual review instead of being overwritten', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.checkout, 'backend', 'release.txt'), 'server-only hotfix');
  f.git(f.checkout, 'add', '.');
  f.git(f.checkout, 'commit', '-m', 'server-only hotfix');
  const installed = f.head();
  const result = await f.run();
  f.assertNoRelease(result, installed);
  assert.match(result.stdout, /bukan fast-forward/);
});

test('checkout mismatch stops before installing dependencies or running migrations', async (t) => {
  const f = await fixture(t);
  const result = await f.run(f.tested, { DEPLOY_TEST_RESET_NOOP: '1' });
  f.assertNoRelease(result);
  assert.match(result.stdout, /checkout tidak cocok/);
});

test('a failed migration cannot restart the API or claim deployment success', async (t) => {
  const f = await fixture(t);
  const result = await f.run(f.tested, { DEPLOY_TEST_MIGRATION_FAIL: '1' });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.commands, /systemctl restart eznihongo-api|^curl /m);
  assert.doesNotMatch(result.stdout, /Deploy ok:/);
});

test('failed health checks retain diagnostics and never claim deployment success', async (t) => {
  const f = await fixture(t);
  const result = await f.run(f.tested, { DEPLOY_TEST_HEALTH_FAIL: '1' });
  assert.notEqual(result.status, 0);
  assert.equal(result.commands.match(/^curl /gm)?.length, 5);
  assert.match(result.commands, /systemctl status eznihongo-api/);
  assert.match(result.commands, /journalctl -u eznihongo-api/);
  assert.doesNotMatch(result.stdout, /Deploy ok:/);
});
