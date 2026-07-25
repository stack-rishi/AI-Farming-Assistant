import { Groq } from 'groq-sdk'
import { config } from '../config.js'

/**
 * AI Service for AgriMind WhatsApp Bot
 * Uses Groq hosted Llama models (currently llama-3.1-8b-instant).
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
