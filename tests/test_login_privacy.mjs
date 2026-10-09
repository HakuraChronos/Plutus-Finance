import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const loginSource = await readFile(new URL('../app/js/login.js', import.meta.url), 'utf8');
const loginStyles = await readFile(new URL('../app/css/login.css', import.meta.url), 'utf8');

assert.doesNotMatch(loginSource, /Select a profile/i);
assert.doesNotMatch(loginSource, /login-user-card|data-user=/i);
assert.doesNotMatch(loginSource, /User_data\//i);
assert.doesNotMatch(loginSource, /Vault open:/i);
assert.match(loginSource, /id="login-username"/);
assert.match(loginSource, /Incorrect username or PIN\./);
assert.match(loginStyles, /loginMarkIntro/);
assert.match(loginStyles, /loginWordmarkIntro/);
assert.match(loginStyles, /loginIdentitySettle/);
assert.match(loginStyles, /loginPanelEnter/);

console.log('Login privacy and intro structure: PASS');
