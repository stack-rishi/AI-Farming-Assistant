import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data', 'conversations')

// In-memory store: Map<phone, { messages: [], preferences: {} }>
const store = new Map()

const MAX_EXCHANGES = 6  // Keep last 6 user+assistant pairs (12 messages total)

// ── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * Load all existing conversation files from disk into memory on startup.
 */
function loadAllFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      return
    }
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
    for (const file of files) {
      try {
        const phone = file.replace('.json', '')
        const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
        store.set(phone, JSON.parse(raw))
      } catch {
        // Corrupt file — skip
      }
    }
    console.log(`📚 Loaded conversation history for ${store.size} user(s)`)
  } catch (err) {
    console.error('❌ Failed to load conversation data:', err.message)
  }
}

loadAllFromDisk()

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreate(phone) {
  if (!store.has(phone)) {
    store.set(phone, { messages: [], preferences: {} })
  }
  return store.get(phone)
}

function saveToDisk(phone) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(DATA_DIR, `${phone}.json`),
      JSON.stringify(store.get(phone), null, 2),
      'utf-8'
    )
  } catch (err) {
    console.error(`❌ Failed to save conversation for ${phone}:`, err.message)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the message history for a user as a Groq-compatible messages array.
 * Returns only the user/assistant messages (system prompt is added separately).
 */
export function getHistory(phone) {
  return getOrCreate(phone).messages
}

/**
 * Append a user message + bot reply to the conversation history and persist.
 * Automatically prunes to the last MAX_EXCHANGES exchanges.
 */
export function addExchange(phone, userMessage, botReply) {
  const session = getOrCreate(phone)

  session.messages.push(
    { role: 'user',      content: userMessage },
    { role: 'assistant', content: botReply    }
  )

  // Prune: keep only the last MAX_EXCHANGES * 2 messages
  const maxMessages = MAX_EXCHANGES * 2
  if (session.messages.length > maxMessages) {
    session.messages = session.messages.slice(-maxMessages)
  }

  saveToDisk(phone)
}

/**
 * Save a user preference (e.g. language, last crop discussed).
 */
export function setPreference(phone, key, value) {
  const session = getOrCreate(phone)
  session.preferences[key] = value
  saveToDisk(phone)
}

/**
 * Read a saved user preference.
 */
export function getPreference(phone, key) {
  return getOrCreate(phone).preferences[key] ?? null
}

/**
 * Detect if a message contains Hindi/Marathi characters and auto-save language preference.
 */
export function detectAndSaveLanguage(phone, text) {
  // Devanagari Unicode range: \u0900-\u097F
  const hasDevanagari = /[\u0900-\u097F]/.test(text)
  if (hasDevanagari) {
    setPreference(phone, 'language', 'hindi')
  } else {
    // Only set to English if no preference has been set yet
    const existing = getPreference(phone, 'language')
    if (!existing) setPreference(phone, 'language', 'english')
  }
  return hasDevanagari ? 'hindi' : (getPreference(phone, 'language') || 'english')
}
