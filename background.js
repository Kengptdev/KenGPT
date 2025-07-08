// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SEND_TO_OPENAI") {
    (async () => {
      try {
        const userMessages = request.messages;
        const userQuery = userMessages[userMessages.length - 1].content;

        console.log("📨 User query:", userQuery);

        // Load vector store with comps
        const vectorStoreURL = chrome.runtime.getURL("vector_store_comps.json");
        const vectorData = await (await fetch(vectorStoreURL)).json();

        // Get query embedding
        const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": "Bearer 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",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: userQuery
          })
        });

        const embedding = (await embedRes.json())?.data?.[0]?.embedding;
        if (!embedding) {
          console.error("❌ Failed to get query embedding");
          sendResponse({ success: false, error: "Embedding failed." });
          return;
        }

        const cosineSim = (a, b) => {
          const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
          const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
          const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
          return dot / (normA * normB);
        };

        const topChunks = vectorData
          .map(chunk => ({ ...chunk, score: cosineSim(chunk.embedding, embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        const contextText = topChunks.map(c => c.text).join("\n\n");

        const systemPrompt = `
You are Ken DeLeon. Use only the context below to answer the user's question.

Speak in a warm, confident, and conversational tone—like you're talking one-on-one with a client. Be natural and professional, never scripted or salesy.

Only mention contacting DeLeon Realty when the user explicitly brings up buying, selling, listing, or working with an agent. Do not mention outreach in general market insights or price breakdowns.

If the user asks how to take action (e.g., “Should I make an offer?” “What’s the next step?”), then you can suggest reaching out to DeLeon Realty and share your contact info:
Ken@DeLeonRealty.com or 650-543-8501.

Never recommend other agents. If the property is listed by another agent and the user brings them up, be respectful but do not recommend them. Politely suggest the user reach out to DeLeon Realty if they want your take.

Avoid canned language like “Let’s break it down.” Write like you're thinking aloud with the user in real time.

Guidance for Property Analysis
Focus exclusively on Silicon Valley and Peninsula neighborhoods.

Always:
- Start with a brief summary of the subject property
- Calculate and comment on price per square foot
- If comps are provided, compare the subject property to them based on:
  - Price per square foot
  - Lot size
  - Condition or level of renovation
  - Location advantages or street differences
- If any comps are better value than the subject property, say so clearly and explain why


Only suggest contacting DeLeon Realty if the user brings up transactions, next steps, or agent involvement.


KEEP RESPONSES BRIEF
Context:
${contextText}
        `.trim();

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": "Bearer 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",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              ...userMessages
            ],
            temperature: 0.35,
            stream: true
          })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullReply = "";
        let lastToken = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter(l => l.startsWith("data:"));

          for (const line of lines) {
            const json = line.replace("data: ", "").trim();
            if (json === "[DONE]") continue;

            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta && delta !== lastToken) {
                lastToken = delta;
                fullReply += delta;
                chrome.runtime.sendMessage({ type: "STREAM_UPDATE", content: delta });
              }
            } catch (err) {
              console.warn("⚠️ Stream parse error:", err);
            }
          }
        }

        sendResponse({ success: true, response: fullReply });
      } catch (err) {
        console.error("❌ Streaming failed:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true;
  }
});
