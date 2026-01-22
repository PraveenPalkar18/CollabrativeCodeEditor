const API_KEY = "AIzaSyAhJfmFFysZklwMiUyEvdLwqKLbfmE3pYA";
const MODEL = "gemini-flash-latest";

async function testGemini() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    console.log(`Testing Gemini API with ${MODEL}...`);

    try {
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello, can you hear me?" }] }]
            })
        });

        console.log("Status:", resp.status);
        const text = await resp.text();
        console.log("Response:", text);

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testGemini();
