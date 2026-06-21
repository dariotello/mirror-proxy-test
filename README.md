# MIRROR «El Origen» — Proxy

La **caja fuerte** de tu MIRROR. Es un Cloudflare Worker que recibe los pedidos de tu entidad, les agrega **tu** clave de IA del lado del servidor (tu clave nunca viaja al navegador) y los reenvía al proveedor real. Una sola puerta para 7 motores de IA, búsqueda web y transcripción de audio.

Una idea original de **Darío Alejandro Tello**.

---

## 🚀 Crealo en 2 clics

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dariotello/mirror-proxy)

Al tocar el botón, Cloudflare:
1. **Clona este repo** en tu cuenta de GitHub (queda tuyo para seguir tocándolo).
2. **Te pide tu clave de Groq** en una página de setup y la guarda **encriptada** como secret de tu Worker (no se sube a ningún lado).
3. **Despliega** el Worker y te da una dirección `…workers.dev`: **esa es tu `PROXY_URL`**.

> Necesitás una cuenta gratuita de Cloudflare y una de GitHub. Si no tenés tu clave de Groq todavía, generala gratis en **[console.groq.com/keys](https://console.groq.com/keys)** antes de empezar.

Cuando termine, **copiá la URL del Worker** y pegala en tu MIRROR (en el constructor, cuando te pida el `PROXY_URL`). Listo: tu entidad ya tiene su caja fuerte.

---

## 🔌 Qué resuelve cada ruta

Tu MIRROR le habla a este proxy por distintas rutas; vos no tenés que tocar nada de esto, pero acá está por si te interesa:

| Ruta | Para qué | Secret que usa |
|------|----------|----------------|
| `/groq` | Chat (modelos gratis y rápidos) | `GROQ_KEY` |
| `/cerebras` | Chat (alternativa gratis) | `CEREBRAS_KEY` |
| `/openai` | Chat (GPT) | `OPENAI_KEY` |
| `/openrouter` | Chat (catálogo enorme) | `OPENROUTER_KEY` |
| `/deepseek` | Chat | `DEEPSEEK_KEY` |
| `/together` | Chat | `TOGETHER_KEY` |
| `/mistral` | Chat | `MISTRAL_KEY` |
| `/tavily` | Búsqueda web | `TAVILY_KEY` |
| `/transcribe` | Audio/video → texto (Whisper) | `GROQ_KEY` |

---

## ➕ Sumar más motores (opcional, cuando quieras)

El botón te pide **solo `GROQ_KEY`** para que el arranque sea de un campo. Si más adelante querés usar otro motor o la búsqueda web, agregá su secret a mano:

1. Andá a **Cloudflare → Workers & Pages → tu proxy → Settings → Variables and Secrets**.
2. **Add → Secret**, con el nombre exacto de la tabla de arriba (ej. `TAVILY_KEY`) y tu clave como valor. **Encrypt**.
3. Guardá. No hace falta re-deployar: el Worker lo toma solo.

Cargá **solo los motores que vayas a usar**. Si tu MIRROR pide una ruta cuyo secret no cargaste, el proxy te avisa con un mensaje claro en vez de fallar en silencio.

Claves gratuitas útiles: Groq ([console.groq.com](https://console.groq.com/keys)), Cerebras ([cloud.cerebras.ai](https://cloud.cerebras.ai/)), Tavily ([tavily.com](https://tavily.com/)).

---

## 🔒 Seguridad

- Tus claves viven como **secrets cifrados** de Cloudflare. Este repo **no contiene ninguna clave**.
- `.dev.vars.example` solo lista **nombres** de secrets para guiar el setup; nunca pongas claves reales ahí.
- El `.gitignore` evita que subas por error un `.dev.vars` con claves.
- La cabecera CORS está abierta (`*`) para que tu MIRROR (en tu dominio) pueda hablarle. Si querés cerrarla a tu dominio, editá `corsHeaders()` en `mirror-proxy.js`.

---

## 📄 Licencia

Apache 2.0 (ver `LICENSE`). La marca y el nombre **"MIRROR — El Origen"** son autoría de Darío Alejandro Tello (ver `NOTICE`).
