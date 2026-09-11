'use strict';

require('../setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { registerChatHandlers, roomFor, isRideMember } = require('../../src/sockets/chat.socket');

/** Minimal stand-in for a Socket.IO socket that records what it was told. */
const fakeSocket = () => {
  const handlers = {};
  return {
    handlers,
    joined: [],
    left: [],
    user: { _id: '507f1f77bcf86cd799439011', name: 'Asha' },
    on: (event, fn) => {
      handlers[event] = fn;
    },
    join: function join(room) {
      this.joined.push(room);
    },
    leave: function leave(room) {
      this.left.push(room);
    },
  };
};

const fakeIo = () => ({ to: () => ({ emit: () => {} }) });

test('room names are namespaced per ride', () => {
  assert.equal(roomFor('507f1f77bcf86cd799439011'), 'ride:507f1f77bcf86cd799439011');
});

test('a malformed ride id is rejected before it reaches the database', async () => {
  // Regression: these used to be passed straight to Ride.findById, which throws
  // a CastError. With no catch in the handler that became an unhandled
  // rejection, which terminates the Node process - so any authenticated client
  // could kill the API with one bad message. No database is running in this
  // test, which is the point: a rejected id must never get that far.
  for (const bad of ['not-an-id', '', null, undefined, 42, { $ne: null }, '../../etc/passwd']) {
    assert.equal(await isRideMember(bad, '507f1f77bcf86cd799439011'), false);
  }
});

test('ride:join with a malformed id acks an error instead of throwing', async () => {
  const socket = fakeSocket();
  registerChatHandlers(fakeIo(), socket);

  const acks = [];
  await socket.handlers['ride:join']('not-an-id', (result) => acks.push(result));

  assert.deepEqual(acks, [{ ok: false, error: 'You are not a member of this ride' }]);
  assert.deepEqual(socket.joined, []);
});

test('message:send with a malformed ride id acks an error instead of throwing', async () => {
  const socket = fakeSocket();
  registerChatHandlers(fakeIo(), socket);

  const acks = [];
  await socket.handlers['message:send']({ rideId: 'not-an-id', message: 'hello' }, (r) =>
    acks.push(r)
  );

  assert.deepEqual(acks, [{ ok: false, error: 'You are not a member of this ride' }]);
});

test('an empty message is rejected before any membership lookup', async () => {
  const socket = fakeSocket();
  registerChatHandlers(fakeIo(), socket);

  const acks = [];
  await socket.handlers['message:send']({ rideId: 'x', message: '   ' }, (r) => acks.push(r));
  await socket.handlers['message:send'](undefined, (r) => acks.push(r));

  assert.deepEqual(acks, [
    { ok: false, error: 'Message cannot be empty' },
    { ok: false, error: 'Message cannot be empty' },
  ]);
});

test('handlers survive being called with no ack callback', async () => {
  const socket = fakeSocket();
  registerChatHandlers(fakeIo(), socket);
  // A client is free to emit without one; that must not throw.
  await socket.handlers['ride:join']('not-an-id');
  await socket.handlers['message:send']({ rideId: 'not-an-id', message: 'hi' });
});

test('ride:leave ignores a malformed id', () => {
  const socket = fakeSocket();
  registerChatHandlers(fakeIo(), socket);
  socket.handlers['ride:leave']('not-an-id');
  assert.deepEqual(socket.left, []);

  socket.handlers['ride:leave']('507f1f77bcf86cd799439011');
  assert.deepEqual(socket.left, ['ride:507f1f77bcf86cd799439011']);
});

test('the message budget allows a burst and then throttles', () => {
  const { createMessageBudget } = require('../../src/sockets/chat.socket');
  const take = createMessageBudget();

  // Ten messages back to back are fine; the eleventh is refused.
  for (let i = 0; i < 10; i += 1) {
    assert.equal(take(), true, `message ${i + 1} should be allowed`);
  }
  assert.equal(take(), false, 'the 11th message in a burst should be refused');
});
