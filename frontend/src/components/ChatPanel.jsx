import { useEffect, useRef, useState } from 'react';
import { createSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { formatTime } from '../lib/format';
import './ChatPanel.css';

/** Real-time ride chat. The server re-checks membership on join and on send. */
export default function ChatPanel({ rideId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('ride:join', rideId, (response) => {
        if (!response?.ok) {
          setStatus('error');
          setError(response?.error || 'Could not open this chat');
          return;
        }
        setMessages(response.messages || []);
        setStatus('ready');
      });
    });

    socket.on('message:new', (message) => setMessages((prev) => [...prev, message]));
    socket.on('connect_error', (err) => {
      setStatus('error');
      setError(err.message || 'Chat connection failed');
    });

    return () => {
      socket.emit('ride:leave', rideId);
      socket.disconnect();
    };
  }, [rideId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  const handleSend = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || status !== 'ready') return;

    socketRef.current.emit('message:send', { rideId, message: text }, (response) => {
      if (response?.ok) {
        setError('');
        return;
      }
      // Put the text back so a rejected message is not silently lost.
      setError(response?.error || 'Message could not be sent');
      setDraft(text);
    });
    setDraft('');
  };

  return (
    <section className="chat card">
      <h2 className="chat__title">Ride chat</h2>

      {status === 'connecting' && <p className="state">Connecting…</p>}
      {status === 'error' && <p className="state state--error">{error}</p>}

      {status === 'ready' && (
        <>
          <div className="chat__messages">
            {messages.length === 0 ? (
              <p className="state">No messages yet. Say hello to your co-riders.</p>
            ) : (
              messages.map((message) => {
                const mine = String(message.sender) === String(user._id);
                return (
                  <div key={message._id} className={`chat__message ${mine ? 'is-mine' : ''}`}>
                    {!mine && <span className="chat__sender">{message.senderName}</span>}
                    <p className="chat__text">{message.message}</p>
                    <span className="chat__time">{formatTime(message.timestamp)}</span>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <form className="chat__form" onSubmit={handleSend}>
            <input
              className="field__input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Message your co-riders…"
              maxLength={1000}
            />
            <button type="submit" className="btn btn--primary" disabled={!draft.trim()}>
              Send
            </button>
          </form>
          {error && <p className="field__hint" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        </>
      )}
    </section>
  );
}
