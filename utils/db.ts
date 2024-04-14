import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';
import { ProofOfCrabFrame } from '../domain/poc-frame.js';
import { ProofOfCrabQuestion } from '../domain/poc-question.js';
import { ProofOfCrabChallenge } from '../domain/poc-challenge.js';

// Create a single supabase client for interacting with your database
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_KEY ?? '',
);

export async function getPocFrame(frameId: string): Promise<ProofOfCrabFrame> {
  let { data: poc_frame, error } = await supabase
    .from('poc_frame')
    .select('id,name,security_level,created_at,phosphor_proof_item_id') // ignore phosphor apikey here
    .eq('id', frameId);
  console.log(poc_frame);
  if (poc_frame) {
    return poc_frame[0];
  } else {
    throw new Error(`Frame not found or Invalid frame id: ${frameId}`);
  }
}

export async function getPocFramePhosphorApiKey(
  frameId: string,
): Promise<string> {
  let { data: poc_frame, error } = await supabase
    .from('poc_frame')
    .select('phosphor_api_key')
    .eq('id', frameId);
  console.log(error);
  console.log(poc_frame);
  if (poc_frame) {
    return poc_frame[0].phosphor_api_key;
  } else {
    throw new Error(`Frame not found or Invalid frame id: ${frameId}`);
  }
}

export async function getPocFrames(): Promise<void> {
  let { data: poc_frame, error } = await supabase.from('poc_frame').select('*');
  console.log(poc_frame);
}

export async function getPocQuestions(): Promise<ProofOfCrabQuestion[]> {
  let { data: poc_question, error } = await supabase
    .from('poc_question')
    .select('*');
  console.log(poc_question);
  return poc_question as ProofOfCrabQuestion[];
}

export async function createPocChallenge(
  newChallenge: ProofOfCrabChallenge,
): Promise<ProofOfCrabChallenge> {
  const { data, error } = await supabase
    .from('poc_frame_challenge')
    .insert([newChallenge])
    .select();
  console.log(data);
  console.log(error);
  if (!data) throw new Error('Error while creating new challenge in DB');
  return data[0] as ProofOfCrabChallenge;
}

export async function updatePocChallengeSteps(
  challenge: ProofOfCrabChallenge,
): Promise<ProofOfCrabChallenge> {
  const { data, error } = await supabase
    .from('poc_frame_challenge')
    .update([{ steps: challenge.steps, score: challenge.score }])
    .eq('id', challenge.id)
    .select();
  console.log(data);
  console.log(error);
  if (!data) throw new Error('Error while updating challenge steps in DB');
  return data[0] as ProofOfCrabChallenge;
}

export async function updatePocChallengeWithProof(
  challenge: ProofOfCrabChallenge,
): Promise<ProofOfCrabChallenge> {
  const { data, error } = await supabase
    .from('poc_frame_challenge')
    .update([
      {
        has_minted_proof: challenge.has_minted_proof,
        mint_tx_hash: challenge.mint_tx_hash,
      },
    ])
    .eq('id', challenge.id)
    .select();
  console.log(data);
  console.log(error);
  if (!data) throw new Error('Error while updating challenge with proof in DB');
  return data[0] as ProofOfCrabChallenge;
}

export async function getPocChallenge(
  challengeId: string,
): Promise<ProofOfCrabChallenge> {
  let { data: poc_frame_challenge, error } = await supabase
    .from('poc_frame_challenge')
    .select('*')
    .eq('id', challengeId);
  console.log(poc_frame_challenge);
  if (poc_frame_challenge) {
    return poc_frame_challenge[0];
  } else {
    throw new Error(
      `Challenge not found or Invalid challenge id: ${challengeId}`,
    );
  }
}
