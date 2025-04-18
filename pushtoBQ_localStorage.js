// Define property URL
const projectId = "xxxx"; //put your project Id here
const datasetId = "xxxx"; //put your dataset id here
const tableId = "xxxx"; //put your table id here

// Define the API endpoint
const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${datasetId}/tables/${tableId}/insertAll`;

// OAuth Credentials
const clientId = "xxxx"; //put your client id here
const clientSecret = "xxxx"; //put your client secret here
const refreshToken = "xxxx"; //put your refresh token here

// Dynamic token holder
let authToken = "";
let lastPayload = null;
let isDataSent = false;

// Function to get dynamic token using refresh token
function getAccessToken() {
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const data = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  return fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: data,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to refresh token. Status: ${response.status}`);
      }
      return response.json();
    })
    .then((result) => {
      console.log("✅ New Access Token:", result.access_token);
      authToken = result.access_token;
      return authToken;
    })
    .catch((error) => {
      console.error("🚨 Error refreshing token:", error);
      return null;
    });
}

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
        rows: [
          {
            json: {
              visitorId: byoid,
              campaignId: key,
              campaignName: exp.name,
              variantId: exp.variationID,
              variantName: exp.variationName,
              timestamp: new Date().toISOString(),
            },
          },
        ],
      };
    }
  });

  if (newPayload) {
    console.log("✅ New Payload:", JSON.stringify(newPayload, null, 2));
  }

  return newPayload;
}

// Function to send data to BigQuery
function sendData(payload) {
  if (!payload || isDataSent) {
    console.warn("⚠️ No valid data to send or already sent");
    return;
  }

  fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 401) {
          console.warn("🚨 Token expired. Refreshing token...");
          return getAccessToken().then(() => sendData(payload));
        } else {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
      }
      return response.json();
    })
    .then((data) => {
      console.log("✅ Data sent to BigQuery:", JSON.stringify(payload, null, 2));
      isDataSent = true;
    })
    .catch((error) => {
      console.error("🚨 Error sending data:", error);
    });
}

// Function to handle token refresh and data sending
function fetchData() {
  const payload = generatePayload();

  if (!payload) {
    console.log("⚠️ No payload generated. Skipping.");
    return;
  }

  if (JSON.stringify(lastPayload) !== JSON.stringify(payload)) {
    lastPayload = payload;
    isDataSent = false;

    if (!authToken) {
      console.log("🔄 Token expired or not set. Refreshing token...");
      getAccessToken().then((token) => {
        if (token) {
          sendData(payload);
        }
      });
    } else {
      sendData(payload);
    }
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