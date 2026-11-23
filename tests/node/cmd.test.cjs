const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const { EventEmitter } = require('node:events');
const { afterEach, mock, test } = require('node:test');

const processTree = require.resolve('ps-tree');
require(processTree);
const treeStub = mock.fn();
require.cache[processTree].exports = treeStub;
const { CMD, STATUS } = require('../../dist/modules/cmd.js');

afterEach(() => {
  mock.restoreAll();
  treeStub.mock.resetCalls();
});

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.pid = 100;
  mock.method(childProcess, 'spawn', () => child);
  return child;
}

test('passes arguments without a shell and forwards output and completion', () => {
  const child = fakeChild();
  const onData = mock.fn();
  const onEnd = mock.fn();
  const command = new CMD('vagrant', ['status', '--machine-readable'], { onData, onEnd });
  const buffer = Buffer.from('fixture status');
  child.stdout.emit('data', buffer);
  child.stdout.emit('end');

  assert.deepEqual(childProcess.spawn.mock.calls[0].arguments, ['vagrant', ['status', '--machine-readable']]);
  assert.deepEqual(onData.mock.calls[0].arguments, [buffer]);
  assert.equal(onData.mock.calls[0].this, command);
  assert.equal(onEnd.mock.calls.length, 1);
  assert.equal(command.status, STATUS.FINISHED);
});

test('surfaces a missing executable without an unhandled process error', () => {
  const child = fakeChild();
  const onError = mock.fn();
  const command = new CMD('missing-fixture-command', [], { onError });
  const error = Object.assign(new Error('missing fixture'), { code: 'ENOENT' });
  child.emit('error', error);

  assert.deepEqual(onError.mock.calls[0].arguments, [error]);
  assert.equal(command.status, STATUS.STOPPED);
});

test('cancels the process tree and retains the cancelled state on stream end', () => {
  const child = fakeChild();
  const kill = mock.method(process, 'kill', (pid) => {
    if (pid === 101) throw new Error('fixture process exited');
    return true;
  });
  treeStub.mock.mockImplementation((_pid, done) => done(null, [{ PID: 101 }]));
  const onCancel = mock.fn();
  const command = new CMD('vagrant', ['status'], { onCancel });
  command.cancel();
  child.stdout.emit('data', Buffer.from('ignored'));
  child.stdout.emit('end');

  assert.deepEqual(kill.mock.calls.map(call => call.arguments), [[100, 'SIGKILL'], [101, 'SIGKILL']]);
  assert.equal(onCancel.mock.calls[0].this, command);
  assert.equal(command.status, STATUS.CANCELLED);
});

test('still cancels the parent if child process enumeration fails', () => {
  const child = fakeChild();
  const kill = mock.method(process, 'kill', () => true);
  treeStub.mock.mockImplementation((_pid, done) => done(new Error('fixture unavailable')));
  const command = new CMD('vagrant', ['status'], {});

  command.cancel();
  child.emit('error', new Error('fixture delayed failure'));
  assert.deepEqual(kill.mock.calls[0].arguments, [100, 'SIGKILL']);
});
