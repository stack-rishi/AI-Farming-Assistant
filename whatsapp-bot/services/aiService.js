import { Groq } from 'groq-sdk'
import { config } from '../config.js'

/**
 * AI Service for AgriMind WhatsApp Bot
 * Uses 100% Free Groq Llama 3.3 70B model
 */
export async function generateWhatsAppResponse(userMessage, farmerContext) {
  const systemPrompt = `You are AgriMind AI, a WhatsApp farming assistant. Be concise, friendly, use emojis and *bold*.
Farmer: ${farmerContext.farmer.name} | ${farmerContext.farmer.location} | Crops: ${farmerContext.farmer.activeCrops.join(', ')}
Sensors: Soil Moisture ${farmerContext.realtimeSensors.soilMoisture.value}% (${farmerContext.realtimeSensors.soilMoisture.status}), Temp ${farmerContext.realtimeSensors.temperature.value}°C, pH ${farmerContext.realtimeSensors.soilPh.value}, Humidity ${farmerContext.realtimeSensors.humidity.value}%
Weather: ${farmerContext.weatherForecast.condition}, ${farmerContext.weatherForecast.todayTemp}, Rain ${farmerContext.weatherForecast.rainChance}. ${farmerContext.weatherForecast.weekendForecast}
Actions due: ${farmerContext.aiActionItems.map(a => a.action).join(', ')}
Rules:
- DEFAULT LANGUAGE IS ENGLISH. Only reply in Hinglish, Hindi, or Marathi if the user explicitly speaks in that language first.
- DO NOT use markdown like ** or #. WhatsApp does not support double asterisks.
- Use a single * for *bold* text sparingly.
- Separate points with a clear blank line for readability.
- Max 3 short, well-spaced bullet points.`
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
      return chatCompletion.choices[0]?.message?.content
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
    return `🌾 *Namaste ${name}!*\n\n*Soil Moisture:* 68% (Optimal)\n*Rain Forecast:* 70% chance of rain this Saturday.\n\n*Recommendation:*\nNo need to irrigate today! Your soil moisture is in the optimal range. Save water and wait until Sunday after evaluating weekend rainfall.`
  }

  if (query.includes('fertilizer') || query.includes('urea') || query.includes('खाद') || query.includes('खत')) {
    return `🌱 *Namaste ${name}!*\n\n*Crop:* Wheat (Tillering Stage)\n*Recommendation:* Apply Urea fertilizer top-dressing within the next 2 days to encourage tillering and strong root growth.`
  }

  if (query.includes('weather') || query.includes('rain') || query.includes('मौसम') || query.includes('पाऊस')) {
    return `🌤️ *Namaste ${name}!*\n\n*Today's Weather in ${farmerContext.farmer.location}:*\n- Temp: 28°C (Partly Cloudy)\n- Rain Chance: 20%\n- *Weekend Outlook:* High chance of rain (70%) on Saturday!`
  }

  return `👨‍🌾 *Namaste ${name}!*\n\nHere is your live farm summary from *AgriMind*:\n- *Overall Health:* ${farmerContext.farmer.healthScore}\n- *Soil Moisture:* ${farmerContext.realtimeSensors.soilMoisture.value}% (Optimal)\n- *Next Action:* Apply Urea fertilizer top-dressing in 2 days.\n\nAsk me about *irrigation*, *fertilizer*, *pest risk*, or *weather forecast* anytime! 📲`
}
