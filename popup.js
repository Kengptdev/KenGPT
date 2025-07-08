// popup.js

const messages = [];
let hasSentInitialMessage = false;

function renderMessage(content, role, replaceLast = false) {
  const chatWindow = document.getElementById("chat-window");
  if (replaceLast && chatWindow.lastChild) {
    chatWindow.removeChild(chatWindow.lastChild);
  }

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${role}`;
  msgDiv.innerHTML = content;
  chatWindow.appendChild(msgDiv);

  if (role === "user" || (role === "assistant" && content.length < 400)) {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

function sendToOpenAI(callback) {
  chrome.runtime.sendMessage({ type: "SEND_TO_OPENAI", messages }, res => {
    if (res?.success) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        last.content = res.response;
        renderMessage(res.response, "assistant", true);
      } else {
        messages.push({ role: "assistant", content: res.response });
        renderMessage(res.response, "assistant");
      }
      callback(res.response);
    } else {
      renderMessage("Sorry, something went wrong.", "assistant", true);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("followup-input");
  const sendBtn = document.getElementById("send-followup");

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }, () => {
      chrome.tabs.sendMessage(tab.id, { action: "getPropertyDetails" }, (response) => {
        if (!response) {
          renderMessage("Could not retrieve property info.", "assistant");
          return;
        }

        if (!hasSentInitialMessage) {
          const maxFullTextLength = 1500;

      

          const prompt = `Here is a property I'm evaluating:

Address: ${response.address}
Price: ${response.price}
Details: ${response.beds}
Lot Size: ${response.lotSize}



${response.fullText?.slice(0, maxFullTextLength) || ""}`.trim();

          messages.push({ role: "user", content: prompt });
          sendToOpenAI(() => {});
          hasSentInitialMessage = true;
        }
      });
    });
  });

  sendBtn.addEventListener("click", () => {
    const userText = input.value.trim();
    if (!userText) return;
    input.value = "";
    messages.push({ role: "user", content: userText });
    renderMessage(userText, "user");
    sendToOpenAI(() => {});
  });

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("send-followup").click();
    }
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STREAM_UPDATE") {
    let last = messages[messages.length - 1];
    if (last?.role === "assistant" && last.content === "Loading Ken’s insight...") {
      messages.pop();
      const newMsg = { role: "assistant", content: msg.content };
      messages.push(newMsg);
      renderMessage(newMsg.content, "assistant");
      return;
    }

    if (last?.role === "assistant") {
      last.content += msg.content;
      renderMessage(last.content, "assistant", true);
    } else {
      const newMsg = { role: "assistant", content: msg.content };
      messages.push(newMsg);
      renderMessage(newMsg.content, "assistant");
    }
  }
});