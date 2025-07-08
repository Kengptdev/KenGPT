function scrapePropertyDetails() {
  const address =
    document.querySelector('h1[data-testid="home-details-summary-headline"]')?.textContent ||
    document.querySelector('h1')?.textContent || "";

  const price =
    document.querySelector('[data-testid="price"]')?.textContent ||
    document.querySelector('.ds-summary-row .ds-value')?.textContent || "";

  let beds = "";
  const bedElems = document.querySelectorAll('[data-testid="bed-bath-item"] span');
  if (bedElems.length) {
    beds = Array.from(bedElems)
      .map(el => el.textContent.trim())
      .filter(Boolean)
      .join(" | ");
  }

  let lotSize = "";
  const lotItem = Array.from(document.querySelectorAll('[data-testid="detail-item"]')).find(el =>
    el.textContent.toLowerCase().includes("lot size")
  );
  if (lotItem) {
    const match = lotItem.textContent.match(/Lot size\s*(.*)/i);
    lotSize = match ? match[1].trim() : "";
  }

  const description =
    document.querySelector('[data-testid="home-description-text"]')?.textContent.trim() || "";

  const fullText = document.body.innerText?.slice(0, 1500) || "";

  // ✅ Try to extract listing agent and brokerage
  let listingAgent = "";
  const agentTextBlock = Array.from(document.querySelectorAll("*")).find(el =>
    el.innerText?.match(/Listed by:/i)
  );

  if (agentTextBlock) {
    const rawText = agentTextBlock.innerText;
    const match = rawText.match(/Listed by:\s*(.*?)(Source:|View virtual|Listing updated:|$)/i);
    if (match) {
      listingAgent = match[1].trim().replace(/\n/g, ' ');
    }
  }

  console.log("📇 Listing agent:", listingAgent);

  return {
    address: address.trim(),
    price: price.trim(),
    beds: beds.trim(),
    lotSize: lotSize,
    description: description,
    fullText: fullText,
    listingAgent: listingAgent
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getPropertyDetails") {
    const data = scrapePropertyDetails();
    sendResponse(data);
  }
});
