import express from 'express'
import dotenv from 'dotenv'
import { config } from './config.js'
import { getFarmerDashboardContext } from './services/dashboardService.js'
import { generateWhatsAppResponse, analyzeImageWithAI } from './services/aiService.js'

dotenv.config()

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = config.port

// Health check endpoint (Render uses this to keep the service alive)
app.get('/', (req, res) => {
  res.json({ status: 'online', service: 'AgriMind WhatsApp Bot' })
})

// GET verification endpoint (Kapso may ping this)
app.get('/kapso-webhook', (req, res) => {
  console.log('✅ Webhook verification GET:', req.query)
  res.status(200).send(req.query['hub.challenge'] || req.query.challenge || 'OK')
})

/**
 * Kapso Webhook Receiver (POST /kapso-webhook)
 * Receives incoming WhatsApp messages (text & images) from Kapso and replies with Groq AI.
 */
app.post('/kapso-webhook', async (req, res) => {
  res.status(200).json({ status: 'received' })

  const body = req.body
  if (!body) return

  console.log('📩 RAW WEBHOOK BODY:', JSON.stringify(body, null, 2))

  // 1. Support Kapso non-debounced payload (body.message)
  if (body.message) {
    const messageObj = body.message
    const direction = messageObj?.kapso?.direction

    if (direction === 'inbound') {
      const senderPhone = messageObj?.from
      const messageId = messageObj?.id
      const msgType = messageObj?.type

      // Handle image messages
      if ((msgType === 'image' || messageObj?.image) && senderPhone) {
        const imageId = messageObj?.image?.id
        const mimeType = messageObj?.image?.mime_type || 'image/jpeg'
        const caption = messageObj?.image?.caption || ''
        await processImageMessage(senderPhone, imageId, mimeType, caption, messageId)
        return
      }

      // Handle text messages
      const incomingText = messageObj?.text?.body || messageObj?.kapso?.content
      if (incomingText && senderPhone) {
        await processMessage(senderPhone, incomingText, messageId)
        return
      }
    }
  }

  // 2. Support Kapso debounced data[] array format
  const dataItems = body.data || []
  for (const dataItem of dataItems) {
    const messageObj = dataItem?.message
    if (!messageObj) continue

    const direction = messageObj?.kapso?.direction
    if (direction && direction !== 'inbound') continue

    const senderPhone = messageObj?.from || dataItem?.conversation?.phone_number
    const messageId = messageObj?.id
    const msgType = messageObj?.type

    // Handle image messages
    if ((msgType === 'image' || messageObj?.image) && senderPhone) {
      const imageId = messageObj?.image?.id
      const mimeType = messageObj?.image?.mime_type || 'image/jpeg'
      const caption = messageObj?.image?.caption || ''
      await processImageMessage(senderPhone, imageId, mimeType, caption, messageId)
      continue
    }

    // Handle text messages
    const incomingText = messageObj?.text?.body || messageObj?.kapso?.content
    if (incomingText && senderPhone) {
      await processMessage(senderPhone, incomingText, messageId)
    }
  }

  // 3. Support Meta raw webhook format (body.entry[0].changes[0].value.messages[0])
  const entries = body.entry || []
  for (const entry of entries) {
    const changes = entry?.changes || []
    for (const change of changes) {
      const value = change?.value
      const messages = value?.messages || []
      for (const msg of messages) {
        const senderPhone = msg?.from
        const messageId = msg?.id
        const msgType = msg?.type

        // Handle image messages
        if (msgType === 'image' && senderPhone) {
          const imageId = msg?.image?.id
          const mimeType = msg?.image?.mime_type || 'image/jpeg'
          const caption = msg?.image?.caption || ''
          await processImageMessage(senderPhone, imageId, mimeType, caption, messageId)
          continue
        }

        // Handle text messages
        const incomingText = msg?.text?.body
        if (incomingText && senderPhone) {
          await processMessage(senderPhone, incomingText, messageId)
        }
      }
    }
  }
})

/**
 * Process a plain text WhatsApp message.
 */
async function processMessage(senderPhone, incomingText, messageId) {
  console.log(`\n🌾 [${new Date().toISOString()}] Text from [${senderPhone}]: "${incomingText}"`)

  try {
    if (messageId) markMessageAsRead(messageId)
    sendTypingIndicator(senderPhone)

    const farmerContext = await getFarmerDashboardContext(senderPhone)
    const replyText = await generateWhatsAppResponse(incomingText, farmerContext)
    console.log(`🤖 AI Reply:\n${replyText}\n`)

    await sendKapsoReply(senderPhone, replyText)
  } catch (error) {
    console.error('❌ Error processing text message:', error)
  }
}

/**
 * Process an image WhatsApp message.
 * Downloads the image from WhatsApp media servers via Kapso proxy, then runs Groq Vision analysis.
 */
async function processImageMessage(senderPhone, imageId, mimeType, caption, messageId) {
  console.log(`\n📸 [${new Date().toISOString()}] Image from [${senderPhone}] | ID: ${imageId} | Caption: "${caption}"`)

  try {
    if (messageId) markMessageAsRead(messageId)
    sendTypingIndicator(senderPhone)

    // Send an immediate acknowledgement so the farmer knows we're working
    await sendKapsoReply(senderPhone, `📸 Got your image! Analyzing it with AgriMind AI...

This takes a few seconds. Stand by! 🌾`)

    // Download image and convert to base64
    const imageBase64 = await downloadWhatsAppMedia(imageId)

    if (!imageBase64) {
      await sendKapsoReply(senderPhone, `⚠️ Sorry, I could not download your image. Please try sending it again, or describe your crop issue in text and I will help you!`)
      return
    }

    sendTypingIndicator(senderPhone)

    // Analyze image with Groq Vision AI
    const farmerContext = await getFarmerDashboardContext(senderPhone)
    const analysis = await analyzeImageWithAI(imageBase64, mimeType, farmerContext)

    console.log(`🔬 Vision Analysis:\n${analysis}\n`)
    await sendKapsoReply(senderPhone, analysis)
  } catch (error) {
    console.error('❌ Error processing image message:', error)
    await sendKapsoReply(senderPhone, `⚠️ Something went wrong while analyzing your image. Please try again or describe the crop issue in text!`)
  }
}

/**
 * Download WhatsApp media via Kapso proxy and return base64-encoded string.
 * Kapso proxies the Meta media download endpoint so no separate Meta token is needed.
 */
async function downloadWhatsAppMedia(mediaId) {
  const apiKey = config.kapsoApiKey
  const phoneNumberId = config.kapsoPhoneNumberId
  if (!apiKey || !mediaId) return null

  try {
    // Step 1: Get the media download URL
    const metaUrl = `https://api.kapso.ai/meta/whatsapp/v24.0/${mediaId}`
    const metaRes = await fetch(metaUrl, {
      headers: { 'X-API-Key': apiKey }
    })

    if (!metaRes.ok) {
      console.error(`❌ Failed to get media URL. Status: ${metaRes.status}`, await metaRes.text())
      return null
    }

    const mediaData = await metaRes.json()
    const downloadUrl = mediaData?.url

    if (!downloadUrl) {
      console.error('❌ No download URL in media metadata:', mediaData)
      return null
    }

    console.log(`📥 Downloading media from: ${downloadUrl}`)

    // Step 2: Download the actual image bytes via Kapso proxy
    const imgRes = await fetch(downloadUrl, {
      headers: { 'X-API-Key': apiKey }
    })

    if (!imgRes.ok) {
      console.error(`❌ Failed to download media. Status: ${imgRes.status}`)
      return null
    }

    // Convert to base64
    const arrayBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    console.log(`✅ Media downloaded and base64 encoded (${Math.round(base64.length / 1024)}KB)`)
    return base64
  } catch (err) {
    console.error('❌ Error downloading WhatsApp media:', err.message)
    return null
  }
}

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
  console.log(`🤖 AI: Groq llama-3.1-8b-instant + llama-4-scout Vision`)
})
