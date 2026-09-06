export default function handler(req, res) {
  return res.status(200).json({
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    accessConfigured: Boolean(process.env.APP_AGENT_ACCESS_KEY)
  });
}
