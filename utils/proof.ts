import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { html } from 'satori-html';
import { readFile } from 'node:fs/promises';
import { supabase } from './supabase.js';

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined';
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development';

export async function generateCustomProofArtwork(
  accountFid: string,
  accountHandle?: string,
  accountDisplayName?: string,
): Promise<string> {
  /*const template = html(`
<div style="display: flex; flex-flow: column nowrap; align-items: stretch; width: 600px; height: 600px; backgroundImage: linear-gradient(to right, #0f0c29, #302b63, #24243e); color: #000;">
  <div style="display: flex; flex: 1 0; flex-flow: row nowrap; justify-content: center; align-items: center;">
    <img style="border: 8px solid rgba(255, 255, 255, 0.2); border-radius: 50%;" src="https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/GrabHome.png" alt="animals" />
  </div>
  <div style="display: flex; justify-content: center; align-items: center; margin: 6px; padding: 12px; border-radius: 4px; background: rgba(255, 255, 255, 0.2); color: #fff; font-size: 22px;">
    The quick brown fox jumps over the lazy dog.
  </div>
</div>
`);*/
  const template = html(`
<div style="display: flex; flex-flow: column nowrap; align-items: center; justify-content: flex-start; width: 600px; height: 600px; background-size: 100% 100%; background-image: url(https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabPass.png);">
  <div style="display: flex; justify-content: flex-start; align-items: center; margin: 6px; padding: 12px; border-radius: 4px; background: rgba(255, 255, 255, 0.2); color: #fff; font-size: 22px;">
    <div>${accountHandle}</div>
    <div>${accountDisplayName}</div>
  </div>
</div>
`);
  const svg = await satori(template, {
    width: 600,
    height: 600,
    fonts: [
      {
        name: 'Roboto',
        data: await readFile(
          isProduction ? 'Roboto-Medium.ttf' : './public/Roboto-Medium.ttf',
        ),
        weight: 400,
        style: 'normal',
      },
    ],
  });
  //console.log(svg);
  const resvg = new Resvg(svg, {
    background: 'rgba(238, 235, 230, .9)',
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  const pngArtworkFileName = `proof-${accountFid}.png`;
  const artworkPublicUrl = await uploadProofArtwork(
    pngArtworkFileName,
    pngBuffer,
  );
  console.log(`New proof artwork was stored at ${artworkPublicUrl}`);
  return artworkPublicUrl;
}

async function uploadProofArtwork(
  fileName: string,
  fileBuffer: any,
): Promise<string> {
  const bucket = 'poc-proof-artworks';
  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileBuffer, { upsert: true, contentType: 'image/png' });
  if (error) {
    console.log(error);
    throw new Error(`Impossible to upload proof artwork: ${fileName}`);
  } else {
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data?.publicUrl;
  }
}
