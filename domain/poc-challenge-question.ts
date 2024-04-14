import { ProofOfCrabQuestion } from './poc-question.js';

export interface ProofOfCrabChallengeQuestion {
  position: number;
  question: ProofOfCrabQuestion;
  selected_answer?: string;
  is_valid_answer?: boolean;
  answered_at?: Date;
}
