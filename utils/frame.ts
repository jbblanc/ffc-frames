import { ProofOfCrabFrame } from '../domain/poc-frame.js';
import { createCustomPocFrame, getPocFramePhosphorApiKey } from './db.js';
import { getUserByFid } from './neynar.js';
import { addNewPocFrameItem } from './phosphor.js';
import { generateCustomProofArtwork } from './proof.js';

export async function cloneCustomPocFrameFromDefault(
  defaultPocFrame: ProofOfCrabFrame,
  accountFid: string,
): Promise<ProofOfCrabFrame> {
  const accountUser = await getUserByFid(accountFid);
  const phosphorApiKey = await getPocFramePhosphorApiKey(defaultPocFrame.id);
  // generate unique artwork for new Proof
  const nftProofArtworkUrl = await generateCustomProofArtwork(
    accountFid,
    accountUser?.username,
    accountUser?.display_name,
  );
  // setup new NFT
  const newNftDetails = await addNewPocFrameItem(
    defaultPocFrame,
    phosphorApiKey,
    accountFid,
    nftProofArtworkUrl,
    accountUser,
  );

  // save new custom frame in DB
  const newCustomFrame = await createCustomPocFrame({
    name: `${accountUser?.username}'s Proof of Crab frame`,
    security_level: defaultPocFrame.security_level,
    phosphor_organization_id: defaultPocFrame.phosphor_organization_id,
    phosphor_proof_collection_id: defaultPocFrame.phosphor_proof_collection_id,
    phosphor_proof_item_id: newNftDetails.item.id,
    phosphor_proof_url: `https://app.phosphor.xyz/${defaultPocFrame.phosphor_organization_id}/collections/${defaultPocFrame.phosphor_proof_collection_id}/${newNftDetails.item.id}`,
    phosphor_api_key: phosphorApiKey,
    account_fid: accountFid,
    account_user: accountUser,
  });
  return newCustomFrame;
}
