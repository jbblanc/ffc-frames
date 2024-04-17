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
  walletOwnsProof,
  getItemForFrame,
  getProofTransaction,
  mintProof,
} from '../utils/phosphor.js';
import { generateCustomPocFrameFromDefault } from '../utils/frame.js';
import { stayIdle } from '../utils/idle.js';
import { FarcasterUser } from '../domain/farcaster-user.js';
import { ProofOfCrabFrame } from '../domain/poc-frame.js';
import { getUserByFid } from '../utils/neynar.js';

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

/**
 * Global HOME frame
 */

app.frame('/', async (c) => {
  const actionCreatePocFrame = '/add-frame-to-account';
  const actionStartPocFrame = '/proof-of-crab';
  //await generateCustomProofArtwork('12345', 'jhjhjjh', 'lklkklklkkl', 'https://i.imgur.com/SnObVa5.jpg');
  return c.res({
    image: 'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/GrabHome.png', //await renderCustomProofGeneratedImage('https://media-resize-prod.consensys-nft.com/resize/?cid=Qmd2KPgHb8JqVJ7PPZ6kJFKMdsehy6v3CQ6KFfPeA3vaJd&image=data.png&size=thumb'),
    intents: [
      <Button action={actionCreatePocFrame}>➕ Add to my account</Button>,
      <Button action={actionStartPocFrame}>🤖 Start default challenge</Button>,
    ],
  });
});

/**
 * Proof of Crab CHALLENGE frames
 * These frames handle a Proof of Crab challenge for any given Proof of Crab frame (owned by a farcaster account)
 */

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
        //alignItems: 'center',
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
          paddingBottom: '20px',
          whiteSpace: 'pre-wrap',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center'}}>
          <div style={{display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', fontSize: 24}}>Take the challenge!</div>
            <div style={{display: 'flex', fontSize: 24}}>Get soulbound proof from:</div>
          </div>
          <div style={{display: 'flex', paddingLeft: '25px', alignItems: 'center'}}>
            <div style={{display: 'flex'}}>
              <div style={{display: 'flex'}}><img style={{borderRadius: '9999px'}} src={accountUser?.pfp_url} width="75" height="75" /></div>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', paddingLeft: '15px', fontSize: 18}}>
              <div style={{display: 'flex'}}>{accountUser?.display_name}</div>
              <div style={{display: 'flex'}}>@{accountUser?.username}</div>
            </div>
          </div>
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
  const { frameData } = c;
  const { fid } = frameData;
  const { frameId } = c.req.param();
  const ignoreOwnershipCheck = new Boolean(
    process.env.CHALLENGE_IGNORE_OWNERSHIP_CHECK,
  );
  try {
    const challengedUser = await getUserByFid(fid);
    const pocFrame = await getPocFrame(frameId);
    // check ownership first (no need to create & run new challenge again)
    const alreadyOwnsProof = await walletOwnsProof(pocFrame, challengedUser?.custody_address);
    if (alreadyOwnsProof && !ignoreOwnershipCheck) {
      return renderProofAlreadyOwned(
        c,
        pocFrame.id,
        pocFrame.phosphor_proof_url,
      );
    } else {
      // generate new challenge for this use and render step/question 1
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
  phosphorItemArtworkUrl: string,
) {
  const phosphorUrl = 'https://phosphor.xyz';
  const shareChallengeUrl = `https://warpcast.com/~/compose?embeds[]=${process.env.BASE_URL}/api/proof-of-crab/${challenge.frame_id}`
  return c.res({
    image: renderProofMintedImage(phosphorItemArtworkUrl),
    intents: [<Button.Link href={proofPageUrl}>View Badge</Button.Link>, 
    <Button.Link href={shareChallengeUrl}>Share</Button.Link>,
    <Button.Link href={phosphorUrl}>Try Phosphor</Button.Link>],
  });
}

function renderProofMintedImage(nftArtworkUrl: string) {
  return (
    <div
      style={{
        background: 'black',
        backgroundSize: '100% 100%',
        backgroundImage: 'url(https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/MintSuccessWide.png)',
        display: 'flex',
        flexDirection: 'column',
        flexWrap: 'nowrap',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        width: '100%',
      }}
    >
      
      <div style={{display: 'flex', paddingBottom: '200px', paddingRight: '70px'}}>
          <div style={{display: 'flex'}}><img style={{borderRadius: '10px'}} src={nftArtworkUrl} width="220" height="220" /></div>
      </div>
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
          
        </div>
      </div>
    </div>
  );
}

app.frame('/proof-of-crab/challenge/:challengeId/mint-proof', async (c) => {
  try {
    const defaultWallet = !isProduction ? (process.env.DEFAULT_TEST_WALLET ?? '') : '';// default wallet only when testing
    const { challengeId } = c.req.param();
    if (!challengeId) {
      throw new Error('Challenge not found');
    }
    let challenge = await getPocChallenge(challengeId);
    if(isProduction && !challenge?.user?.custody_address){
      throw new Error(`No farcaster wallet associated to this challenge ${challengeId}`);
    }
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
        const phosphorItem = await getItemForFrame(pocFrame);
        return renderProofMinted(
          c,
          challenge,
          pocFrame.phosphor_proof_url,
          phosphorItem?.media.image.thumb,
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

/**
 * Proof of Crab CUSTOM FRAME CHALLENGE frames
 * These frames allow any farcaster account to create a custom own Proof of Crab challenge (series of frame + unique NFT)
 */

app.frame('/add-frame-to-account', async (c) => {
  try {
    const hrefDefault = `https://warpcast.com/~/compose?embeds[]=${process.env.BASE_URL}/api/proof-of-crab`;
    const actionBack = `/`;
    const actionCustom = `/add-frame-to-account/custom`;
    return c.res({
      image:
        'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/HostOptions.png',
      intents: [
        <Button action={actionBack}>Back</Button>,
        <Button.Link href={hrefDefault}>Use Standard</Button.Link>,
        <Button action={actionCustom}>Create Custom</Button>,
      ],
    });
  } catch (e: any) {
    console.log(e);
    return renderErrorAddToAccount(c);
  }
});

function renderCustomProofGeneratedImage(nftArtworkUrl: string) {
  return (
    <div
      style={{
        background: 'black',
        backgroundSize: '100% 100%',
        backgroundImage: 'url(https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/ConfirmCustomWide.png)',
        display: 'flex',
        flexDirection: 'column',
        flexWrap: 'nowrap',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        width: '100%',
      }}
    >
      
      <div style={{display: 'flex', paddingBottom: '173px'}}>
          <div style={{display: 'flex'}}><img style={{borderRadius: '10px'}} src={nftArtworkUrl} width="200" height="200" /></div>
      </div>
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
          
        </div>
      </div>
    </div>
  );
}

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
    const pocFrameCloneSummary = await generateCustomPocFrameFromDefault(
      defaultPocFrame,
      fid,
    );
    const hrefDefault = `https://warpcast.com/~/compose?embeds[]=${process.env.BASE_URL}/api/proof-of-crab/${pocFrameCloneSummary.newCustomFrame.id}`;
    return c.res({
      image: renderCustomProofGeneratedImage(pocFrameCloneSummary.nftProofArtworkUrl),
      intents: [
        <Button.Link href={hrefDefault}>Share my Custom Challenge</Button.Link>,
      ],
    });
  } catch (e: any) {
    console.log(e);
    return renderErrorAddToAccount(c);
  }
});

function renderErrorAddToAccount(c: FrameContext, frameId?: string) {
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


/**
 * Proof of Crab SAMPLE GATED CONTENT frames
 * These frames are standalone frames to illustrate how to token gate a specific content depending on whether you own a specific Proof or not
 */

app.frame('/gated-example/secret-party', async (c) => {
  const actionAccessSecretMap = '/gated-example/secret-party/access-secret-map';
  return c.res({
    image: 'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/secret-party-home.png',
    intents: [
      <Button action={actionAccessSecretMap}>🗺️ Show me the secret map !</Button>,
    ],
  });
});

app.frame('/gated-example/secret-party/access-secret-map', async (c) => {
  const { frameData } = c;
  const { fid } = frameData;
  // for this challenge, we use the default genesis challenge Proof
  const genesisFrameId = process.env.DEFAULT_POC_FRAME_ID ?? '';
  const pocFrame = await getPocFrame(genesisFrameId);
  const challengedUser = await getUserByFid(fid);
  // check ownership first (no need to create & run new challenge again)
  const challengedUserOwnsProof = await walletOwnsProof(pocFrame, challengedUser?.custody_address);
  if(challengedUserOwnsProof){
    // he's got Proof he's a crab => showing secret map
    return c.res({
      image: 'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/secret-party-secret-map.png',
      intents: [
        <Button action='/add-frame-to-account'>➕ Try creating custom Proof Badge</Button>,
      ],
    });
  }
  // NO Proof he's a crab => inviting to start the challenge and try again later
  return c.res({
    image: 'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/secret-party-no-proofed-crab.png',
    intents: [
      <Button action='/proof-of-crab'>▶️ Take the challenge, prove you are a 🦀 !</Button>,
    ],
  });
});

devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic });

export const GET = handle(app);
export const POST = handle(app);
