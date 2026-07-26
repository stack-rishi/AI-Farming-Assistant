import { Groq } from 'groq-sdk'
import { config } from '../config.js'

/**
 * AI Service for AgriMind WhatsApp Bot
 * Text:    llama-3.3-70b-versatile  (best free tier text model)
 * Vision:  qwen/qwen3.6-27b         (vision-capable, reasoning_effort: none)
 * Speech:  whisper-large-v3-turbo   (fastest Whisper on Groq free tier)
 */

/**
 * Transcribe a voice note using Groq Whisper.
 * @param {Buffer} audioBuffer - Raw audio bytes
 * @param {string} mimeType    - MIME type e.g. 'audio/ogg; codecs=opus'
 * @returns {Promise<string|null>} Transcribed text or null on failure
 */
export async function transcribeAudio(audioBuffer, mimeType) {
  if (!config.groqApiKey) return null

  try {
    const groq = new Groq({ apiKey: config.groqApiKey })

    // Groq SDK needs a File object — derive a sensible filename from mimeType
    const ext = mimeType.includes('ogg') ? 'ogg'
      : mimeType.includes('mp4') ? 'mp4'
      : mimeType.includes('mpeg') ? 'mp3'
      : mimeType.includes('webm') ? 'webm'
      : 'ogg'
    const audioFile = new File([audioBuffer], `voice_note.${ext}`, { type: mimeType })

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',  // Fastest Whisper on Groq free tier
      language: 'en',                    // Auto-detect works too — set to 'en' for speed
      response_format: 'text',
    })

    const text = typeof transcription === 'string'
      ? transcription.trim()
      : transcription?.text?.trim()

    console.log(`🎙️ Whisper transcript: "${text}"`)
    return text || null
  } catch (error) {
    console.error('❌ Error transcribing audio with Whisper:', error.message)
    return null
  }
}


export async function generateWhatsAppResponse(userMessage, farmerContext) {
  const systemPrompt = `You are AgriMind AI, a WhatsApp farming assistant.
CRITICAL RULE: You MUST speak entirely in ENGLISH by default. Do NOT use Hindi, Hinglish, or Marathi unless the user explicitly asks a question in those languages first.

Farmer: ${farmerContext.farmer.name} | ${farmerContext.farmer.location} | Crops: ${farmerContext.farmer.activeCrops.join(', ')}
Sensors: Soil Moisture ${farmerContext.realtimeSensors.soilMoisture.value}% (${farmerContext.realtimeSensors.soilMoisture.status}), Temp ${farmerContext.realtimeSensors.temperature.value}°C, pH ${farmerContext.realtimeSensors.soilPh.value}, Humidity ${farmerContext.realtimeSensors.humidity.value}%
Weather: ${farmerContext.weatherForecast.condition}, ${farmerContext.weatherForecast.todayTemp}, Rain ${farmerContext.weatherForecast.rainChance}. ${farmerContext.weatherForecast.weekendForecast}
Actions due: ${farmerContext.aiActionItems.map(a => a.action).join(', ')}

Formatting Rules:
- DO NOT use markdown like ** or #. WhatsApp does not support double asterisks.
- Use a single * for *bold* text sparingly.
- Separate points with a clear blank line for readability.
- Max 3 short, well-spaced bullet points.`

  // Try Groq API
  if (config.groqApiKey) {
    try {
      const groq = new Groq({ apiKey: config.groqApiKey })
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        model: 'llama-3.3-70b-versatile',  // Best quality model on free Groq tier (70B params)
        temperature: 0.6,
        max_tokens: 200,
      })
      const content = chatCompletion.choices[0]?.message?.content
      if (content) return content
    } catch (error) {
      console.error('Error calling Groq API:', error.message)
    }
  }

  // Fallback rules engine
  return generateFallbackResponse(userMessage, farmerContext)
}

/**
 * Analyze a crop/field image using Groq Vision (qwen/qwen3.6-27b).
 * Uses reasoning_effort: 'none' to suppress the thinking model's internal monologue.
 * @param {string} imageBase64 - base64-encoded image string
 * @param {string} mimeType    - MIME type e.g. 'image/jpeg'
 * @param {object} farmerContext - live farmer dashboard context
 * @returns {Promise<string>} AI analysis reply
 */
export async function analyzeImageWithAI(imageBase64, mimeType, farmerContext) {
  if (!config.groqApiKey) {
    return `⚠️ Image analysis is currently unavailable. Please send a text description of your crop issue and I will help you!`
  }

  const name = farmerContext.farmer.name
  const crops = farmerContext.farmer.activeCrops.join(', ')
  const location = farmerContext.farmer.location

  const systemPrompt = `You are AgriMind AI, an expert agricultural plant pathologist and crop advisor.
CRITICAL RULE: Respond ONLY in ENGLISH unless the farmer writes in another language.
CRITICAL RULE: Output ONLY the final WhatsApp message. No thinking, no planning, no draft sections, no numbered internal notes. Start directly with your greeting to the farmer.

Farmer: ${name} | Location: ${location} | Active Crops: ${crops}
Soil Moisture: ${farmerContext.realtimeSensors.soilMoisture.value}% (${farmerContext.realtimeSensors.soilMoisture.status})
Temperature: ${farmerContext.realtimeSensors.temperature.value}°C | Humidity: ${farmerContext.realtimeSensors.humidity.value}%

Analyze the image and write a WhatsApp message covering:
- What you see (crop/plant/condition)
- The diagnosis (disease, pest, stress, deficiency)
- One specific action with dosage/treatment
- Urgency: Low / Medium / High

Formatting:
- DO NOT use ** or #. WhatsApp does not support them.
- Use single *word* for bold sparingly.
- Keep it under 160 words, well-spaced.`

  try {
    const groq = new Groq({ apiKey: config.groqApiKey })

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
              }
            },
            {
              type: 'text',
              text: 'Analyze this farm image. Reply with only the final WhatsApp message — no thinking or drafts.'
            }
          ]
        }
      ],
      model: 'qwen/qwen3.6-27b',
      temperature: 0.3,
      max_tokens: 512,
      reasoning_effort: 'none',  // Disable Qwen thinking mode — output final answer only
    })

    const rawContent = chatCompletion.choices[0]?.message?.content
    if (rawContent) {
      // Safety net: strip any leftover <think> blocks (closed or unclosed)
      const cleaned = rawContent
        .replace(/<think>[\s\S]*?<\/think>/gi, '')  // Remove complete think blocks
        .replace(/<think>[\s\S]*/gi, '')              // Remove unclosed think blocks
        .trim()
      return cleaned || rawContent.trim()
    }

    return `🌾 I received your image, ${name}, but could not generate an analysis right now. Please try again or describe the problem in text.`
  } catch (error) {
    console.error('❌ Error in Groq Vision API:', error.message)
    return `🌾 *Image Analysis Failed*

Sorry ${name}, I was unable to analyze your image at this moment.

Please describe your crop issue in text and I will help you right away! 🌱`
  }
}

function generateFallbackResponse(userMessage, farmerContext) {
  const query = userMessage.toLowerCase()
  const name = farmerContext.farmer.name

  if (query.includes('water') || query.includes('irrigate') || query.includes('moisture') || query.includes('सिंचाई') || query.includes('पानी')) {
    return `🌾 *Namaste ${name}!*\n\n*Soil Moisture:* ${farmerContext.realtimeSensors.soilMoisture.value}% (${farmerContext.realtimeSensors.soilMoisture.status})\n*Weather:* ${farmerContext.weatherForecast.condition}, Rain ${farmerContext.weatherForecast.rainChance}. ${farmerContext.weatherForecast.weekendForecast}\n\n*Recommendation:*\nBased on current soil moisture, irrigation may not be needed today. Re-check after the weekend rainfall forecast.`
  }

  if (query.includes('fertilizer') || query.includes('urea') || query.includes('खाद') || query.includes('खत')) {
    return `🌱 *Namaste ${name}!*\n\n*Crop:* Wheat (Tillering Stage)\n*Recommendation:* Apply Urea fertilizer top-dressing within the next 2 days to encourage tillering and strong root growth.`
  }

  if (query.includes('weather') || query.includes('rain') || query.includes('मौसम') || query.includes('पाऊस')) {
    return `🌤️ *Namaste ${name}!*\n\n*Today's Weather in ${farmerContext.farmer.location}:*\n- Temp: ${farmerContext.weatherForecast.todayTemp} (${farmerContext.weatherForecast.condition})\n- Humidity: ${farmerContext.realtimeSensors.humidity.value}%\n- Rain Chance: ${farmerContext.weatherForecast.rainChance}\n- *Weekend Outlook:* ${farmerContext.weatherForecast.weekendForecast}`
  }

  return `👨‍🌾 *Namaste ${name}!*\n\nHere is your live farm summary from *AgriMind*:\n- *Overall Health:* ${farmerContext.farmer.healthScore}\n- *Soil Moisture:* ${farmerContext.realtimeSensors.soilMoisture.value}% (${farmerContext.realtimeSensors.soilMoisture.status})\n- *Next Action:* ${farmerContext.aiActionItems?.[0]?.action || 'No immediate actions'}.\n\nAsk me about *irrigation*, *fertilizer*, *pest risk*, or *weather forecast* anytime! 📲`
}
