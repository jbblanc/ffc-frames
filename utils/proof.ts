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
  accountPfpUrl?: string,
): Promise<string> {
  const template = html(`
<div style="display: flex; flex-flow: column nowrap; align-items: center; justify-content: flex-start; width: 2400px; height: 2400px; background-size: 100% 100%; background-image: url(https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabProofCustom.png);">
  <div style="width: 100%; height: 100%; display: flex; justify-content: center; align-items: flex-end; padding-bottom: 60px; color: white; text-transform: uppercase; font-size: 80px">
    <div style="display: flex; align-items: center;">  
        <div style="display: flex;">You passed</div>
        <div style="display: flex; margin-left:50px; margin-right: 50px;">
          <img style="border-radius: 9999px; border: 10px; border-color: white;" src="${accountPfpUrl}" width="200" height="200" />
        </div>
        <div style="display: flex;">
          ${accountHandle}'s
        </div>
        <div style="display: flex; margin-left: 50px;">challenge!</div>
    </div>
  </div>
</div>
`);
  const svg = await satori(template, {
    width: 2400,
    height: 2400,
    fonts: [
      {
        name: 'Quicksand',
        data: isProduction
          ? await fetch(`${process.env.BASE_URL}/Quicksand-SemiBold.ttf`).then(
              (res) => res.arrayBuffer(),
            )
          : await readFile('./public/Quicksand-SemiBold.ttf'),
        weight: 400,
        style: 'normal',
      },
    ],
  });
  //console.log(svg);
  const resvg = new Resvg(svg, {
    dpi: 300,
    fitTo: {
      mode: 'original',
    },
    imageRendering: 0,
    textRendering: 2,
    shapeRendering: 2,
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  const pngArtworkFileName = `proof-${accountFid}.png`;
  //await writeFile(pngArtworkFileName, pngBuffer); //TODO remove me !!
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
