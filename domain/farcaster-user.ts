export interface FarcasterUser {
  fid: string;
  custody_address: string;
  username: string;
  display_name: string;
  pfp_url: string;
  verified_addresses: { eth_addresses: string[] };
}
