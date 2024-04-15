import { FarcasterUser } from '../domain/farcaster-user.js';

const verify = process.env.VERIFY_BODY === 'true';

export async function getUserByFid(
  fid: string,
): Promise<FarcasterUser | undefined> {
  if (!verify && fid === '1') return undefined;
  const usersResponse = await fetch(
    `${process.env.NEYNAR_URL}/v2/farcaster/user/bulk?fids=${fid}`,
    {
      method: 'GET',
      headers: buildHeader(process.env.NEYNAR_APIKEY ?? ''),
    },
  );
  const users = await usersResponse.json();
  console.log(users);
  return users?.length > 0 ? (users[0] as FarcasterUser) : undefined;
}

function buildHeader(apiKey: string) {
  return {
    Accept: 'application/json',
    Api_key: apiKey,
  };
}
