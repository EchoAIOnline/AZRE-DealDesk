console.log(process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." + process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 5) : 'NONE');
