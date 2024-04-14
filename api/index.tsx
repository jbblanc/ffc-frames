import { Button, FrameContext, Frog, TextInput } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
// import { neynar } from 'frog/hubs'
import { handle } from 'frog/vercel';
import {
  getPocChallenge,
  getPocFrame,
  updatePocChallengeSteps,
  updatePocChallengeWithProof,
} from '../utils/db.js';
import { buildNewChallenge, getPreviousQuestion } from '../utils/challenge.js';
import { ProofOfCrabChallenge } from '../domain/poc-challenge.js';
import { mintProof } from '../utils/phosphor.js';

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
});

app.frame('/', handleHome);

app.frame('/:frameId', handleHome);

async function handleHome(c: any) {
  let { frameId } = c.req.param();
  try {
    if (!frameId) {
      frameId = process.env.DEFAULT_POC_FRAME_ID ?? '';
    }
    const pocFrame = await getPocFrame(frameId);
    // if custom frame, handle any customisation here
    //....
    return renderHome(c, pocFrame.id);
  } catch (e: any) {
    console.log(e);
    return renderError(c, frameId);
  }
}

function renderHome(c: FrameContext, frameId: string) {
  const startAction = `/${frameId}/new-challenge`;
  return c.res({
    image: renderTextImage('Home - Start a new Proof challenge'),
    intents: [<Button action={startAction}>Start</Button>],
  });
}

app.frame('/:frameId/new-challenge', async (c) => {
  const { frameId } = c.req.param();
  try {
    console.log(frameId);
    // challengeId unset => generate new one and render step/question 1
    const newChallenge = await buildNewChallenge(frameId);
    return renderChallengeNextStep(c, newChallenge, 1);
  } catch (e: any) {
    console.log(e);
    return renderError(c, frameId);
  }
});

app.frame('/challenge/:challengeId', async (c) => {
  const { buttonValue, inputText, status } = c;
  const { challengeId } = c.req.param();
  try {
    const previousAnswer = buttonValue;
    console.log(
      `Received answer: ${previousAnswer} for challenge ${challengeId}`,
    );
    if (!challengeId) {
      // challengeId unset => throw ERROR or show ERROR frame
      throw new Error('Challenge not found');
    }
    // challengeId set => fetch challenge with current state, get previous value, set score for previous step and show next step (if any), if no next step, show summary
    let challenge = await getPocChallenge(challengeId);
    // find challenge question to update with previousAnswer
    const answeredQuestion = getPreviousQuestion(challenge);
    console.log(
      `Answering step ${answeredQuestion.position} and rendering next step (if any)`,
    );
    answeredQuestion.selected_answer = previousAnswer;
    answeredQuestion.is_valid_answer =
      answeredQuestion.selected_answer?.toLocaleLowerCase() ===
      answeredQuestion.question.correct_answer.toLowerCase();
    answeredQuestion.answered_at = new Date();
    console.log(`Answering valid ? : ${answeredQuestion.is_valid_answer}`);
    // checking if all steps/questions are completed
    const allAnsweredQuestionsSoFar = challenge.steps.questions.filter(
      (q) => q.selected_answer,
    );
    if (allAnsweredQuestionsSoFar.length === challenge.steps.total_steps) {
      console.log(
        `All answers have been given for challenge ${challenge.id}, calculting score`,
      );
      // calculating score
      let allAnswersAreValid = true;
      challenge.steps.questions.map((q) => {
        allAnswersAreValid = allAnswersAreValid && (q.is_valid_answer ?? false);
      });
      challenge.score = allAnswersAreValid ? 'PASSED' : 'FAILED';
      console.log(`Score for challenge ${challenge.id} is ${challenge.score}`);
    }
    challenge = await updatePocChallengeSteps(challenge);

    if (challenge.score === 'PASSED') {
      return renderChallengePassed(c, challenge);
    } else if (challenge.score === 'FAILED') {
      return renderChallengeFailed(c, challenge);
    } else {
      // moving to next question
      return renderChallengeNextStep(
        c,
        challenge,
        answeredQuestion.position + 1,
      );
    }
  } catch (e: any) {
    console.log(e);
    return renderError(c);
  }
});

function renderChallengeNextStep(
  c: FrameContext,
  challenge: ProofOfCrabChallenge,
  stepToRender: number,
) {
  console.log(
    `Now moving to step ${stepToRender} for challenge ${challenge.id}`,
  );
  const question = challenge.steps.questions[stepToRender - 1].question;
  const btn1Value = question.proposed_answers[0];
  const btn2Value = question.proposed_answers[1];
  const btn3Value = question.proposed_answers[2];
  const btn4Value = question.proposed_answers[3];
  return c.res({
    action: `/challenge/${challenge.id}`,
    image: question.image_url ?? '',
    intents: [
      <Button value={btn1Value}>{btn1Value}</Button>,
      <Button value={btn2Value}>{btn2Value}</Button>,
      <Button value={btn3Value}>{btn3Value}</Button>,
      <Button value={btn4Value}>{btn4Value}</Button>,
    ],
  });
}

function renderChallengePassed(
  c: FrameContext,
  challenge: ProofOfCrabChallenge,
) {
  const actionMintProof = `/challenge/${challenge.id}/proof`;
  return c.res({
    image: renderTextImage('!!!! SUCCESS !!!'),
    intents: [
      <TextInput placeholder="Enter external wallet..." />,
      <Button action={actionMintProof} value="mint">
        Mint you Proof
      </Button>,
    ],
  });
}

function renderChallengeFailed(
  c: FrameContext,
  challenge: ProofOfCrabChallenge,
) {
  const actionRetryChallenge = `/${challenge.frame_id}/new-challenge`;
  return c.res({
    image: renderTextImage('>>>> You failed <<<<'),
    intents: [
      <Button action={actionRetryChallenge} value="retry">
        Try again
      </Button>,
    ],
  });
}

function renderProofMinted(c: FrameContext, challenge: ProofOfCrabChallenge) {
  return c.res({
    image: renderTextImage(`Proof minted - tx hash: ${challenge.mint_tx_hash}`),
    intents: [
      //<Button action={actionRetryChallenge} value="retry">Try again</Button>,
      //status === 'response' && <Button.Reset>Reset</Button.Reset>,
    ],
  });
}

app.frame('/challenge/:challengeId/proof', async (c) => {
  try {
    const { inputText } = c;
    const { challengeId } = c.req.param();
    const fid = '1345';
    const fidWalletAddress = '1345';
    if (!challengeId) {
      throw new Error('Challenge not found');
    }
    let challenge = await getPocChallenge(challengeId);
    const pocFrame = await getPocFrame(challenge.frame_id);
    //TODO get FID + wallet address
    const txHash = await mintProof(pocFrame, inputText ?? fidWalletAddress);
    challenge.mint_tx_hash = txHash;
    challenge.has_minted_proof = txHash !== null;
    await updatePocChallengeWithProof(challenge);
    return renderProofMinted(c, challenge);
  } catch (e: any) {
    console.log(e);
    return renderError(c);
  }
});

function renderTextImage(text: string) {
  return (
    <div
      style={{
        alignItems: 'center',
        background: 'black',
        backgroundSize: '100% 100%',
        display: 'flex',
        flexDirection: 'column',
        flexWrap: 'nowrap',
        height: '100%',
        justifyContent: 'center',
        textAlign: 'center',
        width: '100%',
      }}
    >
      <div
        style={{
          color: 'white',
          fontSize: 60,
          fontStyle: 'normal',
          letterSpacing: '-0.025em',
          lineHeight: 1.4,
          marginTop: 30,
          padding: '0 120px',
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function renderError(c: FrameContext, frameId?: string) {
  const action = frameId ? `/${frameId}` : '/';
  return c.res({
    image: renderTextImage(
      'An error occurred. Please try with a new challenge.',
    ),
    intents: [<Button action={action}>Back to Home</Button>],
  });
}

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined';
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development';
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
