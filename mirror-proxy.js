/* ════════════════════════════════════════════════════════════════════════
   MIRROR «El Origen» — PROXY UNIVERSAL (Cloudflare Worker)
   Una idea original de Darío Alejandro Tello.

   Qué hace este proxy (tu "caja fuerte"):
   • Recibe los pedidos de tu MIRROR y los reenvía al proveedor de IA real.
   • Le agrega TU clave del lado del servidor — tu clave NUNCA viaja al navegador.
   • Rutea a 7 motores, a la búsqueda web (Tavily) y a la transcripción de
     audio/video (Whisper de Groq, ruta /transcribe), todos por la misma puerta.

   Cómo se usa:
   1. Pegá este código en tu Worker de Cloudflare (Workers & Pages → Crear Worker).
   2. En Settings → Variables and Secrets, agregá SOLO las claves de los motores
      que vayas a usar (no hace falta cargar todas). Nombres de los secrets:
        GROQ_KEY, CEREBRAS_KEY, OPENAI_KEY, OPENROUTER_KEY,
        DEEPSEEK_KEY, TOGETHER_KEY, MISTRAL_KEY, TAVILY_KEY
   3. Deploy. La dirección .workers.dev que te queda es tu PROXY_URL.

   Seguridad: las claves viven como secrets cifrados de Cloudflare. Este archivo
   NO contiene ninguna clave. No lo subas a ningún lado con claves pegadas.
   ════════════════════════════════════════════════════════════════════════ */

// Mapa de cada motor → su endpoint real y el nombre del secret con su clave.
const PROVEEDORES = {
  groq:       { url: 'https://api.groq.com/openai/v1/chat/completions',        secret: 'GROQ_KEY' },
  cerebras:   { url: 'https://api.cerebras.ai/v1/chat/completions',            secret: 'CEREBRAS_KEY' },
  openai:     { url: 'https://api.openai.com/v1/chat/completions',             secret: 'OPENAI_KEY' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions',          secret: 'OPENROUTER_KEY' },
  deepseek:   { url: 'https://api.deepseek.com/v1/chat/completions',           secret: 'DEEPSEEK_KEY' },
  together:   { url: 'https://api.together.xyz/v1/chat/completions',           secret: 'TOGETHER_KEY' },
  mistral:    { url: 'https://api.mistral.ai/v1/chat/completions',             secret: 'MISTRAL_KEY' },
};

// Cabeceras CORS: permiten que tu MIRROR (en tu dominio) hable con este proxy.
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return json({ error: { message: 'Usá POST.' } }, 405);
    }

    // La ruta define el destino: /groq, /openai, /tavily, etc.
    const ruta = new URL(request.url).pathname.replace(/^\/+/, '').toLowerCase();

    // ── Búsqueda web (Tavily) ──
    if (ruta === 'tavily') {
      const key = env.TAVILY_KEY;
      if (!key) return json({ error: { message: 'Falta el secret TAVILY_KEY en el proxy.' } }, 400);
      let cuerpo;
      try { cuerpo = await request.json(); } catch (e) { return json({ error: { message: 'Body inválido.' } }, 400); }
      // Tavily recibe la clave dentro del body como api_key.
      cuerpo.api_key = key;
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const txt = await r.text();
      return new Response(txt, { status: r.status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
    }

    // ── Transcripción de audio/video (Whisper de Groq) ──
    // Recibe un archivo (multipart/form-data, campo "file") y devuelve { text }.
    // Transcribe la voz del audio (o la pista de audio de un video). Gratis en el plan free de Groq.
    if (ruta === 'transcribe' || ruta === 'groq-audio') {
      const key = env.GROQ_KEY;
      if (!key) return json({ error: { message: 'Falta el secret GROQ_KEY en el proxy (la transcripción de audio usa Whisper de Groq).' } }, 400);
      let form;
      try { form = await request.formData(); } catch (e) { return json({ error: { message: 'Esperaba un archivo de audio (multipart/form-data).' } }, 400); }
      const file = form.get('file');
      if (!file) return json({ error: { message: 'Falta el archivo (campo "file").' } }, 400);
      const fwd = new FormData();
      fwd.append('file', file, (file.name || 'audio.webm'));
      fwd.append('model', form.get('model') || 'whisper-large-v3-turbo');
      if (form.get('language')) fwd.append('language', form.get('language'));
      fwd.append('response_format', form.get('response_format') || 'json');
      try {
        const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + key },
          body: fwd,
        });
        const txt = await r.text();
        return new Response(txt, { status: r.status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
      } catch (e) {
        return json({ error: { message: 'El proxy no pudo transcribir: ' + e.message } }, 502);
      }
    }

    // ── Motores de IA (formato OpenAI chat completions) ──
    const prov = PROVEEDORES[ruta];
    if (!prov) {
      return json({ error: { message: 'Ruta desconocida: /' + ruta + '. Usá una de: ' + Object.keys(PROVEEDORES).join(', ') + ', tavily.' } }, 404);
    }
    const key = env[prov.secret];
    if (!key) {
      return json({ error: { message: 'Falta el secret ' + prov.secret + ' en el proxy. Cargalo en Settings → Variables and Secrets.' } }, 400);
    }

    let body;
    try { body = await request.text(); } catch (e) { return json({ error: { message: 'Body inválido.' } }, 400); }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
    };
    // OpenRouter pide (opcionalmente) cabeceras de identificación; las mandamos genéricas.
    if (ruta === 'openrouter') {
      headers['HTTP-Referer'] = 'https://mirror-el-origen.app';
      headers['X-Title'] = 'MIRROR El Origen';
    }

    try {
      const r = await fetch(prov.url, { method: 'POST', headers, body });
      const txt = await r.text();
      // Reenviamos la respuesta del proveedor tal cual (la plantilla espera formato OpenAI).
      return new Response(txt, { status: r.status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
    } catch (e) {
      return json({ error: { message: 'El proxy no pudo contactar al proveedor (' + ruta + '): ' + e.message } }, 502);
    }
  },
};
