const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  console.log('Testing Gemini API connectivity...');
  const start = Date.now();
  try {
    const result = await model.generateContent('Say "API is working"');
    const end = Date.now();
    console.log('Response:', result.response.text());
    console.log(`Time taken: ${end - start}ms`);
  } catch (error) {
    console.error('Gemini API Error:', error.message);
  }
}

testGemini();
