import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import { NoncePayload } from "./types.js";

let supabaseClient: SupabaseClient | undefined;

const getClient = (): SupabaseClient | undefined => {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    return undefined;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  return supabaseClient;
};

export const broadcastNonceUpdate = async (payload: NoncePayload): Promise<void> => {
  const client = getClient();
  if (!client) {
    return;
  }

  const channel = client.channel(config.realtimeChannel, {
    config: { broadcast: { self: false, ack: true } }
  });

  await channel.subscribe();
  await channel.send({
    type: "broadcast",
    event: "nonce-issued",
    payload
  });
  await client.removeChannel(channel);
};
