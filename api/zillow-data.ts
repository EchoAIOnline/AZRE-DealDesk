export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ status: 'error', message: 'URL is required' });
    }

    const apiKey = process.env.BRIGHTDATA_API_KEY || "008b1060-0915-4386-b2d1-b84270cbd5b9";
    const collectorId = process.env.BRIGHTDATA_COLLECTOR_ID || "gd_lfqkr8wm13ixtbd8f5";

    if (!collectorId) {
      return res.status(400).json({ 
          status: 'error', 
          message: 'To use this feature, please create a Zillow Web Scraper in BrightData, and add your Collector ID to the BRIGHTDATA_COLLECTOR_ID environment variable in .env' 
      });
    }

    const isDataset = collectorId.startsWith('gd_');
    let endpoint = `https://api.brightdata.com/dca/trigger?collector=${collectorId}&sync=true`;
    let payload: any = [{ url }];
    
    if (isDataset) {
        endpoint = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${collectorId}&include_errors=true&discover_new=true`;
        payload = { input: [{ url }], limit_per_input: null };
    }

    // Trigger BrightData scraper synchronously
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    let result;
    const textResponse = await response.text();
    try {
        result = JSON.parse(textResponse);
    } catch (err) {
        return res.status(response.status).json({ 
            status: 'error', 
            message: `BrightData API Error: ${textResponse}` 
        });
    }
    
    if (!response.ok) {
       return res.status(response.status).json({ status: 'error', message: result.error || result.message || 'Failed to scrape Zillow via BrightData' });
    }

    let parsedData = Array.isArray(result) ? result : (result.data || [result]);
    
    parsedData = parsedData.map((item: any) => {
        if (item.address && typeof item.address === 'object') {
            const a = item.address;
            item.address = `${a.streetAddress || ''}, ${a.city || ''}, ${a.state || ''} ${a.zipcode || ''}`.replace(/^, /, '').trim();
        }

        // Extract photos
        if (Array.isArray(item.photos)) {
            item.mappedPhotos = item.photos.map((p: any) => {
                if (p.mixedSources && p.mixedSources.jpeg && p.mixedSources.jpeg.length > 0) {
                    return p.mixedSources.jpeg[p.mixedSources.jpeg.length - 1].url;
                }
                return null;
            }).filter((url: any) => url);
        }

        // Extract Agent info
        const attr = item.attributionInfo || {};
        const provided = item.listing_provided_by || {};
        item.mappedAgentName = attr.agentName || provided.name || null;
        item.mappedAgentPhone = attr.agentPhoneNumber || provided.phone || null;
        item.mappedAgentBrokerage = attr.brokerName || provided.brokerage || null;
        item.mappedAgentBrokerPhone = attr.brokerPhoneNumber || provided.brokerPhoneNumber || null;

        // MLS & Listing Type
        item.mappedMlsNumber = attr.mlsId || item.mls_id || null;
        if (item.mappedMlsNumber) {
            item.mappedListingType = 'Listed On MLS';
        } else {
            item.mappedListingType = 'Off-Market';
        }

        // Days on Zillow -> Date Listed
        if (typeof item.daysOnZillow === 'number') {
            const dateListed = new Date();
            dateListed.setDate(dateListed.getDate() - item.daysOnZillow);
            item.mappedDateListed = dateListed.toISOString().split('T')[0];
        }

        // Extract Comps
        if (Array.isArray(item.homeValuation) && item.homeValuation.length > 0) {
            try {
                const hv = typeof item.homeValuation[0] === 'string' ? JSON.parse(item.homeValuation[0]) : item.homeValuation[0];
                if (hv && hv.comparables && Array.isArray(hv.comparables.comps)) {
                    const comps = hv.comparables.comps;
                    const soldComps = comps.filter((c: any) => c.property && c.property.homeStatus === 'RECENTLY_SOLD');
                    soldComps.sort((a: any, b: any) => (b.property.dateSold || 0) - (a.property.dateSold || 0));
                    
                    item.mappedComps = soldComps.map((c: any) => {
                        const p = c.property;
                        let compAddress = 'Unknown Address';
                        if (p.address) {
                             compAddress = `${p.address.streetAddress || ''}, ${p.address.city || ''}, ${p.address.state || ''} ${p.address.zipcode || ''}`.replace(/^, /, '').trim();
                        }
                        return {
                            address: compAddress,
                            price: p.price,
                            dateSold: p.dateSold ? new Date(p.dateSold).toISOString().split('T')[0] : null,
                            livingArea: p.livingArea,
                            bedrooms: p.bedrooms,
                            bathrooms: p.bathrooms,
                            distance: c.distance
                        };
                    });
                }
            } catch (e) {
                console.warn("Failed to parse homeValuation:", e);
            }
        }

        return item;
    });

    res.json({ status: 'success', data: parsedData });

  } catch (error: any) {
    console.error("BrightData scraping error:", error);
    res.status(500).json({ status: 'error', message: error.message || 'Internal server error' });
  }
}
