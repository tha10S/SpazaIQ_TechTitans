const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

function cors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

function promptFor({ question, userName, shopName, businessContext }) {
  return [
    'You are Tech Titans Chat Bot, the business assistant inside SpazaIQ, a South African spaza shop management app.',
    `The signed-in owner is ${userName || 'the shop owner'} and the connected shop is ${shopName || "Thabo's Mini Mart"}.`,
    'Answer questions about sales, stock, products, suppliers, selling, customer credit, cash flow, trends, and dashboard insights.',
    'Use the supplied shop data for calculations. Never invent figures, customers, products, transactions, expenses, or supplier payments.',
    'Cash flow requires recorded sales, expenses, and supplier payments. State exactly which parts are unavailable.',
    'Trend or forecast questions require sales history. If there are zero recorded sales, say a trend cannot yet be calculated and explain what data must be recorded.',
    'For app actions, guide the user to the relevant tab but do not claim that chat changed records.',
    'For unrelated questions, politely say you can help only with SpazaIQ shop management.',
    'Keep answers concise, useful, and use South African rand (R) for money.',
    `Current SpazaIQ business context: ${JSON.stringify(businessContext)}`,
    `User question: ${question}`,
  ].join('\n');
}

export default async function handler(request, response) {
  cors(response);
  if (request.method === 'OPTIONS') return response.status(204).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST.' });

  let requestBody = request.body || {};
  if (typeof requestBody === 'string') {
    try {
      requestBody = JSON.parse(requestBody);
    } catch (error) {
      return response.status(400).json({ error: 'Request body must be valid JSON.' });
    }
  }

  const { question, userName, shopName, businessContext, image } = requestBody;
  if (!question || typeof question !== 'string') return response.status(400).json({ error: 'A question is required.' });

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  if (!apiKey) return response.status(500).json({ error: 'The assistant server is not configured.' });

  const parts = [{ text: promptFor({ question, userName, shopName, businessContext }) }];
  if (image?.base64) parts.push({ inlineData: { mimeType: image.mimeType || 'image/jpeg', data: image.base64 } });

  const geminiResponse = await fetch(`${GEMINI_API_URL}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ generationConfig: { temperature: 0.2 }, contents: [{ role: 'user', parts }] }),
  });
  const payload = await geminiResponse.json();
  if (!geminiResponse.ok) return response.status(geminiResponse.status).json({ error: payload.error?.message || 'Gemini request failed.' });

  const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!answer) return response.status(502).json({ error: 'Gemini returned an empty response.' });
  return response.status(200).json({ response: answer });
}