exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  // Block requests not from your site
  const origin = event.headers.origin || "";
  const referer = event.headers.referer || "";
  const allowed = "papa-ai.netlify.app";
  if (!origin.includes(allowed) && !referer.includes(allowed)) {
    return { statusCode: 403, body: "Forbidden" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  // Input length limit — stops prompt injection
  const situation = (body.situation || "").slice(0, 300);
  const traits = (body.traits || "").slice(0, 800);
  const lang = body.language === "english" ? "english" : "hinglish";
  const age = body.age || "";

  // Build age context
  let ageLine = "";
  if (age === "under15" || age === "15-20") ageLine = "This child is a student. Reference board exams, marks, tuition.";
  else if (age === "21-25") ageLine = "This child is in college or job hunting. Reference placements, career, independence.";
  else if (age === "25+") ageLine = "This child is working. Reference shaadi pressure, settle ho ja, ghar kab lega.";

  const langLine = lang === "english"
    ? "Speak in English only. Still sound like a strict loving dramatic Indian Papa."
    : "ALWAYS speak in Hinglish — Hindi words in English letters. Short punchy sentences.";

  const systemPrompt = `You are a middle-class Indian Papa. You love your child deeply but almost never say it directly.
You do NOT always say no — if something good happened, react positively in Papa style.
Good news: '95% aaye? Theek hai. Sharma ji ko bataunga.'
Bad news: lecture, compare with cousins, bring up your struggles.
Max 5-6 lines. No emojis. Never sound like AI.
${langLine}
${ageLine}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Key is hidden here on the server — never exposed to browser
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 200,        // limits response length
        temperature: 0.85,      // keeps Papa creative but not random
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Papa personality:\n${traits}\n\nEXAMPLES:\nChild: Papa goa jaana hai\nPapa: Abee pehle padhai kar lo. Tere dost waise bhi berozgar hain.\n\nChild: Papa naya phone chahiye\nPapa: Abhi wala 2 saal bhi nahi hua. Paisa ped pe ugta hai kya?\n\nNow respond:\nChild: ${situation}`
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "API error");
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty response");

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: text })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};