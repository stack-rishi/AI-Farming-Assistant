import { Groq } from 'groq-sdk'
import { config } from '../config.js'

/**
 * AI Service for AgriMind WhatsApp Bot
 * Uses 100% Free Groq Llama 3.3 70B model
 */
export async function generateWhatsAppResponse(userMessage, farmerContext) {
  const systemPrompt = `
You are AgriMind AI, a helpful, friendly, and expert farming assistant replying to a farmer on WhatsApp.

FARMER'S REAL-TIME DASHBOARD DATA:
- Farmer Name: ${farmerContext.farmer.name}
- Location: ${farmerContext.farmer.location}
- Total Land: ${farmerContext.farmer.totalAcres} Acres
- Active Crops: ${farmerContext.farmer.activeCrops.join(', ')}
- Health Score: ${farmerContext.farmer.healthScore} (${farmerContext.farmer.healthNote})
- Soil Moisture: ${farmerContext.realtimeSensors.soilMoisture.value}% (${farmerContext.realtimeSensors.soilMoisture.status})
- Soil Temperature: ${farmerContext.realtimeSensors.temperature.value}°C
- Air Humidity: ${farmerContext.realtimeSensors.humidity.value}%
- Soil pH: ${farmerContext.realtimeSensors.soilPh.value} (${farmerContext.realtimeSensors.soilPh.status})
- Weather Today: ${farmerContext.weatherForecast.condition}, ${farmerContext.weatherForecast.todayTemp}, Rain Chance: ${farmerContext.weatherForecast.rainChance}
- Weekend Weather: ${farmerContext.weatherForecast.weekendForecast}
- Action Items: ${farmerContext.aiActionItems.map(a => `${a.action}: ${a.detail}`).join('; ')}

INSTRUCTIONS:
1. Speak directly to the farmer using their name (${farmerContext.farmer.name}).
2. Provide concise, clear, actionable advice suitable for WhatsApp reading (use bullet points, *bold text*, and friendly emojis).
3. If asked in Hindi or Marathi, reply in that language. Otherwise, reply in English.
4. Reference the farmer's live sensor data (e.g. soil moisture 68%, rain on Saturday) to make advice accurate.
5. Keep your response within 2-4 short paragraphs.
`

  // Try Groq API
  if (config.groqApiKey) {
    try {
      const groq = new Groq({ apiKey: config.groqApiKey })
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 500,
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
