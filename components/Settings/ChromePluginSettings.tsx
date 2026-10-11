import React, { useState } from 'react';
import { Download, Copy, CheckCircle, Chrome, Code, FileJson, FileCode, Info, Loader2 } from 'lucide-react';
import { GOOGLE_SCRIPT_URL } from '../../constants';
import JSZip from 'jszip';

export const ChromePluginSettings: React.FC = () => {
    const [activeFile, setActiveFile] = useState<'manifest' | 'popup_html' | 'popup_js' | 'content_js'>('manifest');
    const [copied, setCopied] = useState(false);
    const [isZipping, setIsZipping] = useState(false);

    // --- EXTENSION CODE GENERATION ---
    
    const manifestCode = `{
  "manifest_version": 3,
  "name": "AZRE DealDesk Scraper",
  "version": "1.9",
  "description": "Scrape Zillow listings directly into AZRE DealDesk.",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": [
    "https://*.zillow.com/*", 
    "https://script.google.com/*",
    "${localStorage.getItem('custom_supabase_url') || ''}/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon.png",
      "48": "icon.png",
      "128": "icon.png"
    }
  },
  "content_scripts": [
    {
      "matches": ["https://*.zillow.com/homedetails/*"],
      "js": ["content.js"]
    }
  ]
}`;

    const popupHtmlCode = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { width: 320px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 16px; background-color: #0f172a; color: white; }
    h2 { margin-top: 0; font-size: 18px; color: #3b82f6; }
    .btn { background-color: #3b82f6; color: white; border: none; padding: 10px; width: 100%; border-radius: 6px; cursor: pointer; font-weight: bold; margin-top: 10px; transition: background 0.2s; }
    .btn:hover { background-color: #2563eb; }
    .btn:disabled { background-color: #475569; cursor: not-allowed; }
    input { width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #334155; background: #1e293b; color: white; box-sizing: border-box; outline: none; }
    input:focus { border-color: #3b82f6; }
    #status { margin-top: 10px; font-size: 12px; color: #94a3b8; text-align: center; min-height: 16px; white-space: pre-wrap; }
    .hidden { display: none !important; }
    .row { display: flex; gap: 5px; align-items: center; margin-bottom: 5px; }
    label { font-size: 11px; color: #cbd5e1; display: block; margin-bottom: 4px; }
    .user-badge { background: #1e293b; padding: 8px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #334155; }
    .progress-bar { width: 100%; height: 4px; background: #334155; border-radius: 2px; margin-top: 8px; overflow: hidden; display: none; }
    .progress-fill { height: 100%; background: #4ade80; width: 0%; transition: width 0.3s ease; }
  </style>
</head>
<body>
  <h2>AZRE DealDesk</h2>
  
  <div id="loginSection">
    <form id="loginForm">
      <label>Email</label>
      <input type="email" id="email" placeholder="user@asharizakargroup.com" required>
      <label>Password</label>
      <input type="password" id="password" placeholder="••••••••" required>
      <button type="submit" id="loginBtn" class="btn">Login</button>
    </form>
  </div>

  <div id="scrapeSection" class="hidden">
    <div class="user-badge">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">Logged in as:</p>
        <p style="font-size: 14px; font-weight: bold; color: #4ade80; margin: 2px 0 0 0;" id="userDisplay"></p>
    </div>
    <button id="scrapeBtn" class="btn">Scrape & Add Property</button>
    <div id="progressBar" class="progress-bar"><div id="progressFill" class="progress-fill"></div></div>
    <button id="logoutBtn" class="btn" style="background-color: #334155; margin-top: 8px;">Logout</button>
  </div>

  <div id="status"></div>
  <script src="popup.js"></script>
</body>
</html>`;

    const popupJsCode = `
const SUPABASE_URL = "${localStorage.getItem('custom_supabase_url') || ''}";
const SUPABASE_KEY = "${localStorage.getItem('custom_supabase_key') || ''}";
const GOOGLE_SCRIPT_URL = "${GOOGLE_SCRIPT_URL}";

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const token = await chrome.storage.local.get(['access_token', 'user_email', 'user_name']);
        if (token.access_token) {
            showScrapeUI(token.user_name || token.user_email);
        }
    } catch (e) {
        console.error("Storage error:", e);
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('scrapeBtn').addEventListener('click', handleScrape);
});

function showScrapeUI(name) {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('scrapeSection').classList.remove('hidden');
    document.getElementById('userDisplay').textContent = name;
}

async function handleLogin(e) {
    e.preventDefault(); 
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const status = document.getElementById('status');
    const btn = document.getElementById('loginBtn');

    status.textContent = "Logging in...";
    btn.disabled = true;
    
    try {
        const response = await fetch(\`\${SUPABASE_URL}/auth/v1/token?grant_type=password\`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            let userName = email.split('@')[0];
            try {
                const userRes = await fetch(\`\${SUPABASE_URL}/rest/v1/Users?email=eq.\${encodeURIComponent(email)}&select=name\`, {
                     headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + data.access_token }
                });
                if (userRes.ok) {
                    const userData = await userRes.json();
                    if (userData && userData.length > 0 && userData[0].name) userName = userData[0].name;
                }
            } catch(err) { console.warn("Profile fetch error", err); }

            await chrome.storage.local.set({ 
                access_token: data.access_token,
                user_email: data.user.email,
                user_name: userName
            });
            showScrapeUI(userName);
            status.textContent = "";
        } else {
            status.textContent = "Error: " + (data.error_description || data.msg || "Login failed");
            status.style.color = "#f87171";
        }
    } catch (e) {
        status.textContent = "Network error";
        status.style.color = "#f87171";
    } finally {
        btn.disabled = false;
    }
}

async function handleLogout() {
    await chrome.storage.local.clear();
    location.reload();
}

async function urlToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Image fetch failed", e);
    return null;
  }
}

async function handleScrape() {
    const status = document.getElementById('status');
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const scrapeBtn = document.getElementById('scrapeBtn');
    
    status.textContent = "Scraping page data...";
    status.style.color = "#94a3b8";
    scrapeBtn.disabled = true;
    progressBar.style.display = 'none';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) { status.textContent = "No active tab."; scrapeBtn.disabled = false; return; }

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: scrapeZillowData,
    }, async (results) => {
        if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) {
             status.textContent = "Failed to scrape. Navigate to a Zillow listing.";
             status.style.color = "#f87171";
             scrapeBtn.disabled = false;
             return;
        }

        const data = results[0].result;
        const stored = await chrome.storage.local.get(['user_name']);

        // Generate timestamp matching app format: "Feb 18 8:40 PM"
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const logTimestamp = \`\${dateStr} \${timeStr}\`;
        
        // Metadata
        data.acquisitionManager = stored.user_name || 'Extension User';
        data.createdAt = new Date().toISOString();
        data.offerDecision = 'No Offer Made Yet';
        data.logs = [\`\${logTimestamp}: Imported via Chrome Extension\`];
        data.id = Math.random().toString(36).substr(2, 9);
        
        // Capture original photo URLs before saving to DB
        const originalPhotos = data.photos || [];
        // Save initially with empty photos or originals (using originals as fallback)
        data.photos = []; 
        
        status.textContent = "Saving property to DealDesk...";
        
        try {
            const res = await fetch(\`\${SUPABASE_URL}/rest/v1/Deals\`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                // DEAL SAVED. START PHOTO UPLOAD.
                status.textContent = "Property saved! Starting photo upload...";
                status.style.color = "#fbbf24"; // Yellow/Orange
                
                const driveUrls = [];
                // Limit to 15 photos to avoid timeouts/limits
                const photosToUpload = originalPhotos.slice(0, 15);
                
                if (photosToUpload.length > 0) {
                    progressBar.style.display = 'block';
                    
                    for (let i = 0; i < photosToUpload.length; i++) {
                        const originalUrl = photosToUpload[i];
                        status.textContent = \`Uploading photo \${i+1} of \${photosToUpload.length} to Drive...\`;
                        progressFill.style.width = \`\${Math.round(((i) / photosToUpload.length) * 100)}%\`;

                        try {
                            const base64Data = await urlToBase64(originalUrl);
                            if (base64Data) {
                                // Post to Google Apps Script
                                const gasRes = await fetch(GOOGLE_SCRIPT_URL, {
                                    method: 'POST',
                                    headers: { "Content-Type": "text/plain" },
                                    body: JSON.stringify({
                                        action: 'uploadImage',
                                        data: base64Data,
                                        name: \`Photo_\${i+1}.jpg\`,
                                        address: data.address
                                    })
                                });
                                const gasJson = await gasRes.json();
                                if (gasJson.url) {
                                    driveUrls.push(gasJson.url);
                                }
                            }
                        } catch (err) {
                            console.error("Photo upload error", err);
                        }
                    }
                    progressFill.style.width = '100%';
                }
                
                // FINAL UPDATE with Drive URLs
                if (driveUrls.length > 0) {
                    status.textContent = "Linking photos to property...";
                    await fetch(\`\${SUPABASE_URL}/rest/v1/Deals?id=eq.\${data.id}\`, {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': 'Bearer ' + SUPABASE_KEY,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            photos: driveUrls,
                            picturesFolderId: "" // Script doesn't return ID directly in uploadImage but getFolderUrl action does. For now just links.
                        })
                    });
                }

                status.textContent = "Success! Property & Photos added.";
                status.style.color = "#4ade80";
                
                // Cleanup
                setTimeout(() => {
                    status.textContent = "";
                    progressBar.style.display = 'none';
                    progressFill.style.width = '0%';
                }, 5000);

            } else {
                const err = await res.text();
                status.textContent = "DB Error: " + err;
                status.style.color = "#f87171";
            }
        } catch (e) {
            status.textContent = "Error saving: " + e.message;
            status.style.color = "#f87171";
        } finally {
            scrapeBtn.disabled = false;
        }
    });
}

// THIS FUNCTION RUNS IN THE BROWSER CONTEXT
function scrapeZillowData() {
    try {
        const getText = (selector) => document.querySelector(selector)?.innerText?.trim() || "";
        
        // --- 1. JSON-LD EXTRACTION ---
        let jsonLdData = {};
        try {
            const jsonScript = document.querySelector('script[type="application/ld+json"]');
            if (jsonScript) {
                const parsed = JSON.parse(jsonScript.innerText);
                const entry = Array.isArray(parsed) ? parsed[0] : parsed;
                if (entry) jsonLdData = entry;
            }
        } catch (e) { console.log('JSON-LD parse error'); }

        // --- 2. DOM HELPERS ---
        const getPrice = () => {
            const priceEl = document.querySelector('[data-testid="price"] span');
            if(priceEl) return Number(priceEl.innerText.replace(/[^0-9.]/g, ''));
            if (jsonLdData.offers && jsonLdData.offers.price) return Number(jsonLdData.offers.price);
            const summaryPrice = document.querySelector('.summary-container [data-testid="price"]');
            if (summaryPrice) return Number(summaryPrice.innerText.replace(/[^0-9.]/g, ''));
            return 0;
        };

        // --- 3. DATA MINING ---

        // Address
        let fullAddr = jsonLdData.name || getText('h1');
        if (!fullAddr && jsonLdData.address) {
             const a = jsonLdData.address;
             fullAddr = \`\${a.streetAddress}, \${a.addressLocality}, \${a.addressRegion} \${a.postalCode}\`;
        }
        let city = "";
        if (jsonLdData.address) {
             city = jsonLdData.address.addressLocality || "";
        } else {
            const parts = fullAddr.split(',');
            if (parts.length >= 2) city = parts[parts.length - 2].trim();
        }

        // Stats
        let beds = jsonLdData.numberOfRooms || 0;
        let baths = jsonLdData.numberOfBathroomsTotal || jsonLdData.numberOfBathrooms || 0;
        let sqft = jsonLdData.floorSize?.value || 0;

        if (!beds || !baths || !sqft) {
             const statsText = document.body.innerText;
             if (!beds) {
                 const bedsMatch = statsText.match(/(\\d+)\\s+bd/);
                 if (bedsMatch) beds = Number(bedsMatch[1]);
             }
             if (!baths) {
                 const bathsMatch = statsText.match(/(\\d+)\\s+ba/);
                 if (bathsMatch) baths = Number(bathsMatch[1]);
             }
             if (!sqft) {
                 const sqftMatch = statsText.match(/([\\d,]+)\\s+sqft/);
                 if (sqftMatch) sqft = Number(sqftMatch[1].replace(/,/g, ''));
             }
        }

        // Year Built
        let yearBuilt = 0;
        if (jsonLdData.yearBuilt) yearBuilt = Number(jsonLdData.yearBuilt);
        if (!yearBuilt) {
            const facts = Array.from(document.querySelectorAll('span, li, div'));
            const yearFact = facts.find(el => el.innerText && /Year built[:\\s]*(\\d{4})/.test(el.innerText));
            if (yearFact) {
                const match = yearFact.innerText.match(/Year built[:\\s]*(\\d{4})/);
                if (match) yearBuilt = Number(match[1]);
            }
        }

        // --- CALCULATION LOGIC ---
        
        // Date Listed (from Days on Zillow)
        let dateListed = new Date().toISOString().split('T')[0]; // Default to today
        const daysOnZillowMatch = document.body.innerText.match(/(\\d+)\\s+days? on Zillow/i);
        if (daysOnZillowMatch) {
            const days = parseInt(daysOnZillowMatch[1], 10);
            const d = new Date();
            d.setDate(d.getDate() - days);
            dateListed = d.toISOString().split('T')[0];
        }

        // Helper for text facts
        const getFactByText = (regex) => {
            const allElements = Array.from(document.querySelectorAll('dt, dd, li, span, div'));
            for (const el of allElements) {
                if (el.innerText && regex.test(el.innerText)) {
                    if (el.nextElementSibling && !regex.test(el.nextElementSibling.innerText)) {
                         return el.nextElementSibling.innerText;
                    }
                    return el.innerText;
                }
            }
            return "";
        };

        // Lot Size
        let lotSqft = 0;
        // 1. Try "0.38 Acres Lot" pattern from summary bar
        const acreLotMatch = document.body.innerText.match(/([\\d,.]+)\\s+Acres?\\s+Lot/i);
        if (acreLotMatch) {
             const val = parseFloat(acreLotMatch[1].replace(/,/g,''));
             if (!isNaN(val)) lotSqft = Math.round(val * 43560);
        }

        // 2. Fallback to Fact scraping
        if (!lotSqft) {
            const lotSizeRaw = getFactByText(/Lot size:/i); 
            if (lotSizeRaw) {
                 if (lotSizeRaw.toLowerCase().includes('acre')) {
                     lotSqft = Math.round(Number(lotSizeRaw.replace(/[^0-9.]/g, '')) * 43560);
                 } else {
                     lotSqft = Number(lotSizeRaw.replace(/[^0-9]/g, ''));
                 }
            }
        }

        // MLS
        let mls = "";
        const bodyText = document.body.innerText;
        const mlsMatch = bodyText.match(/MLS\\s*#?:?\\s*(\\d{6,10})/i);
        if (mlsMatch) mls = mlsMatch[1];

        // Type
        let type = "Single Family Residential";
        if (bodyText.includes("Multi-family")) type = "Multi-Family Residential";
        else if (bodyText.includes("Condo")) type = "Condo";
        else if (bodyText.includes("Townhouse")) type = "Townhouse";

        // --- AGENT INFO (TARGETED "Listing Provided By") ---
        let agentName = "";
        let agentPhone = "";
        let agentBrokerage = "";

        if (jsonLdData.offers && jsonLdData.offers.seller) {
            agentName = jsonLdData.offers.seller.name || "";
        }

        if (!agentName) {
            const attributionEls = Array.from(document.querySelectorAll('div, p, span, li')).filter(el => 
                el.innerText && el.innerText.includes("Listing Provided by") && el.innerText.length < 300
            );

            if (attributionEls.length > 0) {
                const rawText = attributionEls[attributionEls.length - 1].innerText;
                let cleanText = rawText.replace(/Listing Provided by:?/i, '').trim();
                
                const phoneMatch = cleanText.match(/(\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4})/);
                if (phoneMatch) {
                    agentPhone = phoneMatch[0];
                    cleanText = cleanText.replace(agentPhone, "|");
                }
                
                cleanText = cleanText.replace(/\\n/g, "|").replace(/,/g, "|");
                const parts = cleanText.split("|").map(s => s.trim()).filter(s => s && s.length > 1);
                
                if (parts.length > 0) agentName = parts[0];
                if (parts.length > 1) agentBrokerage = parts[1];
            }
        }
        
        // --- 4. SCRIPT SEARCH (Backup for Agent Info - based on 'attributionInfo') ---
        if (!agentName || agentName === "Unknown Agent") {
            const scripts = Array.from(document.getElementsByTagName('script'));
            for (const script of scripts) {
                const text = script.innerText;
                if (text.includes('attributionInfo')) {
                    // Regex to capture keys in escaped JSON or standard JSON
                    // Matches "agentName":"Name" or \"agentName\":\"Name\"
                    const nameRegex = /\\\\?"agentName\\\\?":\\s*\\\\?"([^"\\\\}]+)\\\\?"/;
                    const phoneRegex = /\\\\?"agentPhoneNumber\\\\?":\\s*\\\\?"([^"\\\\}]+)\\\\?"/;
                    const brokerRegex = /\\\\?"brokerName\\\\?":\\s*\\\\?"([^"\\\\}]+)\\\\?"/;

                    const nameMatch = text.match(nameRegex);
                    const phoneMatch = text.match(phoneRegex);
                    const brokerMatch = text.match(brokerRegex);

                    if (nameMatch && nameMatch[1] && nameMatch[1] !== 'null') agentName = nameMatch[1];
                    if (phoneMatch && phoneMatch[1] && phoneMatch[1] !== 'null') agentPhone = phoneMatch[1];
                    if (brokerMatch && brokerMatch[1] && brokerMatch[1] !== 'null') agentBrokerage = brokerMatch[1];
                    
                    if (agentName) break;
                }
            }
        }

        // --- PHOTOS (HI-RES GALLERY) ---
        const photos = [];
        const imgs = document.querySelectorAll('.media-stream img, ul[data-testid="media-stream"] li picture img, [data-testid="gallery-tile-image"] img');
        
        imgs.forEach(img => {
            if(photos.length < 20) {
                let src = img.src;
                if (!src) return;
                if (src.includes('placeholder')) return;
                if (src.includes('maps.googleapis')) return;
                if (src.toLowerCase().includes('logo')) return;
                if (src.includes('user-avatar')) return;

                src = src.replace(/p_[a-z](?=\.jpg|\.jpeg|\.png|\.webp)/, 'p_f');
                src = src.replace('cc_ft', 'uncropped_scaled_within_1536_1152'); 

                if (!photos.includes(src)) photos.push(src);
            }
        });
        
        const description = getText('[data-testid="description"]') || 
                            jsonLdData.description || 
                            document.querySelector('.ds-overview-section')?.innerText || "";

        return {
            address: fullAddr,
            subMarket: city,
            neighborhood: "",
            listingType: 'Listed On MLS',
            mls: mls,
            propertyType: type,
            yearBuilt: yearBuilt,
            bedrooms: beds,
            bathrooms: baths,
            sqft: sqft,
            lotSqft: lotSqft,
            dateListed: dateListed, // Uses calculated date
            county: "",
            listingDescription: description,
            agentName: agentName || "Unknown Agent",
            agentPhone: agentPhone,
            agentBrokerage: agentBrokerage || "Unknown Brokerage",
            listPrice: getPrice(),
            forSaleBy: 'Agent',
            photos: photos
        };
    } catch (e) {
        console.error("Scrape Error", e);
        return null;
    }
}
`;

    const contentJsCode = `// content.js - Empty placeholder as scraping logic is injected dynamically to ensure latest logic
// You can add persistent content scripts here if you want to modify the Zillow UI directly.
console.log("AZRE DealDesk Scraper Loaded");`;

    const getActiveCode = () => {
        switch(activeFile) {
            case 'manifest': return manifestCode;
            case 'popup_html': return popupHtmlCode;
            case 'popup_js': return popupJsCode;
            case 'content_js': return contentJsCode;
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(getActiveCode());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadZip = async () => {
        setIsZipping(true);
        try {
            const zip = new JSZip();
            zip.file("manifest.json", manifestCode);
            zip.file("popup.html", popupHtmlCode);
            zip.file("popup.js", popupJsCode);
            zip.file("content.js", contentJsCode);

            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath();
                ctx.rect(0, 0, 128, 128);
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('AZRE', 64, 64);
            }
            const iconBlob = await new Promise<Blob | null>(r => canvas.toBlob(r));
            if (iconBlob) zip.file("icon.png", iconBlob);

            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement("a");
            a.href = url;
            a.download = "azre-scraper.zip";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to zip extension:", error);
            alert("Failed to create zip file.");
        } finally {
            setIsZipping(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Chrome className="text-blue-500" size={20} />
                        Zillow Scraper Extension
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl mt-1">
                        Create a custom Chrome Extension to instantly push Zillow listing data and photos directly into your DealDesk pipeline.
                    </p>
                </div>
                <button
                    onClick={handleDownloadZip}
                    disabled={isZipping}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isZipping ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    Download Extension (.zip)
                </button>
            </div>

            {/* Instruction Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
                <Info className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
                <div className="space-y-2">
                    <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300">How to Install</h4>
                    <ol className="text-xs text-blue-700 dark:text-blue-200 list-decimal pl-4 space-y-1">
                        <li>Download the .zip file and extract it to a folder named <b>azre-scraper</b>.</li>
                        <li>Open Chrome and go to <b>chrome://extensions</b>.</li>
                        <li>Enable <b>Developer mode</b> (top right toggle).</li>
                        <li>Click <b>Load unpacked</b> and select your folder.</li>
                        <li>Pin the extension, open a Zillow listing, login with your DealDesk account, and click Scrape!</li>
                    </ol>
                </div>
            </div>

            {/* Code Viewer */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden shadow-2xl flex flex-col h-[500px]">
                {/* File Tabs */}
                <div className="flex bg-gray-800 border-b border-gray-700 overflow-x-auto">
                    {[
                        { id: 'manifest', name: 'manifest.json', icon: <FileJson size={14}/> },
                        { id: 'popup_html', name: 'popup.html', icon: <Code size={14}/> },
                        { id: 'popup_js', name: 'popup.js', icon: <FileCode size={14}/> },
                        { id: 'content_js', name: 'content.js', icon: <FileCode size={14}/> },
                    ].map(file => (
                        <button
                            key={file.id}
                            onClick={() => { setActiveFile(file.id as any); setCopied(false); }}
                            className={`px-4 py-3 text-xs font-mono flex items-center gap-2 border-r border-gray-700 transition-colors ${
                                activeFile === file.id 
                                ? 'bg-gray-900 text-blue-400 border-b-2 border-b-blue-500' 
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-750'
                            }`}
                        >
                            {file.icon}
                            {file.name}
                        </button>
                    ))}
                    <div className="flex-1"></div>
                    <button 
                        onClick={handleCopy}
                        className="px-4 py-2 text-xs font-bold text-gray-300 hover:text-white hover:bg-gray-700 flex items-center gap-2 transition-colors"
                    >
                        {copied ? <CheckCircle size={14} className="text-green-500"/> : <Copy size={14}/>}
                        {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                </div>

                {/* Code Area */}
                <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-[#0f172a] relative">
                    <pre className="font-mono text-xs leading-relaxed text-blue-100/90 whitespace-pre-wrap">
                        <code>{getActiveCode()}</code>
                    </pre>
                </div>
            </div>
            
            <div className="flex justify-end">
                <button className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 underline" onClick={() => window.open('https://developer.chrome.com/docs/extensions/mv3/getstarted/', '_blank')}>
                    Read Chrome Extension Documentation
                </button>
            </div>
        </div>
    );
};
