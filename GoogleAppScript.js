// ==========================================
//      DEALDESK UTILITY SERVICE (ROUTER)
// ==========================================

// --- CONFIGURATION ---
// Credentials are now securely fetched from PropertiesService
// (Managed via the Settings -> Email UI in the app)

// --- FOLDER IDs (Target specific folders to avoid dupes/trash issues) ---
const FOLDER_ID_DEALS = '1V1mKzWRZYuUlJia82wjGD0EUZIaU841U';
const FOLDER_ID_BUYERS = '1dZNYp864vAz1qQTOC1NGgZfIHkMm9q_A';
const FOLDER_ID_AGENTS = '1Ypv9PgjM_U140KBjcJMDEposOkbWC4Mu';
const FOLDER_ID_WHOLESALERS = '1McVTQejCVORIVolp7DNgKaDEYWyvf_Rt';
const FOLDER_ID_USERS = '1JlV4miu84o3DqPSYC2AJ3FIEYcdlsh4n';

// --- ENTRY POINTS ---
function doGet(e) {
  var params = e.parameter || {};
  
  // 1. FILE SYSTEM (Images & Documents)
  if (params.action === 'uploadImage') return uploadImageToDrive(params.data, params.name, params.address);
  if (params.action === 'uploadBuyerImage') return uploadBuyerImageToDrive(params.data, params.name, params.buyerName);
  if (params.action === 'uploadDocument') return uploadDocumentToDrive(params.data, params.name, params.address, params.docCategory);
  
  // Returns URL only (App must save to Supabase)
  if (params.action === 'saveStreetViewToDrive') return saveStreetViewToDrive(params.dealId, params.address, params.key);
  if (params.action === 'getFolderUrl') return getFolderUrl(params.address);

  // 2. SCRAPERS
  if (params.action === 'findAgentPhoto') return handleAgentPhotoSearch(params.name, params.phone);
  if (params.action === 'findAgentDetails') return findAgentDetails(params.name);

  // 3. EMAIL & CONFIG (Calls functions in SES_Email_Services.gs)
  if (params.action === 'get_aws_config') return response(getAwsConfig());
  if (params.action === 'get_templates') return response(getTemplates());

  return response({ status: 'active', message: 'DealDesk Utility Service' });
}

function doPost(e) {
  var params = e.parameter || {};
  
  if (e.postData && e.postData.contents) {
    try {
      var payload = JSON.parse(e.postData.contents);
      
      // --- AI TABLE CREATOR (Supabase Admin) ---
      if (payload.action === 'run_admin_sql') {
        return executeSupabaseSql(payload.query);
      }

      // --- UTILITIES ---
      if (payload.action === 'uploadImage') return uploadImageToDrive(payload.data, payload.name, payload.address);
      if (payload.action === 'uploadDocument') return uploadDocumentToDrive(payload.data, payload.name, payload.address, payload.docCategory);
      if (payload.action === 'uploadBuyerImage') return uploadBuyerImageToDrive(payload.data, payload.name, payload.buyerName);
      if (payload.action === 'getFolderUrl') return getFolderUrl(payload.address);
      if (payload.action === 'deleteImage') return deleteImage(payload.fileId);
      
      // --- EMAIL & AWS (Calls functions in SES_Email_Services.gs) ---
      if (payload.action === 'send_bulk_email') return response(processBulkEmail(payload.data));
      if (payload.action === 'save_aws_config') return response(saveAwsConfig(payload.data));
      if (payload.action === 'get_aws_config') return response(getAwsConfig());
      if (payload.action === 'get_templates') return response(getTemplates());
      if (payload.action === 'test_aws_handshake') return response(testAwsHandshake());
      if (payload.action === 'save_template') return response(saveTemplate(payload.data));
      if (payload.action === 'delete_template') return response(deleteTemplate(payload.data.id));

    } catch(err) {
      return response({ status: 'error', message: 'Router error: ' + err.toString() });
    }
  }
  return response({ status: 'active', message: 'DealDesk Utility Service' });
}

// ==========================================
//          1. FILE & DOCUMENT HANDLERS
// ==========================================

function saveStreetViewToDrive(dealId, address, apiKey) {
  if (!dealId || !address || !apiKey) return response({ error: "Missing required fields" });
  try {
    var url = "https://maps.googleapis.com/maps/api/streetview?size=640x300&location=" + encodeURIComponent(address) + "&fov=70&key=" + apiKey;
    var imageBlob = UrlFetchApp.fetch(url).getBlob().setName("StreetView_Main.jpg");
    
    var folders = getDealFolders(address);
    var file = folders.picturesFolder.createFile(imageBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var displayUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();

    // RETURN URL ONLY (App saves to DB)
    return response({ status: 'success', url: displayUrl });
  } catch (e) { return response({ error: e.toString() }); }
}

function uploadImageToDrive(base64Data, fileName, address) {
  try {
    if (!base64Data || !address) return response({ error: "Missing data" });
    var cleanBase64 = base64Data.split(',').pop();
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, MimeType.JPEG, fileName || "upload.jpg");
    var folders = getDealFolders(address);
    var file = folders.picturesFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return response({ url: "https://drive.google.com/uc?export=view&id=" + file.getId() });
  } catch (e) { return response({ error: "Upload failed: " + e.toString() }); }
}


function uploadBuyerImageToDrive(base64Data, fileName, buyerName) {
  try {
    if (!base64Data || !buyerName) return response({ error: "Missing data" });
    var cleanBase64 = base64Data.split(',').pop();
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, MimeType.JPEG, fileName || "buyer_photo.jpg");
    var folders = getBuyerFolders(buyerName);
    var file = folders.picturesFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return response({ url: "https://drive.google.com/uc?export=view&id=" + file.getId() });
  } catch (e) { return response({ error: "Buyer upload failed: " + e.toString() }); }
}

function uploadDocumentToDrive(base64Data, fileName, address, docCategory) {
  try {
    if (!base64Data || !address || !docCategory) return response({ error: "Missing data" });
    var cleanBase64 = base64Data.split(',').pop();
    var decoded = Utilities.base64Decode(cleanBase64);
    
    // Attempt to guess MimeType based on file extension
    var mimeType = MimeType.PDF;
    if (fileName) {
      const lowerName = fileName.toLowerCase();
      if (lowerName.endsWith('.png')) mimeType = MimeType.PNG;
      else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = MimeType.JPEG;
      else if (lowerName.endsWith('.doc') || lowerName.endsWith('.docx')) mimeType = MimeType.MICROSOFT_WORD;
    }
    
    var blob = Utilities.newBlob(decoded, mimeType, fileName || "document.pdf");
    var folders = getDealFolders(address);
    var targetFolder = folders.docSubFolders[docCategory] || folders.documentsFolder;
    
    var file = targetFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return response({ url: "https://drive.google.com/uc?export=view&id=" + file.getId() });
  } catch (e) { return response({ error: "Upload failed: " + e.toString() }); }
}

function deleteImage(fileId) {
  try {
    if (!fileId) return response({ error: "Missing file ID" });
    var file = DriveApp.getFileById(fileId);
    file.setTrashed(true);
    return response({ status: 'success', message: 'File moved to trash' });
  } catch (e) {
    return response({ error: "Delete failed: " + e.toString() });
  }
}

// --- FOLDER HELPERS (ID BASED) ---
function getDealFolders(address) {
  if (!address) throw new Error("Address is required.");
  
  // USE ID to target specific "DealDesk_Deals" folder
  const root = DriveApp.getFolderById(FOLDER_ID_DEALS);
  
  const dealFolders = root.getFoldersByName(address);
  const dealFolder = dealFolders.hasNext() ? dealFolders.next() : root.createFolder(address);
  
  const subs = ["Buyer", "Seller", "Pictures", "Documents"];
  let picturesFolder = null;
  let documentsFolder = null;
  subs.forEach(sub => {
    const subIter = dealFolder.getFoldersByName(sub);
    const subFolder = subIter.hasNext() ? subIter.next() : dealFolder.createFolder(sub);
    if (sub === "Pictures") picturesFolder = subFolder;
    if (sub === "Documents") documentsFolder = subFolder;
  });

  // Create document subfolders
  const docSubs = ["A-B Purchase Contract", "B-C Purchase Contract", "Other Documents"];
  let docSubFolders = {};
  if (documentsFolder) {
    docSubs.forEach(dsub => {
       const dSubIter = documentsFolder.getFoldersByName(dsub);
       const dSubFolder = dSubIter.hasNext() ? dSubIter.next() : documentsFolder.createFolder(dsub);
       docSubFolders[dsub] = dSubFolder;
    });
  }

  return { dealFolder, picturesFolder, documentsFolder, docSubFolders };
}

function getBuyerFolders(buyerName) {
  if (!buyerName) throw new Error("Buyer name is required.");
  
  // USE ID to target specific "DealDesk_Buyers" folder
  const root = DriveApp.getFolderById(FOLDER_ID_BUYERS);
  
  const buyerFolders = root.getFoldersByName(buyerName);
  const buyerFolder = buyerFolders.hasNext() ? buyerFolders.next() : root.createFolder(buyerName);
  
  const picIter = buyerFolder.getFoldersByName("Pictures");
  const picturesFolder = picIter.hasNext() ? picIter.next() : buyerFolder.createFolder("Pictures");
  return { buyerFolder, picturesFolder };
}

function getFolderUrl(address) {
  try { return response({ url: getDealFolders(address).picturesFolder.getUrl() }); } 
  catch (e) { return response({ error: e.toString() }); }
}

// ==========================================
//          2. AGENT SCRAPERS
// ==========================================

function handleAgentPhotoSearch(name, phone) {
  if (!name) return response({ error: "No name provided" });
  try {
    var parts = name.trim().split(" ");
    var first = parts[0];
    var last = parts.length > 1 ? parts[parts.length - 1] : "";
    var searchUrl = "https://www.georgiamls.com/real-estate-agents/?firstName=" + encodeURIComponent(first) + "&lastName=" + encodeURIComponent(last);
    var searchHtml = UrlFetchApp.fetch(searchUrl, {muteHttpExceptions: true}).getContentText();
    var profileLinkMatch = searchHtml.match(/href=["'](\/real-estate-agents\/[A-Z0-9]+)["']/);
    if (profileLinkMatch && profileLinkMatch[1]) {
        var profileUrl = "https://www.georgiamls.com" + profileLinkMatch[1];
        var profileHtml = UrlFetchApp.fetch(profileUrl, {muteHttpExceptions: true}).getContentText();
        var imageMatch = profileHtml.match(/src=["'](https:\/\/media\.georgiamls\.com\/images\/agents\/[^"']+\.(?:jpg|jpeg|png))["']/i);
        if (imageMatch && imageMatch[1]) return response({ photoUrl: imageMatch[1], status: 'found', method: 'profile_deep_scan' });
    }
    var fallbackMatch = searchHtml.match(/src=["'](https:\/\/media\.georgiamls\.com\/images\/agents\/[^"']+\.(?:jpg|jpeg|png))["']/i);
    if (fallbackMatch && fallbackMatch[1]) return response({ photoUrl: fallbackMatch[1], status: 'found', method: 'search_fallback' });
    return response({ status: 'not_found' });
  } catch (err) { return response({ error: err.toString(), photoUrl: null }); }
}

function findAgentDetails(name) {
  if (!name) return response({ error: "No name provided" });
  var result = {};
  try {
    var parts = name.trim().split(" ");
    var first = parts[0];
    var last = parts.length > 1 ? parts[parts.length - 1] : "";
    var searchUrl = "https://www.georgiamls.com/real-estate-agents/?firstName=" + encodeURIComponent(first) + "&lastName=" + encodeURIComponent(last);
    var searchHtml = UrlFetchApp.fetch(searchUrl, {muteHttpExceptions: true}).getContentText();
    var profileLinkMatch = searchHtml.match(/href=["'](\/real-estate-agents\/[A-Z0-9]+)["']/);
    if (profileLinkMatch && profileLinkMatch[1]) {
        var profileUrl = "https://www.georgiamls.com" + profileLinkMatch[1];
        var profileHtml = UrlFetchApp.fetch(profileUrl, {muteHttpExceptions: true}).getContentText();
        var cleanText = function(text) { return text ? text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim() : ""; };
        
        var emailMatch = profileHtml.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
        if (emailMatch) result.email = emailMatch[1];
        var directMatch = profileHtml.match(/(?:Direct|Cell):?[\s\S]*?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i);
        if (directMatch) result.phone = directMatch[1];
        var officeMatch = profileHtml.match(/(?:Office|Phone):?[\s\S]*?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/i);
        if (officeMatch) result.brokeragePhone = officeMatch[1];
        var addressRegex = /(\d+[\w\s.,-]+(?:GA|Georgia)\s+\d{5})/i;
        var addrMatch = profileHtml.match(addressRegex);
        if (addrMatch) result.brokerageAddress = cleanText(addrMatch[1]);
        var imageMatch = profileHtml.match(/src=["'](https:\/\/media\.georgiamls\.com\/images\/agents\/[^"']+\.(?:jpg|jpeg|png))["']/i);
        if (imageMatch && imageMatch[1]) result.photoUrl = imageMatch[1];
        
        var officeRegex = /<a[^>]*href=["']\/real-estate-offices\/[^"']+["'][^>]*>([^<]+)<\/a>/g;
        var officeMatchName;
        while ((officeMatchName = officeRegex.exec(profileHtml)) !== null) {
            var candidate = cleanText(officeMatchName[1]);
            if (candidate && candidate.indexOf("Directory") === -1 && candidate !== "Real Estate Agents") { result.brokerage = candidate; break; }
        }
    }
    return response(result);
  } catch (e) { return response({ error: e.toString() }); }
}

// ==========================================
//          3. SUPABASE & AI HELPERS
// ==========================================

function executeSupabaseSql(sqlQuery) {
  const props = PropertiesService.getScriptProperties();
  const supabaseUrl = props.getProperty('SUPABASE_URL');
  const supabaseKey = props.getProperty('SUPABASE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    return response({ status: 'error', message: 'Supabase credentials missing from script properties.' });
  }

  const url = `${supabaseUrl}/rest/v1/rpc/exec_sql`;
  const options = {
    method: 'post',
    headers: { 'apikey': supabaseKey, 'Authorization': 'Bearer ' + supabaseKey, 'Content-Type': 'application/json' },
    payload: JSON.stringify({ "sql_query": sqlQuery }),
    muteHttpExceptions: true
  };
  const resp = UrlFetchApp.fetch(url, options);
  return response({ status: 'success', data: JSON.parse(resp.getContentText()) });
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
