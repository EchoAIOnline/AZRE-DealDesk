
import { GOOGLE_SCRIPT_URL, GOOGLE_MAPS_API_KEY } from '../constants';
import { useUploadStore } from '../store/useUploadStore';

// --- HELPER FUNCTIONS ---

export const timeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
};

export const generateId = () => {
    // Prefer native UUID if available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback valid UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const calculateDaysRemaining = (targetDate: string | null) => {
  if (!targetDate) return null;
  const parts = targetDate.split('-');
  if (parts.length !== 3) return null;
  
  const target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const formatCurrency = (amount: number | undefined | null) => {
  if (amount === undefined || amount === null) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
};

export const formatNumberWithCommas = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const parseNumberFromCurrency = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    const cleanStr = String(value).replace(/,/g, '').replace('$', '');
    return parseFloat(cleanStr) || 0;
};

export const formatPhoneNumber = (value: string | number | null | undefined) => {
  if (!value) return '';
  const strValue = String(value);
  const phoneNumber = strValue.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export const getLogTimestamp = () => {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false, timeZone: 'America/New_York' });
  return `${date} ${time}`;
};

export const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!apiKey) {
      reject(new Error("No API key provided"));
      return;
    }
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      if ((window as any).google && (window as any).google.maps) {
        resolve();
      } else {
        // Script exists but google.maps might not be ready yet.
        // In a real scenario, we might want to attach a listener or poll,
        // but for now assuming if script tag exists, it's loading or loaded.
        // We can attach a load listener to the existing script if it's not loaded.
        const script = document.querySelector('script[src*="maps.googleapis.com"]') as HTMLScriptElement;
        if (script) {
            script.addEventListener('load', () => resolve());
            script.addEventListener('error', (e) => reject(e));
        } else {
            resolve();
        }
      }
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
};

export const processPhotoUrl = (url: string) => {
    if (!url) return '';
    try {
        if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
            let id = '';
            const idMatch = url.match(/id=([^&]+)/);
            if (idMatch) id = idMatch[1];
            else {
                const dMatch = url.match(/\/d\/([^/?]+)/);
                if (dMatch) id = dMatch[1];
            }
            if (id) return `https://lh3.googleusercontent.com/d/${id}`;
        }
    } catch (e) {}
    return url;
};

export const normalizeAddressForSearch = (address: string | null | undefined): string => {
    if (!address) return '';
    
    // 1. Lowercase
    let norm = String(address).toLowerCase();
    
    // 2. Remove all periods (e.g. "St." -> "St")
    norm = norm.replace(/\./g, '');
    
    // 3. Normalize whitespace to single space
    norm = norm.replace(/\s+/g, ' ').trim();

    // 4. Expand common street suffixes using strict word boundaries
    const replacements: [RegExp, string][] = [
        [/\bdr\b/g, 'drive'],
        [/\bst\b/g, 'street'],
        [/\brd\b/g, 'road'],
        [/\bave\b/g, 'avenue'],
        [/\bln\b/g, 'lane'],
        [/\bblvd\b/g, 'boulevard'],
        [/\bct\b/g, 'court'],
        [/\bcir\b/g, 'circle'],
        [/\bpl\b/g, 'place'],
        [/\bter\b/g, 'terrace'],
        [/\bpkwy\b/g, 'parkway'],
        [/\bhwy\b/g, 'highway'],
        [/\bste\b/g, 'suite'],
        [/\bapt\b/g, 'apartment'],
        // Directions
        [/\bn\b/g, 'north'],
        [/\bs\b/g, 'south'],
        [/\be\b/g, 'east'],
        [/\bw\b/g, 'west'],
        [/\bne\b/g, 'northeast'],
        [/\bnw\b/g, 'northwest'],
        [/\bse\b/g, 'southeast'],
        [/\bsw\b/g, 'southwest']
    ];

    replacements.forEach(([regex, repl]) => {
        norm = norm.replace(regex, repl);
    });

    return norm;
};

// --- DATA FETCHING (GAMLS ONLY) ---

export const fetchAgentPhotoFromGAMLS = async (name: string, phone: string): Promise<string | null> => {
    if (GOOGLE_SCRIPT_URL) {
        try {
            const url = new URL(GOOGLE_SCRIPT_URL);
            url.searchParams.append("action", "findAgentPhoto");
            url.searchParams.append("name", name);
            if(phone) url.searchParams.append("phone", phone);
            url.searchParams.append("_t", new Date().getTime().toString());
            const response = await fetch(url.toString());
            if (response.ok) {
                const data = await response.json();
                if (data.error && data.error.includes("permission to call UrlFetchApp")) throw new Error("PERMISSION_NEEDED");
                if (data && data.photoUrl) return data.photoUrl;
            }
        } catch (error: any) {
            if (error.message === "PERMISSION_NEEDED") throw error;
        }
    }
    return null;
};

export const fetchAgentDetailsFromGAMLS = async (name: string): Promise<any | null> => {
    if (GOOGLE_SCRIPT_URL) {
        try {
            const url = new URL(GOOGLE_SCRIPT_URL);
            url.searchParams.append("action", "findAgentDetails"); 
            url.searchParams.append("name", name);
            url.searchParams.append("_t", new Date().getTime().toString());
            const response = await fetch(url.toString());
            if (response.ok) {
                const data = await response.json();
                if (data.error && data.error.includes("permission to call UrlFetchApp")) throw new Error("PERMISSION_NEEDED");
                return data;
            }
        } catch (error: any) {
            if (error.message === "PERMISSION_NEEDED") throw error;
        }
    }
    return null;
};

// --- SERVER FUNCTIONS ---

export const serverFunctions = {
  findAgentDetails: (name: string) => fetchAgentDetailsFromGAMLS(name),

  saveStreetViewToDrive: (dealId: string, address: string, apiKey: string): Promise<any> => {
    const url = `${GOOGLE_SCRIPT_URL}?action=saveStreetViewToDrive&dealId=${encodeURIComponent(dealId)}&address=${encodeURIComponent(address)}&key=${encodeURIComponent(apiKey)}`;
    return fetch(url)
      .then(res => res.json())
      .catch(err => {
        console.error("Utils Error:", err);
        return { error: err.toString() };
      });
  },

  uploadImage: (file: File, address: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const uploadId = generateId();
      useUploadStore.getState().addUpload({ id: uploadId, name: file.name, status: 'uploading' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'uploadImage',
            data: base64Data,
            name: file.name,
            address: address
          })
        })
        .then(res => res.json())
        .then(res => {
          if (res.error || res.message) {
            useUploadStore.getState().updateUpload(uploadId, { status: 'error', error: res.error || res.message });
          } else {
            useUploadStore.getState().updateUpload(uploadId, { status: 'success', url: res.url });
          }
          resolve(res);
        })
        .catch(err => {
          useUploadStore.getState().updateUpload(uploadId, { status: 'error', error: err.message });
          reject(err);
        });
      };
      reader.readAsDataURL(file);
    });
  },

  uploadDocument: (file: File, address: string, docCategory: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const uploadId = generateId();
      useUploadStore.getState().addUpload({ id: uploadId, name: file.name, status: 'uploading' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'uploadDocument',
            data: base64Data,
            name: file.name,
            mimeType: file.type,
            address: address,
            docCategory: docCategory
          })
        })
        .then(res => res.json())
        .then(res => {
          if (res.error || (res.message && res.message !== 'DealDesk Utility Service')) {
            useUploadStore.getState().updateUpload(uploadId, { status: 'error', error: res.error || res.message });
          } else {
            useUploadStore.getState().updateUpload(uploadId, { status: 'success', url: res.url });
          }
          resolve(res);
        })
        .catch(err => {
          useUploadStore.getState().updateUpload(uploadId, { status: 'error', error: err.message });
          reject(err);
        });
      };
      reader.readAsDataURL(file);
    });
  },

  uploadBuyerImage: (file: File, buyerName: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const uploadId = generateId();
      useUploadStore.getState().addUpload({ id: uploadId, name: file.name, status: 'uploading' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'uploadBuyerImage',
            data: base64Data,
            name: file.name,
            buyerName: buyerName
          })
        })
        .then(res => res.json())
        .then(res => {
          if (res.error || res.message) {
            useUploadStore.getState().updateUpload(uploadId, { status: 'error', error: res.error || res.message });
          } else {
            useUploadStore.getState().updateUpload(uploadId, { status: 'success', url: res.url });
          }
          resolve(res);
        })
        .catch(err => {
          useUploadStore.getState().updateUpload(uploadId, { status: 'error', error: err.message });
          reject(err);
        });
      };
      reader.readAsDataURL(file);
    });
  },

  uploadDashboardAsset: (base64Data: string, name: string): Promise<any> => {
    const uploadId = generateId();
    useUploadStore.getState().addUpload({ id: uploadId, name: name, status: 'uploading' });
    return fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'uploadImage',
        data: base64Data,
        name: name,
        address: 'DASHBOARD_ASSETS'
      })
    })
    .then(res => res.json())
    .then(res => {
      if (res.error || res.message) {
        useUploadStore.getState().updateUpload(uploadId, { status: 'error', error: res.error || res.message });
      } else {
        useUploadStore.getState().updateUpload(uploadId, { status: 'success', url: res.url });
      }
      return res;
    })
    .catch(err => {
      useUploadStore.getState().updateUpload(uploadId, { status: 'error', error: err.message });
      throw err;
    });
  },

  getFolderUrl: (address: string): Promise<{ url?: string, folderId?: string, error?: string }> => {
    const url = `${GOOGLE_SCRIPT_URL}?action=getFolderUrl&address=${encodeURIComponent(address)}`;
    return fetch(url).then(res => res.json()).catch(err => ({ error: err.toString() }));
  }
};

export const captureStreetViewAsBase64 = async (address: string, apiKey?: string): Promise<string | null> => {
    return null;
};
