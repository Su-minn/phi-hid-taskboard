import { useState, useEffect, useCallback, useRef } from 'react';
import type { AI, Card, Status } from './types';
import { AIS, AI_COLORS, MOCK_QUESTIONS } from './types';
import { ensureNotificationPermission, notify } from './notifications';
import './App.css';

const WORKING_TO_HITL_MS = 3000;
const HITL_TO_DONE_MS = 3000;

function pickAI(): AI {
  return AIS[Math.floor(Math.random() * AIS.length)];
}

function pickQuestion(): string {
  return MOCK_QUESTIONS[Math.floor(Math.random() * MOCK_QUESTIONS.length)];
}

function newId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
  const [response, setResponse] = useState('');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const timers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if ('Notification' in window) setNotifPermission(Notification.permission);
  }, []);

  const clearTimer = (id: string) => {
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  };

  const transitionTo = useCallback((id: string, status: Status) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }, []);

  const scheduleWorkingToHitl = useCallback((card: Card) => {
    clearTimer(card.id);
    const t = window.setTimeout(() => {
      transitionTo(card.id, 'HITL');
      notify(`${card.ai}이(가) 판단을 기다리고 있어요`, `"${card.title}" — ${card.question}`);
    }, WORKING_TO_HITL_MS);
    timers.current.set(card.id, t);
  }, [transitionTo]);

  const scheduleHitlToDone = useCallback((id: string) => {
    clearTimer(id);
    const t = window.setTimeout(() => transitionTo(id, 'done'), HITL_TO_DONE_MS);
    timers.current.set(id, t);
  }, [transitionTo]);

  const addCard = () => {
    const title = input.trim();
    if (!title) return;
    const card: Card = {
      id: newId(),
      title,
      ai: pickAI(),
      status: 'working',
      question: pickQuestion(),
      createdAt: Date.now(),
    };
    setCards((prev) => [card, ...prev]);
    setInput('');
    scheduleWorkingToHitl(card);
  };

  const handleRespond = (id: string) => {
    if (!response.trim()) return;
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'working', userResponse: response.trim() } : c))
    );
    setResponse('');
    setSelectedId(null);
    scheduleHitlToDone(id);
  };

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
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
        id: newId(),
        title,
        ai: AIS[idx % AIS.length],
        status: 'working',
        question: pickQuestion(),
        createdAt: Date.now() + idx,
      };
      setCards((prev) => [card, ...prev]);
      scheduleWorkingToHitl(card);
    });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>HID v0.1 — Task Card Flow</h1>
          <p className="subtitle">대화 시퀀스 → 태스크 카드. 작업판 위의 병렬 AI 위임.</p>
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
        <button className="btn-primary" onClick={addCard}>
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
                {colCards.map((c) => (
                  <button
                    key={c.id}
                    className={`card card-${c.status}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div className="card-top">
                      <span className="ai-chip" style={{ background: AI_COLORS[c.ai] }}>
                        {c.ai}
                      </span>
                      {c.status === 'working' && <span className="dot-pulse" aria-hidden />}
                      {c.status === 'HITL' && <span className="hitl-badge">판단 필요</span>}
                    </div>
                    <div className="card-title">{c.title}</div>
                    {c.status === 'HITL' && c.question && (
                      <div className="card-q">{c.question}</div>
                    )}
                    {c.status === 'done' && c.userResponse && (
                      <div className="card-resp">↳ {c.userResponse}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelectedId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="ai-chip" style={{ background: AI_COLORS[selected.ai] }}>
                {selected.ai}
              </span>
              <span className={`status-tag status-${selected.status}`}>{selected.status}</span>
            </div>
            <h2 className="modal-title">{selected.title}</h2>
            {selected.status === 'HITL' && (
              <>
                <div className="modal-q">
                  <strong>{selected.ai}의 질문</strong>
                  <p>{selected.question}</p>
                </div>
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="여기에 응답을 입력하세요…"
                  rows={3}
                  className="response-input"
                />
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setSelectedId(null)}>
                    닫기
                  </button>
                  <button className="btn-primary" onClick={() => handleRespond(selected.id)}>
                    응답 → 진행 재개
                  </button>
                </div>
              </>
            )}
            {selected.status === 'working' && (
              <p className="modal-info">백그라운드에서 진행 중입니다. 잠시 후 판단이 필요해질 수 있어요.</p>
            )}
            {selected.status === 'done' && (
              <>
                {selected.userResponse && (
                  <p className="modal-info">
                    내 응답: <em>{selected.userResponse}</em>
                  </p>
                )}
                <p className="modal-info">완료된 작업입니다.</p>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => setSelectedId(null)}>
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <footer className="footer">
        <span>v0.1 · 행위-반응 쌍 3개 (생성 · HITL · 응답)</span>
        <span>마찰 3차원 시연: 🌐 분산 · 🌙 비동기 · ⚡ 이벤트</span>
      </footer>
    </div>
  );
}
