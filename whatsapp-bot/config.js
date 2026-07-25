import dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: process.env.PORT || 3001,
  groqApiKey: process.env.GROQ_API_KEY || '',
  kapsoApiKey: process.env.KAPSO_API_KEY || '',
  kapsoPhoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID || '',
}
