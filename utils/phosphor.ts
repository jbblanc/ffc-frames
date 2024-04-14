import 'dotenv/config';
import { ProofOfCrabFrame } from '../domain/poc-frame.js';
import { getPocFramePhosphorApiKey } from './db.js';

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
    'Treum-Api-Key': apiKey,
  };
}
