import 'dotenv/config';
import { ProofOfCrabFrame } from '../domain/poc-frame.js';
import { getPocFramePhosphorApiKey } from './db.js';
import { FarcasterUser } from '../domain/farcaster-user.js';

export async function addNewPocFrameItem(
  defaultPocFrame: ProofOfCrabFrame,
  phosphorApiKey: string,
  accountFid: string,
  accountUser?: FarcasterUser,
) {
  // add item
  const addItemResponse = await fetch(`${process.env.PHOSPHOR_URL}/v1/items`, {
    method: 'POST',
    headers: buildHeader(phosphorApiKey ?? process.env.PHOSPHOR_APIKEY),
    body: JSON.stringify({
      collection_id: defaultPocFrame.phosphor_proof_collection_id,
      attributes: {
        title: `${accountUser?.display_name}'s Proof of Crab`,
        description: `This is a proof of crab that certifying that its holder is a valid crab of ${accountUser?.display_name}'s crabs community`,
        //TODO change image for proper NFT image !!
        image_url: `https://jopwkvlrcjvsluwgyjkm.supabase.co/storage/v1/object/public/poc-images/CrabPass.png?t=2024-04-15T17%3A51%3A47.863Z`,
        fid: accountFid,
        username: accountUser?.username,
      },
    }),
  });
  checkForErrors(addItemResponse);
  const createItemData = await addItemResponse.json();
  if (createItemData.error) {
    throw new Error(`Error while adding item: ${createItemData.error.detail}`);
  }
  // then lock item
  const lockItemResponse = await fetch(
    `${process.env.PHOSPHOR_URL}/v1/items/lock`,
    {
      method: 'POST',
      headers: buildHeader(phosphorApiKey ?? process.env.PHOSPHOR_APIKEY),
      body: JSON.stringify({
        item_id: createItemData.id,
        max_supply: '1000', // hard cap supply as a security for the demo version
      }),
    },
  );
  checkForErrors(lockItemResponse);
  const lockItemData = await lockItemResponse.json();
  if (lockItemData.error) {
    throw new Error(`Error while locking item: ${lockItemData.error.detail}`);
  }
  //console.log(JSON.stringify(data));
  return { item: createItemData, lock: lockItemData };
}

export async function mintProof(pocFrame: ProofOfCrabFrame, toAddress: string) {
  const phosphorApiKey = await getPocFramePhosphorApiKey(pocFrame.id);
  // mint-request
  const mintResponse = await fetch(
    `${process.env.PHOSPHOR_URL}/v1/mint-requests`,
    {
      method: 'POST',
      headers: buildHeader(phosphorApiKey ?? process.env.PHOSPHOR_APIKEY),
      body: JSON.stringify({
        item_id: pocFrame.phosphor_proof_item_id,
        to_address: toAddress,
        quantity: '1',
      }),
    },
  );
  checkForErrors(mintResponse);
  const data = await mintResponse.json();
  if (data.error) {
    throw new Error(`Error during mint: ${data.error.detail}`);
  }
  //console.log(JSON.stringify(data));
  return data.mint_requests[0].transaction_id;
}

export async function getProofTransaction(
  pocFrame: ProofOfCrabFrame,
  transactionId: string,
) {
  const phosphorApiKey = await getPocFramePhosphorApiKey(pocFrame.id);
  const txResponse = await fetch(
    `${process.env.PHOSPHOR_URL}/v1/transactions/${transactionId}`,
    {
      method: 'GET',
      headers: buildHeader(phosphorApiKey ?? process.env.PHOSPHOR_APIKEY),
    },
  );
  checkForErrors(txResponse);
  const transaction = await txResponse.json();
  //console.log(JSON.stringify(transaction));
  return transaction;
}

export async function checkOwnership(
  pocFrame: ProofOfCrabFrame,
  walletAddress: string,
  minQuantityOwned = 1,
): Promise<boolean> {
  let ownerPage: any;
  do {
    ownerPage = await getNextOwnersPageForItem(
      pocFrame.phosphor_proof_item_id,
      ownerPage ? ownerPage.cursor : undefined,
    );
    const owner = ownerPage.results?.filter(
      (o: any) => o.address.toLowerCase() === walletAddress.toLowerCase(),
    );
    if (owner?.length > 0) {
      console.log(
        `Wallet owns ${owner[0].quantity} proof(s) ${pocFrame.phosphor_proof_item_id}`,
      );
      return owner[0].quantity >= minQuantityOwned;
    }
  } while (ownerPage.has_more);
  console.log(
    `Wallet doesn't own the proof ${pocFrame.phosphor_proof_item_id}`,
  );
  return false;
}

export async function getNextOwnersPageForItem(
  itemId: string,
  nextCursor?: string,
) {
  const pagination = nextCursor ? `?cursor=${nextCursor}` : '';
  const ownersPageResponse = await fetch(
    `${process.env.PHOSPHOR_PUBLIC_URL}/v1/items/${itemId}/owners${pagination}`,
    {
      method: 'GET',
      headers: buildHeader(''),
    },
  );
  checkForErrors(ownersPageResponse);
  const ownersPage = await ownersPageResponse.json();
  return ownersPage;
}

function checkForErrors(resp: Response) {
  if (resp.status === 401) {
    throw new Error('You are not authorized to access the API');
  }
  if (resp.status === 403) {
    throw new Error('You do not have access to this resource');
  }
}

function buildHeader(apiKey: string, noContentType = false) {
  return {
    ...(!noContentType && { 'Content-Type': 'application/json' }),
    'Phosphor-Api-Key': apiKey,
  };
}
