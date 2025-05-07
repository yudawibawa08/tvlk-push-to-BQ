// Dynamic holder
let lastPayload = null;
let isDataSent = false;

// Function to generate payload from AB Tasty data
function generatePayload() {
  const experiments = window.ABTasty?.results || {};
  console.log("🔥 AB Tasty Experiments:", experiments);

  let newPayload = null;

  // get visitor ID from localStorage tvlkByoid
  const byoid = localStorage.getItem("tvlkByoid");

  Object.keys(experiments).forEach((key) => {
    const exp = experiments[key];
    if (exp && exp.variationID && exp.variationName) {
      newPayload = {
        visitorId: byoid,
        campaignId: key,
        campaignName: exp.name,
        variantId: exp.variationID,
        variantName: exp.variationName,
        timestamp: new Date().toISOString(),
      };
    }
  });

  if (newPayload) {
    console.log("✅ New Payload:", JSON.stringify(newPayload, null, 2));
  }

  return newPayload;
}

// Function to send data via internal Traveloka endpoint
function sendData(payload) {
  if (!payload || isDataSent) {
    console.warn("⚠️ No valid data to send or already sent");
    return;
  }

  const origin = window.location.origin;
  const clientInterface = window.__NEXT_DATA__?.props?.pageProps?.rawAppContext?.clientInterface || "unknown";

  const bodyData = {
    clientInterface,
    fields: [],
    data: payload,
  };

  fetch(`${origin}/api/v1/tvlk/events?x-domain=data&x-route-prefix=en-id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyData),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("✅ Data sent via internal API:", JSON.stringify(payload, null, 2));
      isDataSent = true;
    })
    .catch((error) => {
      console.error("🚨 Error sending data:", error);
    });
}

// Function to handle data fetching and sending
function fetchData() {
  const payload = generatePayload();

  if (!payload) {
    console.log("⚠️ No payload generated. Skipping.");
    return;
  }

  if (JSON.stringify(lastPayload) !== JSON.stringify(payload)) {
    lastPayload = payload;
    isDataSent = false;
    sendData(payload);
  } else {
    console.log("⚠️ No changes in payload. Skipping update.");
  }
}

// Start the process
function startFetchingData() {
  fetchData();

  const retryInterval = setInterval(() => {
    if (!isDataSent) {
      console.log("🔄 Retrying to send data...");
      fetchData();
    } else {
      console.log("✅ Data sent successfully. Stopping retry.");
      clearInterval(retryInterval);
    }
  }, 60000); // 1 menit
}

startFetchingData();
