import { Agent, run } from '@openai/agents';

const peritoAgent = new Agent({
  name: 'Perito Valutatore PIV',
  model: 'gpt-5',
  instructions: `Sei un agente specializzato nella valutazione d'azienda secondo i Principi Italiani di Valutazione (PIV).
Ricevi esclusivamente dati strutturati JSON prodotti dall'app XBRL.
Devi:
1. analizzare i dati economici, patrimoniali e finanziari;
2. evidenziare dati mancanti, incoerenze e limiti informativi;
3. applicare solo i metodi di valutazione per i quali i dati sono sufficienti;
4. non inventare dati esterni;
5. preparare una bozza professionale di perizia di stima, chiarendo assunzioni, formule e risultati;
6. distinguere sempre dati osservati, calcoli derivati, assunzioni e valutazioni professionali.
Restituisci HTML semplice, senza script.`
});

function isAuthorized(req) {
  const expected = process.env.APP_AGENT_ACCESS_KEY;
  if (!expected) return false;
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${expected}`;
}

function safeOpenAIError(error) {
  const status = error?.status || error?.response?.status || null;
  const code = error?.code || error?.error?.code || error?.cause?.code || null;
  const rawMessage = error?.error?.message || error?.message || error?.cause?.message || 'Errore OpenAI non specificato';
  const message = String(rawMessage).replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]').slice(0, 600);
  return [status ? `HTTP ${status}` : null, code, message].filter(Boolean).join(' - ');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY non configurata sul server' });
  }

  if (!process.env.APP_AGENT_ACCESS_KEY) {
    return res.status(500).json({ error: 'APP_AGENT_ACCESS_KEY non configurata sul server' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Codice accesso agente non valido' });
  }

  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'JSON di valutazione mancante o non valido' });
  }

  try {
    const result = await run(
      peritoAgent,
      `Analizza questo JSON prodotto dall'app XBRL e prepara la bozza di perizia:\n\n${JSON.stringify(payload, null, 2)}`,
      { maxTurns: 8 }
    );

    return res.status(200).json({ html: result.finalOutput ?? '' });
  } catch (error) {
    const detail = safeOpenAIError(error);
    console.error('Errore agente OpenAI:', detail);
    return res.status(500).json({ error: `Errore OpenAI: ${detail}` });
  }
}
