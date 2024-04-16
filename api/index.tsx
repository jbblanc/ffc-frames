import { Button, FrameContext, Frog } from 'frog';
import { devtools } from 'frog/dev';
import { serveStatic } from 'frog/serve-static';
import { neynar } from 'frog/hubs';
import { handle } from 'frog/vercel';
import {
  getPocChallenge,
  getPocFrame,
  updatePocChallengeSteps,
  updatePocChallengeWithProof,
} from '../utils/db.js';
import { buildNewChallenge, getPreviousQuestion } from '../utils/challenge.js';
import { ProofOfCrabChallenge } from '../domain/poc-challenge.js';
import {
  checkOwnership,
  getProofTransaction,
  mintProof,
} from '../utils/phosphor.js';
import { generateCustomPocFrameFromDefault } from '../utils/frame.js';
import { stayIdle } from '../utils/idle.js';
import { FarcasterUser } from '../domain/farcaster-user.js';
import { ProofOfCrabFrame } from '../domain/poc-frame.js';
//import { generateCustomProofArtwork } from '../utils/proof.js';

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined';
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development';

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  imageAspectRatio: '1:1',
  verify: isProduction,
  hub: neynar({ apiKey: process.env.NEYNAR_APIKEY ?? '' }),
});
//app.route('/add-frame-to-account', addFrameToAccount)

app.frame('/', async (c) => {
  const actionCreatePocFrame = '/add-frame-to-account';
  const actionStartPocFrame = '/proof-of-crab';
  //await generateCustomProofArtwork('12345', 'jhjhjjh', 'lklkklklkkl', 'https://i.imgur.com/SnObVa5.jpg');
  return c.res({
    image: 'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/GrabHome.png',
    intents: [
      <Button action={actionCreatePocFrame}>Create on my account</Button>,
      <Button action={actionStartPocFrame}>Go to challenge</Button>,
    ],
  });
});

function renderPocFrameHomeImage(accountUser: FarcasterUser) {
  return (
    <div
      style={{
        background: 'black',
        backgroundSize: '100% 100%',
        backgroundImage: 'url(https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabStartWide.png)',
        display: 'flex',
        flexDirection: 'column',
        flexWrap: 'nowrap',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'flex-end',
        textAlign: 'center',
        width: '100%',
      }}
    >
      <div
        style={{
          color: '#fff',
          fontSize: 32,
          fontStyle: 'normal',
          letterSpacing: '-0.025em',
          lineHeight: 1.4,
          marginTop: 30,
          padding: '0 120px',
          whiteSpace: 'pre-wrap',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <div style={{display: 'flex'}}>
        <div style={{display: 'flex'}}><img style={{borderRadius: '9999px'}} src={accountUser?.pfp_url} width="100" height="100" /></div>

        </div>
        <div style={{display: 'flex', flexDirection: 'column', paddingLeft: '30px'}}>
          <div style={{display: 'flex'}}>{accountUser?.display_name}</div>
          <div style={{display: 'flex'}}>@{accountUser?.username}</div>
        </div>
      </div>
    </div>
  );
}


app.frame('/proof-of-crab', handlePocFrameHome);

app.frame('/proof-of-crab/:frameId', handlePocFrameHome);

async function handlePocFrameHome(c: any) {
  let { frameId } = c.req.param();
  try {
    if (!frameId) {
      frameId = process.env.DEFAULT_POC_FRAME_ID ?? '';
    }
    const pocFrame = await getPocFrame(frameId);
    // if custom frame (for later), handle any customisation here
    //....
    return renderPocFrameHome(c, pocFrame);
  } catch (e: any) {
    console.log(e);
    return renderError(c, frameId);
  }
}

function renderPocFrameHome(c: FrameContext, pocFrame: ProofOfCrabFrame) {
  const startAction = `/proof-of-crab/${pocFrame.id}/new-challenge`;
  const instructionsAction = `/proof-of-crab/${pocFrame.id}/instructions`;
  const crabsUrl = `${process.env.APP_BASE_URL}/frames/${pocFrame.id}`;
  return c.res({
    image: renderPocFrameHomeImage(pocFrame.account_user),
    intents: [
      <Button action={startAction}>▶️ Start</Button>,
      <Button action={instructionsAction}>Instructions</Button>,
      <Button.Link href={crabsUrl}>View Crabs</Button.Link>,
    ],
  });
}

app.frame('/proof-of-crab/:frameId/instructions', async (c) => {
  let { frameId } = c.req.param();
  try {
    const pocFrame = await getPocFrame(frameId);
    return renderPocFrameInstructions(c, pocFrame);
  } catch (e: any) {
    console.log(e);
    return renderError(c, frameId);
  }
});

function renderPocFrameInstructions(c: FrameContext, pocFrame: ProofOfCrabFrame) {
  const backAction = `/proof-of-crab/${pocFrame.id}`;
  const startAction = `/proof-of-crab/${pocFrame.id}/new-challenge`;
  return c.res({
    image: 'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/HowtoPlay.png',
    intents: [
      <Button action={backAction}>Back</Button>,
      <Button action={startAction}>▶️ Start</Button>,
    ],
  });
}

function renderProofAlreadyOwned(
  c: FrameContext,
  frameId: string,
  proofPageUrl: string,
) {
  const action = frameId ? `/${frameId}` : '/';
  return c.res({
    image: 'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabApproved.png',
    intents: [
      <Button action={action}>Back to Home</Button>,
      <Button.Link href={proofPageUrl}>View my 🦀 Proof</Button.Link>,
    ],
  });
}

app.frame('/proof-of-crab/:frameId/new-challenge', async (c) => {
  const { frameData, verified } = c;
  const { fid } = frameData;
  console.log('verified =>', verified);
  console.log('frameData =>', frameData);
  console.log('fid =>', fid);
  const { frameId } = c.req.param();
  const ignoreOwnershipCheck = new Boolean(
    process.env.CHALLENGE_IGNORE_OWNERSHIP_CHECK,
  );
  try {
    console.log(frameId);
    const wallet = '';

    // check ownership first
    const pocFrame = await getPocFrame(frameId);
    const alreadyOwnsProof = await checkOwnership(pocFrame, wallet);
    if (alreadyOwnsProof && !ignoreOwnershipCheck) {
      return renderProofAlreadyOwned(
        c,
        pocFrame.id,
        pocFrame.phosphor_proof_url,
      );
    } else {
      // challengeId unset => generate new one and render step/question 1
      const newChallenge = await buildNewChallenge(frameId, fid);
      return renderChallengeNextStep(c, newChallenge, 1);
    }
  } catch (e: any) {
    console.log(e);
    return renderError(c, frameId);
  }
});

app.frame('/proof-of-crab/challenge/:challengeId', async (c) => {
  const { buttonValue } = c;
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
    action: `/proof-of-crab/challenge/${challenge.id}`,
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
  const actionMintProof = `/proof-of-crab/challenge/${challenge.id}/mint-proof`;
  return c.res({
    image:
      'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabPass.png',
    intents: [
      //<TextInput placeholder="Enter external wallet..." />,
      <Button action={actionMintProof} value="mint">
        Mint your 🦀 Proof
      </Button>,
    ],
  });
}

function renderChallengeFailed(
  c: FrameContext,
  challenge: ProofOfCrabChallenge,
) {
  const actionRetryChallenge = `/proof-of-crab/${challenge.frame_id}/new-challenge`;
  return c.res({
    image:
      'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabFail.png',
    intents: [
      <Button action={actionRetryChallenge} value="retry">
        Try again
      </Button>,
    ],
  });
}

function renderProofMintInProgress(
  c: FrameContext,
  challenge: ProofOfCrabChallenge,
  mintTxHash?: string,
) {
  const actionRefreshMintStatus = `/proof-of-crab/challenge/${challenge.id}/proof-mint-in-progress`;
  return c.res({
    image: 'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabMinting.png',
    intents: [
      (mintTxHash !== undefined && mintTxHash !== null) && (
        <Button.Link href={getTxUrl(mintTxHash)}>View Mint Tx</Button.Link>
      ),
      <Button action={actionRefreshMintStatus}>🔁 Refresh status</Button>,
    ],
  });
}

function renderProofMinted(
  c: FrameContext,
  challenge: ProofOfCrabChallenge,
  proofPageUrl: string,
) {
  const phosphorUrl = 'https://phosphor.xyz/';
  const shareChallengeUrl = `https://warpcast.com/~/compose?embeds[]=${process.env.BASE_URL}/api/proof-of-crab/${challenge.frame_id}`
  return c.res({
    image: 'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/MintSuccess.png',
    intents: [<Button.Link href={proofPageUrl}>View my 🦀 Proof</Button.Link>, 
    <Button.Link href={shareChallengeUrl}>Share this challenge</Button.Link>,
    <Button.Link href={phosphorUrl}>Try Phosphor</Button.Link>],
  });
}

app.frame('/proof-of-crab/challenge/:challengeId/mint-proof', async (c) => {
  try {
    const defaultWallet = process.env.DEFAULT_TEST_WALLET ?? '';
    const { challengeId } = c.req.param();
    if (!challengeId) {
      throw new Error('Challenge not found');
    }
    let challenge = await getPocChallenge(challengeId);
    const pocFrame = await getPocFrame(challenge.frame_id);
    const phosphorTxId = await mintProof(
      pocFrame,
      challenge.user ? challenge.user.custody_address : defaultWallet,
    );
    challenge.mint_tx_id = phosphorTxId;
    challenge.has_minted_proof = phosphorTxId !== null;
    await updatePocChallengeWithProof(challenge);
    return renderProofMintInProgress(c, challenge);
  } catch (e: any) {
    console.log(e);
    return renderError(c);
  }
});

app.frame(
  '/proof-of-crab/challenge/:challengeId/proof-mint-in-progress',
  async (c) => {
    try {
      const { challengeId } = c.req.param();
      if (!challengeId) {
        throw new Error('Challenge not found');
      }
      let challenge = await getPocChallenge(challengeId);
      const pocFrame = await getPocFrame(challenge.frame_id);
      const mintTx = await getProofTransaction(pocFrame, challenge.mint_tx_id);
      if (!mintTx) {
        throw new Error(`Mint tx ${challenge.mint_tx_id} not found`);
      }
      console.log(
        `tx: ${challenge.mint_tx_id}, status: ${mintTx.state}, hash: ${mintTx.tx_hash}, error: ${mintTx.error_message}`,
      );
      if (mintTx.state === 'COMPLETED') {
        return renderProofMinted(
          c,
          challenge,
          mintTx.tx_hash,
          pocFrame.phosphor_proof_url,
        );
      } else if (mintTx.state === 'CANCELLED') {
        throw new Error(`Proof mint tx ${challenge.mint_tx_id} was cancelled`);
      } else {
        // stay idle for a few secs (to avoid frame to refresh too soon)
        stayIdle(3000);
        return renderProofMintInProgress(c, challenge, mintTx.tx_hash);
      }
    } catch (e: any) {
      console.log(e);
      return renderError(c);
    }
  },
);

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
          fontSize: 40,
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
  const action = frameId ? `/proof-of-crab/${frameId}` : '/proof-of-crab';
  return c.res({
    image:
      'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabError.png',
    intents: [<Button action={action}>Back to Home</Button>],
  });
}

app.frame('/add-frame-to-account', async (c) => {
  try {
    const actionInstructions = `/add-frame-to-account/instructions`;
    return c.res({
      image:
        'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/GrabHome.png',
      intents: [
        <Button action={actionInstructions}>Start using this for your 🦀 needs</Button>,
      ],
    });
  } catch (e: any) {
    console.log(e);
    return renderError2(c);
  }
});

app.frame('/add-frame-to-account/instructions', async (c) => {
  try {
    const hrefDefault = `https://warpcast.com/~/compose?embeds[]=${process.env.BASE_URL}/api/proof-of-crab`;
    const actionCustom = `/add-frame-to-account/custom`;
    return c.res({
      image:
        'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/HostOptions.png',
      intents: [
        <Button.Link href={hrefDefault}>Use Standard 🦀 </Button.Link>,
        <Button action={actionCustom}>Create my Custom one</Button>,
      ],
    });
  } catch (e: any) {
    console.log(e);
    return renderError2(c);
  }
});

//TODO prevent same FID to create a new frame for now. If frame already exists, show a message + buttons to access and use it again
app.frame('/add-frame-to-account/custom', async (c) => {
  try {
    const { frameData, verified } = c;
    const { fid } = frameData;
    const allowMultipleForSameFid = new Boolean(
      process.env.FRAME_ALLOW_MULTIPLE_FOR_SAME_FID,
    );
    const defaultPocFrame = await getPocFrame(
      process.env.DEFAULT_POC_FRAME_ID ?? '',
    );
    //TODO fetch other frames for this fid
    if (!allowMultipleForSameFid) {
      //TODO if other frame exists, then return rendered blocker message => you can't create 2 frames
    }
    const pocFrameClone = await generateCustomPocFrameFromDefault(
      defaultPocFrame,
      fid,
    );
    const hrefDefault = `https://warpcast.com/~/compose?embeds[]=${process.env.BASE_URL}/api/proof-of-crab/${pocFrameClone.id}`;
    return c.res({
      //TODO change image with... your proof has been prepared, now activate it by clicking button
      image:
        'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/GrabHome.png',
      intents: [
        <Button.Link href={hrefDefault}>Activate 🦀 on my account</Button.Link>,
      ],
    });
  } catch (e: any) {
    console.log(e);
    return renderError2(c);
  }
});

function renderError2(c: FrameContext, frameId?: string) {
  const action = '/add-frame-to-account';
  return c.res({
    image:
      'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabError.png?t=2024-04-15T13%3A25%3A37.729Z',
    intents: [<Button action={action}>Back</Button>],
  });
}

function getTxUrl(txHash: string): string{
  return `https://lineascan.build/tx/${txHash}`;
}


devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
