export type Status = 'working' | 'HITL' | 'done';
export type Sender = 'ai' | 'user';

export type Message = {
  id: string;
  sender: Sender;
  text: string;
  timestamp: number;
};

export type Card = {
  id: string;
  title: string;
  status: Status;
  messages: Message[];
  turn: number;
  createdAt: number;
};

export const MOCK_FIRST_QUESTIONS = [
  '분류 기준을 어느 쪽으로 잡을까요? (날짜순 / 주제별 / 우선순위)',
  'A안과 B안 중 어느 쪽으로 진행할까요?',
  '핵심 키워드 3개만 골라주세요',
  '톤은 격식체와 친근체 중 어느 쪽이 좋을까요?',
  '결과를 어떤 형식으로 저장할까요? (Markdown / JSON / 표)',
];

export const MOCK_FOLLOWUP_QUESTIONS = [
  '반영했습니다. 추가로 우선순위까지 잡아둘까요?',
  '좋아요. 한 가지만 더 — 길이는 어느 정도가 적당할까요?',
  '확인했습니다. 마지막으로 톤은 어떻게 가져갈까요?',
  '진행할게요. 결과를 어디에 저장할까요? (PKM / 다운로드 / 클립보드)',
];

export const initialAIMessage = (title: string): string =>
  `"${title}" 작업을 시작했어요. 진행하면서 판단이 필요한 지점은 이 카드 안에서 바로 물어볼게요.`;

export const finalAIMessage = (title: string): string =>
  `"${title}" 작업을 마무리했어요. 누적된 대화 이력은 그대로 카드에 보존됩니다.`;
