const getPreviewUrl = (url) => {
    if (!url) return '';
    if (url.includes('drive.google.com/uc?')) {
        const idMatch = url.match(/id=([^&]+)/);
        if (idMatch) {
            return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
        }
    } else if (url.includes('drive.google.com/file/d/')) {
        return url.replace(/\/view.*$/, '/preview');
    }
    
    if (url.includes('/preview')) return url;

    return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
};

console.log(getPreviewUrl('https://drive.google.com/uc?export=download&id=1t3l_VnU0P8N-f8U7-nC5f9L1c_B4w8W1'));
console.log(getPreviewUrl('https://drive.google.com/file/d/1t3l_VnU0P8N-f8U7-nC5f9L1c_B4w8W1/view?usp=drivesdk'));
