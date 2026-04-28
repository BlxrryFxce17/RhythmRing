
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  try {
    // The SDK doesn't have a direct listModels on the main class in all versions, 
    // but we can try to fetch it if we know the endpoint, or just try a different model name.
    console.log('Trying gemini-1.5-flash-001...');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' });
    const result = await model.generateContent('hi');
    console.log('Success with gemini-1.5-flash-001');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listModels();
