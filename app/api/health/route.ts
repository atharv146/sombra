// Whether plans are stored where phones can reach them (Upstash) or only in this server's memory.
export async function GET() {
  return Response.json({ shared: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) });
}
