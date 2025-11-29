// Root-level index.js
// This simply forwards execution to the backend

import("./server/index.js")
  .then(() => console.log("Backend loaded via root index.js"))
  .catch((err) => {
    console.error("Failed to load backend:", err);
    process.exit(1);
  });
