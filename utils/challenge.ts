import { ProofOfCrabChallengeQuestion } from '../domain/poc-challenge-question.js';
import { ProofOfCrabChallenge } from '../domain/poc-challenge.js';
import { ProofOfCrabFrame } from '../domain/poc-frame.js';
import { createPocChallenge, getPocFrame, getPocQuestions } from './db.js';

export async function buildNewChallenge(
  frameId: string,
  fid?: string,
): Promise<ProofOfCrabChallenge> {
  // load POC frame
  const pocFrame = await getPocFrame(frameId);
  const questions = await generateChallengeQuestions(pocFrame);
  let newChallenge: ProofOfCrabChallenge = {
    frame_id: frameId,
    fid,
    steps: {
      questions,
      total_steps: questions.length,
    },
  };
  // store new challenge and return
  return await createPocChallenge(newChallenge);
}

export async function generateChallengeQuestions(pocFrame: ProofOfCrabFrame) {
  console.log('generating questions for challenge');
  // load all questions
  let allQuestions = await getPocQuestions();
  allQuestions = shuffleArray(allQuestions);
  const selectedQuestions = allQuestions.slice(
    0,
    getTotalQuestionsForSecurityLevel(pocFrame.security_level),
  );
  // based on security level, select the questions for this challenge
  let nextPosition = 1;
  const questions: ProofOfCrabChallengeQuestion[] = selectedQuestions.map(
    (q) => {
      q.proposed_answers = shuffleArray(q.proposed_answers);
      const challengeQuestion: ProofOfCrabChallengeQuestion = {
        position: nextPosition++,
        question: q,
      };
      return challengeQuestion;
    },
  );
  console.log(questions);
  return questions;
}

export function getTotalQuestionsForSecurityLevel(
  securityLevel: number,
): number {
  if (securityLevel === 2) return 3;
  if (securityLevel === 3) return 5;
  else return 2;
}

export function shuffleArray(array: any[]): any[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function getPreviousQuestion(challenge: ProofOfCrabChallenge) {
  // previous question is the first without answer
  // sort questions by position in challenge
  const sortedQuestions = challenge.steps.questions.sort((a, b) =>
    a.position > b.position ? 1 : -1,
  );
  // return first one without answer
  return sortedQuestions.filter((q) => !q.selected_answer)[0];
}
