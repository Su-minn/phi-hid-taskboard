import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card, Status, Message } from './types';
import {
  MOCK_FIRST_QUESTIONS,
  MOCK_FOLLOWUP_QUESTIONS,
  initialAIMessage,
  finalAIMessage,
} from './types';
import { ensureNotificationPermission, notify } from './notifications';
import './App.css';

const WORKING_TO_HITL_MS = 3000;
const WORKING_TO_DONE_MS = 3000;
const TURNS_BEFORE_DONE = 2;

function pickFirstQuestion(): string {
  return MOCK_FIRST_QUESTIONS[Math.floor(Math.random() * MOCK_FIRST_QUESTIONS.length)];
}

function pickFollowup(): string {
  return MOCK_FOLLOWUP_QUESTIONS[Math.floor(Math.random() * MOCK_FOLLOWUP_QUESTIONS.length)];
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeMessage(sender: Message['sender'], text: string): Message {
  return { id: newId('msg'), sender, text, timestamp: Date.now() };
}

function lastAIQuestion(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === 'ai') return messages[i].text;
  }
  return null;
}

const COLUMNS: { status: Status; label: string; sublabel: string }[] = [
  { status: 'working', label: 'Working', sublabel: 'AI가 백그라운드에서 처리 중' },
  { status: 'HITL', label: 'Needs You', sublabel: '사용자 판단을 기다리는 중' },
  { status: 'done', label: 'Done', sublabel: '완료된 작업' },
];

export default function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [input, setInput] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'default'
  );
  const timers = useRef<Map<string, number>>(new Map());

  const clearTimer = (id: string) => {
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  };

  // Working → HITL: AI가 질문을 던지고 카드를 HITL 상태로
  const scheduleAIQuestion = useCallback(
    (card: Card, isFollowup: boolean) => {
      clearTimer(card.id);
      const t = window.setTimeout(() => {
        const question = isFollowup ? pickFollowup() : pickFirstQuestion();
        setCards((prev) =>
          prev.map((c) =>
            c.id !== card.id
              ? c
              : { ...c, status: 'HITL', messages: [...c.messages, makeMessage('ai', question)] }
          )
        );
        notify('판단이 필요한 카드가 있어요', `"${card.title}" — ${question}`);
      }, WORKING_TO_HITL_MS);
      timers.current.set(card.id, t);
    },
    []
  );

  // Working → Done: AI가 마지막 메시지를 남기고 카드를 Done으로
  const scheduleFinalize = useCallback((card: Card) => {
    clearTimer(card.id);
    const t = window.setTimeout(() => {
      setCards((prev) =>
        prev.map((c) =>
          c.id !== card.id
            ? c
            : { ...c, status: 'done', messages: [...c.messages, makeMessage('ai', finalAIMessage(card.title))] }
        )
      );
    }, WORKING_TO_DONE_MS);
    timers.current.set(card.id, t);
  }, []);

  const addCard = (titleArg?: string) => {
    const title = (titleArg ?? input).trim();
    if (!title) return;
    const card: Card = {
      id: newId('card'),
      title,
      status: 'working',
      messages: [makeMessage('ai', initialAIMessage(title))],
      turn: 0,
      createdAt: Date.now(),
    };
    setCards((prev) => [card, ...prev]);
    if (!titleArg) setInput('');
    scheduleAIQuestion(card, false);
  };

  const handleSend = (cardId: string) => {
    const text = draft.trim();
    if (!text) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    // 사용자 메시지 추가 + 상태를 working으로
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              status: 'working',
              messages: [...c.messages, makeMessage('user', text)],
              turn: c.turn + 1,
            }
          : c
      )
    );
    setDraft('');

    const nextTurn = card.turn + 1;
    if (nextTurn >= TURNS_BEFORE_DONE) {
      scheduleFinalize(card);
    } else {
      scheduleAIQuestion(card, true);
    }
  };

  useEffect(() => {
    const captured = timers.current;
    return () => {
      captured.forEach((t) => window.clearTimeout(t));
      captured.clear();
    };
  }, []);

  const requestNotif = async () => {
    const p = await ensureNotificationPermission();
    setNotifPermission(p);
  };

  const selected = cards.find((c) => c.id === selectedId);

  const seedDemo = () => {
    const seeds = ['PKM 노트 정리', '회의록 정리', '요구사항 정의서 작성'];
    seeds.forEach((title, idx) => {
      const card: Card = {
        id: newId('card'),
        title,
        status: 'working',
        messages: [makeMessage('ai', initialAIMessage(title))],
        turn: 0,
        createdAt: Date.now() + idx,
      };
      setCards((prev) => [card, ...prev]);
      scheduleAIQuestion(card, false);
    });
  };

  // 카드 미리보기에 마지막 AI 질문 한 줄 노출
  const cardPreview = (c: Card): string | null => {
    if (c.status === 'HITL') return lastAIQuestion(c.messages);
    if (c.status === 'done') {
      const lastUser = [...c.messages].reverse().find((m) => m.sender === 'user');
      return lastUser ? `↳ ${lastUser.text}` : null;
    }
    return null;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>HID v0.2 — Task Card Flow</h1>
          <p className="subtitle">
            대화 시퀀스 → 태스크 카드. 카드 한 장이 곧 멀티턴 대화 컨테이너.
          </p>
        </div>
        <div className="header-right">
          {notifPermission !== 'granted' && (
            <button className="btn-secondary" onClick={requestNotif}>
              알림 권한 켜기
            </button>
          )}
          {notifPermission === 'granted' && <span className="notif-on">🔔 알림 ON</span>}
          <button className="btn-secondary" onClick={seedDemo}>
            데모 시드 (3개)
          </button>
        </div>
      </header>

      <div className="input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCard()}
          placeholder="새 태스크를 입력하세요 (예: PKM 노트 정리)"
          className="task-input"
        />
        <button className="btn-primary" onClick={() => addCard()}>
          분배
        </button>
      </div>

      <div className="board">
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.status === col.status);
          return (
            <div key={col.status} className={`column column-${col.status}`}>
              <div className="column-head">
                <div className="column-label">
                  {col.label} <span className="column-count">{colCards.length}</span>
                </div>
                <div className="column-sub">{col.sublabel}</div>
              </div>
              <div className="column-body">
                {colCards.length === 0 && <div className="empty">—</div>}
                {colCards.map((c) => {
                  const preview = cardPreview(c);
                  return (
                    <button
                      key={c.id}
                      className={`card card-${c.status}`}
                      onClick={() => {
                        setSelectedId(c.id);
                        setDraft('');
                      }}
                    >
                      <div className="card-top">
                        <span className="turn-chip">turn {c.turn + 1}</span>
                        {c.status === 'working' && <span className="dot-pulse" aria-hidden />}
                        {c.status === 'HITL' && <span className="hitl-badge">판단 필요</span>}
                        {c.status === 'done' && <span className="done-badge">완료</span>}
                      </div>
                      <div className="card-title">{c.title}</div>
                      {preview && (
                        <div className={c.status === 'HITL' ? 'card-q' : 'card-resp'}>
                          {preview}
                        </div>
                      )}
                      <div className="card-meta">메시지 {c.messages.length}개</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelectedId(null)}>
          <div className="modal chat-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 className="modal-title">{selected.title}</h2>
              <span className={`status-tag status-${selected.status}`}>{selected.status}</span>
            </div>
            <div className="chat-thread" aria-live="polite">
              {selected.messages.map((m) => (
                <div key={m.id} className={`bubble bubble-${m.sender}`}>
                  <div className="bubble-sender">{m.sender === 'ai' ? 'AI' : '나'}</div>
                  <div className="bubble-text">{m.text}</div>
                </div>
              ))}
              {selected.status === 'working' && (
                <div className="bubble bubble-ai bubble-typing">
                  <div className="bubble-sender">AI</div>
                  <div className="bubble-text">
                    <span className="dot-pulse" aria-hidden />
                    <span className="dot-pulse" aria-hidden />
                    <span className="dot-pulse" aria-hidden />
                  </div>
                </div>
              )}
            </div>

            <div className="chat-input-row">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (selected.status === 'HITL') handleSend(selected.id);
                  }
                }}
                placeholder={
                  selected.status === 'HITL'
                    ? '메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)'
                    : selected.status === 'working'
                    ? 'AI가 처리 중입니다. 잠시 후 질문이 도착해요.'
                    : '완료된 작업입니다. 대화 이력은 카드에 그대로 보존됩니다.'
                }
                rows={2}
                disabled={selected.status !== 'HITL'}
                className="chat-input"
              />
              <button
                className="btn-primary"
                disabled={selected.status !== 'HITL' || !draft.trim()}
                onClick={() => handleSend(selected.id)}
              >
                전송
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setSelectedId(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="footer">
        <span>v0.2 · 카드 = 멀티턴 대화 컨테이너</span>
        <span>마찰 3차원 시연: 🌐 분산 · 🌙 비동기 · ⚡ 이벤트</span>
      </footer>
    </div>
  );
}
