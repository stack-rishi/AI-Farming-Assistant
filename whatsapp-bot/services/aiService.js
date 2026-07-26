import { Groq } from 'groq-sdk'
import { config } from '../config.js'

/**
 * AI Service for AgriMind WhatsApp Bot
 * Uses Groq hosted Llama models (currently llama-3.1-8b-instant).
 * Vision analysis uses meta-llama/llama-4-scout-17b-16e-instruct.
 */
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
        model: 'llama-3.1-8b-instant',  // 3-4x faster than 70B for WhatsApp
        temperature: 0.6,
        max_tokens: 200,                 // WhatsApp needs short replies
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
 * Analyze a crop/field image using Groq Vision (llama-4-scout).
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
CRITICAL RULE: Respond only in ENGLISH unless the farmer writes in another language first.

Farmer: ${name} | Location: ${location} | Active Crops: ${crops}
Soil Moisture: ${farmerContext.realtimeSensors.soilMoisture.value}% (${farmerContext.realtimeSensors.soilMoisture.status})
Temperature: ${farmerContext.realtimeSensors.temperature.value}°C | Humidity: ${farmerContext.realtimeSensors.humidity.value}%

Your job is to analyze the image the farmer sent and provide:
1. What you can see in the image (plant, leaf, field, pest, soil, etc.)
2. Any visible problems: disease, pest damage, nutrient deficiency, weed infestation, or water stress
3. Specific actionable recommendation: treatment, pesticide, fertilizer, or care step with dosage if possible
4. Urgency level: Low / Medium / High

Formatting Rules:
- DO NOT use markdown like ** or #.
- Use single * for *bold* sparingly.
- Keep response under 200 words, well-spaced for WhatsApp readability.
- If the image is not a crop or farming related image, politely say so and ask them to send a plant/field photo.`

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
              text: 'Please analyze this image from my farm and give me your expert diagnosis and recommendation.'
            }
          ]
        }
      ],
      model: 'qwen/qwen3.6-27b',     // Vision-capable model available on free Groq tier
      temperature: 0.4,
      max_tokens: 1024,   // Thinking model needs extra tokens for <think> block + answer
    })

    const rawContent = chatCompletion.choices[0]?.message?.content
    if (rawContent) {
      // Strip <think>...</think> reasoning blocks (Qwen thinking model outputs these)
      const cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
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
