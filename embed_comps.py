import openai
import json

openai.api_key = "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"  # use your actual key here

# Load the original vector store file
with open("vector_store_comps.json", "r") as f:
    comps = json.load(f)

texts = [c["text"] for c in comps]

# Batch embed
batch_size = 100
for i in range(0, len(texts), batch_size):
    batch = texts[i:i+batch_size]
    response = openai.Embedding.create(
        model="text-embedding-3-small",
        input=batch
    )
    for j, result in enumerate(response["data"]):
        comps[i + j]["embedding"] = result["embedding"]

# Save the embedded version
with open("vector_store_comps_embedded.json", "w") as f:
    json.dump(comps, f, indent=2)

print("✅ Embedding complete. Saved to vector_store_comps_embedded.json")
