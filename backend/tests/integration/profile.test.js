'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, dbTest, call, makeUser, ridePayload } = require('./helpers');

test.before(setup);
test.after(teardown);

dbTest('the profile returns the account and its ride counts', async () => {
  const { token, user } = await makeUser('Asha');
  const { status, body } = await call('/api/users/me', { token });

  assert.equal(status, 200);
  assert.equal(body.user._id, user._id);
  assert.equal(body.user.password, undefined);
  assert.deepEqual(body.stats, { ridesCreated: 0, ridesJoined: 0, ridesCompleted: 0 });
});

dbTest('ride counts reflect what the user created and joined', async () => {
  const asha = await makeUser('Asha');
  const priya = await makeUser('Priya');

  await call('/api/rides', { method: 'POST', body: ridePayload(), token: asha.token });
  const second = await call('/api/rides', { method: 'POST', body: ridePayload(), token: asha.token });
  await call(`/api/rides/${second.body.ride._id}/join`, { method: 'POST', token: priya.token });

  const ashaStats = (await call('/api/users/me', { token: asha.token })).body.stats;
  assert.equal(ashaStats.ridesCreated, 2);
  assert.equal(ashaStats.ridesJoined, 0); // she runs both, so neither counts as joined

  const priyaStats = (await call('/api/users/me', { token: priya.token })).body.stats;
  assert.equal(priyaStats.ridesCreated, 0);
  assert.equal(priyaStats.ridesJoined, 1);
});

dbTest('a user can update their own name and phone', async () => {
  const { token } = await makeUser('Asha');
  const { status, body } = await call('/api/users/me', {
    method: 'PATCH',
    body: { name: 'Asha Nair', phone: '9123456780' },
    token,
  });

  assert.equal(status, 200);
  assert.equal(body.user.name, 'Asha Nair');
  assert.equal(body.user.phone, '9123456780');

  // And it persisted.
  const reread = await call('/api/users/me', { token });
  assert.equal(reread.body.user.name, 'Asha Nair');
});

dbTest('a phone number already in use is refused', async () => {
  const first = await makeUser('First');
  const second = await makeUser('Second');

  const taken = (await call('/api/users/me', { token: first.token })).body.user.phone;
  const clash = await call('/api/users/me', {
    method: 'PATCH',
    body: { phone: taken },
    token: second.token,
  });

  assert.equal(clash.status, 409);
  assert.match(clash.body.error.message, /already in use/i);
});

dbTest('the email and the password hash cannot be changed through the profile', async () => {
  const { token } = await makeUser('Asha');
  const before = (await call('/api/users/me', { token })).body.user;

  await call('/api/users/me', {
    method: 'PATCH',
    body: { name: 'Asha N', email: 'attacker@example.com', password: 'attacker-password' },
    token,
  });

  const after = (await call('/api/users/me', { token })).body.user;
  assert.equal(after.email, before.email, 'email must be immutable here');

  // The old password must still work, so the hash was untouched.
  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { email: before.email, password: 'correct-horse-battery' },
  });
  assert.equal(login.status, 200);
});

dbTest('changing the password requires the current one and then works', async () => {
  const { token, user } = await makeUser('Asha');

  const wrong = await call('/api/users/me/password', {
    method: 'PATCH',
    body: { currentPassword: 'not-my-password', newPassword: 'a-brand-new-password' },
    token,
  });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error.message, /current password is incorrect/i);

  const changed = await call('/api/users/me/password', {
    method: 'PATCH',
    body: { currentPassword: 'correct-horse-battery', newPassword: 'a-brand-new-password' },
    token,
  });
  assert.equal(changed.status, 200);

  // The old password stops working and the new one starts.
  const oldLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { email: user.email, password: 'correct-horse-battery' },
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { email: user.email, password: 'a-brand-new-password' },
  });
  assert.equal(newLogin.status, 200);
});

dbTest('the new password must differ from the current one', async () => {
  const { token } = await makeUser('Asha');
  const same = await call('/api/users/me/password', {
    method: 'PATCH',
    body: { currentPassword: 'correct-horse-battery', newPassword: 'correct-horse-battery' },
    token,
  });
  assert.equal(same.status, 400);
  assert.match(same.body.error.message, /different/i);
});
