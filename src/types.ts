export type AI = 'Claude Code' | 'Codex' | 'Gemini';
export type Status = 'working' | 'HITL' | 'done';

export type Card = {
  id: string;
  title: string;
  ai: AI;
  status: Status;
  question?: string;
  userResponse?: string;
  createdAt: number;
};

export const AIS: AI[] = ['Claude Code', 'Codex', 'Gemini'];

export const MOCK_QUESTIONS = [
  '분류 기준을 어느 쪽으로 잡을까요? (날짜순 / 주제별 / 우선순위)',
  'A안과 B안 중 어느 쪽으로 진행할까요?',
  '핵심 키워드 3개만 골라주세요',
  '톤은 격식체와 친근체 중 어느 쪽이 좋을까요?',
  '결과를 어떤 형식으로 저장할까요? (Markdown / JSON / 표)',
];

export const AI_COLORS: Record<AI, string> = {
  'Claude Code': '#D97757',
  'Codex': '#10A37F',
  'Gemini': '#4285F4',
};
