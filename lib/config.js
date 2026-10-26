export function getGroqApiKey() {
  const key = process.env.GROQ_API_KEY?.trim();
  return key && key !== 'your_key_here' ? key : '';
}
