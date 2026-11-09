const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const main = () => readFileSync('src/main/index.ts', 'utf8');
const preload = () => readFileSync('src/preload/index.ts', 'utf8');

function handlerBody(source, marker) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${marker} is present`);
  const end = source.indexOf('\n});', start);
  return source.slice(start, end > start ? end : start + 600);
}

test('roster IPC routes by the sending window (evt.sender.id)', () => {
  const source = main();
  const write = handlerBody(source, "ipcMain.handle('roster:write'");
  assert.match(write, /evt\.sender\.id/);
  assert.match(write, /'no floor repo'/);
  assert.doesNotMatch(write, /\broster\.write\(/, 'roster:write never reaches the legacy roster.json store');
  const readSync = handlerBody(source, "ipcMain.on('roster:readSync'");
  assert.doesNotMatch(readSync, /\broster\.read\(/);
  const read = handlerBody(source, "ipcMain.handle('roster:read'");
  assert.doesNotMatch(read, /\broster\.read\(/);
});

test('migrateLegacyRoster is awaited before the first createWindow( in whenReady', () => {
  const source = main();
  const start = source.indexOf('app.whenReady().then(');
  assert.ok(start >= 0);
  // Code only: comments may mention createWindow() before the real call.
  const body = source.slice(start).replace(/^\s*\/\/.*$/gm, '');
  const mig = body.indexOf('migrateLegacyRoster(');
  const win = body.indexOf('createWindow(');
  assert.ok(mig >= 0, 'migration runs at startup');
  assert.ok(win > mig, 'migration precedes the first window');
  assert.match(body.slice(0, win), /await migrateLegacyRoster\(/);
});

test("changeHome move copies the per-repo 'rosters' folder", () => {
  const source = main();
  assert.match(source, /for \(const sub of \['hive', 'palace', 'roster\.json', 'roster-backups', 'rosters'\]\)/);
});

test('floor IPC channels are registered in main', () => {
  const source = main();
  for (const ch of ['floor:repoSync', 'floor:chooseRepo', 'floor:listRepos', 'floor:openForRepo']) {
    assert.ok(source.includes(`'${ch}'`), `${ch} is registered`);
  }
  assert.match(source, /ipcMain\.on\('floor:repoSync'/);
});

test('preload exposes the floor API', () => {
  const source = preload();
  for (const name of ['floorRepoSync', 'chooseFloorRepo', 'listFloorRepos', 'openFloorForRepo']) {
    assert.match(source, new RegExp(`\\b${name}:`), `${name} is exposed`);
  }
  assert.match(source, /sendSync\('floor:repoSync'\)/);
});

test('closing a floor keeps it in openFloors while the app quits', () => {
  const source = main();
  assert.match(source, /let appQuitting = false/);
  const quit = handlerBody(source, "app.on('before-quit'");
  assert.match(quit, /appQuitting = true/);
  const teardown = source.slice(source.indexOf('function teardownAndQuit'), source.indexOf('function teardownAndQuit') + 200);
  assert.match(teardown, /appQuitting = true/);
});

test('reset archives every per-repo roster too', () => {
  const source = main();
  const reset = handlerBody(source, "ipcMain.handle('app:resetAll'");
  assert.match(reset, /roster\.archive\(\)/);
  assert.match(reset, /listRepoRosters\(/);
});

function closedHandler(source) {
  const start = source.indexOf("win.on('closed'", source.indexOf('function createWindow('));
  assert.ok(start >= 0, 'createWindow has a closed handler');
  return source.slice(start, source.indexOf('\n  });', start));
}

test('the closed handler only drops a floor from openFloors on a deliberate close', () => {
  const closed = closedHandler(main());
  assert.match(closed, /appQuitting/);
  assert.match(closed, /floors\.unbind\(ownerId\)/);
});

test('on Windows/Linux closing the last window keeps its floor (that close is the quit)', () => {
  const closed = closedHandler(main());
  assert.match(closed, /process\.platform !== 'darwin' && allWindows\.size === 0/);
  assert.match(closed, /!lastWindowQuits\) persistOpenFloors\(\)/);
  const del = closed.indexOf('allWindows.delete(win)');
  assert.ok(del >= 0 && del < closed.indexOf('allWindows.size === 0'), 'size is read after this window is removed');
});
