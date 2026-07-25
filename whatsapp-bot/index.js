import express from 'express'
import dotenv from 'dotenv'
import { config } from './config.js'
import { getFarmerDashboardContext } from './services/dashboardService.js'
import { generateWhatsAppResponse } from './services/aiService.js'

dotenv.config()

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = config.port

// Health check endpoint (Render uses this to keep the service alive)
app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'AgriMind WhatsApp Bot', number: '+1 202-852-8477' })
})

// GET verification endpoint (Kapso may ping this)
app.get('/kapso-webhook', (req, res) => {
  console.log('✅ Webhook verification GET:', req.query)
  res.status(200).send(req.query['hub.challenge'] || req.query.challenge || 'OK')
})

/**
 * Kapso Webhook Receiver (POST /kapso-webhook)
 * Receives incoming WhatsApp messages from Kapso and replies with Groq AI.
 */
app.post('/kapso-webhook', async (req, res) => {
  res.status(200).json({ status: 'received' })

  const body = req.body
  if (!body) return

  // Extract message from Kapso's webhook payload: body.data[0].message
  const dataItems = body.data || []

  for (const dataItem of dataItems) {
    const messageObj = dataItem?.message
    const conversation = dataItem?.conversation

    if (!messageObj) continue

    // Skip outbound messages (only process inbound)
    const direction = messageObj?.kapso?.direction
    if (direction && direction !== 'inbound') continue

    const incomingText =
      messageObj?.text?.body ||
      messageObj?.kapso?.content

    const senderPhone =
      messageObj?.from ||
      conversation?.phone_number

    const messageId = messageObj?.id

    if (!incomingText || !senderPhone) continue

    console.log(`\n🌾 [${new Date().toISOString()}] Message from [${senderPhone}]: "${incomingText}"`)

    try {
      // 1. Mark message as READ (Blue Ticks) & Show Typing Status in background (non-blocking)
      if (messageId) {
        markMessageAsRead(messageId)
      }
      sendTypingIndicator(senderPhone)

      // 2. Fetch farmer dashboard context & generate AI response
      const farmerContext = await getFarmerDashboardContext(senderPhone)
      const replyText = await generateWhatsAppResponse(incomingText, farmerContext)
      console.log(`🤖 AI Reply:\n${replyText}\n`)

      // 3. Send reply back via Kapso API
      await sendKapsoReply(senderPhone, replyText)
    } catch (error) {
      console.error('❌ Error processing message:', error)
    }
  }
})

/**
 * Mark incoming message as READ (Triggers double blue ticks on sender's phone)
 */
async function markMessageAsRead(messageId) {
  const apiKey = config.kapsoApiKey
  const phoneNumberId = config.kapsoPhoneNumberId
  if (!apiKey || !messageId) return

  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    })
    const txt = await res.text()
    console.log(`✓✓ Mark Read Status (${res.status}): ${txt}`)
  } catch (err) {
    console.error('❌ Error marking message read:', err.message)
  }
}

/**
 * Send Typing Indicator (Shows "typing..." under bot name while generating response)
 */
async function sendTypingIndicator(recipientPhone) {
  const apiKey = config.kapsoApiKey
  const phoneNumberId = config.kapsoPhoneNumberId
  if (!apiKey || !recipientPhone) return

  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'typing_indicator',
        typing_indicator: {
          type: 'text'
        }
      }),
    })
    const txt = await res.text()
    console.log(`💬 Typing Indicator Status (${res.status}): ${txt}`)
  } catch (err) {
    console.error('❌ Error sending typing indicator:', err.message)
  }
}

/**
 * Send WhatsApp reply via Kapso Official API
 * Endpoint: POST https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages
 * Auth: X-API-Key header
 */
async function sendKapsoReply(recipientPhone, text) {
  const apiKey = config.kapsoApiKey
  const phoneNumberId = config.kapsoPhoneNumberId

  if (!apiKey) {
    console.log(`⚠️ KAPSO_API_KEY missing. Reply not sent.`)
    return
  }

  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientPhone,
        type: 'text',
        text: { body: text },
      }),
    })

    if (response.ok) {
      const data = await response.json()
      console.log(`📤 Reply delivered to [${recipientPhone}]! ID: ${data.messages?.[0]?.id || 'sent'}`)
    } else {
      const errorText = await response.text()
      console.error(`❌ Kapso API Error (${response.status}):`, errorText)
    }
  } catch (err) {
    console.error('❌ Network error:', err.message)
  }
}

app.listen(PORT, () => {
  console.log(`\n🟢 AgriMind WhatsApp Bot running on http://localhost:${PORT}`)
  console.log(`📱 WhatsApp Number: +1 202-852-8477`)
  console.log(`🔗 Webhook: http://localhost:${PORT}/kapso-webhook`)
  console.log(`🤖 AI: Groq Llama 3.3 70B`)
})
