import { Button, FrameContext, Frog } from 'frog';
// import { neynar } from 'frog/hubs'
import { getPocFrame } from '../utils/db.js';

import { cloneCustomPocFrameFromDefault } from '../utils/frame.js';

export const app = new Frog({
  imageAspectRatio: '1:1',
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
});

app.frame('/', async (c) => {
  try {
    const hrefDefault = `https://warpcast.com/~/compose?embeds[]=${process.env.BASE_URL}/api`;
    //const hrefCustom = `${process.env.APP_BASE_URL}/new`;
    const actionCustom = `/clone`;
    return c.res({
      image:
        'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/GrabHome.png',
      intents: [
        <Button.Link href={hrefDefault}>Use 🦀 with my account</Button.Link>,
        //<Button.Link href={hrefCustom}>Setup a custom 🦀</Button.Link>,
        <Button action={actionCustom}>Setup a custom 🦀</Button>,
      ],
    });
  } catch (e: any) {
    console.log(e);
    return renderError(c);
  }
});

app.frame('/clone', async (c) => {
  try {
    const defaultPocFrame = await getPocFrame(
      process.env.DEFAULT_POC_FRAME_ID ?? '',
    );
    const pocFrameClone = await cloneCustomPocFrameFromDefault(
      defaultPocFrame,
      '12345',
      '0xInfluencer',
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
    return renderError(c);
  }
});

function renderError(c: FrameContext, frameId?: string) {
  const action = '/';
  return c.res({
    image: 'https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabError.png?t=2024-04-15T13%3A25%3A37.729Z',
    intents: [<Button action={action}>Back</Button>],
  });
}

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
