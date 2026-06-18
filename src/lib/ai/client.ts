import { GoogleGenerativeAI } from '@google/generative-ai'
import { promises } from 'node:dns'


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })



async function generateJSON(prompt : string) : promise<string> {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
}