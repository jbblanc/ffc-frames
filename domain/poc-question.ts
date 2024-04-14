export interface ProofOfCrabQuestion {
  id: string;
  question?: string;
  image_url?: string;
  correct_answer: string;
  proposed_answers: string[];
  created_at: Date;
}
